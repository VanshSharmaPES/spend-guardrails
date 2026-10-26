import { describe, expect, it } from 'vitest';
import { demoPolicy } from './demo';
import { validatePolicy } from './validate';

const withRules = (...rules: unknown[]) => ({ id: 'pol', agentId: 'agent-1', rules });

describe('validatePolicy', () => {
  it('accepts the demo policy', () => {
    expect(validatePolicy(demoPolicy)).toEqual([]);
  });

  it('accepts a policy with no rules', () => {
    expect(validatePolicy(withRules())).toEqual([]);
  });

  it('rejects input that is not a policy at all', () => {
    expect(validatePolicy(null)).toEqual(['Policy must be an object']);
    expect(validatePolicy([])).toEqual(['Policy must be an object']);
    expect(validatePolicy({ id: '', agentId: 'a', rules: 'nope' })).toEqual(['Policy id is required', 'rules must be a list']);
  });

  it('labels problems by rule id, or by position when the id is missing', () => {
    expect(validatePolicy(withRules({ type: 'velocity-limit', maxPerHour: 3, decision: 'DENY' }))).toEqual([
      'Rule 1 needs an id',
    ]);
  });

  it('rejects duplicate rule ids and unknown rule types', () => {
    expect(
      validatePolicy(
        withRules(
          { type: 'velocity-limit', id: 'r', maxPerHour: 3, decision: 'DENY' },
          { type: 'velocity-limit', id: 'r', maxPerHour: 3, decision: 'DENY' },
          { type: 'llm-judge', id: 'magic' },
        ),
      ),
    ).toEqual(['Rule "r": id is used by more than one rule', 'Rule "magic": unknown rule type "llm-judge"']);
  });

  it('collects every problem instead of stopping at the first', () => {
    const problems = validatePolicy(
      withRules(
        { type: 'per-transaction-cap', id: 'cap', maxAmount: -5, decision: 'ALLOW' },
        { type: 'velocity-limit', id: 'vel', maxPerHour: 0, decision: 'DENY' },
      ),
    );
    expect(problems).toHaveLength(3);
  });
});

describe('per-transaction-cap', () => {
  it('needs a positive numeric cap and a blocking decision', () => {
    expect(validatePolicy(withRules({ type: 'per-transaction-cap', id: 'cap', maxAmount: '100', decision: 'ALLOW' }))).toEqual([
      'Rule "cap": maxAmount must be a positive number',
      'Rule "cap": decision must be DENY or ESCALATE',
    ]);
  });
});

describe('rolling-window-cap', () => {
  it('needs at least one cap', () => {
    expect(validatePolicy(withRules({ type: 'rolling-window-cap', id: 'w', decision: 'DENY' }))).toEqual([
      'Rule "w": set dailyMax, weeklyMax or both',
    ]);
  });

  it('accepts a weekly cap on its own', () => {
    expect(validatePolicy(withRules({ type: 'rolling-window-cap', id: 'w', weeklyMax: 500, decision: 'ESCALATE' }))).toEqual(
      [],
    );
  });

  it('rejects a daily cap above the weekly cap, since it could never be reached', () => {
    expect(
      validatePolicy(withRules({ type: 'rolling-window-cap', id: 'w', dailyMax: 600, weeklyMax: 500, decision: 'DENY' })),
    ).toEqual(['Rule "w": dailyMax $600.00 is above weeklyMax $500.00, so the daily cap can never be reached']);
  });
});

describe('merchant-list', () => {
  it('needs exactly one list', () => {
    const both = { type: 'merchant-list', id: 'm', allowlist: ['FreshMart'], denylist: ['PulseOps'], decision: 'DENY' };
    const neither = { type: 'merchant-list', id: 'm', decision: 'DENY' };
    expect(validatePolicy(withRules(both))).toEqual(['Rule "m": set exactly one of allowlist or denylist']);
    expect(validatePolicy(withRules(neither))).toEqual(['Rule "m": set exactly one of allowlist or denylist']);
  });

  it('rejects an empty list', () => {
    expect(validatePolicy(withRules({ type: 'merchant-list', id: 'm', allowlist: [], decision: 'DENY' }))).toEqual([
      'Rule "m": allowlist must list at least one merchant',
    ]);
  });

  it('rejects a merchant name that is not in the catalogue, so a typo cannot silently never match', () => {
    const [problem] = validatePolicy(
      withRules({ type: 'merchant-list', id: 'm', denylist: ['Daily grind'], decision: 'DENY' }),
    );
    expect(problem).toMatch(/^Rule "m": denylist has unknown merchant "Daily grind" \(known: .*Daily Grind.*\)$/);
  });
});

describe('category-rule', () => {
  it('rejects unknown categories and decisions', () => {
    const problems = validatePolicy(
      withRules({ type: 'category-rule', id: 'c', categories: { weapons: 'DENY', software: 'MAYBE' } }),
    );
    expect(problems[0]).toMatch(/^Rule "c": unknown category "weapons" \(known: /);
    expect(problems[1]).toBe('Rule "c": category "software" must be ALLOW, DENY or ESCALATE');
  });

  it('rejects an empty mapping', () => {
    expect(validatePolicy(withRules({ type: 'category-rule', id: 'c', categories: {} }))).toEqual([
      'Rule "c": categories must map at least one category to a decision',
    ]);
  });
});

describe('velocity-limit', () => {
  it('needs a whole number of at least 1', () => {
    for (const maxPerHour of [0, 1.5, '5']) {
      expect(validatePolicy(withRules({ type: 'velocity-limit', id: 'v', maxPerHour, decision: 'DENY' }))).toEqual([
        'Rule "v": maxPerHour must be a whole number of at least 1',
      ]);
    }
  });
});
