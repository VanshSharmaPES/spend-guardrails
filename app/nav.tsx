'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/approvals', label: 'Approvals' },
  { href: '/history', label: 'History' },
  { href: '/spend', label: 'Spend' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex h-14 items-stretch gap-8 border-b border-line px-6 text-sm">
      <span className="flex items-center font-semibold">Spend Guardrails</span>
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
      <span className="ml-auto flex items-center font-mono text-xs text-muted">PayPal sandbox</span>
    </nav>
  );
}
