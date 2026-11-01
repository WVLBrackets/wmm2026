import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy `/scoreboard/[slug]` → `/scoreboard?group=` (Standings-style searchParams).
 * Toolbar and in-app links use `/scoreboard`; this keeps old bookmarks working.
 */
export default async function LegacyScoreboardSlugRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string; edit?: string }>;
}) {

  const { slug } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (slug) qs.set("group", slug);
  if (sp.year && /^\d{4}$/.test(sp.year)) qs.set("year", sp.year);
  if (sp.edit === "1") qs.set("edit", "1");
  const q = qs.toString();
  redirect(q ? `/scoreboard?${q}` : "/scoreboard");
}
