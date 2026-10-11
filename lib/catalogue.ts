import type { PurchaseProposal } from './types';

export type CatalogueItem = {
  sku: string;
  name: string;
  category: string;
  price: { value: string; currencyCode: string };
  merchant: string;
};

export const catalogue: CatalogueItem[] = [
  { sku: 'GRO-001', name: 'Organic bananas (1 lb)', category: 'groceries', price: { value: '0.69', currencyCode: 'USD' }, merchant: 'FreshMart' },
  { sku: 'GRO-002', name: 'Whole milk (1 gal)', category: 'groceries', price: { value: '3.49', currencyCode: 'USD' }, merchant: 'FreshMart' },
  { sku: 'GRO-003', name: 'Sourdough loaf', category: 'groceries', price: { value: '4.99', currencyCode: 'USD' }, merchant: 'FreshMart' },
  { sku: 'GRO-004', name: 'Free-range eggs (dozen)', category: 'groceries', price: { value: '5.29', currencyCode: 'USD' }, merchant: 'FreshMart' },
  { sku: 'GRO-005', name: 'Ground coffee (12 oz)', category: 'groceries', price: { value: '8.99', currencyCode: 'USD' }, merchant: 'Daily Grind' },
  { sku: 'ELE-001', name: 'USB-C charging cable (2m)', category: 'electronics', price: { value: '12.99', currencyCode: 'USD' }, merchant: 'CircuitHub' },
  { sku: 'ELE-002', name: 'Wireless mouse', category: 'electronics', price: { value: '24.99', currencyCode: 'USD' }, merchant: 'CircuitHub' },
  { sku: 'ELE-003', name: '27" 4K monitor', category: 'electronics', price: { value: '329.00', currencyCode: 'USD' }, merchant: 'CircuitHub' },
  { sku: 'ELE-004', name: 'Mechanical keyboard', category: 'electronics', price: { value: '89.50', currencyCode: 'USD' }, merchant: 'CircuitHub' },
  { sku: 'ELE-005', name: 'External SSD (1TB)', category: 'electronics', price: { value: '109.99', currencyCode: 'USD' }, merchant: 'CircuitHub' },
  { sku: 'SFT-001', name: 'Project management seat (monthly)', category: 'software', price: { value: '15.00', currencyCode: 'USD' }, merchant: 'CloudWorks' },
  { sku: 'SFT-002', name: 'Vector design tool (annual)', category: 'software', price: { value: '199.00', currencyCode: 'USD' }, merchant: 'CloudWorks' },
  { sku: 'SFT-003', name: 'CI/CD pipeline add-on', category: 'software', price: { value: '49.00', currencyCode: 'USD' }, merchant: 'CloudWorks' },
  { sku: 'SFT-004', name: 'API monitoring plan', category: 'software', price: { value: '79.00', currencyCode: 'USD' }, merchant: 'PulseOps' },
  { sku: 'SFT-005', name: 'Password manager team seat', category: 'software', price: { value: '6.00', currencyCode: 'USD' }, merchant: 'PulseOps' },
  { sku: 'OFF-001', name: 'Printer paper (500 sheets)', category: 'office', price: { value: '6.99', currencyCode: 'USD' }, merchant: 'OfficeSupply Co' },
  { sku: 'OFF-002', name: 'Standing desk', category: 'office', price: { value: '249.00', currencyCode: 'USD' }, merchant: 'OfficeSupply Co' },
  { sku: 'OFF-003', name: 'Ergonomic chair', category: 'office', price: { value: '189.00', currencyCode: 'USD' }, merchant: 'OfficeSupply Co' },
  { sku: 'OFF-004', name: 'Whiteboard markers (pack of 8)', category: 'office', price: { value: '9.99', currencyCode: 'USD' }, merchant: 'OfficeSupply Co' },
  { sku: 'OFF-005', name: 'Noise-cancelling headphones', category: 'office', price: { value: '129.00', currencyCode: 'USD' }, merchant: 'OfficeSupply Co' },
];
