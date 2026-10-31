import Link from 'next/link';

const LINKS = [
  { href: '/approvals', label: 'Approvals' },
  { href: '/history', label: 'History' },
  { href: '/spend', label: 'Spend' },
];

export default function Nav() {
  return (
    <nav className="flex h-14 items-center gap-6 border-b border-slate-700 px-6">
      <span className="font-semibold text-sky-400">Spend Guardrails</span>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="text-sm hover:text-sky-400">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
