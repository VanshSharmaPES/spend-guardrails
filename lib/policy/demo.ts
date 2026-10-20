import type { Policy } from '../types';

export const DEMO_AGENT_ID = 'demo-agent';

export const demoPolicy: Policy = {
  id: 'demo-policy',
  agentId: DEMO_AGENT_ID,
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
