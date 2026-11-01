'use client';

import type { VintagePicksConfirmCopy } from '@/lib/vintage/picksContent';
import { formatPicksConfirmText } from '@/lib/vintage/picksContent';
import ConfirmDialog, { type ConfirmDialogTone } from '@/components/vintage/feedback/ConfirmDialog';

export type PicksConfirmTone = ConfirmDialogTone;

/**
 * My Picks confirmation popup (delete / permanent delete / return / copy):
 * resolves `{entry}` tokens in My Picks CMS copy, then renders {@link ConfirmDialog}.
 */
export default function PicksConfirmModal({
  open,
  copy,
  entryName,
  tone = 'danger',
  busy = false,
  busyMessage,
  testId,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  copy: VintagePicksConfirmCopy;
  entryName: string;
  tone?: PicksConfirmTone;
  busy?: boolean;
  busyMessage?: string;
  testId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title={formatPicksConfirmText(copy.title, entryName)}
      message={formatPicksConfirmText(copy.message, entryName)}
      confirmLabel={copy.confirmLabel}
      cancelLabel={copy.cancelLabel}
      tone={tone}
      busy={busy}
      busyMessage={busyMessage}
      testId={testId}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
