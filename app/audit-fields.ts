import type { AgFieldDefinition } from 'ag-studio';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const text = (id: string, name: string): AgFieldDefinition => ({ id, name, format: 'textFormat' });

export const auditFields: AgFieldDefinition[] = [
  { id: 'createdAt', name: 'Time', format: 'dateTimeFormat' },
  text('status', 'Status'),
  text('decision', 'Verdict'),
  text('merchant', 'Merchant'),
  text('category', 'Category'),
  { id: 'amountHome', name: 'Amount (USD)', format: 'currencyFormat', formatOptions: { format: USD } },
  text('ruleId', 'Rule'),
  text('reason', 'Reason'),
  text('agentId', 'Agent'),
  text('paypalOrderId', 'PayPal order'),
];