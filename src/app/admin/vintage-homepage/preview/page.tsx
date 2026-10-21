import { redirectToVintageAdmin } from "@/lib/vintage/legacyAdminRedirect";

export const dynamic = "force-dynamic";

export default function LegacyVintageHomepagePreviewPage() {
  redirectToVintageAdmin("/vintage/admin/preview");
}
