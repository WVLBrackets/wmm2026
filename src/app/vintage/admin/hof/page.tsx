import { Suspense } from "react";
import { notFound } from "next/navigation";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import VintageHofEditor from "@/components/vintage/hof/VintageHofEditor";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vintage Hall of Fame Editor",
  robots: { index: false, follow: false },
};

/**
 * Primary-admin editor for Hall of Fame labels (CMS) and podium years (DB).
 */
export default async function VintageHofAdminPage() {
  if (!(await vintageAdminEmail())) notFound();
  return (
    <Suspense fallback={<p className="ve-help">Loading editor…</p>}>
      <VintageHofEditor />
    </Suspense>
  );
}
