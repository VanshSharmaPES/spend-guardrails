import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { catalogue, type CatalogueItem } from '../catalogue';
import { getHistory, getPolicy, recordDecision } from '../db/queries';
import { convertToHomeCurrency } from '../fx';
import { evaluate } from '../policy';
import type { AuditEntry, PurchaseProposal } from '../types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a purchasing agent. Given a goal, choose items to buy from the catalogue.
Rules:
- Use only skus that appear in the catalogue.
- Every item must come from the same merchant AND the same category.
- Quantities are positive whole numbers.
- If nothing in the catalogue fits the goal, return an empty items list.
- rationale: one or two sentences explaining the choice.`;

const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'purchase_proposal',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'rationale'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['sku', 'qty'],
            properties: { sku: { type: 'string' }, qty: { type: 'integer' } },
          },
        },
        rationale: { type: 'string' },
      },
    },
  },
};

type AgentPick = { items: { sku: string; qty: number }[]; rationale: string };

export class InvalidProposalError extends Error {}

async function askModel(goal: string): Promise<AgentPick> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const catalogueText = catalogue
    .map((i) => `- ${i.sku} | ${i.name} | ${i.category} | ${i.merchant} | ${i.price.value} ${i.price.currencyCode}`)
    .join('\n');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b',
      reasoning_effort: 'low',
      temperature: 0,
      response_format: RESPONSE_FORMAT,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Catalogue:\n${catalogueText}\n\nGoal: ${goal}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq request failed: HTTP ${res.status} ${await res.text()}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new InvalidProposalError('Model returned no content');

  try {
    return JSON.parse(content) as AgentPick;
  } catch {
    throw new InvalidProposalError(`Model returned invalid JSON: ${content}`);
  }
}

function resolveItems(pick: AgentPick): { item: CatalogueItem; qty: number }[] {
  if (!Array.isArray(pick.items) || pick.items.length === 0) {
    throw new InvalidProposalError('Agent found nothing in the catalogue for this goal');
  }
  return pick.items.map(({ sku, qty }) => {
    const item = catalogue.find((c) => c.sku === sku);
    if (!item) throw new InvalidProposalError(`Agent proposed unknown sku "${sku}"`);
    if (!Number.isInteger(qty) || qty < 1) throw new InvalidProposalError(`Invalid quantity ${qty} for ${sku}`);
    return { item, qty };
  });
}

export async function proposePurchase(
  goal: string,
  opts: { agentId: string; homeCurrency?: string; now?: Date },
): Promise<PurchaseProposal> {
  const pick = await askModel(goal);
  const lines = resolveItems(pick);

  // Merchant, category and price come from the catalogue, never from the model's text.
  const { merchant, category, price } = lines[0].item;
  for (const { item } of lines) {
    if (item.merchant !== merchant || item.category !== category || item.price.currencyCode !== price.currencyCode) {
      throw new InvalidProposalError(
        `Proposal mixes merchants or categories (${merchant}/${category} and ${item.merchant}/${item.category})`,
      );
    }
  }

  const totalCents = lines.reduce((sum, { item, qty }) => sum + Math.round(Number(item.price.value) * 100) * qty, 0);
  const value = (totalCents / 100).toFixed(2);

  return {
    id: randomUUID(),
    agentId: opts.agentId,
    merchant,
    category,
    amount: { value, currencyCode: price.currencyCode },
    amountInHomeCurrency: await convertToHomeCurrency(value, price.currencyCode, opts.homeCurrency ?? 'USD'),
    items: lines.map(({ item, qty }) => ({ sku: item.sku, name: item.name, qty })),
    rationale: typeof pick.rationale === 'string' ? pick.rationale : '',
    proposedAt: (opts.now ?? new Date()).toISOString(),
  };
}

export async function runAgentTurn(
  db: Database.Database,
  goal: string,
  opts: { agentId: string; homeCurrency?: string },
): Promise<AuditEntry> {
  const policy = getPolicy(db, opts.agentId);
  if (!policy) throw new Error(`No policy configured for agent ${opts.agentId}`);

  const now = new Date();
  const proposal = await proposePurchase(goal, { agentId: opts.agentId, homeCurrency: opts.homeCurrency, now });
  const nowIso = now.toISOString();
  const verdict = evaluate(proposal, { history: getHistory(db, opts.agentId, nowIso), now: nowIso }, policy);
  return recordDecision(db, proposal, verdict, opts.homeCurrency);
}

