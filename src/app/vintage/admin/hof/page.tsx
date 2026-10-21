import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isVintageEnabled } from "@/lib/vintage/access";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import VintageHofEditor from "@/components/vintage/hof/VintageHofEditor";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vintage Hall of Fame Copy Editor",
  robots: { index: false, follow: false },
};

/**
 * Primary-admin editor for Hall of Fame display copy.
 */
export default async function VintageHofAdminPage() {
  if (!isVintageEnabled()) notFound();
  if (!(await vintageAdminEmail())) notFound();
  return (
    <Suspense fallback={<p className="ve-help">Loading editor…</p>}>
      <VintageHofEditor />
    </Suspense>
  );
}
