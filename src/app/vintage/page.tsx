import { notFound } from "next/navigation";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { isVintageEnabled } from "@/lib/vintage/access";
import { getPublishedVintageContent } from "@/lib/vintage/store";
import VintageHomepage from "@/components/vintage/VintageHomepage";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "The Vintage Edition | Warren’s March Madness",
  robots: { index: false, follow: false },
};
export default async function VintagePage() {
  if (!isVintageEnabled()) notFound();
  const [content, adminEmail] = await Promise.all([
    getPublishedVintageContent(),
    vintageAdminEmail(),
  ]);
  return <VintageHomepage content={content} admin={!!adminEmail} />;
}
