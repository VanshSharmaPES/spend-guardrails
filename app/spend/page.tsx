import { connection } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuditRows } from '@/lib/db/queries';
import SpendClient from './spend-client';

export default async function SpendPage() {
  await connection();
  const rows = getAuditRows(getDb())
    .filter((row) => row.status === 'EXECUTED')
    .map((row) => ({ ...row, day: row.createdAt.slice(0, 10) }))
    .sort((a, b) => a.day.localeCompare(b.day));
  return <SpendClient rows={rows} />;
}
