export type Decision = 'ALLOW' | 'DENY' | 'ESCALATE';

export type Money = { value: string; currencyCode: string };

export type PurchaseProposal = {
  id: string;
  agentId: string;
  merchant: string;
  category: string;
  amount: Money;
  amountInHomeCurrency: number;
  items: { sku: string; name: string; qty: number }[];
  rationale: string; // the agent's stated reason — display only, never an input to policy
  proposedAt: string; // ISO
};

export type PolicyVerdict = {
  decision: Decision;
  ruleId: string; // which rule fired
  reason: string; // human-readable, shown in the UI
  evaluatedAt: string; // ISO
};

export type PerTransactionCapRule = {
  type: 'per-transaction-cap';
  id: string;
  maxAmount: number;
  decision: 'DENY' | 'ESCALATE';
};

export type RollingWindowCapRule = {
  type: 'rolling-window-cap';
  id: string;
  dailyMax?: number;
  weeklyMax?: number;
  decision: 'DENY' | 'ESCALATE';
};

export type MerchantListRule = {
  type: 'merchant-list';
  id: string;
  allowlist?: string[];
  denylist?: string[];
  decision: 'DENY' | 'ESCALATE';
};

export type CategoryRule = {
  type: 'category-rule';
  id: string;
  categories: Record<string, Decision>;
};

export type VelocityLimitRule = {
  type: 'velocity-limit';
  id: string;
  maxPerHour: number;
  decision: 'DENY' | 'ESCALATE';
};

export type Rule =
  | PerTransactionCapRule
  | RollingWindowCapRule
  | MerchantListRule
  | CategoryRule
  | VelocityLimitRule;

export type Policy = {
  id: string;
  agentId: string;
  rules: Rule[];
};

export type AuditEntry = {
  id: string;
  proposal: PurchaseProposal;
  verdict: PolicyVerdict;
  humanAction?: { by: string; decision: 'APPROVED' | 'REJECTED' | 'EXPIRED'; at: string };
  execution?: { paypalOrderId: string; status: string; capturedAt: string };
  createdAt: string;
};
