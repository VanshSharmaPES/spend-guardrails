'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signUp } from '../login/actions';
import { INPUT } from '../login/sign-in-form';

const LABEL = 'block text-xs uppercase tracking-wider text-muted';

export default function SignUpForm() {
  const [email, setEmail] = useState('');
  const [error, action, creating] = useActionState(signUp, null);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-muted">
          New accounts can ask the agent for purchases. Approvers are appointed, so a new account can never approve.
        </p>

        <form action={action} className="mt-6 space-y-4 border border-line bg-surface p-4">
          <label className={LABEL}>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          </label>
          <label className={LABEL}>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} className={INPUT} />
          </label>
          <label className={LABEL}>
            Confirm password
            <input name="confirm" type="password" autoComplete="new-password" minLength={8} className={INPUT} />
          </label>
          <p className="text-xs text-muted">At least 8 characters.</p>
          {error && <p className="text-sm text-deny">{error}</p>}
          <button
            disabled={creating || !email}
            className="h-9 w-full bg-foreground text-sm font-medium text-background hover:brightness-90 disabled:opacity-50"
          >
            {creating ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-3 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
