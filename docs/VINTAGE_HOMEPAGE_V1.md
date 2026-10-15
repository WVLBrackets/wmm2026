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
| `VINTAGE_BLOB_READ_WRITE_TOKEN`   | Token for a dedicated public vintage image store                       |
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

Open `/admin/vintage-homepage` and authenticate as the existing administrator. It is a separate editor rather than a new tab in the existing dashboard.

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

Real Preview sign-in, database migration/persistence, Blob uploads, actual workbook downloads, and the full bracket regression flow must be checked on isolated Preview resources before considering the feature deployment verified.

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
- Production, shared staging, external databases, and remote image stores were not modified. Real Vercel Preview validation is still required.

## Connected Vercel project

The connected Vercel account exposes the existing `wmm2026` project (`prj_dJPGINQQ9vrHV2rJoQJhrM5wPAxC`). Its current production deployment is `main` at the inspected baseline `b23ac3312361fa13604c71f75836cff152515cea`; `staging` has separate Preview deployments. Existing Preview authentication/database variable names are present; their secret values were not retrieved.

The feature branch is published, and `VINTAGE_HOMEPAGE_ENABLED=true` is scoped to that branch’s Preview environment. The first Preview deployment reached READY. Production still points to its original deployment. Protected Preview fetching and build-log tools currently return Vercel scope permission errors, so remote browser verification remains incomplete. Dedicated vintage Postgres/Blob resources and the two actual Excel URLs are still required.

## Approved header and countdown refinement

The mobile header uses a 48px sticky navy icon toolbar, followed by a compact single-line navy/red newspaper masthead. Only the toolbar sticks on mobile (up to 900px); desktop combines navigation and branding into one sticky row. Both account for the existing Preview environment banner. The masthead remains editable, selectable text rather than a raster image.

The original-style four-column countdown now sits immediately below the masthead, ahead of the hero. Its target is still configured independently through the vintage editor. Without an enabled valid date it shows four dashes and “Tipoff date to be announced”; it never treats the mockup’s sample numbers as a real countdown. After the target it displays “Let the madness begin.” Navigation always exposes My Picks; access and submission rules remain enforced by the existing bracket application. The rest of the homepage is reserved for subsequent section-by-section design review, including the planned commissioner section.

Local browser verification covers sticky behavior and masthead/countdown placement across mobile, tablet and desktop widths. An isolated local React harness also checks configured values, ticking, expired dates and unset/invalid dates with zero external requests. It imports only the countdown component, creates no deployed test route, and does not load the existing application shell.
