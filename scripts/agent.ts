import { randomUUID } from 'node:crypto';
import { InvalidProposalError, runAgentTurn } from '../lib/agent/propose';
import type { AuditEntry, Policy } from '../lib/types';

const AGENT_ID = 'demo-agent';

const demoPolicy: Policy = {
  id: 'demo-policy',
  agentId: AGENT_ID,
  rules: [
    { type: 'per-transaction-cap', id: 'cap-review', maxAmount: 100, decision: 'ESCALATE' },
    { type: 'per-transaction-cap', id: 'cap-hard', maxAmount: 1000, decision: 'DENY' },
    { type: 'rolling-window-cap', id: 'spend-window', dailyMax: 500, weeklyMax: 2000, decision: 'ESCALATE' },
    { type: 'merchant-list', id: 'merchant-denylist', denylist: ['Daily Grind'], decision: 'DENY' },
    {
      type: 'category-rule',
      id: 'categories',
      categories: { groceries: 'ALLOW', office: 'ALLOW', electronics: 'ALLOW', software: 'DENY' },
    },
    { type: 'velocity-limit', id: 'velocity', maxPerHour: 5, decision: 'DENY' },
  ],
};

async function main() {
  const goals = process.argv.slice(2);
  if (goals.length === 0) {
    console.error('Usage: npm run agent -- "<goal>" ["<another goal>" ...]');
    process.exit(1);
  }

  // In-memory only: later goals in the same run see earlier spend, nothing is persisted.
  const history: AuditEntry[] = [];

  for (const goal of goals) {
    console.log(`\nGoal: ${goal}`);
    try {
      const { proposal, verdict } = await runAgentTurn(goal, { agentId: AGENT_ID, policy: demoPolicy, history });
      const native = `${proposal.amount.value} ${proposal.amount.currencyCode}`;
      const home = `$${proposal.amountInHomeCurrency.toFixed(2)} USD`;

      console.log(`  Proposal  ${proposal.merchant} / ${proposal.category}`);
      for (const item of proposal.items) console.log(`            ${item.qty} x ${item.name} (${item.sku})`);
      console.log(`  Total     ${native}${proposal.amount.currencyCode === 'USD' ? '' : ` = ${home}`}`);
      console.log(`  Rationale ${proposal.rationale}  [agent's words, not used by policy]`);
      console.log(`  Verdict   ${verdict.decision}  (rule: ${verdict.ruleId})`);
      console.log(`  Reason    ${verdict.reason}`);

      history.push({ id: randomUUID(), proposal, verdict, createdAt: verdict.evaluatedAt });
    } catch (err) {
      const label = err instanceof InvalidProposalError ? 'Rejected before policy' : 'Error';
      console.log(`  ${label}: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
