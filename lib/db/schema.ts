import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const APPEND_ONLY_TABLES = ['decisions', 'human_actions', 'executions'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS decisions (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  merchant          TEXT NOT NULL,
  category          TEXT NOT NULL,
  amount_value      TEXT NOT NULL,
  amount_currency   TEXT NOT NULL,
  amount_home_cents INTEGER NOT NULL,
  home_currency     TEXT NOT NULL,
  items_json        TEXT NOT NULL,
  rationale         TEXT NOT NULL,
  proposed_at       TEXT NOT NULL,
  decision          TEXT NOT NULL CHECK (decision IN ('ALLOW', 'DENY', 'ESCALATE')),
  rule_id           TEXT NOT NULL,
  reason            TEXT NOT NULL,
  evaluated_at      TEXT NOT NULL,
  expires_at        TEXT,
  created_at        TEXT NOT NULL,
  CHECK ((decision = 'ESCALATE') = (expires_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS decisions_agent_created ON decisions (agent_id, created_at);

CREATE TABLE IF NOT EXISTS human_actions (
  decision_id TEXT PRIMARY KEY REFERENCES decisions (id),
  action      TEXT NOT NULL CHECK (action IN ('APPROVED', 'REJECTED', 'EXPIRED')),
  by          TEXT NOT NULL,
  at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS executions (
  decision_id     TEXT PRIMARY KEY REFERENCES decisions (id),
  paypal_order_id TEXT NOT NULL,
  status          TEXT NOT NULL,
  captured_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policies (
  agent_id   TEXT PRIMARY KEY,
  id         TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

${APPEND_ONLY_TABLES.map(
  (t) => `
CREATE TRIGGER IF NOT EXISTS ${t}_no_update BEFORE UPDATE ON ${t}
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ${t}_no_delete BEFORE DELETE ON ${t}
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;`,
).join('\n')}

CREATE TRIGGER IF NOT EXISTS human_actions_only_escalated BEFORE INSERT ON human_actions
WHEN (SELECT decision FROM decisions WHERE id = NEW.decision_id) IS NOT 'ESCALATE'
BEGIN SELECT RAISE(ABORT, 'human action requires an ESCALATE decision'); END;

-- Timestamps are ISO-8601 UTC strings, so string comparison is time order.
CREATE TRIGGER IF NOT EXISTS human_actions_respect_deadline BEFORE INSERT ON human_actions
WHEN (NEW.action IN ('APPROVED', 'REJECTED') AND NEW.at > (SELECT expires_at FROM decisions WHERE id = NEW.decision_id))
  OR (NEW.action = 'EXPIRED' AND NEW.at <= (SELECT expires_at FROM decisions WHERE id = NEW.decision_id))
BEGIN SELECT RAISE(ABORT, 'action is outside the approval window'); END;

CREATE TRIGGER IF NOT EXISTS executions_require_approval BEFORE INSERT ON executions
WHEN NOT EXISTS (
  SELECT 1 FROM decisions d
  LEFT JOIN human_actions h ON h.decision_id = d.id
  WHERE d.id = NEW.decision_id
    AND (d.decision = 'ALLOW' OR (d.decision = 'ESCALATE' AND h.action = 'APPROVED'))
)
BEGIN SELECT RAISE(ABORT, 'execution requires an ALLOW verdict or a human approval'); END;

CREATE VIEW IF NOT EXISTS audit_rows AS
SELECT
  d.id,
  d.agent_id                 AS agentId,
  d.merchant,
  d.category,
  d.amount_value             AS amountValue,
  d.amount_currency          AS amountCurrency,
  d.amount_home_cents / 100.0 AS amountHome,
  d.home_currency            AS homeCurrency,
  d.decision,
  d.rule_id                  AS ruleId,
  d.reason,
  d.rationale,
  d.created_at               AS createdAt,
  d.expires_at               AS expiresAt,
  h.action                   AS humanAction,
  h.by                       AS humanBy,
  h.at                       AS humanAt,
  e.paypal_order_id          AS paypalOrderId,
  e.status                   AS executionStatus,
  e.captured_at              AS capturedAt,
  CASE
    WHEN e.decision_id IS NOT NULL THEN 'EXECUTED'
    WHEN d.decision = 'DENY' THEN 'DENIED'
    WHEN h.action = 'REJECTED' THEN 'REJECTED'
    WHEN h.action = 'EXPIRED' THEN 'EXPIRED'
    WHEN d.decision = 'ESCALATE' AND h.action IS NULL THEN 'PENDING'
    ELSE 'AWAITING_EXECUTION'
  END                        AS status
FROM decisions d
LEFT JOIN human_actions h ON h.decision_id = d.id
LEFT JOIN executions e ON e.decision_id = d.id;
`;

export function openDatabase(path = process.env.DATABASE_PATH ?? 'data/guardrails.db'): Database.Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
