import AuthForms from "@/components/auth/AuthForms";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";

export const dynamic = "force-dynamic";

/**
 * Sign In / Create Account. Labels from My Picks CMS (`auth`) and
 * Emails & Account CMS (`account` pages).
 */
export default async function SignInPage() {
  const bundle = await getPublishedCmsBundle();
  return (
    <AuthForms authCopy={bundle.picks.auth} accountCopy={bundle.emails.account} />
  );
}
