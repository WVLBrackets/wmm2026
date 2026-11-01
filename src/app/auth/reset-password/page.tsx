import ResetPasswordClient from "./ResetPasswordClient";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";

export const dynamic = "force-dynamic";

/**
 * Reset password — copy from Emails & Account CMS.
 */
export default async function ResetPasswordPage() {
  const bundle = await getPublishedCmsBundle();
  return <ResetPasswordClient copy={bundle.emails.account} />;
}
