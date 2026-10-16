import type {
  PurchaseProposal,
  AuditEntry,
  PolicyVerdict,
  PerTransactionCapRule,
  RollingWindowCapRule,
  MerchantListRule,
  CategoryRule,
  VelocityLimitRule,
} from '../types';

export type RuleContext = {
  history: AuditEntry[]; // past entries for this agentId, any order
  now: string; // ISO evaluation time, injected so rules stay deterministic in tests
};

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

export function evaluatePerTransactionCap(
  proposal: PurchaseProposal,
  _context: RuleContext,
  rule: PerTransactionCapRule,
): PolicyVerdict | null {
  const amount = proposal.amountInHomeCurrency;
  if (amount <= rule.maxAmount) return null;
  return {
    decision: rule.decision,
    ruleId: rule.id,
    reason: `Exceeds per-transaction cap: ${formatMoney(amount)} > ${formatMoney(rule.maxAmount)}`,
    evaluatedAt: _context.now,
  };
}

export function evaluateRollingWindowCap(
  proposal: PurchaseProposal,
  context: RuleContext,
  rule: RollingWindowCapRule,
): PolicyVerdict | null {
  const amount = proposal.amountInHomeCurrency;

  const spentWithin = (days: number) =>
    context.history
      .filter((e) => e.proposal.agentId === proposal.agentId)
      .filter((e) => e.verdict.decision === 'ALLOW' || e.execution)
      .filter((e) => daysBetween(e.createdAt, context.now) <= days)
      .reduce((sum, e) => sum + e.proposal.amountInHomeCurrency,0);

  if (rule.dailyMax !== undefined) {
    const projected = spentWithin(1) + amount;
    if (projected > rule.dailyMax) {
      return {
        decision: rule.decision,
        ruleId: rule.id,
        reason: `Daily spend would reach ${formatMoney(projected)} of ${formatMoney(rule.dailyMax)} limit`,
        evaluatedAt: context.now,
      };
    }
  }

  if (rule.weeklyMax !== undefined) {
    const projected = spentWithin(7) + amount;
    if (projected > rule.weeklyMax) {
      return {
        decision: rule.decision,
        ruleId: rule.id,
        reason: `Weekly spend would reach ${formatMoney(projected)} of ${formatMoney(rule.weeklyMax)} limit`,
        evaluatedAt: context.now,
      };
    }
  }

  return null;
}

export function evaluateMerchantList(
  proposal: PurchaseProposal,
  context: RuleContext,
  rule: MerchantListRule,
): PolicyVerdict | null {
  if (rule.denylist?.includes(proposal.merchant)) {
    return {
      decision: rule.decision,
      ruleId: rule.id,
      reason: `Merchant "${proposal.merchant}" is on the denylist`,
      evaluatedAt: context.now,
    };
  }

  if (rule.allowlist && !rule.allowlist.includes(proposal.merchant)) {
    return {
      decision: rule.decision,
      ruleId: rule.id,
      reason: `Merchant "${proposal.merchant}" is not on the allowlist`,
      evaluatedAt: context.now,
    };
  }

  return null;
}

export function evaluateCategoryRule(
  proposal: PurchaseProposal,
  context: RuleContext,
  rule: CategoryRule,
): PolicyVerdict | null {
  const decision = rule.categories[proposal.category];
  if (!decision) return null;

  return {
    decision,
    ruleId: rule.id,
    reason: `Category "${proposal.category}" is configured as ${decision}`,
    evaluatedAt: context.now,
  };
}

export function evaluateVelocityLimit(
  proposal: PurchaseProposal,
  context: RuleContext,
  rule: VelocityLimitRule,
): PolicyVerdict | null {
  const countLastHour = context.history
    .filter((e) => e.proposal.agentId === proposal.agentId)
    .filter((e) => hoursBetween(e.createdAt, context.now) <= 1)
    .length;

  if (countLastHour < rule.maxPerHour) return null;

  return {
    decision: rule.decision,
    ruleId: rule.id,
    reason: `Velocity limit exceeded: ${countLastHour} purchases in the last hour >= limit of ${rule.maxPerHour}`,
    evaluatedAt: context.now,
  };
}
