import { Suspense } from "react";
import { notFound } from "next/navigation";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import VintagePicksEditor from "@/components/vintage/picks/VintagePicksEditor";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vintage My Picks Copy Editor",
  robots: { index: false, follow: false },
};

/**
 * Primary-admin editor for My Picks landing copy.
 */
export default async function VintagePicksAdminPage() {  if (!(await vintageAdminEmail())) notFound();
  return (
    <Suspense fallback={<p className="ve-help">Loading editor…</p>}>
      <VintagePicksEditor />
    </Suspense>
  );
}
