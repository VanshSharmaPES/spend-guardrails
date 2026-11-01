'use client';

import { useActionState } from 'react';
import { retryPayment } from './actions';

export default function RetryButton({ id }: { id: string }) {
  const [, retry, retrying] = useActionState(retryPayment.bind(null, id), null);

  return (
    <form action={retry}>
      <button disabled={retrying} className="h-8 bg-review px-3 text-sm font-medium text-background hover:brightness-110 disabled:opacity-50">
        {retrying ? 'Paying…' : 'Retry payment'}
      </button>
    </form>
  );
}
