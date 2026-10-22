# Design-system change checklist

Use with [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md), [tokens.json](tokens.json), and [ASSETS.md](ASSETS.md).

## Before implementation

- [ ] Inspect current staging and the relevant shared component; note CMS overrides where they affect the change.
- [ ] Identify the family: public editorial, public data, master-art card, bracket workspace, or admin.
- [ ] Read the family/component rules. Reuse its palette, typography role, spacing, and state semantics.
- [ ] Determine whether this is a content edit, design change, behavior change, or asset replacement.
- [ ] Keep behavior changes within the user’s request. Styling does not authorize changing scoring, authentication, data sources, or publishing rules.
- [ ] If the requested work needs a new variant, document its purpose and scope in the PR. Do not introduce a new near-match hex or font casually.

The system is a v1 proposal pending Warren’s review. Use it to make decisions explicit; do not silently refactor unrelated screens merely to enforce the proposal.

## While implementing

- [ ] Preserve the shared public shell. Use the correct sticky offset and ensure the toolbar remains consistent across routes.
- [ ] Reference existing role tokens rather than add page-specific copies.
- [ ] Keep texture in approved material/artwork; use clear live text for variable content.
- [ ] For plates: preserve complete borders, native proportions, title anchor, and overlay geometry.
- [ ] Provide normal, hover/focus, loading, disabled, empty, error, historical/read-only, and success states as relevant.
- [ ] Make full-card links and nested controls semantically valid.
- [ ] Keep long names/captions readable; use the shared fit/abbreviation helpers.
- [ ] Preserve distinct meanings for entry status, payment, result correctness, and selection.

## Verification appropriate to the change

- [ ] Compare representative desktop and mobile views, including neighboring unchanged components.
- [ ] Check 900/901px shared shell transition and relevant component breakpoint edges.
- [ ] Check keyboard operation and visible focus; verify icon-only labels.
- [ ] Check long, short, missing, and future content; inspect complete bottom edges and image borders.
- [ ] Check computed font families/weights, real backgrounds, and CMS-derived values rather than only CSS fallbacks.
- [ ] Check sticky layers, scroll targets, mobile keyboard, and zoom as relevant.
- [ ] Verify behavior with tests when it is affected. Do not add tests that merely repeat constants for a simple documentation or cosmetic change.

## PR handoff

Record the user-visible change, affected family/components, relevant design-system sections, validation, and screenshots when visual. If the standard changes, update the spec and token reference together. Note any intentional deviation and follow-up.

### Deviation record template

| Field | Value |
| --- | --- |
| Component / route | |
| Rule or token | |
| Proposed difference | |
| Reason / user benefit | |
| Scope | |
| Owner | |
| Permanent or temporary | |
| Removal condition / follow-up issue | |
| Review reference | |

### Audit finding template

| Rule | Observed staging value | Evidence | Impact | Recommended correction |
| --- | --- | --- | --- | --- |
| | | Screenshot + viewport / computed style / asset version | | |

## Reusable task brief for developers and coding tools

> Use the latest staging implementation as the baseline. Read docs/DESIGN_SYSTEM.md and the applicable component section before making UI changes; consult docs/design-system/tokens.json and ASSETS.md. State whether the change is public editorial/data, a master-art card, bracket workspace, or admin. Reuse shared components and role tokens, preserve authorized functional behavior, and keep variable text as live content. Explain any new design variant instead of inventing local colors, fonts, or frame geometry. Verify the relevant desktop/mobile states and provide evidence with the PR. This design system is a proposal until Warren approves it; unrelated conformance changes are separate work.
