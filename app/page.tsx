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
    <nav className="flex h-14 items-center gap-8 border-b border-white/10 bg-[#0e1626] px-6">
      <span className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
        Spend Guardrails
      </span>
      <div className="flex h-full gap-1">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center border-b-2 px-3 text-sm transition-colors ${
              pathname === link.href
                ? 'border-sky-400 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <span className="ml-auto rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs text-amber-300">
        Sandbox
      </span>
    </nav>
  );
}
