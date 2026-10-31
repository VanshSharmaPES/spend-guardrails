import { getDb } from '../lib/db';
import { getPendingApprovals } from '../lib/db/queries';
import { approveAndExecute, executeDecision, rejectDecision } from '../lib/executor';

const USER = 'demo-user';
const USAGE = 'Usage: npm run approvals -- list | approve <id> | reject <id> | retry <id>';

async function main() {
  const [command, id] = process.argv.slice(2);
  const db = getDb();

  if (command === 'list') {
    const pending = getPendingApprovals(db, new Date().toISOString());
    if (pending.length === 0) console.log('No purchases awaiting approval.');
    for (const { id, proposal, verdict } of pending) {
      console.log(`${id}\n  ${proposal.merchant} / ${proposal.category}  ${proposal.amount.value} ${proposal.amount.currencyCode}\n  ${verdict.reason}`);
    }
  } else if (command === 'approve' && id) {
    const { execution } = await approveAndExecute(db, id, USER);
    console.log(`Approved. Paid PayPal order ${execution?.paypalOrderId} (${execution?.status})`);
  } else if (command === 'reject' && id) {
    rejectDecision(db, id, USER);
    console.log('Rejected. No payment made.');
  } else if (command === 'retry' && id) {
    const { execution } = await executeDecision(db, id);
    console.log(`Paid PayPal order ${execution?.paypalOrderId} (${execution?.status})`);
  } else {
    console.error(USAGE);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});
