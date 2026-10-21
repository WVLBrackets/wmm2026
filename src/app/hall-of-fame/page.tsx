import { notFound } from "next/navigation";
import { PageLogger } from "@/components/PageLogger";
import VintageHallOfFamePage from "@/components/vintage/hof/VintageHallOfFamePage";
import { getHallOfFameData } from "@/lib/googleSheets";
import { buildHofViewModel } from "@/lib/hallOfFameStats";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { isVintageEnabled } from "@/lib/vintage/access";
import { getPublishedVintageHofContent } from "@/lib/vintage/hofStore";
import { getPublishedVintageContent } from "@/lib/vintage/store";

export const dynamic = "force-dynamic";

/**
 * Hall of Fame: vintage for everyone when enabled; edit gear for primary admin only.
 * Historical data from the Hall of Fame Google Sheet; titles from HoF CMS sidecar.
 */
export default async function HallOfFamePage() {
  if (!isVintageEnabled()) notFound();

  const entries = await getHallOfFameData();
  const model = buildHofViewModel(entries);

  const [home, copy, adminEmail] = await Promise.all([
    getPublishedVintageContent(),
    getPublishedVintageHofContent(),
    vintageAdminEmail(),
  ]);

  return (
    <>
      <PageLogger location="Hall of Fame" />
      <VintageHallOfFamePage
        model={model}
        home={home}
        copy={copy}
        admin={Boolean(adminEmail)}
      />
    </>
  );
}
