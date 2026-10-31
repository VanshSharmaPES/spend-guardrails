import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { getAuditEntry, recordDecision, resolveApproval } from './db/queries';
import { openDatabase } from './db/schema';
import { ExecutionError, executeDecision } from './executor';
import { payForProposal } from './paypal';
import type { Decision, PurchaseProposal } from './types';

vi.mock('./paypal', () => ({ payForProposal: vi.fn() }));
const pay = vi.mocked(payForProposal);

const T0 = '2026-10-19T12:00:00.000Z';
const LATER = '2026-10-19T13:00:00.000Z';
const PAID = { paypalOrderId: 'ORDER-1', status: 'COMPLETED', capturedAt: LATER };

let db: Database.Database;

function decide(id: string, decision: Decision) {
  const proposal: PurchaseProposal = {
    id,
    agentId: 'agent-1',
    merchant: 'FreshMart',
    category: 'groceries',
    amount: { value: '15.15', currencyCode: 'USD' },
    amountInHomeCurrency: 15.15,
    items: [{ sku: 'GRO-002', name: 'Whole milk', qty: 1 }],
    rationale: 'r',
    proposedAt: T0,
  };
  recordDecision(db, proposal, { decision, ruleId: 'rule', reason: 'why', evaluatedAt: T0 });
  return proposal;
}

beforeEach(() => {
  db = openDatabase(':memory:');
  pay.mockReset();
  pay.mockResolvedValue(PAID);
});

describe('executeDecision', () => {
  it('pays an ALLOW decision using its id as the idempotency key', async () => {
    const proposal = decide('d1', 'ALLOW');
    const entry = await executeDecision(db, 'd1');
    expect(pay).toHaveBeenCalledWith(proposal, 'd1');
    expect(entry.execution).toEqual(PAID);
  });

  it('pays an escalated decision once a human approves', async () => {
    decide('d1', 'ESCALATE');
    resolveApproval(db, 'd1', 'APPROVED', 'demo-user', LATER);
    expect((await executeDecision(db, 'd1')).execution).toEqual(PAID);
  });

  it('never calls PayPal for denied, pending, rejected or expired decisions', async () => {
    decide('denied', 'DENY');
    decide('pending', 'ESCALATE');
    decide('rejected', 'ESCALATE');
    decide('expired', 'ESCALATE');
    resolveApproval(db, 'rejected', 'REJECTED', 'demo-user', LATER);
    db.prepare("INSERT INTO human_actions VALUES ('expired', 'EXPIRED', 'system', '2026-10-21T00:00:00.000Z')").run();
    for (const id of ['denied', 'pending', 'rejected', 'expired', 'missing']) {
      await expect(executeDecision(db, id)).rejects.toThrow(ExecutionError);
    }
    expect(pay).not.toHaveBeenCalled();
  });

  it('does not pay twice', async () => {
    decide('d1', 'ALLOW');
    await executeDecision(db, 'd1');
    await executeDecision(db, 'd1');
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('records nothing when PayPal errors or declines', async () => {
    decide('d1', 'ALLOW');
    pay.mockRejectedValueOnce(new Error('down'));
    await expect(executeDecision(db, 'd1')).rejects.toThrow('PayPal payment failed: down');
    pay.mockResolvedValueOnce({ ...PAID, status: 'DECLINED' });
    await expect(executeDecision(db, 'd1')).rejects.toThrow('status DECLINED');
    expect(getAuditEntry(db, 'd1')?.execution).toBeUndefined();
  });
});
