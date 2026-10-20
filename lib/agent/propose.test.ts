import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase } from '../db/schema';
import { getAuditEntry, savePolicy } from '../db/queries';
import { InvalidProposalError, runAgentTurn } from './propose';

let db: Database.Database;

function groqReplies(...picks: { items: { sku: string; qty: number }[]; rationale: string }[]) {
  const fetchMock = vi.fn();
  for (const pick of picks) {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(pick) } }] }), { status: 200 }),
    );
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  db = openDatabase(':memory:');
  vi.stubEnv('GROQ_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('runAgentTurn', () => {
  it('saves every decision, and the next turn sees it in its history', async () => {
    savePolicy(
      db,
      { id: 'pol', agentId: 'agent-1', rules: [{ type: 'velocity-limit', id: 'velocity', maxPerHour: 1, decision: 'DENY' }] },
      new Date().toISOString(),
    );
    groqReplies(
      { items: [{ sku: 'GRO-002', qty: 1 }], rationale: 'milk' },
      { items: [{ sku: 'GRO-003', qty: 1 }], rationale: 'bread' },
    );

    const first = await runAgentTurn(db, 'buy milk', { agentId: 'agent-1' });
    const second = await runAgentTurn(db, 'buy bread', { agentId: 'agent-1' });

    expect(first.verdict).toMatchObject({ decision: 'ALLOW', ruleId: 'default-allow' });
    expect(second.verdict).toMatchObject({ decision: 'DENY', ruleId: 'velocity' });
    expect(getAuditEntry(db, first.id)?.proposal.merchant).toBe('FreshMart');
    expect(getAuditEntry(db, second.id)?.verdict.decision).toBe('DENY');
  });

  it('takes price, merchant and category from the catalogue, not the model', async () => {
    savePolicy(db, { id: 'pol', agentId: 'agent-1', rules: [] }, new Date().toISOString());
    groqReplies({ items: [{ sku: 'ELE-003', qty: 2 }], rationale: 'monitors' });

    const entry = await runAgentTurn(db, 'two monitors', { agentId: 'agent-1' });

    expect(entry.proposal).toMatchObject({
      merchant: 'CircuitHub',
      category: 'electronics',
      amount: { value: '658.00', currencyCode: 'USD' },
      amountInHomeCurrency: 658,
    });
  });

  it('records nothing when the proposal is rejected before policy', async () => {
    savePolicy(db, { id: 'pol', agentId: 'agent-1', rules: [] }, new Date().toISOString());
    groqReplies({ items: [{ sku: 'NOT-A-SKU', qty: 1 }], rationale: 'made up' });

    await expect(runAgentTurn(db, 'anything', { agentId: 'agent-1' })).rejects.toThrow(InvalidProposalError);
    expect(db.prepare('SELECT COUNT(*) AS n FROM decisions').get()).toEqual({ n: 0 });
  });

  it('refuses to run for an agent with no policy, before calling the model', async () => {
    const fetchMock = groqReplies({ items: [{ sku: 'GRO-002', qty: 1 }], rationale: 'milk' });

    await expect(runAgentTurn(db, 'buy milk', { agentId: 'nobody' })).rejects.toThrow('No policy configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
