import LegacyHomepage from "@/components/LegacyHomepage";
import LegacySiteChrome from "@/components/LegacySiteChrome";
import VintageHomepage from "@/components/vintage/VintageHomepage";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedVintageContent } from "@/lib/vintage/store";
import { getBuildStamp } from "@/lib/buildStamp";

// Session-dependent HTML must never be shared between visitors.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return (await vintageAdminEmail())
    ? { robots: { index: false, follow: false } }
    : {};
}

export default async function Home() {
  if (await vintageAdminEmail()) {
    return (
      <VintageHomepage content={await getPublishedVintageContent()} admin />
    );
  }
  return (
    <LegacySiteChrome buildStamp={getBuildStamp()}>
      <div data-testid="legacy-homepage">
        <LegacyHomepage />
      </div>
    </LegacySiteChrome>
  );
}
