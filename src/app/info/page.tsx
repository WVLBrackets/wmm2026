import { getSiteConfigFromGoogleSheets } from "@/lib/siteConfig";
import { FALLBACK_CONFIG } from "@/lib/fallbackConfig";
import { PageLogger } from "@/components/PageLogger";
import LegacyInfoPage from "@/components/LegacyInfoPage";
import LegacySiteChrome from "@/components/LegacySiteChrome";
import VintageInfoPage from "@/components/vintage/info/VintageInfoPage";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedVintageContent } from "@/lib/vintage/store";
import { getPublishedVintageInfoContent } from "@/lib/vintage/infoStore";
import { getBuildStamp } from "@/lib/buildStamp";

// Primary-admin path is session-dependent; legacy path keeps on-demand rebuild.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return (await vintageAdminEmail())
    ? { robots: { index: false, follow: false } }
    : {};
}

/**
 * Info page: vintage handbook for the primary admin; legacy Sheets page for everyone else.
 */
export default async function InfoPage() {
  if (await vintageAdminEmail()) {
    const [info, home] = await Promise.all([
      getPublishedVintageInfoContent(),
      getPublishedVintageContent(),
    ]);
    return (
      <>
        <PageLogger location="Info" />
        <VintageInfoPage content={info} home={home} admin />
      </>
    );
  }

  let siteConfig = null;
  try {
    siteConfig = await getSiteConfigFromGoogleSheets();
  } catch (error) {
    console.error("Error loading site config:", error);
    siteConfig = FALLBACK_CONFIG;
  }
  if (!siteConfig) siteConfig = FALLBACK_CONFIG;

  return (
    <LegacySiteChrome buildStamp={getBuildStamp()}>
      <PageLogger location="Info" />
      <LegacyInfoPage siteConfig={siteConfig} />
    </LegacySiteChrome>
  );
}
