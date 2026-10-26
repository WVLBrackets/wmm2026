# Vintage Homepage V1 — private production release

## Audience and routing

`/` selects the homepage on the server using the existing authenticated NextAuth session. The original production homepage implementation is preserved unchanged in `src/components/LegacyHomepage.tsx`.

| Visitor | Homepage | New routes and editor APIs |
| --- | --- | --- |
| Signed out | Original | Denied |
| Any other signed-in user, including another configured admin | Original | Denied |
| Authenticated `wvanderlaan@gmail.com` | Vintage newspaper | Allowed |

Only the exact email identity qualifies (case-insensitive). Display names, usernames, query parameters, browser storage, and the global `ADMIN_EMAIL` setting cannot grant vintage access. The Old / New toggle is removed. `/vintage`, `/vintage/admin`, the saved-draft route, and compatibility editor routes verify authorization server-side before returning content. The primary administrator signs in through the existing `/auth/signin` flow, then opens Home. No authentication provider, password, or account record is changed.

The homepage uses `force-dynamic` and private/no-store response headers. Primary-admin HTML is never placed into a shared homepage cache. Metadata for private views requests no indexing. Other site routes retain the original navigation, footer, bracket providers, and functionality. Existing Google Sheets configuration and its original consumers are unchanged; the new homepage and editor never load that configuration.

## Production storage

Production uses a dedicated `vintage-content-production` Neon branch (`br-divine-salad-ad5eiaj7`) in the existing `lively-unit-34313220` project. The provider project retains its legacy Preview name; the production CMS branch and endpoint are separate from both the app database and the feature Preview CMS branch.

The production branch was copied from the working `vintage-content-preview` branch (`br-shy-thunder-adxk07yz`) after the user authorized the private production release. It includes the published edition and countdown, draft, and inherited `vintage-homepage-media` bucket. Its application role is `vintage_production_app`, with the required grants on the three vintage tables. Its storage credential is newly issued and anchored to the production CMS branch. Neither bracket data nor existing application database settings are modified. No bracket initializer or production schema migration runs during release.

Set the following variables only in the matching Vercel environment. Production and feature Preview use different database endpoints and image credentials.

| Variable | Purpose |
| --- | --- |
| `VINTAGE_HOMEPAGE_ENABLED=true` | Availability switch; identity checks still apply |
| `VINTAGE_DATABASE_URL` | Dedicated vintage database, never an app/bracket database |
| `VINTAGE_S3_ENDPOINT`, `VINTAGE_S3_REGION`, `VINTAGE_S3_BUCKET` | Dedicated Neon image bucket |
| `VINTAGE_S3_ACCESS_KEY_ID`, `VINTAGE_S3_SECRET_ACCESS_KEY` | Server-only, branch-scoped storage credentials |
| `VINTAGE_BLOB_READ_WRITE_TOKEN` | Optional alternative; unused by this release |

The production CMS role and image credential were verified with the actual application content reader and a signed storage listing from an ephemeral Vercel sandbox. The published countdown remained enabled and content version remained 1 at copy time. The new configuration does not share future Preview content edits with production.

## Editor

Open `/vintage/admin` while signed in as the primary administrator. Edit masthead, toolbar/theme, the three home cards, explore band, announcements, tipoff countdown, media, and footer. All mutations require server-side primary-admin authorization, CSRF validation, and rate limiting.

- **Save draft** updates the draft while retaining the last published edition. No revision history is kept.
- **Preview saved draft** opens the primary-admin-only draft page.
- **Publish homepage** updates the new experience seen only by the primary administrator. It does not alter the original homepage shown to everyone else.
- **CMS export / import** on the Home admin desk downloads or applies a full `vintage_homepage` package (draft + published, including Guidebook / HoF / Standings / Picks sidecars). Import previews every changed field and requires confirm. Use this to promote local CMS values to Staging/Prod; code deploy alone does not move Neon CMS rows. Image URLs are not remapped across buckets.
- Optimistic versions reject stale edits rather than overwriting newer saves.
- Images accept JPEG, PNG, and WebP under 3 MB with validated signatures and required alt text. Image assets are public-read even while draft page copy stays private. Uploads use unique immutable keys; failed metadata saves attempt to remove their new object.

