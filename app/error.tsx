'use client';

import { useEffect } from 'react';

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="w-full px-6 py-8">
      <h1 className="text-xl font-semibold">This page could not load</h1>
      <p className="mt-2 text-sm text-muted">
        A service it depends on did not respond. No purchase was approved or paid by this error.
      </p>
      <button onClick={() => retry()} className="mt-4 h-8 border border-line px-3 text-sm hover:bg-line">
        Try again
      </button>
    </main>
  );
}
