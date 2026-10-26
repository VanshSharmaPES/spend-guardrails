import { InvalidProposalError, runAgentTurn } from '../lib/agent/propose';
import { getDb } from '../lib/db';
import { DEMO_AGENT_ID } from '../lib/policy/demo';

async function main() {
  const goals = process.argv.slice(2);
  if (goals.length === 0) {
    console.error('Usage: npm run agent -- "<goal>" ["<another goal>" ...]');
    process.exit(1);
  }

  const db = getDb();

  for (const goal of goals) {
    console.log(`\nGoal: ${goal}`);
    try {
      const { id, proposal, verdict } = await runAgentTurn(db, goal, { agentId: DEMO_AGENT_ID });
      const native = `${proposal.amount.value} ${proposal.amount.currencyCode}`;
      const home = `$${proposal.amountInHomeCurrency.toFixed(2)} USD`;

      console.log(`  Proposal  ${proposal.merchant} / ${proposal.category}`);
      for (const item of proposal.items) console.log(`            ${item.qty} x ${item.name} (${item.sku})`);
      console.log(`  Total     ${native}${proposal.amount.currencyCode === 'USD' ? '' : ` = ${home}`}`);
      console.log(`  Rationale ${proposal.rationale}  [agent's words, not used by policy]`);
      console.log(`  Verdict   ${verdict.decision}  (rule: ${verdict.ruleId})`);
      console.log(`  Reason    ${verdict.reason}`);
      console.log(`  Saved     audit entry ${id}`);
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
