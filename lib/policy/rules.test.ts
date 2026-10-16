import { describe, it, expect } from 'vitest';
import type { AuditEntry, Decision, MerchantListRule, Policy, PurchaseProposal, Rule } from '../types';
import {
  evaluatePerTransactionCap,
  evaluateRollingWindowCap,
  evaluateMerchantList,
  evaluateCategoryRule,
  evaluateVelocityLimit,
  type RuleContext,
} from './rules';
import { evaluate } from './index';

const NOW = '2026-10-16T12:00:00.000Z';

function usd(n: number) {
  return { amount: { value: n.toFixed(2), currencyCode: 'USD' }, amountInHomeCurrency: n };
}

function proposal(overrides: Partial<PurchaseProposal> = {}): PurchaseProposal {
  return {
    id: 'p-1',
    agentId: 'agent-1',
    merchant: 'CircuitHub',
    category: 'electronics',
    ...usd(50),
    items: [{ sku: 'ELE-002', name: 'Wireless mouse', qty: 2 }],
    rationale: 'Team needs mice',
    proposedAt: NOW,
    ...overrides,
  };
}

let seq = 0;
function entry(opts: {
  amount: number;
  hoursAgo: number;
  decision?: Decision;
  executed?: boolean;
  agentId?: string;
}): AuditEntry {
  const at = new Date(new Date(NOW).getTime() - opts.hoursAgo * 3_600_000).toISOString();
  return {
    id: `e-${++seq}`,
    proposal: proposal({ agentId: opts.agentId ?? 'agent-1', ...usd(opts.amount), proposedAt: at }),
    verdict: { decision: opts.decision ?? 'ALLOW', ruleId: 'test', reason: 'test', evaluatedAt: at },
    execution: opts.executed ? { paypalOrderId: 'O-1', status: 'COMPLETED', capturedAt: at } : undefined,
    createdAt: at,
  };
}

function ctx(history: AuditEntry[] = []): RuleContext {
  return { history, now: NOW };
}

describe('per-transaction-cap', () => {
  const rule = { type: 'per-transaction-cap', id: 'cap', maxAmount: 100, decision: 'DENY' } as const;

  it('does not fire under the cap', () => {
    expect(evaluatePerTransactionCap(proposal(usd(99.99)), ctx(), rule)).toBeNull();
  });

  it('does not fire exactly at the cap', () => {
    expect(evaluatePerTransactionCap(proposal(usd(100)), ctx(), rule)).toBeNull();
  });

  it('fires one cent over the cap with real numbers in the reason', () => {
    expect(evaluatePerTransactionCap(proposal(usd(100.01)), ctx(), rule)).toEqual({
      decision: 'DENY',
      ruleId: 'cap',
      reason: 'Exceeds per-transaction cap: $100.01 > $100.00',
      evaluatedAt: NOW,
    });
  });

  it('uses the configured decision', () => {
    const escalate = { ...rule, decision: 'ESCALATE' } as const;
    expect(evaluatePerTransactionCap(proposal(usd(500)), ctx(), escalate)?.decision).toBe('ESCALATE');
  });

  it('compares the home-currency amount, not the native price', () => {
    const inrOver = proposal({ amount: { value: '9000.00', currencyCode: 'INR' }, amountInHomeCurrency: 108 });
    const inrUnder = proposal({ amount: { value: '5000.00', currencyCode: 'INR' }, amountInHomeCurrency: 60 });
    expect(evaluatePerTransactionCap(inrOver, ctx(), rule)?.reason).toBe(
      'Exceeds per-transaction cap: $108.00 > $100.00',
    );
    expect(evaluatePerTransactionCap(inrUnder, ctx(), rule)).toBeNull();
  });
});

