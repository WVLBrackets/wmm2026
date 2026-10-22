import AuthForms from "@/components/auth/AuthForms";
import { getPublishedVintagePicksContent } from "@/lib/vintage/picksStore";

// Session / config-dependent; avoid sharing HTML across visitors.
export const dynamic = "force-dynamic";

/**
 * Dedicated Sign In / Create Account page (chrome from `auth/layout.tsx`).
 * Labels come from published My Picks CMS (`auth` section).
 */
export default async function SignInPage() {
  const picks = await getPublishedVintagePicksContent();
  return <AuthForms authCopy={picks.auth} />;
}
