# Base Application — Product Requirements Document (PRD)

**Audience:** Engineering agent or team implementing a **new** greenfield application from this template.  
**Reference implementation:** Warren’s March Madness (WMM) in this repository—use it for patterns only; **do not** copy WMM-specific domain (brackets, tournament, standings).

**Goal:** A production-ready **shell**: sticky app chrome, Config Sheet–driven branding, NextAuth email/password with confirmation, strict configuration (no silent defaults), environment banners, Admin + User management (with **persisted** admin role in DB), local dev bypass, profile modal with name + avatar upload.

---

## 1. Technology stack (mandatory)

| Layer | Choice | Notes |
|--------|--------|--------|
| Framework | **Next.js 15.x** | App Router |
| UI | **React 19.x**, **TypeScript 5.x** | |
| Styling | **Tailwind CSS 4.x** | |
| Icons | **Lucide React** | Match WMM nav/icon style |
| Auth | **NextAuth.js v4** | Credentials provider, JWT sessions (align with WMM `src/lib/auth.ts`) |
| Passwords | **bcryptjs** | |
| Database | **PostgreSQL** via **@vercel/postgres** (Neon) | Raw SQL only—no ORM |
| SQL access | Tagged template helper (e.g. `sql\`...\``) | Same pattern as WMM `src/lib/databaseAdapter.ts` |
| Env resolution | Explicit **local / preview (staging) / production** | Same *idea* as WMM `src/lib/appEnvironment.ts` + `src/lib/databaseConfig.ts` |
| Mutations | **CSRF** on all state-changing API routes | Same *idea* as WMM `src/lib/csrf.ts` + `getCSRFHeaders` client hook |
| Structure | `src/lib/repositories/*`, `src/lib/services/*`, `src/app/api/*` | Optional: `src/lib/api/responses.ts` for `{ success, data?, error? }` |

**Runtime:** Node.js 20+.

---

## 2. Config Sheet (Google Sheets)

### 2.1 Definition

The **Config Sheet** is a single Google Spreadsheet that holds **non-secret** application configuration as **name/value** rows. It replaces scattered defaults in code for anything that should be operator-editable.

### 2.2 Tabs

| Tab name | Used when | Notes |
|----------|-----------|--------|
| **PROD** | Production deployments only (`VERCEL_ENV === 'production'` or equivalent) | Live customer-facing values |
| **STAGE** | Staging **and** local development | One tab for all non-production |

Implement tab selection exactly as product policy above (do not use WMM’s old sheet IDs; use **environment variables** for spreadsheet ID and GID per tab—see Section 8).

### 2.3 Row format

- **Column A (or first column):** parameter name (human-readable or snake_case; normalize to a canonical internal key: lowercase, spaces/hyphens → underscores).
- **Column B (or second column):** value.
- Optional header row row 1: e.g. `parameter`, `value`.
- Parsing stops after **two consecutive blank rows** (same convention as WMM CSV parsing conceptually).

### 2.4 Strict validation (no fallbacks)

**Requirements:**

1. Define a **closed list** of required config keys for the base app (see Section 7). For each key, document **expected type** (string, integer, URL, boolean as `YES`/`NO`, etc.).
2. When loading config at runtime:
   - If the sheet cannot be fetched: show a **blocking error UI** stating **Config Sheet fetch failed** and include HTTP/status or timeout reason.
   - If a **required** key is **missing** or **empty**: show **blocking error UI** naming the **canonical key** and reason `missing` or `empty`.
   - If a value is present but **fails type validation** (e.g. expected integer, got non-numeric): show **blocking error UI** naming the key and reason `invalid_type` with expected vs actual.
3. **Do not** substitute default values in code for required keys. Optional keys may be omitted from the sheet only if explicitly documented as optional; otherwise treat as required.

This is a **deliberate deviation** from WMM’s `siteConfig.ts`, which uses many fallbacks and optional fields—new apps must not copy that pattern.

### 2.5 Caching

You may use `unstable_cache` or short TTL revalidation for Config Sheet CSV, but failures must still surface clearly (do not serve stale config silently after repeated failure unless explicitly specified—default: fail loud).

---

## 3. Environment banners

Render a **full-width** bar **above** the sticky primary navigation:

