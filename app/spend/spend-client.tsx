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
      layout: { rowHeight: 14, pagePadding: 12, widgetPadding: 8 },
      widgets: {
        total: {
          type: 'value',
          format: title('Total paid (USD)'),
          dataMapping: { value: [AMOUNT] },
        },
        payments: {
          type: 'value',
          format: title('Payments'),
          dataMapping: { value: [{ id: 'audit.merchant', aggregation: 'count' as const }] },
        },
        average: {
          type: 'value',
          format: title('Average payment'),
          dataMapping: { value: [{ id: 'audit.amountHome', aggregation: 'avg' as const }] },
        },
        largest: {
          type: 'value',
          format: title('Largest payment'),
          dataMapping: { value: [{ id: 'audit.amountHome', aggregation: 'max' as const }] },
        },
        'over-time': {
          type: 'line-chart',
          format: title('Spend per day'),
          dataMapping: { categoryKey: [{ id: 'audit.day' }], valueKey: [AMOUNT] },
        },
        'by-category': {
          type: 'donut-chart',
          format: title('By category'),
          dataMapping: { categoryKey: [{ id: 'audit.category' }], valueKey: [AMOUNT] },
        },
        'by-merchant': {
          type: 'bar-chart-grouped',
          format: title('By merchant'),
          dataMapping: { categoryKey: [{ id: 'audit.merchant' }], valueKey: [AMOUNT] },
        },
        'by-agent': {
          type: 'column-chart-grouped',
          format: title('By agent'),
          dataMapping: { categoryKey: [{ id: 'audit.agentId' }], valueKey: [AMOUNT] },
        },
      },
      widgetLayout: {
        total: { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 7 },
        payments: { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 7 },
        average: { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 7 },
        largest: { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 7 },
        'over-time': { xTrack: 0, yTrack: 7, xSpan: 16, ySpan: 18 },
        'by-category': { xTrack: 16, yTrack: 7, xSpan: 8, ySpan: 18 },
        'by-merchant': { xTrack: 0, yTrack: 25, xSpan: 12, ySpan: 19 },
        'by-agent': { xTrack: 12, yTrack: 25, xSpan: 12, ySpan: 19 },
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
          panels={{ view: { right: [] } }}
          mode="view"
          style={{ height: '100%' }}
        />
      </div>
    </AgStudioProvider>
  );
}
