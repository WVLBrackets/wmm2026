# Vintage Homepage V1

This feature lives on `feature/vintage-homepage-v1`. The original homepage remains at `/`; the new newspaper edition is at `/vintage`. The homepage-only Old/New selector links between these routes. Bracket, standings, payments, and existing Google Sheets configuration remain unchanged.

## Availability

- Local `next dev`: enabled.
- Vercel Preview: requires `VINTAGE_HOMEPAGE_ENABLED=true`.
- Vercel Production: disabled unconditionally for V1, including the new APIs. Do not merge or promote this branch to production as part of V1 review.
- Vintage homepage metadata requests no indexing.

The root layout retains authentication and bracket providers. `SiteChrome` selects the dedicated vintage presentation without mounting the old Sheets-backed navigation/footer on vintage routes. Fonts and styles are scoped to the new pages. The original `src/app/page.tsx` is unchanged.

## Preview-only setup

Set these values in the feature branch's **Preview** environment, using the existing Vercel project. Do not change production environment values.

| Variable                          | Purpose                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `VINTAGE_HOMEPAGE_ENABLED=true`   | Enable the Preview routes                                              |
| `VINTAGE_DATABASE_URL`            | Dedicated vintage Postgres database; do not reuse any bracket database |
| `VINTAGE_S3_ENDPOINT`, `VINTAGE_S3_REGION`, `VINTAGE_S3_BUCKET` | Dedicated Neon public image bucket on the feature Preview branch |
| `VINTAGE_S3_ACCESS_KEY_ID`, `VINTAGE_S3_SECRET_ACCESS_KEY` | Branch-scoped Neon storage credentials, server-side only |
| `VINTAGE_BLOB_READ_WRITE_TOKEN` | Optional alternative for a dedicated Vercel Blob store; unused in this Preview |
| `ADMIN_EMAIL`                     | Existing administrator identity                                        |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Existing authentication settings, with the URL correct for Preview     |

The database guard rejects known application database connection identities even if their credentials or query parameters differ. Verify storage separation in the provider console before setup; URL checks cannot prove arbitrary hostname aliases point to separate databases. Keep the existing Preview authentication/application database isolated from production as well. Local content development never falls back to a remote bracket database.

Initialize only the dedicated vintage database:

```sh
node --import tsx scripts/setup-vintage-homepage.ts
```

The setup script reads `.env.local` for local use and refuses explicit production execution. It calls a separate schema initializer; it does not run the existing bracket initializer. No migrations run automatically during a build, public request, or editor request.

Then deploy the feature branch to Vercel **Preview only**. Confirm the Vercel project's production branch before pushing; branch pushes may automatically create Preview deployments. Never run `vercel --prod` or change a production alias.

## The editor

Open `/vintage/admin` and authenticate as the existing administrator. It is a separate editor rather than a new tab in the existing dashboard.

- Edit masthead, lead story, image/crop, tournament display information, announcements, history, two promotions, two Excel resources, and footer.
- Save Draft persists a new revision without changing published content.
- Preview Saved Draft opens the protected saved draft route.
- Publish to Preview updates the feature's published content, not a Vercel deployment.
- Restore as Draft retrieves an earlier revision without publishing it.
- Version checks reject stale edits rather than overwriting a newer save.
- The image library accepts JPEG, PNG, and WebP uploads under 3 MB, validates signatures/types, requires alt text, and supports selecting existing images. Uploaded image assets are public even while draft page copy is private.
- All mutations require server-side admin authorization, CSRF validation, and rate limiting.

The countdown date includes an explicit timezone. The homepage My Picks link is a display setting only; it cannot enable bracket submission or override existing application rules.

## Content still needed

The current public homepage did not expose the two workbook destinations during inspection. No workbook URLs were hardcoded in the repository. The editor has separate fields for the existing Excel Picks Sheet and Excel Tournament Tracker URLs; populate them with the real destinations. Publishing is blocked until both are set. Do not replace or edit the workbook files.

The initial preview includes two clearly provisional property promotions, empty champion/count data, and a disabled countdown rather than invented tournament details. Replace these through the editor. If storage is absent, the public vintage page renders the bundled starter edition; the editor states that saving is unavailable. A database error cannot silently save edits.

## Validation

```sh
npm run test:vintage
npm run test:vintage:browser
npx tsc --noEmit
npm run lint
npm run build
```

`test:vintage` covers content validation, safe URLs, fixed placement/resource counts, production disabling, database isolation, and draft/publication/restoration SQL behavior. SQL tests use `pg-mem` only and cannot verify real Postgres transaction isolation or provider availability.

`test:vintage:browser` starts its own local server and uses Playwright. It checks widths from 375 to 1440 px, no Sheets configuration calls, admin/draft protection, CSRF, required workbook links, honest storage failures, and editing/save/publish UI contracts. Editor persistence is mocked in the UI contract portion; real SQL behavior is tested separately. It never targets staging or production. Install Playwright Chromium first, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing local Chromium executable. Screenshots go to `test-results/vintage`.

