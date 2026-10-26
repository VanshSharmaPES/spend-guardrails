import { catalogue } from '../catalogue';

const MERCHANTS = [...new Set(catalogue.map((i) => i.merchant))];
const CATEGORIES = [...new Set(catalogue.map((i) => i.category))];
const DECISIONS = ['ALLOW', 'DENY', 'ESCALATE'];
const BLOCKING_DECISIONS = ['DENY', 'ESCALATE'];

export class PolicyValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid policy: ${problems.join('; ')}`);
  }
}

type Fields = Record<string, unknown>;

const isFields = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const money = (n: number) => `$${n.toFixed(2)}`;

// Input comes from the policy editor, so it is checked as untrusted data rather than as a typed Policy.
export function validatePolicy(input: unknown): string[] {
  if (!isFields(input)) return ['Policy must be an object'];

  const problems: string[] = [];
  if (!isText(input.id)) problems.push('Policy id is required');
  if (!isText(input.agentId)) problems.push('Policy agentId is required');
  if (!Array.isArray(input.rules)) return [...problems, 'rules must be a list'];

  const ids = new Set<string>();
  input.rules.forEach((rule, index) => {
    const label = isFields(rule) && isText(rule.id) ? `Rule "${rule.id}"` : `Rule ${index + 1}`;
    if (!isFields(rule)) {
      problems.push(`${label} must be an object`);
      return;
    }
    if (!isText(rule.id)) problems.push(`${label} needs an id`);
    else if (ids.has(rule.id)) problems.push(`${label}: id is used by more than one rule`);
    else ids.add(rule.id);

    for (const problem of ruleProblems(rule)) problems.push(`${label}: ${problem}`);
  });
  return problems;
}

function ruleProblems(rule: Fields): string[] {
  const problems: string[] = [];
  const checkDecision = () => {
    if (!BLOCKING_DECISIONS.includes(rule.decision as string)) problems.push('decision must be DENY or ESCALATE');
  };

  switch (rule.type) {
    case 'per-transaction-cap':
      if (!isPositive(rule.maxAmount)) problems.push('maxAmount must be a positive number');
      checkDecision();
      break;

    case 'rolling-window-cap': {
      const { dailyMax, weeklyMax } = rule;
      if (dailyMax === undefined && weeklyMax === undefined) problems.push('set dailyMax, weeklyMax or both');
      if (dailyMax !== undefined && !isPositive(dailyMax)) problems.push('dailyMax must be a positive number');
      if (weeklyMax !== undefined && !isPositive(weeklyMax)) problems.push('weeklyMax must be a positive number');
      if (isPositive(dailyMax) && isPositive(weeklyMax) && dailyMax > weeklyMax) {
        problems.push(
          `dailyMax ${money(dailyMax)} is above weeklyMax ${money(weeklyMax)}, so the daily cap can never be reached`,
        );
      }
      checkDecision();
      break;
    }

    case 'merchant-list': {
      if ((rule.allowlist === undefined) === (rule.denylist === undefined)) {
        problems.push('set exactly one of allowlist or denylist');
      }
      for (const name of ['allowlist', 'denylist'] as const) {
        const list = rule[name];
        if (list === undefined) continue;
        if (!Array.isArray(list) || list.length === 0) {
          problems.push(`${name} must list at least one merchant`);
          continue;
        }
        for (const merchant of list) {
          if (!MERCHANTS.includes(merchant as string)) {
            problems.push(`${name} has unknown merchant ${JSON.stringify(merchant)} (known: ${MERCHANTS.join(', ')})`);
          }
        }
      }
      checkDecision();
      break;
    }

    case 'category-rule': {
      if (!isFields(rule.categories) || Object.keys(rule.categories).length === 0) {
        problems.push('categories must map at least one category to a decision');
        break;
      }
      for (const [category, decision] of Object.entries(rule.categories)) {
        if (!CATEGORIES.includes(category)) {
          problems.push(`unknown category "${category}" (known: ${CATEGORIES.join(', ')})`);
        }
        if (!DECISIONS.includes(decision as string)) {
          problems.push(`category "${category}" must be ALLOW, DENY or ESCALATE`);
        }
      }
      break;
    }

    case 'velocity-limit':
      if (!Number.isInteger(rule.maxPerHour) || (rule.maxPerHour as number) < 1) {
        problems.push('maxPerHour must be a whole number of at least 1');
      }
      checkDecision();
      break;

    default:
      problems.push(`unknown rule type ${JSON.stringify(rule.type)}`);
  }
  return problems;
}
