# Setup Guide for New Machine

This guide helps you get up and running on a new machine while preserving all context and work completed.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/WVLBrackets/wmm2026.git
   cd wmm2026
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```powershell
   # On Windows PowerShell
   .\scripts\pull-env-all.ps1
   ```
   This creates `.env.test` / local env files with values from Vercel. Confirm **`NEXTAUTH_URL`** and **`ADMIN_EMAIL`** are present — there is **no** `wmm2026.vercel.app` origin fallback.

4. **Install Playwright browsers** (for local testing/debugging only)
   ```bash
   npx playwright install
   ```
   Note: Most testing is done via staging preview deployments, not locally.

5. **Optional: Run the development server** (for local development/debugging)
   ```bash
   npm run dev
   ```
   Note: This is optional. All testing is done on staging preview deployments via GitHub Actions workflows.

## Environment Variables

Pulled via `pull-env-all.ps1` or set in Vercel. Names vary slightly by environment; production is validated by `assertProductionEnv` (`src/lib/env.ts`) on `/api/health`.

### Required for the app to run

| Variable | Purpose |
|----------|---------|
| `NEXTAUTH_SECRET` | Session signing |
| `NEXTAUTH_URL` | Canonical origin for auth callbacks and emails. **Required. No product-domain fallback.** |
| `ADMIN_EMAIL` | Comma-separated admin identities (`isAdminEmail` / `requireAdminRequest`). First address receives admin error mail. |
| `POSTGRES_URL` | Application / bracket database (Neon) |
| `VINTAGE_DATABASE_URL` | Dedicated vintage **CMS** Neon branch. Never the bracket database. |
| `RESEND_API_KEY` | Email delivery |
| `FROM_EMAIL_STAGING` / `FROM_EMAIL_PRODUCTION` | Sender addresses |

### Required in production (`assertProductionEnv`)

- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `CRON_SECRET`
- `DEV_AUTH_BYPASS` and `NEXT_PUBLIC_DEV_AUTH_BYPASS` **must be unset** (not `true`)

### Email / webhooks

- `RESEND_WEBHOOK_SECRET` — inbound auto-reply webhook
- `EMAIL_USER_*` / `EMAIL_PASS_*` — Gmail SMTP fallback
- `SUPPRESS_TEST_EMAILS` — optional; set `true` to suppress emails during test runs

### Testing

- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD_STAGING` / `TEST_USER_PASSWORD_PRODUCTION`
- `VERCEL_ENV` — environment identifier

### Vintage CMS storage (images)

- `VINTAGE_S3_ENDPOINT`, `VINTAGE_S3_REGION`, `VINTAGE_S3_BUCKET`
- `VINTAGE_S3_ACCESS_KEY_ID`, `VINTAGE_S3_SECRET_ACCESS_KEY`

### Cron

- `CRON_SECRET` — Bearer token for `/api/cron/scoreboard-sync` (also sent by Vercel Cron)
- Optional `SCOREBOARD_SYNC_ACTOR_USER_ID` if the `ADMIN_EMAIL` user row is missing

## Neon databases

This product uses **two** Neon databases per environment:

1. **App / brackets** — `POSTGRES_URL` (users, brackets, payments, `hof_seasons`, scoreboard ops tables, live standings snapshots, `admin_notifications`).
2. **Vintage CMS** — `VINTAGE_DATABASE_URL` (`vintage_homepage` draft/published JSON + sidecars). Isolated from bracket data.

Do not point `VINTAGE_DATABASE_URL` at the app database. Preview/staging and production must use matching pairs of branches.

## CMS (user-facing copy)

**Published CMS is the only source of visitor copy** (`vintage_homepage` + sidecars). There is no Config Sheet.

- Edit and publish at `/vintage/admin/*` (ops admin remains `/admin`).
- Blank CMS field → hide the element on the public path (`blankMissingStrings` after normalize).
- Required Key Data (**Tourney Year**, **site name**) missing, or CMS load failure → throw, vintage `SiteErrorPanel`, email via `notifyAdminOfError` (throttled in `admin_notifications`).
- `DEFAULT_*` objects seed the **editor** only. They are never merged on the public read path.

Promote CMS between environments with **CMS export / import** on the Home admin desk. Code deploy does not copy Neon CMS rows.

## Key Project Context

### Architecture Highlights

1. **Email Service**
   - Primary: Resend API
   - Fallback: Gmail SMTP
   - Auto-reply for do-not-reply addresses (copy from Emails & Account CMS)
   - Test user detection and email suppression

2. **Testing Setup**
   - Playwright for E2E testing
   - GitHub Actions workflows for manual execution on staging previews
   - Support for desktop and mobile; Chrome, Firefox, and WebKit

3. **Admin**
   - `/admin` — ops (Users, Brackets, Key, Teams, Tourney, Payments, Logs)
   - `/vintage/admin` — CMS (Home, Info, Hall of Fame, My Picks, Standings, Emails & Account, Bracket Editor Messages, Scoreboard)
   - `/admin/vintage-*` URLs redirect in `next.config.ts` (not stub pages)

4. **Configuration**
   - Season controls live in homepage Key Data / Payments (Tourney Year, site name, locks, entry cost, pay methods)
   - Environment-specific settings (staging vs production) stay in Vercel env

### Important Files

- `playwright.config.ts` — Test configuration with browser/device projects
- `src/lib/emailService.ts` — Email sending with Resend/Gmail fallback
- `src/lib/testUserDetection.ts` — Test user identification for email suppression
- `src/lib/vintage/cmsBundle.ts` — Published CMS cache
- `src/lib/env.ts` — Production env assertions
- `.github/workflows/` — GitHub Actions workflows for testing

### Testing Workflow

**Primary Testing Method: GitHub Actions Workflows**
- All testing is done via staging preview deployments
- Manual workflow execution through GitHub Actions
- Workflows available: Full Regression Tests, Group 1–5, environment/browser/mode selectors

**Local Testing (Optional - for debugging only)**
```bash
npm test
npm run test:group-1
TEST_ENV=staging npm test
npm run test:mobile
SUPPRESS_TEST_EMAILS=true npm test
```
Local testing requires `.env.test` with all environment variables.

### Deployment

- **Staging**: Automatically deploys from `staging` branch
- **Production**: Automatically deploys from `main` branch — **only after explicit production approval**
- Both managed via Vercel

Before pushing to `staging`, run `npm run build` so CI/Vercel catches no new compile/type issues.

## Cursor-Specific Notes

Since Cursor doesn't automatically sync conversation history:

1. **Document important decisions** in this file or `docs/` folder
2. **Use Git commits** with descriptive messages
3. **Review recent commits** to understand recent changes:
   ```bash
   git log --oneline -20
   ```
4. **Check tags** for major milestones:
   ```bash
   git tag -l
   ```

## Troubleshooting

### Missing Environment Variables
Run `.\scripts\pull-env-all.ps1`. Confirm `NEXTAUTH_URL`, `ADMIN_EMAIL`, `POSTGRES_URL`, and `VINTAGE_DATABASE_URL`.

### CMS / SiteErrorPanel on `/`
Published CMS could not load or required Key Data is blank. Check the vintage Neon branch, then Vintage Admin → Key Data, then `/api/health`.

### Playwright Tests Failing
1. Ensure browsers are installed: `npx playwright install`
2. Check `.env.test` exists and has `TEST_USER_EMAIL` and passwords
3. Verify `POSTGRES_URL` and `VINTAGE_DATABASE_URL` are set correctly

### Build Errors
1. Clear `.next` folder: `rm -rf .next` (or `rmdir /s .next` on Windows)
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check TypeScript errors: `npm run build`

## Next Steps After Setup

1. Verify environment variables are loaded
2. Review recent changes: `git log --oneline -10`
3. Push changes to **staging** (after `npm run build`) to trigger preview deployment
4. Execute workflows via GitHub Actions for testing on staging preview
5. (Optional) Run local tests for debugging: `npm run test:group-1`
