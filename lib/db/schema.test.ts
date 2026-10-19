import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './schema';

const T0 = '2026-10-19T12:00:00.000Z';
const BEFORE_DEADLINE = '2026-10-20T11:00:00.000Z';
const DEADLINE = '2026-10-20T12:00:00.000Z';
const AFTER_DEADLINE = '2026-10-20T13:00:00.000Z';

let db: Database.Database;

function insertDecision(id: string, decision: 'ALLOW' | 'DENY' | 'ESCALATE') {
  db.prepare(
    `INSERT INTO decisions (id, agent_id, merchant, category, amount_value, amount_currency, amount_home_cents,
       home_currency, items_json, rationale, proposed_at, decision, rule_id, reason, evaluated_at, expires_at, created_at)
     VALUES (?, 'agent-1', 'CircuitHub', 'electronics', '443.49', 'USD', 44349, 'USD', '[]', 'r', ?, ?, 'rule', 'why', ?, ?, ?)`,
  ).run(id, T0, decision, T0, decision === 'ESCALATE' ? DEADLINE : null, T0);
}

function act(id: string, action: 'APPROVED' | 'REJECTED' | 'EXPIRED', at: string) {
  db.prepare('INSERT INTO human_actions (decision_id, action, by, at) VALUES (?, ?, ?, ?)').run(
    id,
    action,
    action === 'EXPIRED' ? 'system' : 'demo-user',
    at,
  );
}

function execute(id: string) {
  db.prepare('INSERT INTO executions (decision_id, paypal_order_id, status, captured_at) VALUES (?, ?, ?, ?)').run(
    id,
    'ORDER-1',
    'COMPLETED',
    T0,
  );
}

