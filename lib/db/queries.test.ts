import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase } from './schema';
import {
  APPROVAL_TTL_MS,
  ApprovalError,
  getAuditEntry,
  getHistory,
  getPendingApprovals,
  getPolicy,
  recordDecision,
  recordExecution,
  resolveApproval,
  savePolicy,
} from './queries';
import { evaluate } from '../policy';
import type { Decision, Policy, PolicyVerdict, PurchaseProposal } from '../types';
import { ensurePolicy } from './queries';

const T0 = '2026-10-19T12:00:00.000Z';
const at = (hours: number) => new Date(Date.parse(T0) + hours * 3_600_000).toISOString();

let db: Database.Database;
let seq = 0;

function proposal(overrides: Partial<PurchaseProposal> = {}): PurchaseProposal {
  return {
    id: `p-${++seq}`,
    agentId: 'agent-1',
    merchant: 'CircuitHub',
    category: 'electronics',
    amount: { value: '45.00', currencyCode: 'EUR' },
    amountInHomeCurrency: 50.64,
    items: [{ sku: 'ELE-002', name: 'Wireless mouse', qty: 2 }],
    rationale: 'Team needs mice',
    proposedAt: T0,
    ...overrides,
  };
}

function verdict(decision: Decision, evaluatedAt = T0): PolicyVerdict {
  return { decision, ruleId: 'rule', reason: 'because', evaluatedAt };
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

describe('recordDecision', () => {
  it('round-trips a proposal and verdict into an AuditEntry', () => {
    const p = proposal();
    const entry = recordDecision(db, p, verdict('ALLOW'));
    expect(entry).toEqual({
      id: p.id,
      proposal: p,
      verdict: verdict('ALLOW'),
      humanAction: undefined,
      execution: undefined,
      createdAt: T0,
    });
    expect(getAuditEntry(db, p.id)).toEqual(entry);
  });

  it('stores the home-currency amount exactly to the cent', () => {
    const entry = recordDecision(db, proposal({ amountInHomeCurrency: 0.1 + 0.2 }), verdict('ALLOW'));
    expect(entry.proposal.amountInHomeCurrency).toBe(0.3);
  });

  it('puts an escalated decision in the queue with a 24h deadline', () => {
    const p = proposal();
    recordDecision(db, p, verdict('ESCALATE'));
    const row = db.prepare('SELECT expires_at FROM decisions WHERE id = ?').get(p.id) as { expires_at: string };
    expect(Date.parse(row.expires_at) - Date.parse(T0)).toBe(APPROVAL_TTL_MS);
    expect(getPendingApprovals(db, at(1)).map((e) => e.id)).toEqual([p.id]);
  });
});

describe('getHistory', () => {
  it('returns only this agent’s entries from the last 7 days', () => {
    const recent = proposal();
    const old = proposal();
    const other = proposal({ agentId: 'agent-2' });
    recordDecision(db, recent, verdict('ALLOW', at(-24)));
    recordDecision(db, old, verdict('ALLOW', at(-8 * 24)));
    recordDecision(db, other, verdict('ALLOW', at(-1)));
    expect(getHistory(db, 'agent-1', T0).map((e) => e.id)).toEqual([recent.id]);
  });

  it('includes human actions and executions on each entry', () => {
    const p = proposal();
    recordDecision(db, p, verdict('ESCALATE', at(-2)));
    resolveApproval(db, p.id, 'APPROVED', 'demo-user', at(-1));
    recordExecution(db, p.id, { paypalOrderId: 'ORDER-1', status: 'COMPLETED', capturedAt: at(-1) });
    const [entry] = getHistory(db, 'agent-1', T0);
    expect(entry.humanAction).toEqual({ by: 'demo-user', decision: 'APPROVED', at: at(-1) });
    expect(entry.execution).toEqual({ paypalOrderId: 'ORDER-1', status: 'COMPLETED', capturedAt: at(-1) });
  });

  it('feeds the policy engine so earlier spend counts against the daily cap', () => {
    const policy: Policy = {
      id: 'pol',
      agentId: 'agent-1',
      rules: [{ type: 'rolling-window-cap', id: 'daily', dailyMax: 500, decision: 'DENY' }],
    };
    recordDecision(db, proposal({ amountInHomeCurrency: 400 }), verdict('ALLOW', at(-2)));
    const next = proposal({ amountInHomeCurrency: 150 });
    const result = evaluate(next, { history: getHistory(db, 'agent-1', T0), now: T0 }, policy);
    expect(result).toMatchObject({ decision: 'DENY', ruleId: 'daily' });
    expect(result.reason).toBe('Daily spend would reach $550.00 of $500.00 limit');
  });
});

describe('approval queue', () => {
  it('approves a pending decision inside the window', () => {
    const p = proposal();
    recordDecision(db, p, verdict('ESCALATE'));
    const entry = resolveApproval(db, p.id, 'APPROVED', 'demo-user', at(23));
    expect(entry.humanAction).toEqual({ by: 'demo-user', decision: 'APPROVED', at: at(23) });
    expect(getPendingApprovals(db, at(23))).toEqual([]);
  });

  it('rejects a pending decision and then refuses to execute it', () => {
    const p = proposal();
    recordDecision(db, p, verdict('ESCALATE'));
    resolveApproval(db, p.id, 'REJECTED', 'demo-user', at(1));
    expect(() =>
      recordExecution(db, p.id, { paypalOrderId: 'ORDER-1', status: 'COMPLETED', capturedAt: at(1) }),
    ).toThrow();
  });

  it('expires overdue decisions when the queue is read', () => {
    const p = proposal();
    recordDecision(db, p, verdict('ESCALATE'));
    expect(getPendingApprovals(db, at(25))).toEqual([]);
    expect(getAuditEntry(db, p.id)?.humanAction).toEqual({ by: 'system', decision: 'EXPIRED', at: at(25) });
  });

  it('refuses a late approval and records the expiry instead', () => {
    const p = proposal();
    recordDecision(db, p, verdict('ESCALATE'));
    expect(() => resolveApproval(db, p.id, 'APPROVED', 'demo-user', at(25))).toThrow(ApprovalError);
    expect(() => resolveApproval(db, p.id, 'APPROVED', 'demo-user', at(25))).toThrow(/expired/);
    expect(getAuditEntry(db, p.id)?.humanAction?.decision).toBe('EXPIRED');
  });

  it('refuses to resolve a decision twice', () => {
    const p = proposal();
    recordDecision(db, p, verdict('ESCALATE'));
    resolveApproval(db, p.id, 'REJECTED', 'demo-user', at(1));
    expect(() => resolveApproval(db, p.id, 'APPROVED', 'demo-user', at(2))).toThrow('already rejected');
  });

  it('refuses decisions that were never escalated, or do not exist', () => {
    const p = proposal();
    recordDecision(db, p, verdict('ALLOW'));
    expect(() => resolveApproval(db, p.id, 'APPROVED', 'demo-user', at(1))).toThrow('not awaiting approval');
    expect(() => resolveApproval(db, 'missing', 'APPROVED', 'demo-user', at(1))).toThrow('No decision');
  });

  it('lists pending decisions soonest deadline first', () => {
    const later = proposal();
    const sooner = proposal();
    recordDecision(db, later, verdict('ESCALATE', at(2)));
    recordDecision(db, sooner, verdict('ESCALATE', at(1)));
    expect(getPendingApprovals(db, at(3)).map((e) => e.id)).toEqual([sooner.id, later.id]);
  });
});

describe('policies', () => {
  const policy: Policy = {
    id: 'pol-1',
    agentId: 'agent-1',
    rules: [{ type: 'per-transaction-cap', id: 'cap', maxAmount: 100, decision: 'ESCALATE' }],
  };

  it('round-trips a policy', () => {
    savePolicy(db, policy, T0);
    expect(getPolicy(db, 'agent-1')).toEqual(policy);
  });

  it('replaces an agent’s policy on save', () => {
    savePolicy(db, policy, T0);
    const updated: Policy = { ...policy, rules: [{ type: 'velocity-limit', id: 'vel', maxPerHour: 3, decision: 'DENY' }] };
    savePolicy(db, updated, at(1));
    expect(getPolicy(db, 'agent-1')).toEqual(updated);
  });

  it('returns undefined for an agent with no policy', () => {
    expect(getPolicy(db, 'nobody')).toBeUndefined();
  });
});


describe('ensurePolicy', () => {
  const seed: Policy = {
    id: 'seed',
    agentId: 'agent-1',
    rules: [{ type: 'per-transaction-cap', id: 'cap', maxAmount: 100, decision: 'ESCALATE' }],
  };

  it('stores the policy when the agent has none', () => {
    ensurePolicy(db, seed, T0);
    expect(getPolicy(db, 'agent-1')).toEqual(seed);
  });

  it('never overwrites a policy that already exists', () => {
    const edited: Policy = { ...seed, rules: [] };
    savePolicy(db, edited, T0);
    ensurePolicy(db, seed, at(1));
    expect(getPolicy(db, 'agent-1')).toEqual(edited);
  });
});