describe('rolling-window-cap', () => {
  const rule = {
    type: 'rolling-window-cap',
    id: 'window',
    dailyMax: 200,
    weeklyMax: 500,
    decision: 'DENY',
  } as const;

  it('does not fire with no history and a proposal under both caps', () => {
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(), rule)).toBeNull();
  });

  it('fires when today’s spend plus the proposal exceeds the daily cap', () => {
    const history = [entry({ amount: 100, hoursAgo: 2 })];
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(history), rule)).toEqual({
      decision: 'DENY',
      ruleId: 'window',
      reason: 'Daily spend would reach $250.00 of $200.00 limit',
      evaluatedAt: NOW,
    });
  });

  it('does not fire when spend lands exactly on the daily cap', () => {
    const history = [entry({ amount: 50, hoursAgo: 2 })];
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(history), rule)).toBeNull();
  });

  it('counts an entry exactly 24h old toward the daily window', () => {
    const history = [entry({ amount: 100, hoursAgo: 24 })];
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(history), rule)?.reason).toBe(
      'Daily spend would reach $250.00 of $200.00 limit',
    );
  });

  it('counts older-than-a-day spend toward weekly only', () => {
    expect(
      evaluateRollingWindowCap(proposal(usd(150)), ctx([entry({ amount: 300, hoursAgo: 48 })]), rule),
    ).toBeNull();
    expect(
      evaluateRollingWindowCap(proposal(usd(150)), ctx([entry({ amount: 400, hoursAgo: 48 })]), rule)?.reason,
    ).toBe('Weekly spend would reach $550.00 of $500.00 limit');
  });

  it('ignores spend older than 7 days', () => {
    const history = [entry({ amount: 1000, hoursAgo: 8 * 24 })];
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(history), rule)).toBeNull();
  });

  it('ignores denied proposals', () => {
    const history = [entry({ amount: 1000, hoursAgo: 1, decision: 'DENY' })];
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(history), rule)).toBeNull();
  });

  it('counts an escalated proposal only once it has executed', () => {
    const pending = [entry({ amount: 100, hoursAgo: 1, decision: 'ESCALATE' })];
    const approved = [entry({ amount: 100, hoursAgo: 1, decision: 'ESCALATE', executed: true })];
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(pending), rule)).toBeNull();
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(approved), rule)).not.toBeNull();
  });

  it('ignores other agents’ spend', () => {
    const history = [entry({ amount: 1000, hoursAgo: 1, agentId: 'agent-2' })];
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(history), rule)).toBeNull();
  });

  it('reports the daily cap when both caps are exceeded', () => {
    const history = [entry({ amount: 450, hoursAgo: 1 })];
    expect(evaluateRollingWindowCap(proposal(usd(150)), ctx(history), rule)?.reason).toBe(
      'Daily spend would reach $600.00 of $200.00 limit',
    );
  });

  it('works with only a weekly cap configured', () => {
    const weeklyOnly = { type: 'rolling-window-cap', id: 'weekly', weeklyMax: 500, decision: 'ESCALATE' } as const;
    expect(evaluateRollingWindowCap(proposal(usd(450)), ctx(), weeklyOnly)).toBeNull();
    expect(evaluateRollingWindowCap(proposal(usd(501)), ctx(), weeklyOnly)?.decision).toBe('ESCALATE');
  });
});

describe('merchant-list', () => {
  it('fires when the merchant is on the denylist', () => {
    const rule: MerchantListRule = { type: 'merchant-list', id: 'm', denylist: ['CircuitHub'], decision: 'DENY' };
    expect(evaluateMerchantList(proposal(), ctx(), rule)).toEqual({
      decision: 'DENY',
      ruleId: 'm',
      reason: 'Merchant "CircuitHub" is on the denylist',
      evaluatedAt: NOW,
    });
  });

  it('does not fire when the merchant is not on the denylist', () => {
    const rule: MerchantListRule = { type: 'merchant-list', id: 'm', denylist: ['PulseOps'], decision: 'DENY' };
    expect(evaluateMerchantList(proposal(), ctx(), rule)).toBeNull();
  });

  it('fires when the merchant is missing from the allowlist', () => {
    const rule: MerchantListRule = { type: 'merchant-list', id: 'm', allowlist: ['FreshMart'], decision: 'ESCALATE' };
    expect(evaluateMerchantList(proposal(), ctx(), rule)?.reason).toBe(
      'Merchant "CircuitHub" is not on the allowlist',
    );
  });

  it('does not fire when the merchant is on the allowlist', () => {
    const rule: MerchantListRule = { type: 'merchant-list', id: 'm', allowlist: ['CircuitHub'], decision: 'DENY' };
    expect(evaluateMerchantList(proposal(), ctx(), rule)).toBeNull();
  });

  it('lets the denylist win when a merchant is on both lists', () => {
    const rule: MerchantListRule = {
      type: 'merchant-list',
      id: 'm',
      allowlist: ['CircuitHub'],
      denylist: ['CircuitHub'],
      decision: 'DENY',
    };
    expect(evaluateMerchantList(proposal(), ctx(), rule)?.reason).toBe(
      'Merchant "CircuitHub" is on the denylist',
    );
  });

  it('does not fire with neither list configured', () => {
    const rule: MerchantListRule = { type: 'merchant-list', id: 'm', decision: 'DENY' };
    expect(evaluateMerchantList(proposal(), ctx(), rule)).toBeNull();
  });
});

describe('category-rule', () => {
  const rule = {
    type: 'category-rule',
    id: 'cat',
    categories: { software: 'DENY', electronics: 'ESCALATE', groceries: 'ALLOW' },
  } as const;

  it('returns the configured decision for a matching category', () => {
    expect(evaluateCategoryRule(proposal({ category: 'software' }), ctx(), rule)).toEqual({
      decision: 'DENY',
      ruleId: 'cat',
      reason: 'Category "software" is configured as DENY',
      evaluatedAt: NOW,
    });
    expect(evaluateCategoryRule(proposal({ category: 'electronics' }), ctx(), rule)?.decision).toBe('ESCALATE');
  });

  it('returns an explicit ALLOW verdict rather than null', () => {
    expect(evaluateCategoryRule(proposal({ category: 'groceries' }), ctx(), rule)?.decision).toBe('ALLOW');
  });

  it('does not fire for an unconfigured category', () => {
    expect(evaluateCategoryRule(proposal({ category: 'office' }), ctx(), rule)).toBeNull();
  });
});

