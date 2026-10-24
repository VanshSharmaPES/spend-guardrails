import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase } from './schema';
import { getAuditRows, getPendingApprovals } from './queries';
import { AlreadySeededError, OPS_AGENT_ID, seedDemoData } from './seed';
import { DEMO_AGENT_ID, demoPolicy } from '../policy/demo';

const NOW = '2026-10-24T12:00:00.000Z';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

describe('seedDemoData', () => {
  it('produces every status the dashboard shows', () => {
    seedDemoData(db, NOW);
    const statuses = new Set(getAuditRows(db, NOW).map((r) => r.status));
    expect([...statuses].sort()).toEqual(
      ['AWAITING_EXECUTION', 'DENIED', 'EXECUTED', 'EXPIRED', 'PENDING', 'REJECTED'].sort(),
    );
  });

  it('makes every demo policy rule fire at least once', () => {
    seedDemoData(db, NOW);
    const ruleIds = new Set(getAuditRows(db, NOW).map((r) => r.ruleId));
    for (const rule of demoPolicy.rules) expect(ruleIds).toContain(rule.id);
  });

  it('covers both agents and leaves pending approvals inside their window', () => {
    const count = seedDemoData(db, NOW);
    const rows = getAuditRows(db, NOW);
    expect(rows).toHaveLength(count);
    expect(new Set(rows.map((r) => r.agentId))).toEqual(new Set([DEMO_AGENT_ID, OPS_AGENT_ID]));

    const pending = getPendingApprovals(db, NOW);
    expect(pending.length).toBeGreaterThan(0);
    for (const entry of pending) expect(entry.verdict.decision).toBe('ESCALATE');
  });

  it('refuses to seed twice', () => {
    seedDemoData(db, NOW);
    expect(() => seedDemoData(db, NOW)).toThrow(AlreadySeededError);
  });
});
