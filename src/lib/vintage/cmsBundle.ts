import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import {
  CmsUnavailableError,
  parsePublishedCmsBundle,
  type VintageCmsBundle,
} from "./cmsPublished";
import { VINTAGE_CMS_TAG } from "./sidecarWriter";

export { CmsUnavailableError, type VintageCmsBundle };

/**
 * Read and parse the published CMS row (one query).
 */
async function loadPublishedCmsBundle(): Promise<VintageCmsBundle> {
  if (!hasVintageDatabase()) {
    throw new CmsUnavailableError("Vintage CMS database is not configured.");
  }
  const result = await getVintageDbPool().query(
    "SELECT version, published FROM vintage_homepage WHERE id = 1",
  );
  const row = result.rows[0];
  if (!row) throw new CmsUnavailableError("Vintage CMS row is missing.");
  return parsePublishedCmsBundle(Number(row.version), row.published);
}

const loadCached = unstable_cache(loadPublishedCmsBundle, ["vintage-cms-published-v2"], {
  revalidate: 300,
  tags: [VINTAGE_CMS_TAG],
});

/**
 * Report a CMS / site-config outage to the admin (throttled) without blocking the caller.
 *
 * @param error - Failure to report
 * @param location - Dedup location (default published bundle)
 */
export function reportSiteConfigFailure(
  error: Error,
  location = "cms:published",
): void {
  void import("@/lib/adminNotifications")
    .then(({ notifyAdminOfError }) => notifyAdminOfError(error, location))
    .catch(() => undefined);
}

/**
 * Report a CMS outage to the admin (throttled) without blocking the caller.
 *
 * @param error - Failure to report
 */
function reportCmsFailure(error: Error): void {
  reportSiteConfigFailure(error, "cms:published");
}

/**
 * Published CMS bundle — deduped per request and cached for 5 minutes
 * (tag `vintage-cms`, invalidated on every CMS write).
 *
 * @throws CmsUnavailableError — callers let it reach the route error boundary
 */
export const getPublishedCmsBundle = cache(async (): Promise<VintageCmsBundle> => {
  try {
    return await loadCached();
  } catch (error) {
    const err =
      error instanceof CmsUnavailableError
        ? error
        : new CmsUnavailableError(
            `Published CMS could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
          );
    console.error("[CMS] Published bundle unavailable:", err.message);
    reportCmsFailure(err);
    throw err;
  }
});
