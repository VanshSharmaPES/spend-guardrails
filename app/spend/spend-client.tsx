'use client';

import type { AgReportState } from 'ag-studio';
import { AgStudio, AgStudioProvider } from 'ag-studio-react';
import type { AuditRow } from '@/lib/types';
import { guardrailsTheme } from '../studio-theme';
import { auditFields } from '../audit-fields';


export type SpendRow = AuditRow & { day: string };

const title = (text: string) => ({ title: { enabled: true, text } });
const AMOUNT = { id: 'audit.amountHome', aggregation: 'sum' as const };

const initialState: AgReportState = {
  pages: [
    {
      id: 'spend',
      widgets: {
        total: {
          type: 'value',
          format: title('Total spend (USD)'),
          dataMapping: { value: [AMOUNT] },
        },
        'by-category': {
          type: 'donut-chart',
          format: title('Spend by category'),
          dataMapping: { categoryKey: [{ id: 'audit.category' }], valueKey: [AMOUNT] },
        },
        'by-merchant': {
          type: 'bar-chart-grouped',
          format: title('Spend by merchant'),
          dataMapping: { categoryKey: [{ id: 'audit.merchant' }], valueKey: [AMOUNT] },
        },
        'by-agent': {
          type: 'column-chart-grouped',
          format: title('Spend by agent'),
          dataMapping: { categoryKey: [{ id: 'audit.agentId' }], valueKey: [AMOUNT] },
        },
        'over-time': {
          type: 'line-chart',
          format: title('Spend over time'),
          dataMapping: { categoryKey: [{ id: 'audit.day' }], valueKey: [AMOUNT] },
        },
      },
      widgetLayout: {
        total: { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 14 },
        'over-time': { xTrack: 6, yTrack: 0, xSpan: 18, ySpan: 14 },
        'by-category': { xTrack: 0, yTrack: 14, xSpan: 8, ySpan: 22 },
        'by-merchant': { xTrack: 8, yTrack: 14, xSpan: 8, ySpan: 22 },
        'by-agent': { xTrack: 16, yTrack: 14, xSpan: 8, ySpan: 22 },
      },
    },
  ],
  selectedPageId: 'spend',
};

export default function SpendClient({ rows }: { rows: SpendRow[] }) {
  return (
    <AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY}>
      <div style={{ height: 'calc(100vh - 57px)', width: '100%' }}>
        <AgStudio
          theme={guardrailsTheme}
          data={{
            sources: [
              {
                id: 'audit',
                data: rows,
                fields: [...auditFields, { id: 'day', name: 'Day', format: 'textFormat' }],
              },
            ],
          }}
          initialState={initialState}
          mode="view"
          style={{ height: '100%' }}
        />
      </div>
    </AgStudioProvider>
  );
}
