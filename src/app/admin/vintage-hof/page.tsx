import { redirectToVintageAdmin } from "@/lib/vintage/legacyAdminRedirect";

export const dynamic = "force-dynamic";

export default function LegacyVintageHofAdminPage() {
  redirectToVintageAdmin("/vintage/admin/hof");
}
