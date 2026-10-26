import type Database from 'better-sqlite3';
import { catalogue } from '../catalogue';
import { evaluate } from '../policy';
import { DEMO_AGENT_ID, demoPolicy } from '../policy/demo';
import type { PurchaseProposal } from '../types';
import { ensurePolicy, getHistory, getPolicy, recordDecision, recordExecution, resolveApproval } from './queries';

export const OPS_AGENT_ID = 'ops-agent';
const SEED_PREFIX = 'seed-';
const REVIEWER = 'manager@demo';

// What happens after the policy engine decides. ALLOW defaults to executed; ESCALATE defaults to untouched,
// so it ends up PENDING if under 24 hours old and EXPIRED otherwise.
type FollowUp = 'approve' | 'approve-only' | 'reject' | 'hold';

type SeedPurchase = {
  agentId: string;
  hoursAgo: number;
  items: [sku: string, qty: number][];
  rationale: string;
  then?: FollowUp;
};

const D = DEMO_AGENT_ID;
const O = OPS_AGENT_ID;

const PURCHASES: SeedPurchase[] = [
  { agentId: D, hoursAgo: 160, items: [['OFF-001', 2]], rationale: 'Printer is out of paper.' },
  { agentId: O, hoursAgo: 155, items: [['SFT-005', 10]], rationale: 'Password manager seats for the ops team.' },
  { agentId: D, hoursAgo: 152, items: [['GRO-002', 2], ['GRO-003', 1]], rationale: 'Kitchen restock for the week.' },
  { agentId: D, hoursAgo: 148, items: [['ELE-003', 1]], rationale: 'Second monitor for the new hire.', then: 'approve' },
  { agentId: D, hoursAgo: 140, items: [['SFT-001', 5]], rationale: 'Project tracker seats for the team.' },
  { agentId: D, hoursAgo: 130, items: [['GRO-005', 2]], rationale: 'Coffee for the office.' },
  { agentId: O, hoursAgo: 122, items: [['GRO-001', 10]], rationale: 'Fruit for the team offsite.' },
  { agentId: D, hoursAgo: 120, items: [['OFF-002', 5]], rationale: 'Standing desks for the whole pod.' },
  { agentId: D, hoursAgo: 110, items: [['ELE-002', 2]], rationale: 'Replacement mice for two broken ones.' },
  { agentId: D, hoursAgo: 100, items: [['OFF-003', 1]], rationale: 'Ergonomic chair requested by a developer.', then: 'reject' },
  { agentId: O, hoursAgo: 96, items: [['ELE-005', 2]], rationale: 'Backup drives for the build machines.', then: 'approve' },
  // Small purchases on the same day push the ops agent past its $500 daily budget.
  { agentId: O, hoursAgo: 95.5, items: [['ELE-004', 1]], rationale: 'Keyboard for the build station.' },
  { agentId: O, hoursAgo: 95, items: [['OFF-001', 14]], rationale: 'Paper for printed runbooks.' },
  { agentId: O, hoursAgo: 94.5, items: [['ELE-002', 4]], rationale: 'Mice for the on-call laptops.', then: 'reject' },
  { agentId: D, hoursAgo: 90, items: [['ELE-001', 3]], rationale: 'Spare charging cables for the meeting rooms.' },
  { agentId: D, hoursAgo: 80, items: [['ELE-005', 1]], rationale: 'External SSD for design assets.' },
  { agentId: D, hoursAgo: 72, items: [['OFF-004', 2]], rationale: 'Whiteboard markers ran dry.' },
  { agentId: O, hoursAgo: 70, items: [['OFF-005', 8]], rationale: 'Headphones for the whole support team.' },
  { agentId: D, hoursAgo: 60, items: [['ELE-004', 1]], rationale: 'Keyboard for the new developer.' },
  { agentId: D, hoursAgo: 50, items: [['OFF-005', 1]], rationale: 'Noise-cancelling headphones for focus work.', then: 'approve' },
  { agentId: O, hoursAgo: 48, items: [['GRO-003', 4]], rationale: 'Bread for the team lunch.' },
  { agentId: D, hoursAgo: 40, items: [['GRO-004', 2]], rationale: 'Eggs for the office breakfast.' },
  { agentId: D, hoursAgo: 30, items: [['OFF-002', 1]], rationale: 'Standing desk for a back-pain request.' },
  { agentId: O, hoursAgo: 26, items: [['ELE-004', 3]], rationale: 'Keyboards for three new support hires.', then: 'reject' },
  // A burst: the sixth purchase inside one hour trips the velocity limit.
  { agentId: D, hoursAgo: 20, items: [['GRO-001', 6]], rationale: 'Bananas for the snack shelf.' },
  { agentId: D, hoursAgo: 19.9, items: [['GRO-002', 1]], rationale: 'Milk for the coffee machine.' },
  { agentId: D, hoursAgo: 19.8, items: [['OFF-004', 1]], rationale: 'More whiteboard markers.' },
  { agentId: D, hoursAgo: 19.7, items: [['ELE-001', 1]], rationale: 'One more USB-C cable.' },
  { agentId: D, hoursAgo: 19.6, items: [['OFF-001', 1]], rationale: 'Extra printer paper.' },
  { agentId: D, hoursAgo: 19.5, items: [['GRO-003', 1]], rationale: 'Bread for sandwiches.' },
  { agentId: O, hoursAgo: 12, items: [['OFF-004', 5]], rationale: 'Markers for the planning room.' },
  { agentId: D, hoursAgo: 6, items: [['ELE-003', 1]], rationale: 'Monitor for the design lead.', then: 'approve-only' },
  { agentId: D, hoursAgo: 3, items: [['OFF-003', 1]], rationale: 'Chair for the new hire.' },
  { agentId: O, hoursAgo: 2, items: [['ELE-002', 6]], rationale: 'Mice for the support desk.' },
  { agentId: D, hoursAgo: 1, items: [['OFF-001', 3]], rationale: 'Paper for the quarterly print run.', then: 'hold' },
];

