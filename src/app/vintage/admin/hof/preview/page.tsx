import { notFound } from "next/navigation";
import { PageLogger } from "@/components/PageLogger";
import VintageHallOfFamePage from "@/components/vintage/hof/VintageHallOfFamePage";
import { buildHofViewModel } from "@/lib/hallOfFameStats";
import { listHofSeasons } from "@/lib/repositories/hofSeasonRepository";
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
  if (!(await vintageAdminEmail())) notFound();
  const [entries, home, hofState] = await Promise.all([
    listHofSeasons(),
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
