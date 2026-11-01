# Bracket editor theme screenshots

## Isolation

- Key Data: `keyData.bracketEditorTheme` = `legacy` | `vintage` (default `legacy`).
- Publish per environment (Staging vs Production CMS).
- Scoped CSS: `[data-bracket-theme="vintage"]` in `src/components/bracket/bracket-vintage-theme.css`.
- Local/dev override (non-production only): `?bracketEditorTheme=vintage|legacy`.

## Rollback

Republish homepage Key Data with **Legacy** selected. No code deploy required to revert chrome.

## Deferred (not in this pass)

- Enlarging canvas / slots / hit areas
- New truncated-name reveal UX
- Sticky action bar that changes scroll/overlap behavior
- Public end-user theme picker

## Validation notes (2026-10-25)

Same incomplete in-progress fixture; Theme via query override (CMS published Legacy).

| Check | Legacy | Vintage |
| --- | --- | --- |
| Layout labels | `5 Page` / `1 Page` | `Regions` / `Full` |
| Brand strip | absent (prior chrome) | WMM title + year · Bracket Editor |
| Region tabs | bright blue / yellow parens | navy selected, outlined available |
| Actions | purple Save / blue Submit / red Cancel | navy Save / red Submit / outlined Cancel |
| Mode switch 5p↔1p | works | works |
| Progress | existing bars | quiet strip; overall + regional counts in Region mode |
| Geometry / TBD slots | unchanged | unchanged (FF shadow/radius flattened only under Vintage) |

Screenshots in this folder:

- `legacy-region-desktop-1440.png`, `legacy-full-desktop.png`, `legacy-region-mobile-390.png`
- `vintage-region-desktop.png`, `vintage-full-desktop.png`, `vintage-region-mobile-390.png`

**Staging:** Publish Key Data → Vintage for env-wide Vintage. **Production:** leave Legacy published (no Prod Vintage publish as part of this task).

## Files changed (summary)

- `src/lib/vintage/content.ts` — Key Data field
- `src/components/vintage/VintageEditor.tsx` — Legacy / Vintage control
- `src/components/bracket/BracketEditorThemeContext.tsx` — theme context
- `src/components/bracket/bracket-vintage-theme.css` — scoped chrome
- `src/app/bracket/BracketPageClient.tsx` — gate + layout labels + brand strip
- Chrome consumers: `BracketStepNavBar`, `BracketEditorTopMessage`, `RegionBracketLayout`, `StepByStepBracket`, `FullBracketEditorShell`, `FinalFourChampionship`
- `docs/DESIGN_SYSTEM.md` §5.1 note