function status(id: string) {
  return (db.prepare('SELECT status FROM audit_rows WHERE id = ?').get(id) as { status: string }).status;
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

describe('schema setup', () => {
  it('reopens an existing database file without error and keeps its rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guardrails-'));
    const path = join(dir, 'test.db');
    try {
      const first = openDatabase(path);
      first.prepare("INSERT INTO policies (agent_id, id, rules_json, updated_at) VALUES ('a', 'p', '[]', ?)").run(T0);
      first.close();
      const second = openDatabase(path);
      expect(second.prepare('SELECT COUNT(*) AS n FROM policies').get()).toEqual({ n: 1 });
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('turns on foreign keys', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});

describe('append-only audit log', () => {
  it.each(['decisions', 'human_actions', 'executions'])('blocks UPDATE and DELETE on %s', (table) => {
    insertDecision('d1', 'ESCALATE');
    act('d1', 'APPROVED', BEFORE_DEADLINE);
    execute('d1');
    const key = table === 'decisions' ? 'id' : 'decision_id';
    expect(() => db.prepare(`UPDATE ${table} SET ${key} = ${key} WHERE ${key} = 'd1'`).run()).toThrow(
      'audit log is append-only',
    );
    expect(() => db.prepare(`DELETE FROM ${table} WHERE ${key} = 'd1'`).run()).toThrow('audit log is append-only');
  });

  it('requires an expiry time on ESCALATE and forbids it otherwise', () => {
    const insert = (decision: string, expiresAt: string | null) =>
      db
        .prepare(
          `INSERT INTO decisions (id, agent_id, merchant, category, amount_value, amount_currency, amount_home_cents,
             home_currency, items_json, rationale, proposed_at, decision, rule_id, reason, evaluated_at, expires_at, created_at)
           VALUES ('x', 'a', 'm', 'c', '1.00', 'USD', 100, 'USD', '[]', '', ?, ?, 'r', 'why', ?, ?, ?)`,
        )
        .run(T0, decision, T0, expiresAt, T0);
    expect(() => insert('ESCALATE', null)).toThrow();
    expect(() => insert('ALLOW', DEADLINE)).toThrow();
  });
});

describe('human actions', () => {
  it('are refused on ALLOW and DENY decisions', () => {
    insertDecision('allow', 'ALLOW');
    insertDecision('deny', 'DENY');
    expect(() => act('allow', 'APPROVED', BEFORE_DEADLINE)).toThrow('requires an ESCALATE decision');
    expect(() => act('deny', 'APPROVED', BEFORE_DEADLINE)).toThrow('requires an ESCALATE decision');
  });

  it('are refused for a decision that does not exist', () => {
    expect(() => act('missing', 'APPROVED', BEFORE_DEADLINE)).toThrow();
  });

  it('can only happen once per decision', () => {
    insertDecision('d1', 'ESCALATE');
    act('d1', 'REJECTED', BEFORE_DEADLINE);
    expect(() => act('d1', 'APPROVED', BEFORE_DEADLINE)).toThrow();
  });

  it('allow approval up to and including the deadline', () => {
    insertDecision('d1', 'ESCALATE');
    expect(() => act('d1', 'APPROVED', DEADLINE)).not.toThrow();
  });

  it('refuse approval after the deadline', () => {
    insertDecision('d1', 'ESCALATE');
    expect(() => act('d1', 'APPROVED', AFTER_DEADLINE)).toThrow('outside the approval window');
  });

  it('refuse marking expired before the deadline has passed', () => {
    insertDecision('d1', 'ESCALATE');
    expect(() => act('d1', 'EXPIRED', BEFORE_DEADLINE)).toThrow('outside the approval window');
    expect(() => act('d1', 'EXPIRED', AFTER_DEADLINE)).not.toThrow();
  });
});

describe('executions', () => {
  it('are allowed for an ALLOW decision', () => {
    insertDecision('d1', 'ALLOW');
    expect(() => execute('d1')).not.toThrow();
  });

  it('are refused for a DENY decision', () => {
    insertDecision('d1', 'DENY');
    expect(() => execute('d1')).toThrow('requires an ALLOW verdict or a human approval');
  });

  it('are refused for an ESCALATE decision until a human approves', () => {
    insertDecision('d1', 'ESCALATE');
    expect(() => execute('d1')).toThrow('requires an ALLOW verdict or a human approval');
    act('d1', 'APPROVED', BEFORE_DEADLINE);
    expect(() => execute('d1')).not.toThrow();
  });

  it('are refused after a rejection or expiry', () => {
    insertDecision('rejected', 'ESCALATE');
    insertDecision('expired', 'ESCALATE');
    act('rejected', 'REJECTED', BEFORE_DEADLINE);
    act('expired', 'EXPIRED', AFTER_DEADLINE);
    expect(() => execute('rejected')).toThrow();
    expect(() => execute('expired')).toThrow();
  });

  it('can only happen once per decision', () => {
    insertDecision('d1', 'ALLOW');
    execute('d1');
    expect(() => execute('d1')).toThrow();
  });
});

describe('audit_rows view', () => {
  it('derives a status for every stage of a decision', () => {
    insertDecision('denied', 'DENY');
    insertDecision('allowed', 'ALLOW');
    insertDecision('executed', 'ALLOW');
    insertDecision('pending', 'ESCALATE');
    insertDecision('rejected', 'ESCALATE');
    insertDecision('expired', 'ESCALATE');
    insertDecision('approved', 'ESCALATE');
    execute('executed');
    act('rejected', 'REJECTED', BEFORE_DEADLINE);
    act('expired', 'EXPIRED', AFTER_DEADLINE);
    act('approved', 'APPROVED', BEFORE_DEADLINE);

    expect(status('denied')).toBe('DENIED');
    expect(status('allowed')).toBe('AWAITING_EXECUTION');
    expect(status('executed')).toBe('EXECUTED');
    expect(status('pending')).toBe('PENDING');
    expect(status('rejected')).toBe('REJECTED');
    expect(status('expired')).toBe('EXPIRED');
    expect(status('approved')).toBe('AWAITING_EXECUTION');
  });

  it('exposes flat camelCase fields with the home amount in currency units', () => {
    insertDecision('d1', 'ALLOW');
    const row = db.prepare('SELECT * FROM audit_rows WHERE id = ?').get('d1') as Record<string, unknown>;
    expect(row).toMatchObject({ agentId: 'agent-1', amountHome: 443.49, homeCurrency: 'USD', ruleId: 'rule' });
  });
});