| Environment | Banner text | Style |
|-------------|-------------|--------|
| **Production** | *(none)* | No banner |
| **Staging** (Vercel preview / staging deployment) | `Staging` | Yellow background (e.g. amber/yellow-400/500), dark readable text |
| **Local** (`NODE_ENV === 'development'` or `APP_ENV=local` per your env matrix) | `Local` | Orange background, dark readable text |

Detection must align with how `APP_ENV` / `VERCEL_ENV` are set (document in checklist). WMM does not ship this banner today—implement fresh.

---

## 4. Layout and navigation

### 4.1 Sticky top chrome

- **Primary bar (sticky):**
  - **Left:** small logo (image URL from Config), **site title**, **site subtitle** (all from Config Sheet keys—see Section 7).
  - **Right:** auth affordance (see 4.3).
- **Sub-navigation row** (below title cluster or integrated per design—must stay sticky with header):
  - Each item: **icon + label** text.
  - **Home:** house icon, label `Home` (or Config-driven label if you add a key). **Leftmost** item. Visible to **everyone** (logged in or not).
  - **Admin:** gear (or shield) icon; label `Admin`. Visible **only** if `isAdmin(sessionUser)` is true.
  - Additional app-specific tabs may be added later; base template may include a single placeholder second tab (e.g. “App”) or omit until product defines routes.

### 4.2 Routing

- **`/`** resolves to **Home** page content (marketing or dashboard shell—minimal placeholder is acceptable).
- Each subnav item navigates to its route (`/admin`, `/app`, etc.).

### 4.3 Login / profile (right side)

**Logged out:**

- Far right: **“Login”** text + **anonymous user** icon (Lucide `UserCircle` or similar).
- Click → `/auth/signin` (or equivalent).

**Logged in:**

- Far right: **user avatar** image only (no “Login” label). If no avatar URL yet, use initials placeholder or generic silhouette.
- **Hover:** tooltip text from Config key `profile_hover` (required string).
- **Click:** open **profile modal**:
  - Edit **display name** (persist to `users` table).
  - **Avatar image upload** (see Section 6)—persist URL to DB after successful upload.

---

## 5. Authentication and registration

### 5.1 Sign-in page (WMM-style)

- Two modes on one page (tabs or toggle): **Sign in** | **Create account**.
- Link: **Forgot password** → existing forgot-password flow.
- **Welcome / footer copy:**
  - Sign-in mode: body/footer text from Config key `signin_welcome` (required, support multi-line via sheet convention e.g. `||` for line breaks if you document it).
  - Create-account mode: from `signup_welcome` (required).

### 5.2 Create account fields

- Name  
- Email  
- Password  
- Confirm password  

Validation: email format, password policy (document min length; match WMM-level sanity), confirm must match password.

### 5.3 Email confirmation

- New users are **unconfirmed** until they complete email verification (same **concept** as WMM: token link, confirm route).
- Unconfirmed users cannot sign in (or can sign in but see restricted UX—**pick one** and document; WMM restricts sign-in until confirmed—recommend same).

### 5.4 Forgot / reset password

- Implement forgot-password + reset-password pages and API routes (WMM reference under `src/app/api/auth/` and `src/app/auth/`).

---

## 6. Profile avatar storage (default recommendation)

WMM does **not** implement profile avatar upload in-repo today; the base app **must**.

**Default approach (specify in implementation unless product overrides):**

1. **Vercel Blob** (or S3-compatible presigned upload) for binary object storage.
2. **`users.avatar_url`** (nullable `TEXT`) storing the public or app-served URL after upload.
3. API route: authenticated POST (with CSRF) accepting multipart file; validate MIME/size; upload; update user row; return new URL.
4. Next/Image `remotePatterns` must allow the blob host if using optimized images.

Document env vars for Blob in the project checklist (`BLOB_READ_WRITE_TOKEN` etc. per Vercel docs).

---

## 7. Initial Config Sheet variables (base app)

Every row exists on **both** `PROD` and `STAGE` tabs unless noted. **All listed keys are required** for the base shell (strict mode).

