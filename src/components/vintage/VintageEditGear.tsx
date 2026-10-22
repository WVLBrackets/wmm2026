"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import type { VintageAdminFocus } from "@/lib/vintage/adminFocus";
import { vintageAdminEditHref } from "@/lib/vintage/adminFocus";

/**
 * Tiny admin-only gear that deep-links into the matching vintage editor section.
 */
export default function VintageEditGear({
  focus,
  testId,
  label,
}: {
  focus: VintageAdminFocus;
  testId: string;
  label: string;
}) {
  return (
    <Link
      href={vintageAdminEditHref(focus)}
      className="v-edit-gear"
      data-testid={testId}
      aria-label={label}
      title={label}
      onClick={(event) => {
        // Keep Play Now / download hotspots from stealing the click.
        event.stopPropagation();
      }}
    >
      <Settings size={13} strokeWidth={2.25} aria-hidden="true" />
    </Link>
  );
}
