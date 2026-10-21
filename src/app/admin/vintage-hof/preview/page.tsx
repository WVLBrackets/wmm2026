import { redirectToVintageAdmin } from "@/lib/vintage/legacyAdminRedirect";

export const dynamic = "force-dynamic";

export default function LegacyVintageHofPreviewPage() {
  redirectToVintageAdmin("/vintage/admin/hof/preview");
}
