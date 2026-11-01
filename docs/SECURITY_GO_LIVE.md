# Security go-live notes (WMM2026)

Findings already addressed in code, plus remaining operator duties. Staging only until **explicit production approval**.

## Admin identity

- **Single source:** `ADMIN_EMAIL` (comma-separated list).
- Helpers: `isAdminEmail` (`lib/adminEmails.ts`), `isAdmin` / `requireAdminRequest` (`lib/adminAuth.ts`), vintage `isPrimaryVintageAdmin` (`lib/vintage/access.ts`).
- Same list gates ops `/admin`, vintage CMS `/vintage/admin/*`, and `notifyAdminOfError` recipients (first address is primary).
- Do not reintroduce a separate “vintage-only” email allowlist.

## Tournament JSON is not HTTP-public

`public/data/tournament-*.json` is for the **server loader** (and `outputFileTracingIncludes`). Middleware returns **404** for `/data/*` so tournament JSON is not fetchable over HTTP.

```26:28:src/middleware.ts
  if (pathname.startsWith('/data/')) {
    return new NextResponse('Not found', { status: 404 });
  }
```

## `/api/log/error`

- **Unauthenticated** by design (client error reporter).
- **Rate-limited** with `RATE_LIMITS.API_WRITE` (30 writes / minute / client) in `src/app/api/log/error/route.ts`.
- Do not expose stack traces or secrets in the payload; keep the handler conservative.

## CSRF + rate limits

Keep coverage on:

- **Payment:** `/api/bracket/payment`, `/api/admin/brackets/[id]/payment`, `/api/admin/payments/bulk`
- **Admin writes:** vintage CMS routes, tournament builder, scoreboard, kill-switch, revalidate, etc.
- **User profile** and **bracket mutations** (`csrfProtection` + existing rate-limit buckets)

New state-changing routes must call `csrfProtection` and an appropriate `RATE_LIMITS` bucket. Staging/preview limits are relaxed vs production (`lib/rateLimit.ts`) — do not copy staging numbers into production.

## `DEV_AUTH_BYPASS`

`DEV_AUTH_BYPASS` / `NEXT_PUBLIC_DEV_AUTH_BYPASS` must **not** be `true` in production. `assertProductionEnv()` throws if they are. Confirm Vercel Production env does not define them. `/api/health` fails closed when the assertion fails.

## CMS / copy

- Public copy is CMS-only. Do not restore a Sheets config loader or silent `fallbackConfig` / `SITE_COPY_DEFAULTS` merge on the public path.
- CMS outages notify admins via `notifyAdminOfError` (throttled in `admin_notifications`).

## Cron

`/api/cron/scoreboard-sync` (optional scripted sync; not Vercel-scheduled on Hobby) requires `Authorization: Bearer CRON_SECRET`. Production still expects `CRON_SECRET` for env validation. Prefer Admin **Sync now** for day-to-day score pulls.

## Remaining operator vigilance

- Rotate `NEXTAUTH_SECRET`, `CRON_SECRET`, Resend, and S3 keys if they ever leaked in logs or previews.
- Keep Production `NEXTAUTH_URL` on the real public origin (no preview-host fallback).
- Review Vercel Deployment Protection / SSO separately from app auth; this file does not replace dashboard settings.
