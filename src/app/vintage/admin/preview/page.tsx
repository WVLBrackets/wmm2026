import { notFound } from "next/navigation";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { readVintageState } from "@/lib/vintage/store";
import VintageHomepage from "@/components/vintage/VintageHomepage";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Private draft preview",
  robots: { index: false, follow: false },
};

export default async function VintageDraftPage() {
  if (!(await vintageAdminEmail())) notFound();
  try {
    return (
      <VintageHomepage content={(await readVintageState()).draft} draft admin />
    );
  } catch {
    return (
      <p className="p-10">
        Draft storage is unavailable. Return to the homepage editor and check
        its storage status.
      </p>
    );
  }
}
