import { PageLogger } from "@/components/PageLogger";
import LegacySiteChrome from "@/components/LegacySiteChrome";
import BracketPageClient from "./BracketPageClient";
import { getBuildStamp } from "@/lib/buildStamp";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedVintagePicksContent } from "@/lib/vintage/picksStore";
import { getPublishedVintageContent } from "@/lib/vintage/store";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return (await vintageAdminEmail())
    ? { robots: { index: false, follow: false } }
    : {};
}

/**
 * My Picks: vintage landing for the primary admin; legacy landing for everyone else.
 * Bracket workspace UI is unchanged either way.
 */
export default async function BracketPage() {
  if (await vintageAdminEmail()) {
    const [home, picksCopy] = await Promise.all([
      getPublishedVintageContent(),
      getPublishedVintagePicksContent(),
    ]);
    return (
      <>
        <PageLogger location="My Picks" />
        <BracketPageClient vintage vintageHome={home} picksCopy={picksCopy} />
      </>
    );
  }

  return (
    <LegacySiteChrome buildStamp={getBuildStamp()}>
      <PageLogger location="My Picks" />
      <BracketPageClient />
    </LegacySiteChrome>
  );
}