Real deployed Preview sign-in, editor persistence, image uploads, actual workbook downloads, and the full bracket regression flow must be checked before considering the deployed feature verified. Provider checks and local mocked checks do not establish the complete deployed flow.

## Assets

`public/images/vintage/basketball-editorial.webp` was generated using the built-in image tool. Final prompt: authentic-looking 1960s college basketball newspaper photograph; anonymous adult player in a plain vintage sleeveless jersey reaching toward a hoop; low courtside angle; navy/ivory duotone with halftone grain; player on the right and dark space on the left for editable HTML; no brands, lettering, watermark, or UI. The image is illustrative, not an archival photograph.

Oswald and Roboto Slab are self-hosted under `public/fonts/vintage` with their accompanying OFL/Apache license files. No external font request is required.

## Verification in this workspace

- Six content/security/SQL tests passed.
- Local browser checks passed for desktop/mobile presentation, configuration independence, authorization, CSRF, storage failures, and editor interactions. The editor save/publish UI contract uses mocked storage; SQL persistence is checked in the separate in-memory integration test.
- TypeScript and lint for all changed TypeScript/TSX files passed.
- Repository-wide lint reports 19 errors and 39 warnings in unchanged files.
- The standard Turbopack build is blocked here by the existing bracket component's Google-hosted `Press Start 2P` font request. The new homepage fonts are self-hosted.
- An additional optimized Webpack build completed, including lint/type checks and all 74 static pages, using a temporary local copy of that same existing font through Next's build-test response hook. No font workaround or build-script change was committed. Existing bracket-loader `fs` and unused-variable warnings remain; the old homepage's Sheets announcements timed out and used its existing fallback.
- Production and shared staging were not modified. Dedicated feature Preview storage was provisioned later as described below. Real Vercel Preview browser validation is still required.

## Connected Vercel project

The connected Vercel account exposes the existing `wmm2026` project (`prj_dJPGINQQ9vrHV2rJoQJhrM5wPAxC`). Its current production deployment is `main` at the inspected baseline `b23ac3312361fa13604c71f75836cff152515cea`; `staging` has separate Preview deployments. Existing Preview authentication/database variable names are present; their secret values were not retrieved.

The feature branch is published, and `VINTAGE_HOMEPAGE_ENABLED=true` is scoped to that branch’s Preview environment. The first Preview deployment reached READY. Production still points to its original deployment. Protected Preview fetching and build-log tools currently return Vercel scope permission errors, so remote browser verification remains incomplete. The two actual Excel URLs are still required. Dedicated Preview storage was subsequently provisioned as described below.

## Approved header and countdown refinement

The mobile header uses a 48px sticky navy icon toolbar, followed by a compact single-line navy/red newspaper masthead. Only the toolbar sticks on mobile (up to 900px); desktop combines navigation and branding into one sticky row. Both account for the existing Preview environment banner. The masthead uses self-hosted Alfa Slab One as regular HTML text. Both colored parts inherit exactly the same font and size. A small client component measures the loaded font and available width, then applies one horizontal scale to the complete line; it refits on font loading, resizing, and content changes. Overflow is contained while measurements settle. This replaces SVG text-length fitting, which overflowed on the user’s iPhone. Its accessible heading and editor fields remain text.

The original-style four-column countdown now sits immediately below the masthead, ahead of the hero. Its target is still configured independently through the vintage editor. Without an enabled valid date it shows four dashes and “Tipoff date to be announced”; it never treats the mockup’s sample numbers as a real countdown. After the target it displays “Let the madness begin.” Navigation always exposes My Picks; access and submission rules remain enforced by the existing bracket application. The rest of the homepage is reserved for subsequent section-by-section design review, including the planned commissioner section.

Local browser verification covers sticky behavior and masthead/countdown placement across mobile, tablet and desktop widths. An isolated local React harness also checks configured values, ticking, expired dates and unset/invalid dates with zero external requests. It imports only the countdown component, creates no deployed test route, and does not load the existing application shell.

## Stable review URL

Keep this branch URL open and refresh after each successful Preview build:

https://wmm2026-git-feature-vinta-9633ca-ncaatourney-gmailcoms-projects.vercel.app/vintage

Vercel automatically moves this branch alias to the newest successful deployment from `feature/vintage-homepage-v1`. Deployment-specific URLs remain useful for comparing older versions but should not be used as the ongoing review link.

Alfa Slab One is bundled from the Google Fonts repository (`ofl/alfaslabone`) alongside its SIL Open Font License. It is used only for the vintage masthead and requires no external font request.

### iPhone masthead overflow fix

The user’s iPhone exposed an SVG text fitting overflow that Chromium did not reproduce. The title now uses regular HTML text with a measured, shared horizontal scale. Both parts retain one font size. Browser checks verify the transformed text bounds, equal typography, single-line fit and sticky behavior at 320, 375, 390, 430, 768, 1024 and 1440px. The public-page checks can run in WebKit with `VINTAGE_BROWSER=webkit VINTAGE_PUBLIC_ONLY=true npm run test:vintage:browser`; `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` optionally selects an installed executable.

