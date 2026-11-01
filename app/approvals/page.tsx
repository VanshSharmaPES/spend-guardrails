import { connection } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuditRows, getPendingApprovals } from '@/lib/db/queries';
import type { AuditRow } from '@/lib/types';
import DecisionButtons from './decision-buttons';
import RetryButton from './retry-button';

const DAY_MS = 86_400_000;
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function timeLeft(expiresAtMs: number, nowMs: number) {
  const minutes = Math.max(0, Math.floor((expiresAtMs - nowMs) / 60_000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

const total = (rows: AuditRow[]) => rows.reduce((sum, row) => sum + row.amountHome, 0);

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className={`border border-line border-l-2 ${tone} bg-surface px-4 py-3`}>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{detail}</p>
    </div>
  );
}

function SectionTitle({ dot, label, count }: { dot: string; label: string; count: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
      <span className={`size-2 rounded-full ${dot}`} />
      {label}
      <span className="font-mono text-muted">{count}</span>
    </h2>
  );
}

export default async function ApprovalsPage() {
  await connection();
  const now = new Date();
  const db = getDb();
  const pending = getPendingApprovals(db, now.toISOString());
  const rows = getAuditRows(db, now.toISOString());
  const failed = rows.filter((row) => row.status === 'AWAITING_EXECUTION');
  const lastDay = rows.filter((row) => now.getTime() - Date.parse(row.createdAt) < DAY_MS);
  const paid = lastDay.filter((row) => row.status === 'EXECUTED');
  const blocked = lastDay.filter((row) => row.status === 'DENIED' || row.status === 'REJECTED');

  return (
    <main className="w-full px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Every purchase an agent proposes is checked against a fixed policy. Anything over the line waits here for a
          person, and no answer within 24 hours denies it.
        </p>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Awaiting review" value={String(pending.length)} detail="Escalated by policy" tone="border-l-review" />
        <Stat label="Payment failed" value={String(failed.length)} detail="Approved, ready to retry" tone="border-l-deny" />
        <Stat label="Paid, last 24h" value={USD.format(total(paid))} detail={`${paid.length} purchases`} tone="border-l-allow" />
        <Stat label="Blocked, last 24h" value={String(blocked.length)} detail="Denied or rejected" tone="border-l-muted" />
      </section>

      {failed.length > 0 && (
        <section className="mb-10">
          <SectionTitle dot="bg-deny" label="Payment failed" count={failed.length} />
          <ul className="space-y-2">
            {failed.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-8 border border-line border-l-2 border-l-deny bg-surface px-4 py-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{row.merchant}</p>
                  <p className="truncate text-sm text-deny" title={row.paymentError ?? undefined}>
                    {row.paymentError ?? 'Approved, but payment has not gone through.'}
                  </p>
                </div>
                <p className="text-right font-mono tabular-nums">
                  {row.amountValue} <span className="text-xs text-muted">{row.amountCurrency}</span>
                </p>
                <RetryButton id={row.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle dot="bg-review" label="Awaiting review" count={pending.length} />
        {pending.length === 0 ? (
          <p className="border border-dashed border-line py-12 text-center text-sm text-muted">
            Nothing to review. Escalated purchases will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map(({ id, proposal, verdict, createdAt }) => (
              <li
                key={id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-8 gap-y-2 border border-line border-l-2 border-l-review bg-surface px-4 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_8rem_6rem_auto]"
              >
                <div className="min-w-0">
                  <p className="font-medium">{proposal.merchant}</p>
                  <p className="truncate text-sm text-muted">
                    {proposal.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}
                  </p>
                </div>
                <p className="text-sm">
                  <span className="mr-2 border border-review/40 px-1.5 py-0.5 font-mono text-xs text-review">
                    {verdict.ruleId}
                  </span>
                  {verdict.reason}
                </p>
                <p className="text-right font-mono text-lg tabular-nums">
                  {proposal.amount.value} <span className="text-xs text-muted">{proposal.amount.currencyCode}</span>
                </p>
                <p className="text-right font-mono text-sm tabular-nums text-muted" title="Time left to decide">
                  {timeLeft(Date.parse(createdAt) + DAY_MS, now.getTime())}
                </p>
                <DecisionButtons id={id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
