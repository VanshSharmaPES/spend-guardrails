'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate, createAccount, SignUpError } from '@/lib/auth/accounts';
import { createToken, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/auth/session';
import type { Role } from '@/lib/auth/users';
import { getDb } from '@/lib/db';

async function startSession(email: string, role: Role) {
  (await cookies()).set(SESSION_COOKIE, createToken(email, role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function signIn(_previous: string | null, form: FormData): Promise<string | null> {
  const user = authenticate(getDb(), String(form.get('email') ?? ''), String(form.get('password') ?? ''));
  if (!user) return 'Email or password is incorrect.';
  await startSession(user.email, user.role);
  redirect('/approvals');
}

export async function signUp(_previous: string | null, form: FormData): Promise<string | null> {
  const password = String(form.get('password') ?? '');
  if (password !== String(form.get('confirm') ?? '')) return 'The passwords do not match.';
  try {
    const user = createAccount(getDb(), String(form.get('email') ?? ''), password);
    await startSession(user.email, user.role);
  } catch (err) {
    if (err instanceof SignUpError) return err.message;
    throw err;
  }
  redirect('/approvals');
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}