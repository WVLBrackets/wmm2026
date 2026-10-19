import { PageLogger } from "@/components/PageLogger";
import LegacyHallOfFamePage from "@/components/LegacyHallOfFamePage";
import LegacySiteChrome from "@/components/LegacySiteChrome";
import VintageHallOfFamePage from "@/components/vintage/hof/VintageHallOfFamePage";
import { getHallOfFameData } from "@/lib/googleSheets";
import { buildHofViewModel } from "@/lib/hallOfFameStats";
import { getBuildStamp } from "@/lib/buildStamp";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedVintageHofContent } from "@/lib/vintage/hofStore";
import { getPublishedVintageContent } from "@/lib/vintage/store";

// Primary-admin path is session-dependent; legacy keeps on-demand rebuild.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return (await vintageAdminEmail())
    ? { robots: { index: false, follow: false } }
    : {};
}

/**
 * Hall of Fame: vintage redesign for the primary admin; legacy page for everyone else.
 * Historical data from the Hall of Fame Google Sheet; titles from HoF CMS sidecar.
 */
export default async function HallOfFamePage() {
  const entries = await getHallOfFameData();
  const model = buildHofViewModel(entries);

  if (await vintageAdminEmail()) {
    const [home, copy] = await Promise.all([
      getPublishedVintageContent(),
      getPublishedVintageHofContent(),
    ]);
    return (
      <>
        <PageLogger location="Hall of Fame" />
        <VintageHallOfFamePage
          model={model}
          home={home}
          copy={copy}
          admin
        />
      </>
    );
  }

  return (
    <LegacySiteChrome buildStamp={getBuildStamp()}>
      <PageLogger location="Hall of Fame" />
      <LegacyHallOfFamePage model={model} />
    </LegacySiteChrome>
  );
}
