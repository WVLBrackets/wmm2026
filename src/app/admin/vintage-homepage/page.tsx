import { notFound } from "next/navigation";
import { isVintageEnabled } from "@/lib/vintage/access";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import VintageEditor from "@/components/vintage/VintageEditor";
import VintageAdminSignIn from "@/components/vintage/VintageAdminSignIn";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vintage Homepage Editor",
  robots: { index: false, follow: false },
};
export default async function VintageAdminPage() {
  if (!isVintageEnabled()) notFound();
  if (!(await vintageAdminEmail())) {
    const session = await getServerSession(authOptions);
    return <VintageAdminSignIn denied={!!session?.user} />;
  }
  return <VintageEditor />;
}
