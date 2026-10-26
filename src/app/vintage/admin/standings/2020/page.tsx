import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { isVintageEnabled } from "@/lib/vintage/access";
import { vintageAdminEmail } from "@/lib/vintage/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "2020 Newspaper Editor",
  robots: { index: false, follow: false },
};

/**
 * Legacy URL — 2020 newspaper fields live in Standings Admin now.
 */
export default async function VintagePaper2020AdminPage() {
  if (!isVintageEnabled()) notFound();
  if (!(await vintageAdminEmail())) notFound();
  redirect("/vintage/admin/standings#ve-section-2020-newspaper");
}
