import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isVintageEnabled } from "@/lib/vintage/access";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import VintageInfoEditor from "@/components/vintage/info/VintageInfoEditor";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vintage Info Handbook Editor",
  robots: { index: false, follow: false },
};

export default async function VintageInfoAdminPage() {
  if (!isVintageEnabled()) notFound();
  if (!(await vintageAdminEmail())) notFound();
  return (
    <Suspense fallback={<p className="ve-help">Loading editor…</p>}>
      <VintageInfoEditor />
    </Suspense>
  );
}
