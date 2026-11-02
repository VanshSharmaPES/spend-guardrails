import { describe, expect, it } from 'vitest';
import { createToken, findUser, SESSION_TTL_MS, verifyToken } from './session';

describe('session tokens', () => {
  it('round-trips a signed session', () => {
    const session = verifyToken(createToken('approver@demo', 'approver', 1000), 2000);
    expect(session).toMatchObject({ email: 'approver@demo', role: 'approver' });
  });

  it('rejects a token whose payload was changed', () => {
    const [, signature] = createToken('requester@demo', 'requester', 1000).split('.');
    const forged = Buffer.from(JSON.stringify({ email: 'requester@demo', role: 'approver', exp: 1e15 })).toString('base64url');
    expect(verifyToken(`${forged}.${signature}`, 2000)).toBeNull();
  });

  it('rejects an expired token', () => {
    expect(verifyToken(createToken('approver@demo', 'approver', 0), SESSION_TTL_MS + 1)).toBeNull();
  });

  it('rejects missing or malformed tokens', () => {
    expect(verifyToken(undefined)).toBeNull();
    expect(verifyToken('not-a-token')).toBeNull();
  });
});

describe('findUser', () => {
  it('accepts the right password, ignoring email case', () => {
    expect(findUser(' Approver@demo ', 'approver-demo')?.role).toBe('approver');
  });

  it('rejects a wrong password', () => {
    expect(findUser('approver@demo', 'requester-demo')).toBeUndefined();
  });
});
