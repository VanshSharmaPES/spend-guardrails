import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifyToken, type Session } from './session';

export async function getSession(): Promise<Session | null> {
  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
}
