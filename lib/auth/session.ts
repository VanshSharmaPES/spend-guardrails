import { createHmac, timingSafeEqual } from 'node:crypto';
import { DEMO_USERS, type Role } from './users';

export type Session = { email: string; role: Role; exp: number };

export const SESSION_COOKIE = 'sg_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is not set');
  return 'dev-only-session-secret';
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function createToken(email: string, role: Role, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ email, role, exp: now + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined, now = Date.now()): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    return session.exp > now ? session : null;
  } catch {
    return null;
  }
}

export function findUser(email: string, password: string) {
  return DEMO_USERS.find((user) => user.email === email.trim().toLowerCase() && user.password === password);
}
