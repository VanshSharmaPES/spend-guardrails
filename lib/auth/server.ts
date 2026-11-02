import { cookies } from 'next/headers';
import type { Role } from './users';
import { SESSION_COOKIE, verifyToken, type Session } from './session';

export class AuthError extends Error {}

export async function getSession(): Promise<Session | null> {
  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError('Your session has ended. Sign in again.');
  return session;
}

export async function requireRole(role: Role): Promise<Session> {
  const session = await requireSession();
  if (session.role !== role) throw new AuthError(`Only an ${role} can do this.`);
  return session;
}
