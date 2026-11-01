import { Suspense } from "react";
import { notFound } from "next/navigation";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import VintageEditor from "@/components/vintage/VintageEditor";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vintage Homepage Editor",
  robots: { index: false, follow: false },
};

export default async function VintageAdminPage() {  if (!(await vintageAdminEmail())) notFound();
  return (
    <Suspense fallback={<p className="ve-help">Loading editor…</p>}>
      <VintageEditor />
    </Suspense>
  );
}
