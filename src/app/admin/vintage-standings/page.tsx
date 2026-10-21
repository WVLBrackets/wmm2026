import { redirectToVintageAdmin } from "@/lib/vintage/legacyAdminRedirect";

export const dynamic = "force-dynamic";

export default function LegacyVintageStandingsAdminPage() {
  redirectToVintageAdmin("/vintage/admin/standings");
}
