import VintageHomepage from "@/components/vintage/VintageHomepage";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedVintageContent } from "@/lib/vintage/store";

/** Session-dependent admin gears; do not share HTML across visitors. */
export const dynamic = "force-dynamic";

/**
 * Public home: vintage for everyone; edit gear for primary admin only.
 */
export default async function Home() {  const [content, adminEmail] = await Promise.all([
    getPublishedVintageContent(),
    vintageAdminEmail(),
  ]);
  return <VintageHomepage content={content} admin={Boolean(adminEmail)} />;
}
