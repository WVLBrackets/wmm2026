import ConfirmEmailClient from "./ConfirmEmailClient";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";

export const dynamic = "force-dynamic";

/**
 * Email confirmation result — copy from Emails & Account CMS.
 */
export default async function ConfirmEmailPage() {
  const bundle = await getPublishedCmsBundle();
  return <ConfirmEmailClient accountCopy={bundle.emails.account} />;
}
