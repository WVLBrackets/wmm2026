"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

/**
 * Admin-only gear that opens the Hall of Fame copy editor.
 */
export default function HofEditGear({
  testId = "vintage-hof-gear",
  label = "Edit Hall of Fame titles",
}: {
  testId?: string;
  label?: string;
}) {
  return (
    <Link
      href="/vintage/admin/hof"
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
