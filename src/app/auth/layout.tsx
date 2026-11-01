import VintageShell from "@/components/vintage/VintageShell";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";

export const dynamic = "force-dynamic";

/**
 * Shared vintage chrome for all `/auth/*` routes.
 * CMS load failure surfaces the site error panel (no default-document fallback).
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bundle = await getPublishedCmsBundle();
  return (
    <VintageShell content={bundle.home} testId="vintage-auth-page">
      {children}
    </VintageShell>
  );
}
