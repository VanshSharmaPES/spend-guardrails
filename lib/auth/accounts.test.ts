import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase } from '../db/schema';
import { authenticate, createAccount, SignUpError } from './accounts';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

describe('accounts', () => {
  it('creates a requester that can sign in, ignoring email case', () => {
    const account = { email: 'new.user@example.com', role: 'requester' };
    expect(createAccount(db, ' New.User@Example.com ', 'long-password')).toEqual(account);
    expect(authenticate(db, 'NEW.USER@example.com', 'long-password')).toEqual(account);
  });

  it.each([
    ["' OR '1'='1", "' OR '1'='1"],
    ["approver@demo' --", 'anything'],
    ['approver@demo', "' OR 1=1 --"],
    ["a@example.com'; DROP TABLE accounts; --", 'long-password'],
  ])('refuses SQL injection attempts (%s / %s)', (email, password) => {
    createAccount(db, 'a@example.com', 'long-password');
    expect(authenticate(db, email, password)).toBeUndefined();
    expect(db.prepare('SELECT COUNT(*) AS n FROM accounts').get()).toEqual({ n: 1 });
  });

  it('stores a salted hash, never the password', () => {
    createAccount(db, 'a@example.com', 'long-password');
    const row = db.prepare('SELECT password_hash FROM accounts').get() as { password_hash: string };
    expect(row.password_hash).not.toContain('long-password');
  });

  it('rejects a wrong password', () => {
    createAccount(db, 'a@example.com', 'long-password');
    expect(authenticate(db, 'a@example.com', 'wrong-password')).toBeUndefined();
  });

  it('refuses duplicate emails, invalid emails and short passwords', () => {
    createAccount(db, 'a@example.com', 'long-password');
    expect(() => createAccount(db, 'A@example.com', 'long-password')).toThrow(SignUpError);
    expect(() => createAccount(db, 'not-an-email', 'long-password')).toThrow(SignUpError);
    expect(() => createAccount(db, 'b@example.com', 'short')).toThrow(SignUpError);
  });

  it('cannot hold an approver, even when written directly', () => {
    const insert = db.prepare("INSERT INTO accounts VALUES ('x@example.com', 'h', 'approver', 't')");
    expect(() => insert.run()).toThrow();
  });

  it('still signs in the demo accounts', () => {
    expect(authenticate(db, 'approver@demo', 'approver-demo')?.role).toBe('approver');
  });
});
