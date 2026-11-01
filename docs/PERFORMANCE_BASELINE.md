# Staging performance baseline (Picks / Standings / Scoreboard)

Capture **before vs after** on staging after go-live hardening. Numbers below are the measurement method, not invented scores.

## How to measure

On staging, signed in as a typical player, Chrome DevTools (Performance + Network) or Lighthouse:

| Page | What to record |
|------|----------------|
| `/bracket` (My Picks) | TTFB, LCP, document + XHR/fetch count after first paint |
| `/standings` | TTFB, LCP, whether the first table paint used SSR snapshot (no waiting `/api/live-standings` for scored years) |
| `/scoreboard` | TTFB, LCP, extra `getActiveTournamentYear` round trips (should be none; year comes from homepage CMS) |

Record the environment (staging URL), date, and whether CMS / KEY snapshot were warm.

## Expected shape after this hardening

- **Picks:** session, field, team ref, and bracket list load on the server; PaymentModal / editor shells are code-split; no `/api/site-config?fresh=true` waterfall.
- **Standings:** first scored-year payload from `live_standings_snapshots` on the RSC; public snapshot GET uses a 15s cache; no lazy recompute on GET.
- **Scoreboard:** public page reads `scoreboard_snapshots`; year list is cached in `listTournamentFieldYears`.

Fill actual staging numbers in this table when you run the capture:

| Page | TTFB (ms) | LCP (ms) | Own-origin requests | Notes |
|------|-----------|----------|---------------------|-------|
| My Picks | | | | |
| Standings | | | | |
| Scoreboard | | | | |
