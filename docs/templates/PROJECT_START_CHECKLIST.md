# New project — setup checklist and runbook

Use this document **every time** you spin up a new application that follows the [BASE_APP_REQUIREMENTS.md](./BASE_APP_REQUIREMENTS.md) template. Check boxes as you complete steps.

---

## Part 1 — Accounts and hosting

### 1.1 Source control

- [ ] Create **GitHub** repository (name, default branch `main`, branch protection optional).
- [ ] Add collaborators and (if org) team access.
- [ ] Initialize from template repo or copy base codebase; push initial commit.

### 1.2 Vercel

- [ ] Create **Vercel** project linked to the GitHub repo.
- [ ] Set **Production** branch to `main` (or your release branch).
- [ ] Confirm **Preview** deployments for PRs / `staging` branch (match team policy).
- [ ] Add project to correct **Vercel team**; note production URL and preview URL pattern.

### 1.3 DNS (if custom domain)

- [ ] Register or point **DNS** to Vercel (A/CNAME per Vercel docs).
- [ ] Set **Production** domain in Vercel; update `NEXTAUTH_URL` after domain is live.

---

## Part 2 — Data and configuration

### 2.1 Neon (PostgreSQL)

- [ ] Create **Neon** project (or two: one prod, one non-prod—recommended).
- [ ] Create branch or database for **production**; copy connection string (pooler URL recommended).
- [ ] Create branch or database for **preview/staging** (and optional **local** dev DB).
- [ ] Store URLs securely—**never** commit to repo:
  - Production → `PRODUCTION_POSTGRES_URL` (or `POSTGRES_URL` on prod Vercel env).
  - Preview/staging → `PREVIEW_POSTGRES_URL` (or `POSTGRES_URL` on preview).
  - Local → `LOCAL_POSTGRES_URL` or `POSTGRES_URL_LOCAL` in `.env.local`.

### 2.2 Google Config Sheet

- [ ] Create a new **Google Sheet** (or duplicate from a blank template).
- [ ] Add tabs named exactly **`PROD`** and **`STAGE`**.
- [ ] Row layout: `parameter` | `value` (header row optional).
- [ ] Populate **all required keys** from BASE_APP_REQUIREMENTS Section 7 on **both** tabs (values can differ per environment).
- [ ] **Publish / share** for CSV export: Sheet must be readable via **public CSV export URL** (same model as WMM: `docs.google.com/spreadsheets/d/{id}/export?format=csv&gid={gid}`).  
  - If you require private sheet + service account later, that is a **template change**—v1 checklist assumes public export like WMM.
- [ ] Record **Spreadsheet ID** and each tab’s **GID** (File → Share → link, or tab-specific URL shows `gid=`).

### 2.3 Google Cloud (optional later)

- [ ] If moving to private Sheets API: create GCP project, enable Sheets API, create service account, download JSON key to **Vercel secret only**—not in Sheet.

### 2.4 Email (transactional)

- [ ] Choose provider (SMTP, Resend, SendGrid, etc.)—align with WMM if reusing patterns.
- [ ] Create API key or SMTP credentials; add to **Vercel** env (and `.env.local` for local tests).
- [ ] Set **from** address and domain authentication (SPF/DKIM) for production domain.
- [ ] Send test: registration confirmation + password reset.

---

## Part 3 — Environment variables matrix

Set in **Vercel → Project → Settings → Environment Variables** (scope Production vs Preview vs Development) and in **`.env.local`** for local.

| Variable | Production | Preview / Staging | Local (`.env.local`) |
|----------|------------|-------------------|----------------------|
| `NEXTAUTH_URL` | `https://your-prod-domain` | Vercel preview URL or staging URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Strong random | Strong random (can differ) | Strong random |
| `PRODUCTION_POSTGRES_URL` | Neon prod URL | — | — |
| `PREVIEW_POSTGRES_URL` | — | Neon preview URL | — |
| `POSTGRES_URL` | Sometimes used as alias | Sometimes Vercel default | Optional |
| `LOCAL_POSTGRES_URL` | — | — | Neon/local Postgres URL |
| `SITE_CONFIG_SHEET_ID` | Same sheet ID | Same sheet ID | Same sheet ID |
| `SITE_CONFIG_GID_PROD` | GID of `PROD` tab | — | — |
| `SITE_CONFIG_GID_STAGE` | — | GID of `STAGE` tab | GID of `STAGE` tab |
| `VERCEL_ENV` | Set by Vercel | Set by Vercel | — |
| `NODE_ENV` | `production` | `production` | `development` |
| `APP_ENV` | `production` or unset | `preview` or `staging` | `local` |
| `DEV_AUTH_BYPASS` | **unset / false** | **unset / false** | `true` for local fake login |
| `DEV_AUTH_EMAIL` | — | — | `wvanderlaan@gmail.com` (optional) |
| `BLOB_READ_WRITE_TOKEN` | If using Vercel Blob | Preview token or shared | Dev token |

**Optional (legacy / extra admin):**

| Variable | Notes |
|----------|--------|
| `ADMIN_EMAIL` | Not required if PRD bootstrap + DB-only admins; add if you want env-listed second admin |

**Secrets checklist:** no secrets in Config Sheet; no secrets in client-exposed `NEXT_PUBLIC_*` except documented public keys.

---

## Part 4 — Recommended order of operations

1. **Repo** created; base code pushed.
2. **Neon** URLs created; **Vercel** project linked.
3. Set **Vercel env vars** for Preview first (smallest blast radius).
4. **Config Sheet** created; PROD + STAGE rows filled; GIDs in env.
5. Deploy **preview**; run **`/api/init-database`** as admin (or run migrations) against preview DB.
6. **Smoke test** preview: Config loads, banner shows “Staging”, sign-in or dev flow, admin users.
7. Set **Production** env vars; deploy **production**.
8. Run **init-database** (or migrations) on **production** DB.
9. **Smoke test** production: no banner, auth, admin, health.
10. Document URLs and env in team **password manager** or internal wiki.

---

## Part 5 — Ongoing per release

- [ ] Before promoting to prod: `npm run build` and lint clean locally or in CI.
- [ ] After Config Sheet change: verify CSV export cache bust if issues (see PRD).
- [ ] After schema change: run migration / init path on staging before prod.

---

## Part 6 — Handoff to build agent

1. Attach **BASE_APP_REQUIREMENTS.md** as the authoritative spec.
2. Attach this checklist filled or partially filled for **env-specific values** (sheet ID, GIDs, URLs—redact secrets in shared docs).
3. State **repository URL** and **Vercel project** name in the handoff message.

---

*End of checklist.*
