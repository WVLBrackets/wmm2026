import LegacySiteChrome from "@/components/LegacySiteChrome";
import VintageShell from "@/components/vintage/VintageShell";
import { getBuildStamp } from "@/lib/buildStamp";
import { isVintageEnabled } from "@/lib/vintage/access";
import { DEFAULT_VINTAGE_CONTENT } from "@/lib/vintage/content";
import { getPublishedVintageContent } from "@/lib/vintage/store";

/**
 * Shared chrome for all `/auth/*` routes: VintageShell when vintage is enabled,
 * otherwise legacy chrome with the vintage form panel surface.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isVintageEnabled()) {
    let content = DEFAULT_VINTAGE_CONTENT;
    try {
      content = await getPublishedVintageContent();
    } catch {
      content = structuredClone(DEFAULT_VINTAGE_CONTENT);
    }
    return (
      <VintageShell content={content} testId="vintage-auth-page">
        {children}
      </VintageShell>
    );
  }

  return (
    <LegacySiteChrome buildStamp={getBuildStamp()}>
      <div className="v-auth-legacy-wrap" data-testid="auth-page-legacy">
        {children}
      </div>
    </LegacySiteChrome>
  );
}
