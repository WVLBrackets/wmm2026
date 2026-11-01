'use client';

import type { ReactNode } from 'react';
import type { VintageToolbarItem } from '@/lib/vintage/content';
import VintageToolbar from '@/components/vintage/VintageToolbar';
import VintageMasthead from '@/components/vintage/VintageMasthead';
import '@/components/vintage/vintage.css';

/**
 * Ops admin shell: vintage edition header + centered column (same width as public `.v-paper`).
 * Body UI stays otherwise unstyled.
 */
export default function OpsAdminChrome({
  toolbar,
  mastheadFirst,
  mastheadSecond,
  children,
}: {
  toolbar: VintageToolbarItem[];
  mastheadFirst: string;
  mastheadSecond: string;
  children: ReactNode;
}) {
  return (
    <div
      className="vintage-page ops-admin-chrome"
      data-testid="ops-admin-chrome"
      style={{
        minHeight: '100vh',
        paddingTop: 10,
        paddingBottom: 24,
      }}
    >
      <div className="v-paper ops-admin-chrome__paper" data-testid="ops-admin-paper">
        <header className="v-edition-header" data-testid="ops-admin-toolbar">
          <VintageToolbar items={toolbar} />
          <VintageMasthead first={mastheadFirst} second={mastheadSecond} />
        </header>
        <div className="ops-admin-chrome__body">{children}</div>
      </div>
    </div>
  );
}