## Admin access from the homepage

Open `/vintage/admin` (or the Homepage editor link in the newspaper footer) to sign in using the existing administrator account. This dedicated sign-in form uses the existing credentials provider without loading the old Google Sheets configuration, and returns directly to the vintage editor. Only a server-verified administrator sees the Admin mode toolbar on `/vintage`; its Edit homepage link and account icon open the standalone editor. Non-admin sessions never receive those controls, and all editor APIs continue enforcing authorization independently.

The Vercel Blob provisioning API returned scope 403, so no Blob store was created. After Neon was connected, dedicated content and image storage were provisioned on the existing feature Preview database branch. No production environment settings changed.

The canonical editor entry is `/vintage/admin`, outside the legacy `/admin` layout. It performs its own server-side role check before rendering any editor UI. The original `/admin/vintage-homepage` URLs remain as protected compatibility routes. The legacy admin layout is unchanged.

## Connected feature Preview storage

The Vercel-managed Neon organization does not permit creating projects directly through Neon. The existing `neon-wmm-preview` project already has a Vercel-created `preview/feature/vintage-homepage-v1` branch (`br-ancient-cake-ad5t9y75`). That branch now contains a separate `vintage_homepage` database, owned by `vintage_homepage_owner`, with only the three vintage tables. No bracket tables were altered. The versioned vintage initializer DDL was applied only to this new database. Application traffic uses its pooled URL in `VINTAGE_DATABASE_URL`, scoped to the feature branch's Preview environment.

Images use the dedicated `vintage-homepage-media` Neon bucket on the same branch, with public reads and authenticated writes. Storage credentials have only storage read/write scopes and are anchored to this feature branch. All five `VINTAGE_S3_*` variables are scoped to that branch's Preview environment; standard `AWS_*` variables and existing application credentials are never reused. The server uses the AWS S3 client with explicit credentials, endpoint, region, path-style addressing, unique object keys, and immutable cache headers. A failed metadata insert attempts to remove its newly uploaded object. Existing optional Vercel Blob support remains available for future explicitly configured environments.

A separate `vintage-admin-verification` child branch (`br-rapid-grass-adt5yuiu`) holds disposable provider verification data. It is not linked to the site. Never use its content database for the homepage: it contains deliberately minimal test JSON. Workspace direct PostgreSQL access fails DNS resolution (`EAI_AGAIN`); this is a local network restriction. Neon API checks confirmed the dedicated schema and transactional draft/published/revision storage on the verification branch. Full local browser tests continue using isolated mock storage, and protected Vercel Preview browser access remains blocked by connector scope permissions. These limits must be kept distinct from deployed end-to-end verification.

The application image upload helper was exercised against the verification branch through the workspace HTTPS proxy: authenticated S3 PUT succeeded, anonymous GET returned 200 with the expected image type, and downloaded bytes exactly matched the source WebP. No test image was uploaded to the feature Preview bucket. The complete deployed editor-to-database flow still requires signed-in Preview testing.

The verification child branch expires automatically on 2026-10-22. The final local Chromium suite passed after the storage update, including editing, saving, and publishing UI contracts (mocked persistence). All six content/security/SQL tests, TypeScript, and focused lint passed.

## Dedicated database endpoint correction

The deployed editor reported `DATABASE_ISOLATION_BLOCKED`. Its URL-identity guard detected an overlap with a known application database setting before opening a connection. The exact matching runtime environment key could not be read through the connector's restricted runtime logs. The guard was retained unchanged.

The editor now uses a dedicated `vintage-content-preview` Neon branch (`br-shy-thunder-adxk07yz`), forked from the feature Preview branch. Its `vintage_homepage` database contains only the three vintage tables. At the switch it had zero content rows, revisions, and image metadata rows, matching the original feature database. No user content was discarded. The original feature database remains intact. Inherited application databases are not used or modified by the editor.

Both `VINTAGE_DATABASE_URL` and `VINTAGE_S3_ENDPOINT` were updated only for `feature/vintage-homepage-v1` in the Vercel Preview environment. The bucket and storage credential remain inherited from the feature branch; the existing branch-anchored storage credential also authorizes descendants. Production and shared staging settings are unchanged.

Verification used the actual exported `readVintageState` application function, bundled with unused writes removed, running in an ephemeral Vercel sandbox. It connected to the dedicated endpoint with production-mode Node settings and the unchanged isolation guard. Sanitized comparison URLs simulated an app Preview alias referring to the old vintage database and a separate bracket database; no bracket or production credentials were sent to the sandbox. The complete application read returned version 0 and zero revisions successfully. Protected deployed editor verification still requires the signed-in user's refresh because connector access to protected Preview fetching and runtime logs returns 403.