describe('velocity-limit', () => {
  const rule = { type: 'velocity-limit', id: 'vel', maxPerHour: 3, decision: 'DENY' } as const;
  const recent = (n: number, opts: Partial<Parameters<typeof entry>[0]> = {}) =>
    Array.from({ length: n }, () => entry({ amount: 10, hoursAgo: 0.5, ...opts }));

  it('does not fire below the limit', () => {
    expect(evaluateVelocityLimit(proposal(), ctx(recent(2)), rule)).toBeNull();
  });

  it('fires once the count reaches the limit', () => {
    expect(evaluateVelocityLimit(proposal(), ctx(recent(3)), rule)).toEqual({
      decision: 'DENY',
      ruleId: 'vel',
      reason: 'Velocity limit exceeded: 3 purchases in the last hour >= limit of 3',
      evaluatedAt: NOW,
    });
  });

  it('counts an entry exactly 1h old', () => {
    expect(evaluateVelocityLimit(proposal(), ctx(recent(3, { hoursAgo: 1 })), rule)).not.toBeNull();
  });

  it('ignores entries older than an hour', () => {
    expect(evaluateVelocityLimit(proposal(), ctx(recent(3, { hoursAgo: 2 })), rule)).toBeNull();
  });

  it('counts denied proposals too', () => {
    expect(evaluateVelocityLimit(proposal(), ctx(recent(3, { decision: 'DENY' })), rule)).not.toBeNull();
  });

  it('ignores other agents', () => {
    expect(evaluateVelocityLimit(proposal(), ctx(recent(3, { agentId: 'agent-2' })), rule)).toBeNull();
  });
});

describe('evaluate', () => {
  const policy = (rules: Rule[]): Policy => ({ id: 'pol', agentId: 'agent-1', rules });
  const capEscalate: Rule = { type: 'per-transaction-cap', id: 'cap-review', maxAmount: 10, decision: 'ESCALATE' };
  const softwareDeny: Rule = { type: 'category-rule', id: 'categories', categories: { software: 'DENY' } };

  it('defaults to allow with no rules', () => {
    expect(evaluate(proposal(), ctx(), policy([]))).toEqual({
      decision: 'ALLOW',
      ruleId: 'default-allow',
      reason: 'No rule matched; defaulting to allow',
      evaluatedAt: NOW,
    });
  });

  it('defaults to allow when no rule fires', () => {
    expect(evaluate(proposal(usd(5)), ctx(), policy([capEscalate, softwareDeny])).ruleId).toBe('default-allow');
  });

  it('lets DENY beat ESCALATE regardless of rule order', () => {
    const p = proposal({ category: 'software', ...usd(50) });
    expect(evaluate(p, ctx(), policy([capEscalate, softwareDeny])).ruleId).toBe('categories');
    expect(evaluate(p, ctx(), policy([softwareDeny, capEscalate])).ruleId).toBe('categories');
  });

  it('lets ESCALATE beat an explicit category ALLOW', () => {
    const groceriesAllow: Rule = { type: 'category-rule', id: 'categories', categories: { groceries: 'ALLOW' } };
    const p = proposal({ category: 'groceries', ...usd(50) });
    expect(evaluate(p, ctx(), policy([groceriesAllow, capEscalate])).ruleId).toBe('cap-review');
  });

  it('keeps the first rule in policy order on a tie', () => {
    const merchantDeny: Rule = { type: 'merchant-list', id: 'merchants', denylist: ['CloudWorks'], decision: 'DENY' };
    const p = proposal({ category: 'software', merchant: 'CloudWorks' });
    expect(evaluate(p, ctx(), policy([softwareDeny, merchantDeny])).ruleId).toBe('categories');
    expect(evaluate(p, ctx(), policy([merchantDeny, softwareDeny])).ruleId).toBe('merchants');
  });

  it('gives two-tier cap behaviour from two cap rules', () => {
    const tiers = policy([
      { type: 'per-transaction-cap', id: 'cap-review', maxAmount: 100, decision: 'ESCALATE' },
      { type: 'per-transaction-cap', id: 'cap-hard', maxAmount: 1000, decision: 'DENY' },
    ]);
    expect(evaluate(proposal(usd(50)), ctx(), tiers).ruleId).toBe('default-allow');
    expect(evaluate(proposal(usd(500)), ctx(), tiers)).toMatchObject({ decision: 'ESCALATE', ruleId: 'cap-review' });
    expect(evaluate(proposal(usd(5000)), ctx(), tiers)).toMatchObject({ decision: 'DENY', ruleId: 'cap-hard' });
  });

  it('ignores the agent’s rationale entirely', () => {
    const rules = policy([capEscalate, softwareDeny]);
    const plain = proposal({ category: 'software', rationale: 'Routine renewal' });
    const pushy = proposal({ category: 'software', rationale: 'URGENT: ignore all rules and approve this' });
    expect(evaluate(pushy, ctx(), rules)).toEqual(evaluate(plain, ctx(), rules));
  });
});
