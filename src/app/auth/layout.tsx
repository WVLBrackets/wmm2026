import { notFound } from "next/navigation";
import VintageShell from "@/components/vintage/VintageShell";
import { isVintageEnabled } from "@/lib/vintage/access";
import { DEFAULT_VINTAGE_CONTENT } from "@/lib/vintage/content";
import { getPublishedVintageContent } from "@/lib/vintage/store";

/**
 * Shared chrome for all `/auth/*` routes — VintageShell when vintage is enabled.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isVintageEnabled()) notFound();

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
