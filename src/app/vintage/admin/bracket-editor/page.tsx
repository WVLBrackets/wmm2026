import { Suspense } from "react";
import { notFound } from "next/navigation";
import VintageCopyTreeEditor from "@/components/vintage/editors/VintageCopyTreeEditor";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { DEFAULT_VINTAGE_BRACKET_EDITOR_CONTENT } from "@/lib/vintage/bracketEditorContent";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bracket Editor Messages CMS",
  robots: { index: false, follow: false },
};

/**
 * Primary-admin editor for pick-editor labels and validation copy.
 */
export default async function VintageBracketEditorAdminPage() {
  if (!(await vintageAdminEmail())) notFound();
  return (
    <Suspense fallback={<p className="ve-help">Loading editor…</p>}>
      <VintageCopyTreeEditor
        slot="bracketEditor"
        title="Bracket Editor Messages"
        navId="bracketEditor"
        seed={DEFAULT_VINTAGE_BRACKET_EDITOR_CONTENT}
        intro="Labels, validation, tie-breaker bounds, viewer, and print copy used by the bracket editor."
      />
    </Suspense>
  );
}