export class AlreadySeededError extends Error {}

function hoursBefore(now: string, hours: number): string {
  return new Date(Date.parse(now) - hours * 3_600_000).toISOString();
}

function toProposal(p: SeedPurchase, id: string, proposedAt: string): PurchaseProposal {
  const lines = p.items.map(([sku, qty]) => {
    const item = catalogue.find((c) => c.sku === sku);
    if (!item) throw new Error(`Seed uses unknown sku ${sku}`);
    return { item, qty };
  });
  const cents = lines.reduce((sum, { item, qty }) => sum + Math.round(Number(item.price.value) * 100) * qty, 0);
  const { merchant, category, price } = lines[0].item;
  return {
    id,
    agentId: p.agentId,
    merchant,
    category,
    amount: { value: (cents / 100).toFixed(2), currencyCode: price.currencyCode },
    amountInHomeCurrency: cents / 100,
    items: lines.map(({ item, qty }) => ({ sku: item.sku, name: item.name, qty })),
    rationale: p.rationale,
    proposedAt,
  };
}

// Fills the database with demo decisions. Every verdict comes from the real policy engine; only the
// human clicks and the PayPal order ids are scripted. The order ids are fake (SEED-...) and do not exist in PayPal.
export function seedDemoData(db: Database.Database, now = new Date().toISOString()): number {
  if (db.prepare(`SELECT 1 FROM decisions WHERE id LIKE '${SEED_PREFIX}%'`).get()) {
    throw new AlreadySeededError('Database already holds seed data');
  }
  for (const agentId of [DEMO_AGENT_ID, OPS_AGENT_ID]) {
    ensurePolicy(db, { ...demoPolicy, id: `${agentId}-policy`, agentId }, now);
  }

  db.transaction(() => {
    PURCHASES.forEach((p, i) => {
      const id = `${SEED_PREFIX}${String(i + 1).padStart(2, '0')}`;
      const createdAt = hoursBefore(now, p.hoursAgo);
      const proposal = toProposal(p, id, createdAt);
      const policy = getPolicy(db, p.agentId)!;
      const verdict = evaluate(proposal, { history: getHistory(db, p.agentId, createdAt), now: createdAt }, policy);
      recordDecision(db, proposal, verdict);

      const expected = { approve: 'ESCALATE', 'approve-only': 'ESCALATE', reject: 'ESCALATE', hold: 'ALLOW' } as const;
      if (p.then && expected[p.then] !== verdict.decision) {
        throw new Error(`Seed ${id} expects ${expected[p.then]} but the policy said ${verdict.decision} (${verdict.reason})`);
      }

      const approvedAt = hoursBefore(createdAt, -0.5);
      if (p.then === 'reject') resolveApproval(db, id, 'REJECTED', REVIEWER, approvedAt);
      if (p.then === 'approve' || p.then === 'approve-only') resolveApproval(db, id, 'APPROVED', REVIEWER, approvedAt);

      const executes = p.then === 'approve' || (verdict.decision === 'ALLOW' && p.then !== 'hold');
      if (executes) {
        recordExecution(db, id, {
          paypalOrderId: `SEED-${String(i + 1).padStart(4, '0')}`,
          status: 'COMPLETED',
          capturedAt: hoursBefore(p.then === 'approve' ? approvedAt : createdAt, -0.05),
        });
      }
    });
  })();
  return PURCHASES.length;
}
