import ForgotPasswordClient from "./ForgotPasswordClient";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";

export const dynamic = "force-dynamic";

/**
 * Forgot password — copy from Emails & Account CMS.
 */
export default async function ForgotPasswordPage() {
  const bundle = await getPublishedCmsBundle();
  return <ForgotPasswordClient copy={bundle.emails.account} />;
}
