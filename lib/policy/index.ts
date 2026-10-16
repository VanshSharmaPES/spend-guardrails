import type { PurchaseProposal, Policy, PolicyVerdict } from '../types';
import {
  evaluatePerTransactionCap,
  evaluateRollingWindowCap,
  evaluateMerchantList,
  evaluateCategoryRule,
  evaluateVelocityLimit,
  type RuleContext,
} from './rules';

const SEVERITY: Record<PolicyVerdict['decision'], number> = {
  DENY: 2,
  ESCALATE: 1,
  ALLOW: 0,
};

export function evaluate(
  proposal: PurchaseProposal,
  context: RuleContext,
  policy: Policy,
): PolicyVerdict {
  const verdicts: PolicyVerdict[] = [];

  for (const rule of policy.rules) {
    let verdict: PolicyVerdict | null;
    switch (rule.type) {
      case 'per-transaction-cap':
        verdict = evaluatePerTransactionCap(proposal, context, rule);
        break;
      case 'rolling-window-cap':
        verdict = evaluateRollingWindowCap(proposal, context, rule);
        break;
      case 'merchant-list':
        verdict = evaluateMerchantList(proposal, context, rule);
        break;
      case 'category-rule':
        verdict = evaluateCategoryRule(proposal, context, rule);
        break;
      case 'velocity-limit':
        verdict = evaluateVelocityLimit(proposal, context, rule);
        break;
    }
    if (verdict) verdicts.push(verdict);
  }

  if (verdicts.length === 0) {
    return {
      decision: 'ALLOW',
      ruleId: 'default-allow',
      reason: 'No rule matched; defaulting to allow',
      evaluatedAt: context.now,
    };
  }

  return verdicts.reduce((most, v) =>
    SEVERITY[v.decision] > SEVERITY[most.decision] ? v : most,
  );
}
