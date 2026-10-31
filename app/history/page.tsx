import { connection } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuditRows } from '@/lib/db/queries';
import StudioClient from './studio-client';

export default async function HistoryPage() {
  await connection();
  return <StudioClient rows={getAuditRows(getDb())} />;
}
