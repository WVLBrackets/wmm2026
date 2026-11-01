import { Suspense } from "react";
import { notFound } from "next/navigation";
import VintageCopyTreeEditor from "@/components/vintage/editors/VintageCopyTreeEditor";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { DEFAULT_VINTAGE_EMAILS_CONTENT } from "@/lib/vintage/emailsContent";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Emails & Account CMS",
  robots: { index: false, follow: false },
};

/**
 * Primary-admin editor for transactional email and account-page copy.
 */
export default async function VintageEmailsAdminPage() {
  if (!(await vintageAdminEmail())) notFound();
  return (
    <Suspense fallback={<p className="ve-help">Loading editor…</p>}>
      <VintageCopyTreeEditor
        slot="emails"
        title="Emails & Account"
        navId="emails"
        seed={DEFAULT_VINTAGE_EMAILS_CONTENT}
        intro="Registration, password reset, submit confirmation, PDF email, auto-reply, and on-site account messages."
      />
    </Suspense>
  );
}
