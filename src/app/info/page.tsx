import { PageLogger } from "@/components/PageLogger";
import VintageInfoPage from "@/components/vintage/info/VintageInfoPage";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedVintageContent } from "@/lib/vintage/store";
import { getPublishedVintageInfoContent } from "@/lib/vintage/infoStore";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { getPublishedCmsBundle } = await import("@/lib/vintage/cmsBundle");
  const bundle = await getPublishedCmsBundle().catch(() => null);
  const { cmsRouteMetadata } = await import("@/lib/pageMetadata");
  return cmsRouteMetadata(bundle?.info.intro.heading ?? "");
}

/**
 * Info / Guidebook: vintage for everyone; edit gear for primary admin only.
 */
export default async function InfoPage() {
  const [info, home, adminEmail] = await Promise.all([
    getPublishedVintageInfoContent(),
    getPublishedVintageContent(),
    vintageAdminEmail(),
  ]);

  return (
    <>
      <PageLogger location="Info" />
      <VintageInfoPage
        content={info}
        home={home}
        admin={Boolean(adminEmail)}
      />
    </>
  );
}
