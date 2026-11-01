import { Suspense } from "react";
import { notFound } from "next/navigation";
import VintageCopyTreeEditor from "@/components/vintage/editors/VintageCopyTreeEditor";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { DEFAULT_VINTAGE_SCOREBOARD_CONTENT } from "@/lib/vintage/scoreboardContent";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Scoreboard Copy CMS",
  robots: { index: false, follow: false },
};

/**
 * Primary-admin editor for public Scoreboard labels (not game results).
 */
export default async function VintageScoreboardCopyAdminPage() {
  if (!(await vintageAdminEmail())) notFound();
  return (
    <Suspense fallback={<p className="ve-help">Loading editor…</p>}>
      <VintageCopyTreeEditor
        slot="scoreboard"
        title="Scoreboard copy"
        navId="scoreboard"
        seed={DEFAULT_VINTAGE_SCOREBOARD_CONTENT}
        intro="Headings, tabs, empty states, and loading text on the public Scoreboard."
      />
    </Suspense>
  );
}
