import { connection } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuditRows } from '@/lib/db/queries';
import EmptyState from '../empty-state';
import StudioClient from './studio-client';

export default async function HistoryPage() {
  await connection();
  const rows = getAuditRows(getDb());
  if (rows.length === 0) {
    return <EmptyState title="History" message="No decisions yet. Every purchase the agent proposes will be logged here." />;
  }
  return <StudioClient rows={rows} />;
}
