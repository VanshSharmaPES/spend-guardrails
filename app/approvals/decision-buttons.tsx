'use client';

import { useActionState } from 'react';
import { decide } from './actions';

export default function DecisionButtons({ id }: { id: string }) {
  const [approveError, approve, approving] = useActionState(decide.bind(null, id, true), null);
  const [rejectError, reject, rejecting] = useActionState(decide.bind(null, id, false), null);
  const busy = approving || rejecting;
  const error = approveError ?? rejectError;

  return (
    <div>
      <div className="flex gap-2">
        <form action={approve}>
          <button disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white disabled:opacity-50">
            {approving ? 'Paying…' : 'Approve'}
          </button>
        </form>
        <form action={reject}>
          <button disabled={busy} className="rounded bg-red-700 px-3 py-1 text-white disabled:opacity-50">
            Reject
          </button>
        </form>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
