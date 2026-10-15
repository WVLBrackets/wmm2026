import Link from "next/link";
import { notFound } from "next/navigation";
import { isVintageEnabled } from "@/lib/vintage/access";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import VintageEditor from "@/components/vintage/VintageEditor";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vintage Homepage Editor",
  robots: { index: false, follow: false },
};
export default async function VintageAdminPage() {
  if (!isVintageEnabled()) notFound();
  if (!(await vintageAdminEmail()))
    return (
      <main className="max-w-xl mx-auto py-20 px-6">
        <h1 className="text-3xl font-bold">Homepage editor</h1>
        <p className="my-6">
          Sign in with your administrator account to manage the vintage
          homepage.
        </p>
        <Link
          className="underline"
          href="/auth/signin?callbackUrl=%2Fadmin%2Fvintage-homepage"
        >
          Sign in
        </Link>
        <Link className="block mt-6 underline" href="/vintage">
          Back to homepage
        </Link>
      </main>
    );
  return <VintageEditor />;
}
