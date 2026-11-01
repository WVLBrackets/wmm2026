import { PageLogger } from "@/components/PageLogger";
import VintageHallOfFamePage from "@/components/vintage/hof/VintageHallOfFamePage";
import { buildHofViewModel } from "@/lib/hallOfFameStats";
import { listHofSeasons } from "@/lib/repositories/hofSeasonRepository";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { getPublishedCmsBundle } = await import("@/lib/vintage/cmsBundle");
  const bundle = await getPublishedCmsBundle().catch(() => null);
  const { cmsRouteMetadata } = await import("@/lib/pageMetadata");
  return cmsRouteMetadata(bundle?.hof.heading ?? "");
}

/**
 * Hall of Fame: podium history from `hof_seasons`; titles from HoF CMS.
 */
export default async function HallOfFamePage() {
  const [entries, bundle, adminEmail] = await Promise.all([
    listHofSeasons(),
    getPublishedCmsBundle(),
    vintageAdminEmail(),
  ]);
  const model = buildHofViewModel(entries);

  return (
    <>
      <PageLogger location="Hall of Fame" />
      <VintageHallOfFamePage
        model={model}
        home={bundle.home}
        copy={bundle.hof}
        admin={Boolean(adminEmail)}
      />
    </>
  );
}
