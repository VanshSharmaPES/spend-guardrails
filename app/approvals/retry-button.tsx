'use client';

import { useActionState } from 'react';
import { retryPayment } from './actions';

export default function RetryButton({ id }: { id: string }) {
  const [error, retry, retrying] = useActionState(retryPayment.bind(null, id), null);

  return (
    <div>
      <form action={retry}>
        <button disabled={retrying} className="h-8 bg-review px-3 text-sm font-medium text-background hover:brightness-110 disabled:opacity-50">
          {retrying ? 'Paying…' : 'Retry payment'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-deny">{error}</p>}
    </div>
  );
}