| Canonical key | Type | Purpose |
|----------------|------|---------|
| `site_name` | string | App title in nav |
| `site_subtitle` | string | Subtitle under title in nav |
| `site_logo_url` | URL string | Small logo image left of title |
| `signin_welcome` | string | HTML-safe or plain text; sign-in panel footer |
| `signup_welcome` | string | Create-account panel footer |
| `profile_hover` | string | Tooltip on logged-in avatar |

**Optional extension keys** (only if you implement features): e.g. `footer_text` for global footer—if present in v1, list as required; otherwise omit from v1 closed list.

**Secrets:** Do **not** put database passwords, `NEXTAUTH_SECRET`, or API keys in the Config Sheet. Those stay in **Vercel / `.env.local`** only.

---

## 8. Environment variables (config loader + infra)

**Required for Config Sheet access (recommended pattern):**

| Variable | Purpose |
|----------|---------|
| `SITE_CONFIG_SHEET_ID` | Google Spreadsheet ID |
| `SITE_CONFIG_GID_PROD` | GID for tab `PROD` |
| `SITE_CONFIG_GID_STAGE` | GID for tab `STAGE` |

Loader logic: production → PROD tab GID; else → STAGE tab GID.

**Database (mirror WMM semantics):**

| Variable | When |
|----------|------|
| `LOCAL_POSTGRES_URL` or `POSTGRES_URL_LOCAL` | Local |
| `PREVIEW_POSTGRES_URL` or `POSTGRES_URL` | Vercel preview / staging |
| `PRODUCTION_POSTGRES_URL` or `POSTGRES_URL` | Production |

**Auth:**

| Variable | Purpose |
|----------|---------|
| `NEXTAUTH_URL` | Canonical app URL per environment |
| `NEXTAUTH_SECRET` | Secret |

**Environment classification:**

| Variable | Purpose |
|----------|---------|
| `VERCEL_ENV` | Set by Vercel (`production` / `preview`) |
| `APP_ENV` | Optional override: `local`, `preview`/`staging`, `production` (align with WMM `appEnvironment.ts` ideas) |

**Local dev bypass (see Section 9):**

| Variable | Purpose |
|----------|---------|
| `DEV_AUTH_BYPASS` | `true` only when `NODE_ENV=development` |
| `DEV_AUTH_EMAIL` / `NEXT_PUBLIC_DEV_AUTH_EMAIL` | Email for synthetic session (default `wvanderlaan@gmail.com`) |

**Do not** require `ADMIN_EMAIL` for bootstrap admin—use code rule in Section 10. You may still support `ADMIN_EMAIL` as an **additional** env-based admin if desired; document if kept.

---

## 9. Local development behavior

- **No** real user registration or credential login in local (optional: hide UI or show message “Local mode”).
- Application behaves as if the signed-in user is **`wvanderlaan@gmail.com`**, treated as **admin** (see Section 10).
- Implement via secure dev-only bypass (same **safety** as WMM `src/lib/devAuth.ts`: never allow `DEV_AUTH_BYPASS` in production builds).
- Seed or ensure user row exists for dev email on first DB init if needed.

---

## 10. Admin authorization model

### 10.1 Rules

1. **`wvanderlaan@gmail.com`** (case-insensitive): **always** considered an admin in **code**, regardless of DB `is_admin` / role column.
2. **All other users:** admin if and only if persisted **DB** field says so (recommended: `is_admin BOOLEAN NOT NULL DEFAULT FALSE` on `users`, scoped by `environment` if multi-env single DB pattern matches WMM).

### 10.2 `isAdmin(email: string)`

Returns `true` if:

- `email` equals `wvanderlaan@gmail.com` (case-insensitive), **or**
- DB lookup for that user in current environment has admin flag true.

Use for: API route guards, Admin subnav visibility, User Admin screen access.

### 10.3 Deviation from current WMM UI

WMM `UsersTab` displays “Admin” for a row when row email equals **session** email—not a persisted role. The base app **must** display Role from **DB** (and still show bootstrap user as Admin via rule above).

---

## 11. Admin — User management screen

Model after WMM **Users** tab behavior (`src/components/admin/UsersTab.tsx`) with these **updates**:

**Columns:**

