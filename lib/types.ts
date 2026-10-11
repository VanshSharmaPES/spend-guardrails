export type Decision = 'ALLOW' | 'DENY' | 'ESCALATE';

export type PurchaseProposal = {
  id: string;
  agentId: string;
  merchant: string;
  category: string;
  amount: { value: string; currencyCode: string };
  items: { sku: string; name: string; qty: number }[];
  proposedAt: string; // ISO
};

export type PolicyVerdict = {
  decision: Decision;
  ruleId: string; // which rule produced it
  reason: string; // human-readable, shown in the UI
  evaluatedAt: string; // ISO
};
