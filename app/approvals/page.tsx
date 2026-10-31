import { connection } from 'next/server';
import { getDb } from '@/lib/db';
import { getPendingApprovals } from '@/lib/db/queries';
import DecisionButtons from './decision-buttons';

function timeLeft(expiresAtMs: number, nowMs: number) {
  const minutes = Math.max(0, Math.floor((expiresAtMs - nowMs) / 60_000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export default async function ApprovalsPage() {
  await connection();
  const now = new Date();
  const pending = getPendingApprovals(getDb(), now.toISOString());

  return (
    <main className="w-full px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted">
          {pending.length} waiting. No answer within 24 hours denies the purchase.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="border-y border-line py-12 text-center text-sm text-muted">
          Nothing to review. Escalated purchases will appear here.
        </p>
      ) : (
        <ul className="border-t border-line">
          {pending.map(({ id, proposal, verdict, createdAt }) => (
            <li
              key={id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-8 gap-y-1 border-b border-line py-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_8rem_6rem_auto]"
            >
              <div className="min-w-0">
                <p className="font-medium">{proposal.merchant}</p>
                <p className="truncate text-sm text-muted">
                  {proposal.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}
                </p>
              </div>
              <p className="text-sm">
                <span className="mr-2 font-mono text-xs text-review">{verdict.ruleId}</span>
                {verdict.reason}
              </p>
              <p className="text-right font-mono tabular-nums">
                {proposal.amount.value} <span className="text-xs text-muted">{proposal.amount.currencyCode}</span>
              </p>
              <p className="text-right font-mono text-sm tabular-nums text-muted">
                {timeLeft(Date.parse(createdAt) + 86_400_000, now.getTime())}
              </p>
              <DecisionButtons id={id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