- **User:** display name + email (stacked or two lines).
- **Role:** `Admin` or `User` from **DB** (with bootstrap email always Admin as in Section 10).
- **Created:** timestamp.
- **Last login:** timestamp or “Never”.
- **Actions:**  
  - **Confirm** — for users with unconfirmed email (manual confirm).  
  - **Edit** — name, email, **role** (admin toggle).  
  - **Change password** — admin-set password (WMM pattern).  
  - **Delete** — single user with confirmation.

**Toolbar / controls:**

- **Refresh** button.
- **Unconfirmed** filter (show only unconfirmed).
- **Bulk delete** with selection and confirmation.
- **Protect confirmed** checkbox — when enabled, bulk delete (and possibly single delete) must not delete confirmed users (match WMM semantics).
- **Search** — filter list by any displayed field (name, email, role string, created, last login text, confirmed state).

**APIs:** Implement under `/api/admin/users` consistent with WMM patterns (session + `isAdmin` check, CSRF on mutations).

---

## 12. Admin shell

- **Admin** is a subnav destination (e.g. `/admin`).
- Minimum viable admin home: link or tab strip to **Users**; leave room for future tabs.
- Protect entire `/admin` layout with server-side session + `isAdmin` (middleware or layout `getServerSession`).

---

## 13. Database schema (minimum)

Document migrations in one place (e.g. `src/lib/database/migrations.ts` pattern).

**Users table (conceptual):**

- `id`, `email`, `name`, `password` (hash), `email_confirmed`, confirmation/reset tokens + expiry as WMM
- `is_admin` boolean (or `role` enum)—**required** for base template
- `avatar_url` nullable text
- `environment` (if multi-env isolation like WMM)
- `created_at`, `last_login`, etc.

**Tokens** table if used for confirm/reset (WMM pattern).

Provide **`/api/init-database`** (admin-only GET/POST) or equivalent to run idempotent DDL—same operational idea as WMM.

---

## 14. Cross-cutting requirements

- **`data-testid`** on interactive controls (buttons, nav links, auth forms, admin table actions)—follow WMM naming discipline where applicable.
- **API JSON:** `{ success: boolean, data?, error?, message? }` for consistency.
- **Email:** SMTP or provider used by WMM for registration/reset—configure via env, not Config Sheet.

---

## 15. Appendix A — Optional baseline (recommended)

1. **Security:** rate limit auth endpoints; security headers in `next.config.ts`.
2. **Ops:** `GET /api/health` returning 200 + build/git sha for uptime monitors.
3. **Logging:** client/server error reporting hook (WMM `/api/log/error` idea).
4. **CI:** GitHub Action running `npm run build` + lint; optional Playwright smoke: home loads, banner visible on preview, sign-in page renders.

---

## 16. Appendix B — Explicit deltas from WMM (do not copy blindly)

| Topic | WMM today | Base template requirement |
|--------|-----------|----------------------------|
| Config | Many optional fields + numeric/string fallbacks in parser | **Strict** required key set; blocking errors with key + reason |
| Env banners | Not standardized in PRD | **Staging** yellow, **Local** orange, **Prod** none |
| Admin role | `ADMIN_EMAIL` env + dev bypass; Users “Role” UI tied to session email match | **`wvanderlaan@gmail.com` always admin in code** + **DB `is_admin`** for others; editable in User Admin |
| Profile avatar | Not in scope | **Required**: upload + URL in DB + Blob (default) |
| Config tabs | Hardcoded sheet id + GIDs in code | **Env-driven** `SITE_CONFIG_SHEET_ID` + GIDs |
| Local auth | Dev bypass optional | **Specified**: no real login; fixed admin user experience |

---

## 17. Acceptance criteria (base shell “done”)

1. Prod/staging/local each resolve DB + Config Sheet tab correctly; misconfiguration shows **named** error.
2. Banners: only staging/local show correct colors/text.
3. Nav: logo/title/subtitle from sheet; Home + Login/avatar behavior matches Section 4; Admin visible only for admins.
4. Auth: sign-in, register, forgot, confirm flows work in staging/prod; local uses bypass without exposing bypass in prod.
5. User Admin: full CRUD actions per Section 11; Role persisted in DB; bootstrap email always admin.
6. Profile modal: name save + avatar upload works; `profile_hover` works.
7. `npm run build` passes; no TypeScript errors.

---

*End of PRD.*
