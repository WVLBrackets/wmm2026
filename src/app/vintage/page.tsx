import { notFound } from "next/navigation";
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
  return <VintageHomepage content={await getPublishedVintageContent()} />;
}