The **Tournament & countdown** tab includes an editable **Countdown heading** (default “Countdown to tipoff”), **Show countdown**, a **Live tourney message** (shown large when the countdown is off — tournament underway), and a native date/time picker. Its timezone is the administrator's device timezone; the stored timestamp identifies one exact moment for every visitor. With countdown on but no date set, the homepage displays dashes and “Tipoff date to be announced.” After tipoff, the live message replaces the clock. The countdown changes homepage display only, never bracket deadlines or submission rules.

Excel workbook links live on the Excel Downloads home card (not a separate page section). URLs are optional: a blank path shows Coming Soon for that hotspot. Picks and Tracker become available independently.

## Validation and release

`npm run test:vintage` covers schema validation, unsafe URLs, exact primary identity, availability flags, database isolation, safe error messages, and draft/publication behavior in isolated SQL tests.

`npm run test:vintage:browser` starts a local server. It checks signed-out and ordinary users, another configured admin, the primary administrator, direct-route/API denial, no toggles or query overrides, no-store headers, responsive layout, countdown timezone conversion, pending workbooks, and editor save/publish contracts. HTTP storage is mocked in UI contract tests; SQL behavior is checked separately. The explicit test subprocess preload stubs Sheets failures and blocks other external requests, so the old homepage exercises its existing fallback without contacting Google or any live app database.

Use `VINTAGE_TEST_ENV=production` for the production-mode access and banner checks. A local Chromium executable may be supplied through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Before release: run unit/browser/type/lint checks, build the reviewed feature SHA in Vercel Preview, then merge the exact reviewed head to `main` for the authorized production deployment. Confirm the `warrensmm.com` alias points to the successful production build and verify signed-out root plus protected URLs. Deployed signed-in testing uses the user's real session; tests never forge a production session or retrieve the production authentication secret.

## Rollback

Set the production vintage availability flag to false and redeploy to return everyone, including the primary administrator, to the original homepage. All vintage routes/APIs close when disabled. Alternatively restore the previous production deployment. Keep server authorization and database-isolation checks enabled.

## Home-card footer captions

Locked master plates (Play Now, Champ, Excel, and future cards) leave the footer band empty in the art and share one overlay via `CardFooterCaption`:

| Card | CMS field |
| --- | --- |
| Play Now | `playCtaLabel` |
| Reigning Champ | `champMotto` |
| Excel Downloads | `excelCaption` |

Excel uses three full master plates (`neither` / `picks` / `both`), auto-selected from download URLs. Bundled defaults live under `public/images/vintage/card-excel-*.jpg`; admin can override each via `excelNeitherImageSrc`, `excelPicksImageSrc`, and `excelBothImageSrc` (same upload pattern as Play Now / Champ).

- **Type:** Oswald Bold, ALL CAPS, plate red (`#a8342c`)
- **One line:** Full caption letter height, vertically centered in the shared footer hole
- **Two lines:** Author with `||` as the line break (never more than two lines); slightly smaller type, same weight/color, block still vertically centered
- Without `||`, prefer a single line; only wrap to two lines if the copy cannot fit at a readable one-line size
- **Hole geometry:** Shared CSS on `.v-card-play-caption` / `.v-card-champ-motto` / `.v-card-excel-caption` so placement stays aligned across cards

## Reigning Champ name + year

- **Name:** Alfa Slab One, ALL CAPS, fitted into the cream field. Author with `||` for a hard line break (up to three lines); without `||`, auto-fit still chooses 1–3 lines.
- **Year:** Locked **straight slab** (Alfa Slab One, centered in the wreath). Legacy year-style mockups are ignored on normalize (`champYearStyle` always `"straight"`).

## Explore band

