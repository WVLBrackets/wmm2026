"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import type { VintageInfoAdminFocus } from "@/lib/vintage/infoAdminFocus";
import { vintageInfoAdminEditHref } from "@/lib/vintage/infoAdminFocus";

/**
 * Tiny admin-only gear that deep-links into a handbook editor section.
 */
export default function InfoEditGear({
  focus,
  testId,
  label,
}: {
  focus: VintageInfoAdminFocus;
  testId: string;
  label: string;
}) {
  return (
    <Link
      href={vintageInfoAdminEditHref(focus)}
      className="v-edit-gear"
      data-testid={testId}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <Settings size={13} strokeWidth={2.25} aria-hidden="true" />
    </Link>
  );
}
