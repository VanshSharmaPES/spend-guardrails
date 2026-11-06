'use client';

import { useActionState, useState } from 'react';
import { DEMO_USERS } from '@/lib/auth/users';
import { signIn } from './actions';
import Link from 'next/link';

const TONE = { requester: 'border-l-review', approver: 'border-l-allow' };

export const INPUT =
  'mt-1 h-9 w-full border border-line bg-background px-3 text-sm normal-case tracking-normal text-foreground placeholder:text-muted focus:border-foreground focus:outline-none';

export default function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, action, signingIn] = useActionState(signIn, null);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Purchases are requested and approved by different people.
        </p>

        <form action={action} className="mt-6 space-y-4 border border-line bg-surface p-4">
          <label className="block text-xs uppercase tracking-wider text-muted">
            Email
            <input
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-muted">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
            />
          </label>
          {error && <p className="text-sm text-deny">{error}</p>}
          <button
            disabled={signingIn || !email || !password}
            className="h-9 w-full bg-foreground text-sm font-medium text-background hover:brightness-90 disabled:opacity-50"
          >
            {signingIn ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-3 text-center text-sm text-muted">
          No account?{' '}
          <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
          </p>
        </form>

        <h2 className="mt-8 mb-3 text-xs uppercase tracking-wider text-muted">Demo accounts</h2>
        <ul className="space-y-2">
          {DEMO_USERS.map((user) => (
            <li key={user.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(user.email);
                  setPassword(user.password);
                }}
                className={`w-full border border-line border-l-2 ${TONE[user.role]} bg-surface px-4 py-3 text-left hover:border-foreground`}
              >
                <p className="text-sm font-medium capitalize">{user.role}</p>
                <p className="font-mono text-xs text-muted">
                  {user.email} / {user.password}
                </p>
                <p className="mt-0.5 text-xs text-muted">{user.detail}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
