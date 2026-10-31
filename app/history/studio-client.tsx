'use client';

import { AgStudio, AgStudioProvider } from 'ag-studio-react';
import type { AuditRow } from '@/lib/types';

export default function StudioClient({ rows }: { rows: AuditRow[] }) {
  return (
        <AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY}>
      <div style={{ height: '85vh', width: '100%' }}>
        <AgStudio data={{ sources: [{ id: 'audit', data: rows }] }} mode="edit" style={{ height: '100%' }} />
      </div>
    </AgStudioProvider>
  );
}
