# Caching and revalidation

Operator reference for **where data can look stale** and **how to refresh** without a full redeploy.

## Admin controls (`POST /api/admin/revalidate`)

Requires an admin session and CSRF headers (same as other admin POSTs).

| UI action | Body | Effect |
|-----------|------|--------|
| **Rebuild: Home** | `{ "path": "/" }` | `revalidateTag('site-config')`, `revalidateTag('announcements')`, `revalidatePath('/')`, module config cache clear |
| **Rebuild: Info** | `{ "path": "/info" }` | Site config tag + path `/info` |
| **Rebuild: Hall of Fame** | `{ "path": "/hall-of-fame" }` | Site config tag + path `/hall-of-fame` |
| **Rebuild: Standings** | `{ "path": "/standings" }` | Site config tag, **`clearStandingsCache()`** (in-process 2-minute standings sheet cache), `revalidatePath('/standings')`, `revalidatePath('/standings/live')` |
| **Site config cache** | `{ "action": "flush-site-config" }` | `revalidateTag('site-config')`, `invalidateSiteConfigModuleCache()` only — **does not** rebuild pages |

Use **Standings** after editing the **standings Google Sheet** so daily standings pick up new rows quickly. Use **Site config cache** after changing the **site config sheet** when you need server-side config (API routes, server components) to see new values; see **CDN** note below.

## Kill switch vs config latency

| Source | Why it feels “instant” or slow |
|--------|--------------------------------|
| **Kill switch** | Read from the database on `/api/kill-switch` with `Cache-Control: no-store`. Clients poll or refetch; no long-lived Next data cache on that path. |
| **Site config (Google Sheet)** | Server: `getSiteConfigFromGoogleSheets` uses **`unstable_cache`** (~5 min TTL, tag `site-config`). Client: **`GET /api/site-config`** uses **`s-maxage=300`** (edge cache). Flushing the tag clears the server layer; **browsers/CDN may still serve `/api/site-config` for up to ~5 minutes** unless the client uses `?fresh=true` or `Cache-Control: no-store` (the app already uses `no-store` in some flows). |
| **Announcements (home)** | Cached with tag `announcements` (~5 min). Rebuild **Home** clears them. |
| **Daily standings data** | **`standingsData.ts`**: in-memory **`Map` per sheet+day, ~2 minutes**. **`GET /api/standings`** has no extra CDN header; clients typically use `cache: 'no-store'`. Admin **Rebuild Standings** calls **`clearStandingsCache()`**. |
| **Live standings API** | Snapshot in **Postgres**; recomputed when the KEY bracket is saved. **`LiveStandingsPanel`** fetches with **`cache: 'no-store'`**. Stale UI is usually snapshot age, not HTTP cache. |
| **Static / ISR pages** | Routes like `/`, `/info`, `/hall-of-fame`, **`export const revalidate = false`** are handled via **on-demand `revalidatePath`** when you click Rebuild. **`/standings` and `/standings/live`** may be regenerated on a time-based revalidate (see build output); **`revalidatePath`** forces a fresh generation. |
| **Team data API** | Public **`s-maxage`** for mascot/team JSON; changes need time or a future admin hook if this becomes painful. |

## Client `fetch` behavior (summary)

Already **`cache: 'no-store'`** for: standings list/day API, live standings, kill switch, many admin calls. Where the browser shows stale UI, check server/cache layers above first.

## Related files

- `src/app/api/admin/revalidate/route.ts` — allowed paths and flush action
- `src/lib/siteConfig.ts` — `unstable_cache` + tag `site-config`
- `src/lib/standingsData.ts` — `standingsCache`, `clearStandingsCache`
- `src/app/api/site-config/route.ts` — CDN cache headers
- `src/lib/announcements.ts` — home announcements cache
