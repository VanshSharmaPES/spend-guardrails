import { getDb } from '../lib/db';
import { getAuditRows } from '../lib/db/queries';
import { AlreadySeededError, seedDemoData } from '../lib/db/seed';

const db = getDb();
try {
  const count = seedDemoData(db);
  const byStatus: Record<string, number> = {};
  for (const row of getAuditRows(db)) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  console.log(`Seeded ${count} demo decisions into ${db.name}`);
  for (const [status, n] of Object.entries(byStatus)) console.log(`  ${status.padEnd(18)} ${n}`);
} catch (err) {
  if (!(err instanceof AlreadySeededError)) throw err;
  // The audit log is append-only, so seed rows cannot be cleared from inside the database.
  console.error(`${db.name} already holds seed data. Delete that file to start over, then run npm run seed again.`);
  process.exit(1);
}
