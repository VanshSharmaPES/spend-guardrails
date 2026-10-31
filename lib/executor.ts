import type Database from 'better-sqlite3';
import { getAuditEntry, recordExecution } from './db/queries';
import { payForProposal } from './paypal';
import type { AuditEntry } from './types';

export class ExecutionError extends Error {}

const SUCCESSFUL_CAPTURES = ['COMPLETED', 'PENDING'];

export async function executeDecision(db: Database.Database, decisionId: string): Promise<AuditEntry> {
  const entry = getAuditEntry(db, decisionId);
  if (!entry) throw new ExecutionError(`No decision with id ${decisionId}`);
  if (entry.execution) return entry;

  const { decision } = entry.verdict;
  const approved = decision === 'ALLOW' || (decision === 'ESCALATE' && entry.humanAction?.decision === 'APPROVED');
  if (!approved) throw new ExecutionError(`Decision ${decisionId} is not approved for payment`);

  let payment;
  try {
    payment = await payForProposal(entry.proposal, decisionId);
  } catch (err) {
    throw new ExecutionError(`PayPal payment failed: ${(err as Error).message}`);
  }
  if (!SUCCESSFUL_CAPTURES.includes(payment.status)) {
    throw new ExecutionError(`PayPal did not capture the payment: status ${payment.status}`);
  }
  return recordExecution(db, decisionId, payment);
}
