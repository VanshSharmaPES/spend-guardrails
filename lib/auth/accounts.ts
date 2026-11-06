import type Database from 'better-sqlite3';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { findUser } from './session';
import { DEMO_USERS, type Role } from './users';

export class SignUpError extends Error {}

export type Account = { email: string; role: Role };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const normalise = (email: string) => email.trim().toLowerCase();

function hash(password: string, salt = randomBytes(16).toString('base64url')): string {
  return `${salt}:${scryptSync(password, salt, 32).toString('base64url')}`;
}

function matches(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  const given = Buffer.from(hash(password, salt).split(':')[1]);
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Sign-up only ever creates requesters. Approvers are appointed, never self-registered,
// and the accounts table refuses any other role.
export function createAccount(
  db: Database.Database,
  email: string,
  password: string,
  now = new Date().toISOString(),
): Account {
  const address = normalise(email);
  if (!EMAIL.test(address)) throw new SignUpError('Enter a valid email address.');
  if (password.length < MIN_PASSWORD) throw new SignUpError(`Use at least ${MIN_PASSWORD} characters for the password.`);
  if (DEMO_USERS.some((user) => user.email === address) || db.prepare('SELECT 1 FROM accounts WHERE email = ?').get(address)) {
    throw new SignUpError('An account with this email already exists.');
  }
  db.prepare("INSERT INTO accounts (email, password_hash, role, created_at) VALUES (?, ?, 'requester', ?)").run(
    address,
    hash(password),
    now,
  );
  return { email: address, role: 'requester' };
}

export function authenticate(db: Database.Database, email: string, password: string): Account | undefined {
  const demo = findUser(email, password);
  if (demo) return { email: demo.email, role: demo.role };
  const row = db.prepare('SELECT email, password_hash, role FROM accounts WHERE email = ?').get(normalise(email)) as
    | { email: string; password_hash: string; role: Role }
    | undefined;
  return row && matches(password, row.password_hash) ? { email: row.email, role: row.role } : undefined;
}
