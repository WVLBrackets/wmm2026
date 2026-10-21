import { notFound } from "next/navigation";
import VintageHomepage from "@/components/vintage/VintageHomepage";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { isVintageEnabled } from "@/lib/vintage/access";
import { getPublishedVintageContent } from "@/lib/vintage/store";

/** Session-dependent admin gears; do not share HTML across visitors. */
export const dynamic = "force-dynamic";

/**
 * Public home: vintage for everyone when enabled; edit gear for primary admin only.
 */
export default async function Home() {
  if (!isVintageEnabled()) notFound();
  const [content, adminEmail] = await Promise.all([
    getPublishedVintageContent(),
    vintageAdminEmail(),
  ]);
  return <VintageHomepage content={content} admin={Boolean(adminEmail)} />;
}
