import { notFound } from "next/navigation";
import { PageLogger } from "@/components/PageLogger";
import VintageInfoPage from "@/components/vintage/info/VintageInfoPage";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { isVintageEnabled } from "@/lib/vintage/access";
import { getPublishedVintageContent } from "@/lib/vintage/store";
import { getPublishedVintageInfoContent } from "@/lib/vintage/infoStore";

export const dynamic = "force-dynamic";

/**
 * Info / Guidebook: vintage for everyone when enabled; edit gear for primary admin only.
 */
export default async function InfoPage() {
  if (!isVintageEnabled()) notFound();

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
