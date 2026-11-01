# Caching and revalidation

Operator reference for **where data can look stale** and **how to refresh** without a full redeploy.

**User-facing copy** comes only from the published vintage CMS (`vintage_homepage` plus sidecars). There is no Google Sheets Config Sheet cache.

## Published CMS (`getPublishedCmsBundle`)

`lib/vintage/cmsBundle.ts` loads the published row once per request (`React.cache`) and wraps the query in `unstable_cache`:

| Layer | Behavior |
|-------|----------|
| Tag | `vintage-cms` (`VINTAGE_CMS_TAG`) |
| Key | `vintage-cms-published-v2` |
| TTL | ~5 minutes (`revalidate: 300`) |
| Invalidate | `revalidateTag('vintage-cms')` on every CMS write (`revalidateVintageCms` in `sidecarWriter.ts`) and on admin rebuild / flush |

Public reads parse with `blankMissingStrings` after normalize. **Do not** merge `DEFAULT_*` objects on this path. A CMS load failure throws, the vintage `SiteErrorPanel` is shown, and `notifyAdminOfError` emails admins (DB-throttled).

## Admin controls (`POST /api/admin/revalidate`)

Requires an admin session and CSRF headers (same as other admin POSTs).

| UI action | Body | Effect |
|-----------|------|--------|
| **Rebuild: Home** | `{ "path": "/" }` | `revalidateTag('vintage-cms')`, `revalidateTag('site-config')`, `revalidateTag('announcements')`, `revalidatePath('/')`, module config cache clear |
| **Rebuild: Info** | `{ "path": "/info" }` | CMS + site-config tags + path `/info` |
| **Rebuild: Hall of Fame** | `{ "path": "/hall-of-fame" }` | CMS + site-config tags + path `/hall-of-fame` |
| **Rebuild: Standings** | `{ "path": "/standings" }` | CMS + site-config tags, `revalidatePath('/standings')` |
| **Site config cache** | `{ "action": "flush-site-config" }` | `revalidateTag('vintage-cms')`, `revalidateTag('site-config')`, `invalidateSiteConfigModuleCache()` — **does not** rebuild a specific page |

Publishing in Vintage Admin already invalidates `vintage-cms` (and `site-config`). Use Rebuild when a page still looks stale after publish (ISR / CDN).

## Kill switch vs config latency

| Source | Why it feels “instant” or slow |
|--------|--------------------------------|
| **Application Master Lock** | Read from published homepage Key Data (`keyData.masterLockUnlocked`) via `lib/killSwitch.ts`. `/api/kill-switch` uses `Cache-Control: no-store`. Clients poll or refetch. |
| **Site config (published CMS)** | Server: `getSiteConfigCached` → `getPublishedCmsBundle` (`vintage-cms` tag). Client: **`GET /api/site-config`** uses **`s-maxage=300`**. Flushing the tag clears the server layer; **browsers/CDN may still serve `/api/site-config` for up to ~5 minutes** unless the client uses `?fresh=true` or `Cache-Control: no-store`. `fresh=true` skips the CDN layer only; it never bypasses the published CMS. |
| **Homepage announcements** | Stored on the homepage CMS document (`announcementBoard`). They refresh when the CMS tag is invalidated (publish or Rebuild Home). |
| **Live standings** | Snapshot in **Postgres**; recomputed when the KEY bracket is saved, on cold start, or admin **Regenerate**. **`LiveStandingsPanel`** fetches with **`cache: 'no-store'`**. Stale UI is usually snapshot age, not HTTP cache. |
| **Scoreboard** | Public path reads `scoreboard_snapshots`. Admin edits rebuild the snapshot. Cron `/api/cron/scoreboard-sync` (Bearer `CRON_SECRET`) may update scores on a schedule. |
| **Static / ISR pages** | On-demand `revalidatePath` when you click Rebuild. **`revalidatePath`** forces a fresh generation. |

## Client `fetch` behavior (summary)

Already **`cache: 'no-store'`** for: live standings, kill switch, many admin calls. Where the browser shows stale UI, check the CMS tag, `/api/site-config` CDN headers, and snapshot age first.

## Related files

- `src/lib/vintage/cmsBundle.ts` — `unstable_cache` + tag `vintage-cms`
- `src/lib/vintage/sidecarWriter.ts` — `revalidateVintageCms()`
- `src/lib/vintage/cmsPublished.ts` — parse + `blankMissingStrings`
- `src/app/api/admin/revalidate/route.ts` — allowed paths and flush action
- `src/lib/siteConfigServer.ts` — CMS → `SiteConfigData`
- `src/app/api/site-config/route.ts` — CDN cache headers
- `src/config/site.ts` — client module cache (`invalidateSiteConfigModuleCache`)
