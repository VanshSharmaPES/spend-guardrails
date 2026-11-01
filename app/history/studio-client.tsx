'use client';

import type { AgReportState } from 'ag-studio';
import { AgStudio, AgStudioProvider } from 'ag-studio-react';
import type { AuditRow } from '@/lib/types';
import { guardrailsTheme } from '../studio-theme';
import { auditFields } from '../audit-fields';

const COLUMNS = ['createdAt', 'status', 'merchant', 'amountHome', 'ruleId', 'reason', 'paypalOrderId'];

const title = (text: string) => ({ title: { enabled: true, text } });

const initialState: AgReportState = {
  pages: [
    {
      id: 'history',
      layout: { rowHeight: 14, pagePadding: 12, widgetPadding: 8 },
      widgets: {
        'status-filter': {
          type: 'list-filter',
          format: title('Status'),
          dataMapping: { value: [{ id: 'audit.status' }] },
        },
        'decision-filter': {
          type: 'list-filter',
          format: title('Verdict'),
          dataMapping: { value: [{ id: 'audit.decision' }] },
        },
        'merchant-filter': {
          type: 'list-filter',
          format: title('Merchant'),
          dataMapping: { value: [{ id: 'audit.merchant' }] },
        },
        'audit-log': {
          type: 'grid',
          format: { ...title('Every decision, with the rule that made it'), style: { columnAutoSize: true } },
          dataMapping: { cols: COLUMNS.map((name) => ({ id: `audit.${name}` })) },
          sort: [{ field: { id: 'audit.createdAt' }, direction: 'desc' }],
        },
      },
      widgetLayout: {
        'status-filter': { xTrack: 0, yTrack: 0, xSpan: 5, ySpan: 15 },
        'decision-filter': { xTrack: 0, yTrack: 15, xSpan: 5, ySpan: 10 },
        'merchant-filter': { xTrack: 0, yTrack: 25, xSpan: 5, ySpan: 19 },
        'audit-log': { xTrack: 5, yTrack: 0, xSpan: 19, ySpan: 44 },
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
          panels={{ view: { right: [] } }}
          mode="view"
          style={{ height: '100%' }}
        />
      </div>
    </AgStudioProvider>
  );
}
