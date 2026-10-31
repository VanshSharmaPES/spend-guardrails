'use client';

import type { AgReportState } from 'ag-studio';
import { AgStudio, AgStudioProvider } from 'ag-studio-react';
import type { AuditRow } from '@/lib/types';
import { guardrailsTheme } from '../studio-theme';
import { auditFields } from '../audit-fields';

const COLUMNS = [
  'createdAt',
  'status',
  'decision',
  'merchant',
  'category',
  'amountHome',
  'ruleId',
  'reason',
  'agentId',
  'paypalOrderId',
];

const initialState: AgReportState = {
  pages: [
    {
      id: 'history',
            widgets: {
        'status-filter': {
          type: 'list-filter',
          format: { title: { enabled: true, text: 'Status' } },
          dataMapping: { value: [{ id: 'audit.status' }] },
        },
        'decision-filter': {
          type: 'list-filter',
          format: { title: { enabled: true, text: 'Decision' } },
          dataMapping: { value: [{ id: 'audit.decision' }] },
        },
        'merchant-filter': {
          type: 'list-filter',
          format: { title: { enabled: true, text: 'Merchant' } },
          dataMapping: { value: [{ id: 'audit.merchant' }] },
        },
        'audit-log': {
          type: 'grid',
          format: { title: { enabled: true, text: 'Transaction history' } },
          dataMapping: { cols: COLUMNS.map((name) => ({ id: `audit.${name}` })) },
          sort: [{ field: { id: 'audit.createdAt' }, direction: 'desc' }],
        },
      },
      widgetLayout: {
        'status-filter': { xTrack: 0, yTrack: 0, xSpan: 4, ySpan: 12 },
        'decision-filter': { xTrack: 0, yTrack: 12, xSpan: 4, ySpan: 10 },
        'merchant-filter': { xTrack: 0, yTrack: 22, xSpan: 4, ySpan: 14 },
        'audit-log': { xTrack: 4, yTrack: 0, xSpan: 20, ySpan: 36 },
      },
    },
  ],
  selectedPageId: 'history',
};

export default function StudioClient({ rows }: { rows: AuditRow[] }) {
  return (
    <AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY}>
      <div style={{ height: 'calc(100vh - 57px)', width: '100%' }}>
        <AgStudio
          theme={guardrailsTheme}
          data={{ sources: [{ id: 'audit', data: rows, fields: auditFields }] }}
          initialState={initialState}
          mode="view"
          style={{ height: '100%' }}
        />
      </div>
    </AgStudioProvider>
  );
}