Under the three main home cards, a wide two-panel band links to Info and Hall of Fame (`exploreBand` in CMS). Panels are admined together on the **Explore band** tab (enable toggle, headlines, bodies, CTAs). Stacks to one column on mobile. Icons are design-fixed (book / trophy).

## Announcements board

Full-width board under the explore band (`announcementBoard`). Minimal megaphone header with an admin-editable board title; each line is **date/time + message**. Admin tab supports add / edit / delete with no practical cap (schema allows up to 100). Newest first on the homepage.

## Admin edit gears

When the primary vintage admin views the homepage, a tiny gear appears at the top-right of the tipoff countdown, each home card, the explore band, and the announcements board (in addition to the toolbar Admin icon). Gears deep-link into the editor:

| Element | URL |
| --- | --- |
| Countdown | `/vintage/admin?focus=countdown` |
| Home card | `/vintage/admin?focus=card&id=<card.id>` |
| Explore band | `/vintage/admin?focus=explore` |
| Announcements | `/vintage/admin?focus=announcements` |

The editor opens the matching tab and scrolls/highlights the target. Helpers live in `src/lib/vintage/adminFocus.ts`.

## Assets

`public/images/vintage/basketball-editorial.webp` was generated using the built-in image tool. Final prompt: authentic-looking 1960s college basketball newspaper photograph; anonymous adult player in a plain vintage sleeveless jersey reaching toward a hoop; low courtside angle; navy/ivory duotone with halftone grain; player on the right and dark space on the left for editable HTML; no brands, lettering, watermark, or UI. The image is illustrative, not an archival photograph.

Alfa Slab One and Oswald are self-hosted under `public/fonts/vintage` with their accompanying OFL license files. Body faces (Arial, Georgia, and other catalog options) use system fonts. Theme fonts are editable in the homepage editor. No external font request is required.

## Removed from CMS (cleanup)

The following legacy document fields are stripped on normalize and are no longer editable: `hero`, `introduction`, `history`, `promotions`, `downloads`, and unused masthead extras (`tagline`, `established`, `slogan`). Excel downloads live on the Excel home card; explore/announcements replaced archives and classifieds. Masthead edits are first/second line only. Footer text and optional contact email are on the **Footer** tab.

## Tournament Handbook (/info)

Primary-admin visitors see a vintage **Tournament Handbook** at `/info` (same gate as the homepage). Everyone else still gets the legacy Sheets-backed Info page.

- **CMS:** Handbook JSON is stored as a `__infoHandbook` sidecar on the existing `vintage_homepage` draft/published row (the app role cannot create new tables). Types in `src/lib/vintage/infoContent.ts`. Homepage saves preserve the sidecar.
- **Editor:** `/vintage/admin/info` (preview `/vintage/admin/info/preview`) with left-rail section index. Draft / publish / restore mirrors the homepage editor. On-page gears deep-link with `?focus=`. Linked from the homepage editor desk.
- **Shared chrome:** `VintageShell` (toolbar, masthead, footer, theme) from the **published homepage** content.
- **Shared tipoff deadline:** Quick-facts deadline formats `tournament.countdownAt` from the homepage CMS (Tournament & countdown). Not duplicated in the handbook editor; not from Google Sheets.
- **Excel links:** Taken from the homepage Excel Downloads card paths; empty → Coming soon.
- **Handbook numbers** (fee, scoring table display, contact email, etc.) are fully editable in the Info editor. Display scoring is not the live scoring engine. Prize pool = $5 × entry count; place amounts are derived from admin percents (must total 100%). Projected vs finalized each have their own pool label and explanation (`<entries>` resolves to the entry count). Projected amounts show `*`; footnote sits at the bottom of Prizes. Tracker is heading + notes only (`||` line breaks).

## Backlog (not started)

- Standings entry on the vintage homepage
- Live scores
- This Week in Fun (TWIF) ads
- Vintage Hall of Fame redesign at `/hall-of-fame` (primary-admin gated; Sheets-backed; shared VintageShell)
- Full public rollout of vintage homepage + handbook + HoF (drop primary-admin gate)
