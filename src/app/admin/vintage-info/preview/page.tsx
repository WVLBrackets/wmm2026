import { redirectToVintageAdmin } from "@/lib/vintage/legacyAdminRedirect";

export const dynamic = "force-dynamic";

export default function LegacyVintageInfoPreviewPage() {
  redirectToVintageAdmin("/vintage/admin/info/preview");
}
