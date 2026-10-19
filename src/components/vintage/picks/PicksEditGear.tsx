"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

/**
 * Admin-only gear that opens the My Picks copy editor.
 */
export default function PicksEditGear({
  testId = "vintage-picks-gear",
  label = "Edit My Picks copy",
}: {
  testId?: string;
  label?: string;
}) {
  return (
    <Link
      href="/vintage/admin/picks"
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
