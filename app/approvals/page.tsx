import { connection } from 'next/server';
import { getDb } from '@/lib/db';
import { getPendingApprovals } from '@/lib/db/queries';
import DecisionButtons from './decision-buttons';

export default async function ApprovalsPage() {
  await connection();
  const pending = getPendingApprovals(getDb(), new Date().toISOString());

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Pending approvals</h1>
      {pending.length === 0 && <p>No purchases awaiting approval.</p>}
      <ul className="space-y-3">
        {pending.map(({ id, proposal, verdict }) => (
          <li key={id} className="rounded border p-4">
            <p className="font-medium">
              {proposal.merchant} / {proposal.category}: {proposal.amount.value} {proposal.amount.currencyCode}
            </p>
            <p className="text-sm">{proposal.items.map((i) => `${i.qty} x ${i.name}`).join(', ')}</p>
            <p className="my-2 text-sm">{verdict.reason}</p>
            <DecisionButtons id={id} />
          </li>
        ))}
      </ul>
    </main>
  );
}
