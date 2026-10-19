import type Database from 'better-sqlite3';
import type { AuditEntry, Decision, Policy, PolicyVerdict, PurchaseProposal } from '../types';

export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 7;

export class ApprovalError extends Error {}

type Row = {
  id: string;
  agent_id: string;
  merchant: string;
  category: string;
  amount_value: string;
  amount_currency: string;
  amount_home_cents: number;
  items_json: string;
  rationale: string;
  proposed_at: string;
  decision: Decision;
  rule_id: string;
  reason: string;
  evaluated_at: string;
  expires_at: string | null;
  created_at: string;
  h_action: 'APPROVED' | 'REJECTED' | 'EXPIRED' | null;
  h_by: string | null;
  h_at: string | null;
  e_order_id: string | null;
  e_status: string | null;
  e_captured_at: string | null;
};

const SELECT_ENTRIES = `
  SELECT d.*,
         h.action AS h_action, h.by AS h_by, h.at AS h_at,
         e.paypal_order_id AS e_order_id, e.status AS e_status, e.captured_at AS e_captured_at
  FROM decisions d
  LEFT JOIN human_actions h ON h.decision_id = d.id
  LEFT JOIN executions e ON e.decision_id = d.id`;

function toEntry(row: Row): AuditEntry {
  return {
    id: row.id,
    proposal: {
      id: row.id,
      agentId: row.agent_id,
      merchant: row.merchant,
      category: row.category,
      amount: { value: row.amount_value, currencyCode: row.amount_currency },
      amountInHomeCurrency: row.amount_home_cents / 100,
      items: JSON.parse(row.items_json),
      rationale: row.rationale,
      proposedAt: row.proposed_at,
    },
    verdict: { decision: row.decision, ruleId: row.rule_id, reason: row.reason, evaluatedAt: row.evaluated_at },
    humanAction: row.h_action ? { by: row.h_by!, decision: row.h_action, at: row.h_at! } : undefined,
    execution: row.e_order_id
      ? { paypalOrderId: row.e_order_id, status: row.e_status!, capturedAt: row.e_captured_at! }
      : undefined,
    createdAt: row.created_at,
  };
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export function recordDecision(
  db: Database.Database,
  proposal: PurchaseProposal,
  verdict: PolicyVerdict,
  homeCurrency = 'USD',
): AuditEntry {
  const createdAt = verdict.evaluatedAt;
  db.prepare(
    `INSERT INTO decisions (id, agent_id, merchant, category, amount_value, amount_currency, amount_home_cents,
       home_currency, items_json, rationale, proposed_at, decision, rule_id, reason, evaluated_at, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    proposal.id,
    proposal.agentId,
    proposal.merchant,
    proposal.category,
    proposal.amount.value,
    proposal.amount.currencyCode,
    Math.round(proposal.amountInHomeCurrency * 100),
    homeCurrency,
    JSON.stringify(proposal.items),
    proposal.rationale,
    proposal.proposedAt,
    verdict.decision,
    verdict.ruleId,
    verdict.reason,
    verdict.evaluatedAt,
    verdict.decision === 'ESCALATE' ? addMs(verdict.evaluatedAt, APPROVAL_TTL_MS) : null,
    createdAt,
  );
  return getAuditEntry(db, proposal.id)!;
}

export function getAuditEntry(db: Database.Database, id: string): AuditEntry | undefined {
  const row = db.prepare(`${SELECT_ENTRIES} WHERE d.id = ?`).get(id) as Row | undefined;
  return row && toEntry(row);
}

export function getHistory(db: Database.Database, agentId: string, now: string): AuditEntry[] {
  const since = addMs(now, -HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const rows = db
    .prepare(`${SELECT_ENTRIES} WHERE d.agent_id = ? AND d.created_at >= ? AND d.created_at <= ? ORDER BY d.created_at`)
    .all(agentId, since, now) as Row[];
  return rows.map(toEntry);
}

export function expireOverdue(db: Database.Database, now: string): number {
  return db
    .prepare(
      `INSERT INTO human_actions (decision_id, action, by, at)
       SELECT d.id, 'EXPIRED', 'system', ?
       FROM decisions d
       LEFT JOIN human_actions h ON h.decision_id = d.id
       WHERE d.decision = 'ESCALATE' AND h.decision_id IS NULL AND d.expires_at < ?`,
    )
    .run(now, now).changes;
}

export function getPendingApprovals(db: Database.Database, now: string): AuditEntry[] {
  expireOverdue(db, now);
  const rows = db
    .prepare(`${SELECT_ENTRIES} WHERE d.decision = 'ESCALATE' AND h.decision_id IS NULL ORDER BY d.expires_at`)
    .all() as Row[];
  return rows.map(toEntry);
}

export function resolveApproval(
  db: Database.Database,
  decisionId: string,
  action: 'APPROVED' | 'REJECTED',
  by: string,
  now: string,
): AuditEntry {
  // Outside the transaction: a refused late approval must not roll back the expiry it triggered.
  expireOverdue(db, now);
  return db.transaction(() => {
    const entry = getAuditEntry(db, decisionId);
    if (!entry) throw new ApprovalError(`No decision with id ${decisionId}`);
    if (entry.verdict.decision !== 'ESCALATE') {
      throw new ApprovalError(`Decision ${decisionId} is ${entry.verdict.decision}, not awaiting approval`);
    }
    if (entry.humanAction?.decision === 'EXPIRED') {
      throw new ApprovalError(`Approval window for ${decisionId} expired at ${entry.humanAction.at}`);
    }
    if (entry.humanAction) {
      throw new ApprovalError(`Decision ${decisionId} was already ${entry.humanAction.decision.toLowerCase()}`);
    }
    db.prepare('INSERT INTO human_actions (decision_id, action, by, at) VALUES (?, ?, ?, ?)').run(
      decisionId,
      action,
      by,
      now,
    );
    return getAuditEntry(db, decisionId)!;
  })();
}

export function recordExecution(
  db: Database.Database,
  decisionId: string,
  execution: NonNullable<AuditEntry['execution']>,
): AuditEntry {
  db.prepare('INSERT INTO executions (decision_id, paypal_order_id, status, captured_at) VALUES (?, ?, ?, ?)').run(
    decisionId,
    execution.paypalOrderId,
    execution.status,
    execution.capturedAt,
  );
  return getAuditEntry(db, decisionId)!;
}

export function savePolicy(db: Database.Database, policy: Policy, now: string): void {
  db.prepare(
    `INSERT INTO policies (agent_id, id, rules_json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (agent_id) DO UPDATE SET id = excluded.id, rules_json = excluded.rules_json, updated_at = excluded.updated_at`,
  ).run(policy.agentId, policy.id, JSON.stringify(policy.rules), now);
}

export function getPolicy(db: Database.Database, agentId: string): Policy | undefined {
  const row = db.prepare('SELECT id, agent_id, rules_json FROM policies WHERE agent_id = ?').get(agentId) as
    | { id: string; agent_id: string; rules_json: string }
    | undefined;
  return row && { id: row.id, agentId: row.agent_id, rules: JSON.parse(row.rules_json) };
}
