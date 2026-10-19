import { notFound } from "next/navigation";
import { isVintageEnabled } from "@/lib/vintage/access";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import VintageInfoPage from "@/components/vintage/info/VintageInfoPage";
import { getPublishedVintageContent } from "@/lib/vintage/store";
import { readVintageInfoState } from "@/lib/vintage/infoStore";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Info Handbook Draft Preview",
  robots: { index: false, follow: false },
};

/**
 * Preview the saved Info handbook draft with published homepage chrome.
 */
export default async function VintageInfoPreviewPage() {
  if (!isVintageEnabled()) notFound();
  if (!(await vintageAdminEmail())) notFound();
  const [infoState, home] = await Promise.all([
    readVintageInfoState(),
    getPublishedVintageContent(),
  ]);
  return (
    <VintageInfoPage content={infoState.draft} home={home} draft />
  );
}
