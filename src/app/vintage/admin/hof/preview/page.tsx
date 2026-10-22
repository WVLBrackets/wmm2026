import { notFound } from "next/navigation";
import { PageLogger } from "@/components/PageLogger";
import VintageHallOfFamePage from "@/components/vintage/hof/VintageHallOfFamePage";
import { getHallOfFameData } from "@/lib/googleSheets";
import { buildHofViewModel } from "@/lib/hallOfFameStats";
import { isVintageEnabled } from "@/lib/vintage/access";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { readVintageHofState } from "@/lib/vintage/hofStore";
import { getPublishedVintageContent } from "@/lib/vintage/store";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Hall of Fame Draft Preview",
  robots: { index: false, follow: false },
};

/**
 * Preview the saved Hall of Fame copy draft with published homepage chrome.
 */
export default async function VintageHofPreviewPage() {
  if (!isVintageEnabled()) notFound();
  if (!(await vintageAdminEmail())) notFound();
  const [entries, home, hofState] = await Promise.all([
    getHallOfFameData(),
    getPublishedVintageContent(),
    readVintageHofState(),
  ]);
  return (
    <>
      <PageLogger location="Hall of Fame Preview" />
      <VintageHallOfFamePage
        model={buildHofViewModel(entries)}
        home={home}
        copy={hofState.draft}
        draft
        admin
      />
    </>
  );
}
