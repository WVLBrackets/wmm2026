# Tournament Builder and First Four

This feature starts with 2027. It does not convert historical JSON or modify team-reference rows.

## Admin workflow

1. Open Admin → Tourney → Edit Bracket, and select/load the current or a future year.
2. Fill eight matchups in each region. Each slot is either one real school or a play-in pair of real schools. The searchable selector shows each school once; its seed and logo appear beside it, without a duplicate caption.
3. Save Draft to persist incomplete work. Preview Bracket shows all four regions. Publish explicitly activates the definition in the environment named on the button. Existing site availability, year and deadline configuration still applies; publishing does not change Google Sheets.
4. Export JSON is optional. No commit or redeployment is required for an admin publication.
5. Use First Four Results under Tourney or Key to select a survivor. Save explicitly. Corrections/clearing previous results require confirmation. Refresh/reopen picks to display the new survivor; standings snapshots invalidate and are rebuilt on read.

## Identity and scoring

- A play-in slot has a stable, year/position/seed-specific `playin:` id. It is **not** a row in the global school-reference database.
- Definitions contain the two real school ids, labels and local logos. An unresolved slot displays both labels and a composed logo made from the existing local PNGs.
- Results are a separate slot-id → school-id map, not extra picks in KEY.
- Resolution changes the name/logo and `playIn.winnerId`, never the slot id or seed. Every saved pick, including later-round picks, continues to reference the slot.
- The scoring engine is unchanged. There are exactly 63 scored games; First Four results award zero points. Both survivors have the slot's seed for the existing underdog rules.
- Client picks/viewers/print and server scoring/email use the same resolved tournament. Live snapshots include tournament-specific logo mappings so no fake reference team is necessary.

## Persistence and isolation

`src/lib/database/tournamentSchema.ts` is an additive, idempotent migration. It creates `tournament_workspaces` and `tournament_workspace_history`; it is applied on the first authorized draft/publish/result save. Public reads do not migrate schemas. Do not run it against production just to test the branch.

The store uses the application's existing environment-specific database configuration. Production and local scopes are distinct. Preview scopes additionally hash `VERCEL_GIT_COMMIT_REF`, preventing a feature preview from replacing staging data when both use the same preview database. Missing preview branch identity fails closed.

Each mutation checks an optimistic revision, locks the workspace, writes the new state, and adds an audit revision in one transaction. Stale editor saves return HTTP 409 and ask the admin to reload. A year with existing brackets/KEY cannot have its published field replaced; First Four results remain editable. In-flight snapshot recomputations are detected by the tournament-revision marker on subsequent reads.

New APIs:

- `GET /api/tournament-data?year=YYYY`: published/resolved field, no-store, legacy file fallback; 404 when unpublished and 503 for storage failure.
- `GET /api/admin/tournament-builder?year=YYYY`: draft/published/results/revision and environment label.
- `POST /api/admin/tournament-builder`: draft or publish with definition and expected revision.
- `PUT /api/admin/first-four`: result map and expected revision.

All admin endpoints authorize server-side. Mutations require existing CSRF tokens. Historical years and years before the configured active year cannot be changed through these APIs.

## Merge and rollout

Merge the feature branch to staging first. It requires no new credentials if the existing bracket database connection is configured. The application database role must have permission to create the two new tables, as existing migrations do. Otherwise have the normal migration process apply `initializeTournamentWorkspace` first.

Publish a staging test tournament, create an entry, confirm either survivor, and check editor/viewer/print/email/standings against a real isolated staging database before production promotion. Local automated storage tests use pg-mem, which does not prove PostgreSQL transaction/concurrency behavior.

Rollback code does not delete stored drafts, publications or audit history. Export a definition first if a portable backup is desired. No historical file or shared school record should be rewritten or removed.

## Verification commands

- `npm run test:tournament`: field validation, 63-game invariant, both survivors, points/slot-id preservation, logos, deduplication, SQL revisions/publication/history/environment scopes and field freeze.
- `npm run test:tournament:browser`: local authenticated API and browser flow against an in-memory SQL adapter; external requests are blocked by a subprocess-only fixture.
- `npx tsc --noEmit`
- `npm run build`

When Google Fonts is unreachable, an offline compile check can use `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$PWD/tests/fixtures/tournament-font-mock.cjs npm run build`. This tests compilation with an explicit font fixture, not the real Google font download. Browser verification can use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for a preinstalled Chromium.

The untouched staging baseline at `f7d2954` already fails four vintage content/handbook assertions (date validation, countdown copy, handbook icon default and prize amount). These are separate from the tournament feature.

Local verification completed: all four feature test groups pass; the authenticated desktop/mobile browser flow passes through actual new API handlers and in-memory SQL, including the explicit First Four save/correction UI and unauthorized/CSRF rejection. TypeScript and focused ESLint checks pass. The complete Next production build passes with the offline Google Font fixture; an unmodified-font build is blocked by this environment's Google Fonts network access. No remote database migration was run.

## Combined play-in labels

Unresolved pairs keep full school names when they fit a shared 140px label budget
(14px Arial glyph measurements, summed consistently on server and client).
Long pairs use recognized ESPN abbreviations by school ID: for example, ETSU / UNCG.
Unknown schools use readable word shortening and, if needed, ellipses rather than
invented initials. The builder previews the result and provides an optional
40-character combined display name override. Clearing it restores automatic mode;
changing either participant clears the override to avoid stale labels.

The bundled abbreviation catalog covers 362 teams, retrieved 2026-10-21 from
https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=1000.
It requires no runtime ESPN request or reference-database changes. The catalog can
be refreshed from that feed when new schools join. Glyph widths are a conservative
fit estimate; actual UI fonts can differ, and an admin override may be longer.

Only the combined label may be republished after entries exist. School identities,
seeds, and the rest of the published field remain frozen. First Four results stay
separate; the winner's normal display name and logo replace either automatic or
custom combined labels. Existing saved picks and scores retain their slot IDs.
