import { redirectToVintageAdmin } from "@/lib/vintage/legacyAdminRedirect";

export const dynamic = "force-dynamic";

export default function LegacyVintageInfoAdminPage() {
  redirectToVintageAdmin("/vintage/admin/info");
}
