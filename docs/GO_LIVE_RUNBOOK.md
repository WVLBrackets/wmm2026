# Go-live runbook (WMM2026)

Stay on **staging** until there is **explicit production approval**. Merging to `main` / promoting a production alias is not implied by this checklist.

**Staging guardrail:** before any commit/push intended for the `staging` branch, run `npm run build` locally. If the build fails, fix compile/type errors before the staging push.

## 1. Neon backup / PITR

This app uses **two** Neon databases per environment (app/brackets vs vintage CMS). Treat them as a pair.

Before production cutover (and before any destructive CMS import):

1. Confirm both production branches have **PITR** (or a current backup) enabled in the Neon console.
2. Note the time you start cutover (UTC) so you can restore to just before go-live if needed.
3. Optionally create named restore branches (`app-prod-pre-golive`, `vintage-cms-prod-pre-golive`).
4. Do **not** point `VINTAGE_DATABASE_URL` at `POSTGRES_URL` (or vice versa).

`hof_seasons`, scoreboard tables, live standings snapshots, users/brackets, and `admin_notifications` live on the **app** database. `vintage_homepage` lives on the **CMS** database.

## 2. Scoreboard sync (manual)

Hobby Vercel does not run multi-daily crons. Scoreboard refresh is **manual**.

**First time on a new Preview/staging DB** (error `relation "scoreboard_games" does not exist` / empty public board):

1. Sign in as admin on that environment.
2. Open `/api/init-database` once (creates scoreboard tables), or reload **Admin → Scoreboard** after a deploy that auto-ensures tables.
3. On **Admin → Scoreboard**, year **2026**, click **Sync now** (seeds from tournament JSON + pulls Big Balls when `API_KEY_BIGBALL` is set).
4. On public **Scores**, open **Edit scoreboard** → **Publish** (no edits) to rebuild Day 1/Day 2 tipoff pages if needed.

Ongoing:

1. Sign in as admin → **Admin** → **Scoreboard** tab.
2. Confirm year / BBS season.
3. Click **Sync now** (requires `API_KEY_BIGBALL`).

Optional: `POST /api/cron/scoreboard-sync` with `Authorization: Bearer <CRON_SECRET>` still exists for scripted pulls, but it is **not** scheduled in `vercel.json`. Sync writes use the `ADMIN_EMAIL` user row, or `SCOREBOARD_SYNC_ACTOR_USER_ID`.

## 3. CMS publish checklist

Published CMS is the only visitor copy. Code deploy does **not** copy Neon rows.

1. In **staging**, open `/vintage/admin` as an `ADMIN_EMAIL` user.
2. Key Data: **Tourney Year** and **site name** are non-blank (required; missing throws + `SiteErrorPanel` + admin email).
3. Publish every desk you changed: Home, Info, Hall of Fame, My Picks, Standings, Emails & Account, Bracket Editor Messages, Scoreboard.
4. Promote with **CMS export / import** (Home desk) from the source environment. Review Include toggles; confirm before write. Image URLs are not remapped across buckets.
5. After import, **publish** if the tool wrote published JSON directly — verify the public site, not only draft preview.
6. Hall of Fame podium years: confirm `hof_seasons` rows in the **app** DB (not Sheets).
7. Blank fields hide elements; do not expect `DEFAULT_*` copy on the public path.

## 4. Environment validation

Production (`VERCEL_ENV=production` or `NODE_ENV=production`) must have:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (canonical production origin — **no** `wmm2026.vercel.app` fallback)
- `ADMIN_EMAIL` (comma-separated admins)
- `POSTGRES_URL` and `VINTAGE_DATABASE_URL`
- Optional: `CRON_SECRET` only if you call `/api/cron/scoreboard-sync` manually
- Email: `RESEND_API_KEY` and production `FROM_EMAIL_*`
- Vintage S3 credentials if homepage images are used

**Must be unset / not `true`:** `DEV_AUTH_BYPASS`, `NEXT_PUBLIC_DEV_AUTH_BYPASS`.

Hit **`GET /api/health`**: expects `{ ok: true, year, siteName }`. Failures:

- `500` — env assertion (`assertProductionEnv`)
- `503` — app DB ping or published CMS read

## 5. Go-live smoke list

Signed-out and signed-in (player + admin) as applicable:

| Surface | What to confirm |
|---------|-----------------|
| **Home** | Vintage masthead, cards, explore, announcements, countdown; blank CMS fields hidden; admin gears only for admins |
| **My Picks** | Create entry, edit WIP, **submit**, **pay** (Venmo/Zelle per Key Data); Action Lock messages from CMS |
| **Standings** | Live standings for Standings Year; year switch; no legacy daily-sheet UI |
| **Scoreboard** | Groups/year; snapshot data; toolbar Scores |
| **Info** | Handbook from `__infoHandbook`; TOC and prizes |
| **Hall of Fame** | Copy from `__hofContent`; history from `hof_seasons` |
| **Print** | `/print-bracket` (and in-flow print) with `__bracketEditorContent` labels |
| **Auth** | Sign in / create account / confirm / reset copy from Emails & Account CMS |
| **Ops** | `/admin` still works; `/admin/vintage-*` redirects to `/vintage/admin/*` |

On CMS/config failure you should see vintage **`SiteErrorPanel`**, and `ADMIN_EMAIL` should receive a throttled `notifyAdminOfError` message (check `admin_notifications` if mail is quiet).

## 6. After smoke

- Watch Vercel runtime logs for CMS / sync / payment errors.
- Confirm inbound auto-reply only if MX/webhook is already production-ready (`docs/AUTO_REPLY_SETUP.md`).
- Do not flush caches as a substitute for publishing CMS.

## 7. Rollback

1. Vercel → previous production deployment.
2. Neon PITR / restore branch for **both** databases if CMS or bracket data is wrong.
3. Re-check `/api/health` and the smoke list on staging before another production attempt.
