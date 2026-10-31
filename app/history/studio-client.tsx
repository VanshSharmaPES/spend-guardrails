'use client';

import type { AgReportState } from 'ag-studio';
import { AgStudio, AgStudioProvider } from 'ag-studio-react';
import type { AuditRow } from '@/lib/types';
import { guardrailsTheme } from '../studio-theme';


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
        'audit-log': {
          type: 'grid',
          format: { title: { enabled: true, text: 'Transaction history' } },
          dataMapping: { cols: COLUMNS.map((name) => ({ id: `audit.${name}` })) },
        },
      },
      widgetLayout: {
        'audit-log': { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 24 },
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
          data={{ sources: [{ id: 'audit', data: rows }] }}
          initialState={initialState}
          mode="view"
          style={{ height: '100%' }}
        />
      </div>
    </AgStudioProvider>
  );
}
