# WMM 2027 Plan of Attack

Handoff document written 2026-10-11 after the initial re-familiarization and Phase 0 work.
Purpose: let any model/agent pick up one item at a time without re-discovering context.

Related: `.cursor/plans/wmm_2027_multi-year_readiness_7d352338.plan.md` (approved plan), `GLOBAL_ENGINEERING_STANDARDS.md`.

Rules for whoever picks this up:
- Work one numbered item at a time. Stop and report when it is done.
- Never print secret values. Names of env vars are fine; values are not.
- Before any push to `staging`, run `npm run build`.
- Local Node is 24; CI and Vercel use Node 20. Validate lockfile changes with `npx npm@10 ci --dry-run`.

---

## Decisions already made (do not re-ask)

1. Single active year: a bracket is editable only when `bracket.year === tournament_year` (from Google Sheets). Every other year is read-only.
2. Players may view, for prior years: their own submitted brackets, their own drafts, final standings/KEY, and payment status. All read-only.
3. Housekeeping docs were committed (done).

---

## Phase 0 status

### 0.1 Commit carryover docs - DONE
- `158f6bb` on `staging`: standards rewrite + `docs/templates/*` + `docs/STANDINGS_SHADING_AND_BORDERS.md`.
- Local `main` fast-forwarded to `0ff5ecc` (same as `origin/main`).

### 0.2 Local verification - DONE
- Build green, dev server boots, home page renders, DB-backed routes work.
- `.env.local` DB host is different from preview and prod hosts (good, it is a clone).
- `.env.local` lacks `NEXTAUTH_SECRET` / `NEXTAUTH_URL`. Works today only because dev auth bypass substitutes a dev secret. Add real values for password-reset/CSRF testing (item 0.4 covers documenting this).
- Dependency security fixes pushed as `982936b`: `next` 15.5.14 -> 15.5.27, `next-auth` 4.24.13 -> 4.24.15 (critical advisories), removed unused `prisma`, `@prisma/client`, `@auth/prisma-adapter`. Prod-dep audit went from 4 critical to 2 (remaining are in `@auth/core` bundled by next-auth v4, email-provider path this app does not use).
- Lockfile regenerated with npm 10 in `a614379` because CI `npm ci` failed on the npm-11-generated lockfile.
- Deferred, needs a decision: semver-major upgrades `nodemailer` 8 -> 10 and `puppeteer-core` 24 -> 25 (both have high advisories).

### 0.3 Staging verification - PARTIALLY DONE, ONE OPEN PROBLEM

Done:
- Vercel Preview has every runtime secret the app needs (`NEXTAUTH_*`, `POSTGRES_URL`, `PREVIEW_POSTGRES_URL`, `RESEND_*`, `STANDINGS_SHEET_ID_STAGE`, email vars).
- Staging has Vercel Deployment Protection ON. `playwright.config.ts` already sends the bypass header. Added `VERCEL_AUTOMATION_BYPASS_SECRET` to every GitHub workflow env block (`42d8662`) and created the GitHub secret. Verified the bypass value works (API returns 200 through the wall).
- GitHub secret `TEST_USER_PASSWORD_STAGING` was set to the current Vercel Preview value. Local `.env.test` was updated to the same value.
- All four staging deployments today built successfully on Vercel.
- STAGE Google Sheet still has 2026 values (`tournament_year=2026`, April 2026 deadlines). That is a rollover-time edit, see Phase 1.4 runbook.

OPEN PROBLEM (plain-English version):
- The smoke test (`tests/e2e/smoke-test.spec.ts`) fails at "Sign in" on staging with `CredentialsSignin`. This happened before any of today's code changes, so it is not caused by them.
- The staging server itself can log users in: I registered a throwaway account through the staging API and it authenticated correctly.
- The strange part: when I connect to the database using the `PREVIEW_POSTGRES_URL` value from `.env.test` (and the same value pulled fresh from Vercel), I cannot see rows that the staging server just wrote, and the staging server cannot see rows I update. Same host name, same database name (`neondb`), same role, yet two different sets of data. Most likely explanations: the connection string differs in a query parameter that selects a different Neon endpoint/branch, or the test user row the server sees simply has a different (stale) password hash than the one I updated.
- Side effect to clean up when the right DB is found: an unconfirmed throwaway user with email `<test-user-local-part>+probe<timestamp>@<test-user-domain>` exists in whatever database staging actually uses. Delete it from `users` and `tokens`.

Cheapest next steps, in order (each is small):
1. In the Vercel dashboard (Settings > Environment Variables), open `PREVIEW_POSTGRES_URL` and `POSTGRES_URL` for Preview and check whether they are branch-scoped to `staging` and whether the full value (including `?...` query string) matches what `vercel env pull --environment=preview --git-branch=staging` returns. Compare with the Neon console: which branch/endpoint does the staging project actually point at?
2. Simplest fix regardless of cause: reset the staging test user's password through the app itself (Forgot Password flow on the staging site, or the admin UI) to the value in Vercel Preview `TEST_USER_PASSWORD_STAGING`. That guarantees the server-side hash matches whatever DB it uses.
3. Re-run: `npm run test:smoke` locally with `TEST_ENV=staging` (set `PLAYWRIGHT_BROWSERS_PATH=%LOCALAPPDATA%\ms-playwright` if the sandbox redirects it), then `gh workflow run test-smoke.yml --ref staging -f environment=staging -f send_emails=false`.
4. Delete the throwaway probe user.

