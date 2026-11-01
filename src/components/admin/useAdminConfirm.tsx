"use client";

import { useCallback, useState, type ReactNode } from "react";
import ConfirmDialog from "@/components/vintage/feedback/ConfirmDialog";

type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  testId: string;
  tone?: "danger" | "warn" | "neutral";
};

type PendingConfirm = ConfirmRequest & {
  resolve: (value: boolean) => void;
};

/**
 * Replace `window.confirm` in admin tools with the shared vintage dialog.
 * Resolves `true` on Confirm and `false` on Cancel / Escape.
 */
export function useAdminConfirm(): {
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...request, resolve });
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const dialog = pending ? (
    <ConfirmDialog
      open
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel ?? "Confirm"}
      cancelLabel={pending.cancelLabel ?? "Cancel"}
      tone={pending.tone ?? "warn"}
      testId={pending.testId}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  ) : null;

  return { confirm, dialog };
}
