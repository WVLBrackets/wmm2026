import { Suspense } from "react";
import { notFound } from "next/navigation";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import VintageStandingsEditor from "@/components/vintage/standings/VintageStandingsEditor";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vintage Standings Copy Editor",
  robots: { index: false, follow: false },
};

/**
 * Primary-admin editor for Live Standings display copy.
 */
export default async function VintageStandingsAdminPage() {  if (!(await vintageAdminEmail())) notFound();
  return (
    <Suspense fallback={<p className="ve-help">Loading editor…</p>}>
      <VintageStandingsEditor />
    </Suspense>
  );
}
