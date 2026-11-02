'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/auth/users';
import { signOut } from './login/actions';

const LINKS = [
  { href: '/approvals', label: 'Approvals' },
  { href: '/history', label: 'History' },
  { href: '/spend', label: 'Spend' },
];

export default function Nav({ user }: { user: { email: string; role: Role } | null }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-14 items-stretch gap-8 border-b border-line px-6 text-sm">
      <span className="flex items-center font-semibold">Spend Guardrails</span>
      {user && (
        <div className="flex gap-6">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={`flex items-center border-b-2 ${
                pathname === link.href
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
      <div className="ml-auto flex items-center gap-6">
        <span className="flex items-center gap-2 font-mono text-xs text-muted">
          <span className="size-1.5 rounded-full bg-allow" />
          PayPal sandbox
        </span>
        {user && (
          <>
            <span className="flex items-center gap-2 text-xs">
              <span
                className={`border px-1.5 py-0.5 font-mono uppercase ${
                  user.role === 'approver' ? 'border-allow/40 text-allow' : 'border-review/40 text-review'
                }`}
              >
                {user.role}
              </span>
              <span className="text-muted">{user.email}</span>
            </span>
            <form action={signOut}>
              <button className="text-xs text-muted hover:text-foreground">Sign out</button>
            </form>
          </>
        )}
      </div>
    </nav>
  );
}
