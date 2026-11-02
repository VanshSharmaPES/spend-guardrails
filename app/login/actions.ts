'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createToken, findUser, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/auth/session';

export async function signIn(_previous: string | null, form: FormData): Promise<string | null> {
  const user = findUser(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
  if (!user) return 'Email or password is incorrect.';

  (await cookies()).set(SESSION_COOKIE, createToken(user.email, user.role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect('/approvals');
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
