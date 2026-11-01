import type { Metadata } from "next";
import { getEnvironmentTitlePrefix } from "@/lib/appEnvironment";
import { getSiteConfigCached } from "@/lib/siteConfigServer";

/**
 * Per-route document title from published CMS (site name + page heading).
 * Blank headings omit the page segment; CMS load failure degrades to the
 * environment prefix only (the page itself surfaces SiteErrorPanel).
 *
 * @param heading - CMS page heading (blank allowed)
 */
export async function cmsRouteMetadata(heading: string): Promise<Metadata> {
  const config = await getSiteConfigCached().catch(() => null);
  const page = heading.trim();
  const site = config?.siteName?.trim() ?? "";
  const title = `${getEnvironmentTitlePrefix()}${[site, page].filter(Boolean).join(" · ")}`.trim();
  const description = config?.siteDescription?.trim() || undefined;
  return {
    title: title || undefined,
    description,
  };
}