Security observations from 0.3 (no action taken, need a decision):
- `POSTGRES_URL_PROD` is exposed to the Preview environment (used by `src/lib/teamDataConnection.ts` so staging reads the shared prod team table). Staging can therefore reach the production database.
- `handleTestEmailSuppression` in `src/app/api/auth/register/route.ts` never activates on preview because `NODE_ENV` is `production` on Vercel; test registrations on staging always send real email.
- `scripts/pull-env-all.ps1` gives Production precedence when merging, which can silently overwrite preview-specific values like `TEST_USER_PASSWORD_STAGING` in `.env.test`.

### 0.4 Doc hygiene - NOT STARTED
- Add `.env.example` with variable names only (no values). `.gitignore` line 41 `.env*` would ignore it; add `!.env.example`.
- Replace stale root `ENVIRONMENT_SETUP.md` (describes pre-Postgres JSON files) with a pointer to `docs/SETUP_GUIDE.md`.
- Fix `tests/ENV_PULL_GUIDE.md`: the `npm run env:pull*` scripts do not exist; the real tool is `.\scripts\pull-env-all.ps1`.
- Mention Node 20 (consider adding `.nvmrc` or `engines`).

---

## Phase 1 - Multi-year foundation (not started)

Do these in order; 1.1 unblocks everything else.

### 1.1 Central active-year helper
- New `src/lib/services/tournamentYearService.ts` exporting `getActiveTournamentYear()` (fresh Sheets value, fall back to `FALLBACK_CONFIG.tournamentYear` with a logged warning) and `isHistoricalYear(year)`.
- Replace the copy-pasted resolution (`new Date().getFullYear()` -> Sheets -> fallback) in:
  - `src/app/api/tournament-bracket/route.ts` lines ~97-110 and ~422-424
  - `src/app/api/tournament-bracket/[id]/route.ts` lines ~185-196
  - `src/lib/repositories/bracketRepository.ts` `createBracket`
- Remove hardcoded `'2025'` defaults in `src/lib/tournamentLoader.ts:7`, `src/app/bracket/page.tsx` (L421, L516), print-bracket and email-pdf routes, `standingsData.ts`.

### 1.2 Server-side immutability guard (security-critical)
- `src/app/api/tournament-bracket/[id]/route.ts` PUT and DELETE, and `src/app/api/bracket/payment/route.ts`: return 403 when `bracket.year !== activeYear`, before kill-switch and deadline checks.
- Admin routes keep write access; include year in usage logs.
- `src/lib/bracketSubmissionValidator.ts` `checkSubmissionAllowed`: accept the bracket year so the deadline/kill switch govern only the active year.
- Add API tests in `tests/api/` asserting 403 for prior-year PUT/DELETE/payment.

### 1.3 Historical read API and UI
- `GET /api/tournament-bracket?year=2026` (default active year; `all=true` groups by year); historical rows flagged `readOnly: true`. Today the GET filters to the active year only, which hides 2026 after the flip.
- `src/components/MyPicksLanding.tsx`: "Previous Years" section with submitted and draft brackets, read-only.
- `src/app/bracket/page.tsx`: read-only mode when `bracket.year !== activeYear` (reuse the existing `status === 'submitted'` branch; hide return/delete/pay; keep print/email).
- Prior-year payment status as a read-only badge.
- `src/app/standings/previous-years/page.tsx`: replace "Coming Soon" with a year selector over `live_standings_snapshots` / final KEY.

### 1.4 2027 promotion content
- Add `public/data/tournament-2027.json` placeholder (schema-valid) so `loadTournamentData` cannot throw after the Sheets flip.
- Drive hero image, logo, and "Countdown to {year}" from `tournament_year` + `wmm_logo` / CTA image keys. Fix literals in `src/components/CountdownClock.tsx:74`, `src/components/StandingsTable.tsx` (~345, 355), `src/lib/emailService.ts` (~471, 493), `src/lib/fallbackConfig.ts`, `src/app/info/page.tsx:324`. Add a 2027 asset alongside `public/images/2026 Logo Indianapolis.png`.
- Write `docs/SEASON_ROLLOVER.md`: Sheets keys to change on both PROD and STAGE tabs (`tournament_year`, `standings_year`, `last_year_winner`, `last_year_championship`, `tournament_start_date/time`, `stop_submit_*`, `kill_switch_on`, `show_picks_*`, countdown keys), JSON file to add, verification steps.

### 1.5 Security carryover
- Rate limits on bracket mutations (`src/lib/rateLimit.ts` pattern, env-aware like `AUTH_*`).
- `vercel.json` cron hitting an admin-protected route that runs `cleanupExpiredTokens()` (`src/lib/services/tokenService.ts`, currently never called) and 60-day usage-log cleanup.
- Remove or fix `src/app/admin/users-across-environments/page.tsx` (calls non-existent `/api/debug-all-environments`).
- Decide on semver-major dependency upgrades (nodemailer, puppeteer-core).
- Later, separate decision: shared rate-limit store (Upstash/Vercel KV) instead of in-memory.

---

## Git state at handoff
- Branch `staging` at `a614379`, pushed. Working tree clean except this file.
- Commits today: `158f6bb` docs, `982936b` security deps, `42d8662` CI bypass secret, `a614379` lockfile.
