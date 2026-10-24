# Warren’s March Madness Design System

**Version:** 1.0 proposal · **Owner:** Warren Vander Laan · **Prepared:** October 22, 2026  
**Status:** Ready for review. This document defines the intended standard; it does not certify that every existing page complies.  
**Baseline:** `staging` at [`373f6bb`](https://github.com/WVLBrackets/wmm2026/commit/373f6bb47ed478ad96dc4aa1e9eb65a55a4a83d2). Production is not the design reference.

## How to use this system

Read this document before changing a public interface, bracket interface, admin workflow, or visual asset. Use the relevant section, existing shared components, and the [change checklist](design-system/CHANGE_CHECKLIST.md). The [token reference](design-system/tokens.json) makes the intended values explicit for developers and coding tools. The [asset register](design-system/ASSETS.md) explains what is and is not an approved master.

This is a design specification, not an application configuration file. The JSON tokens are documentation; they are not imported by the app. Adopting a proposed value requires an implementation change and verification.

**Evidence labels used below:**

| Label | Meaning |
| --- | --- |
| Established | Supported by Warren’s decisions and the current staging implementation |
| Standard | A specific recommendation adopted by this v1 proposal to prevent new variations |
| Baseline | An observed code/default value, not proof of the current published CMS setting |
| Unverified | Requires the rendered staging site or an approved source asset; do not guess |

Staging’s rendered appearance comes from **code + published CMS content + the selected media assets**. This review inspected the pinned repository, CSS, component logic, default content, and bundled image dimensions. It did not independently read the published staging CMS document or capture a live browser session. A CSS fallback, an old screenshot, or a bundled image must not silently replace the current published design as the source of truth.

The next task is the conformance audit: compare actual staging pages and CMS values against this specification, record differences, then agree on corrections. No visual corrections are included in this documentation change.

## 1. Identity and design principles

Warren’s March Madness is a vintage sports newspaper with a useful tournament application inside it.

1. **One recognizable publication.** Shared masthead, navigation, paper, ink, and typography make every public page feel related.
2. **Texture belongs to the material.** Artwork can feel printed and worn; reading, forms, numbers, and interactions stay clear.
3. **Hierarchy before decoration.** A visitor should identify the main action, find their entry, and read results immediately.
4. **Reuse before invention.** Extend a component or approved master before creating another visual treatment.
5. **Density has a purpose.** Brackets and results may be compact without turning every other page into a control panel.
6. **Exceptions need a role.** A result color, team logo, sponsor image, or admin workspace may differ for a reason. “It looked better here” alone does not establish a new standard.

### Three interface families

| Family | Primary objective | What it shares | What may differ |
| --- | --- | --- | --- |
| Public publication | Identity, reading, discovery, account access | Brand palette, font roles, shell, icons, editorial rules | Page composition and approved card formats |
| Bracket workspace | Accurate, fast picks and result review | School identity, clear state semantics, familiar controls; public shell at ordinary entry points | Canvas geometry, density, working surfaces, compact type, immersive layout |
| Admin workspace | Reliable editing and publishing | Clear labels, accessible controls, consistent workflow and navigation | Quieter surfaces, utility typography, higher information density |

My Picks landing and Standings are **public data pages**. The interactive bracket canvas/editor is the bracket workspace. A table’s density does not justify changing the public masthead or creating a new page palette.

## 2. Public foundations

### 2.1 Brand colors — established

| Role | Exact value | Existing token | Use |
| --- | --- | --- | --- |
| Ink / navy | `#152c3a` | `--v-ink` | Main text, rules, navigation background |
| Newspaper red | `#b52c26` | `--v-red` | Masthead, primary actions, editorial emphasis |
| Paper / cream | `#f2ead8` | `--v-paper` | Main page material |
| Quiet rule | `#b7b09f` | `--v-rule` | Row separators, secondary divisions |
| First-place gold | `#c9a227` | `--v-first` | Wreaths, champion accents, first place |
| Second-place silver | `#a8a9ad` | `--v-second` | Second-place accents |
| Third-place bronze | `#cd7f32` | `--v-third` | Third-place accents |
| Outside-paper canvas | `#dcd5c6` | Current literal | Desktop surround only |
| White | `#ffffff` | Semantic surface | Inputs and neutral result tiles |
| Black | `#000000` | Semantic frame | Pending finalist frame |

Use the role token, not a newly sampled near-match. Page-local aliases may reference a global role; they must not redefine the brand hex value.

**Standard derived surfaces:** panel = `color-mix(in srgb, var(--v-paper) 92%, white)`; quiet text = `color-mix(in srgb, var(--v-ink) 78%, transparent)`; subtle ink tint = `color-mix(in srgb, var(--v-ink) 5%, transparent)`. Judge translucent text against its actual background.

The public light newspaper theme remains deliberate even when the device prefers dark mode. Do not inherit the generic application dark palette into the paper shell.

### 2.2 Functional colors are a separate vocabulary

| Role | Fill | Border / foreground | Meaning |
| --- | --- | --- | --- |
| Correct result | `#dcfce7` | `#16a34a` border | KEY confirms the pick |
| Incorrect result | `#fee2e2` | `#dc2626` border | KEY contradicts it or the team is eliminated |
| Pending result | `#ffffff` | Neutral; `#000000` for a finalist frame | Still possible / undecided |
| Submitted status | `#d9e6dc` | `#3f6b4a` border; `#243f2c` text | Entry submitted |
| In-progress status | Gold mixed 28% with white | Ink text; gold mixed 62% with black border | Entry unfinished |
| Deleted status | `#d5d8de` | `#6b7280` dashed border; `#374151` text | Deleted entry |
| Paid indicator | `#dcfce7` | `#166534` text | Payment state as supplied by the application |
| Unpaid indicator | `#fee2e2` | `#991b1b` text | Payment state as supplied by the application |
| Disabled control | `#d1d5db` | `#6b7280` text | Unavailable interaction |

These greens and reds do not replace the brand colors. Payment state, entry status, and result correctness are distinct concepts even when they share a hue. Include words, icons, patterns, or accessible descriptions.

**Standard for new action controls:** red for the principal call to action; ink or outlined ink for ordinary utilities; destructive red for delete; muted gray for disabled. Current My Picks action defaults also include blue, purple, and amber. Treat that existing palette as a compatibility surface to assess in the audit, not a menu of colors for new components.

### 2.3 Typography roles — established families, standardized hierarchy

| Role | Family and fallback | Weight | Use |
| --- | --- | --- | --- |
| Display / headline | `"Alfa Slab One", Georgia, serif` | 400 | Masthead, page titles, major champion names |
| Condensed / UI emphasis | `Oswald, Impact, sans-serif` | 600 normally; 700 for strong labels | Navigation, table headings, buttons, captions, countdown |
| Body / utility | `Arial, Helvetica, sans-serif` | 400 / 700 | Reading, forms, instructions |
| Editorial specialty | `Georgia, "Times New Roman", serif` | 400; italic or bold deliberately | Supporting introductions, editorial notes, selected data labels |

Alfa Slab One and Oswald are self-hosted under `public/fonts/vintage/`; keep their license files. Do not synthesize a bold Alfa Slab face. A mascot name, page type, or different developer is not a reason to introduce another family.

| Type recipe — v1 standard | Size | Line height | Tracking / case |
| --- | --- | --- | --- |
| Public page title | `clamp(34px, 6vw, 60px)` | 1.05 | −0.02em; uppercase; Alfa 400 |
| Public section heading | `clamp(22px, 3vw, 30px)` | 1.15 | −0.01em; uppercase; Alfa 400 |
| Supporting introduction | 17px; 15px in compact composition | 1.4 | Georgia; sentence case |
| Body copy | 15px | 1.55 | Arial; sentence case |
| Form input | 16px minimum for ordinary public forms | 1.3–1.5 | Arial; preserve input case |
| Standard button | 14px | 1.2 | Oswald 600; 0.08em; uppercase |
| Table / column heading | 12px desktop; 10–11px compact | 1.2 | Oswald 600; 0.08em; uppercase |
| Supporting metadata | 12–13px | 1.4 | Arial or the component’s defined specialty role |

This consolidates currently differing page-title recipes; it does not claim they already match. The masthead and fitted artwork text are explicit component recipes below, not exceptions invented per page. Compact bracket labels may use 12px because they are part of a dense diagram.

### 2.4 Spacing, geometry, and borders

Use the standard spacing scale **4, 8, 12, 16, 24, 32, 40, 48, 64px** for new general layout. Existing optical values belong to named components: paper gutter 35px desktop / 22px medium / 18px mobile; home-card gap 18px desktop / 14px stacked. Do not normalize those mechanically or add unrelated one-off values.

| Geometry | Standard |
| --- | --- |
| Public control / panel corner radius | 0px |
| Fine separator | 1px solid quiet rule |
| Structural outline | 1px solid ink |
| Heavy semantic frame | 2px solid the appropriate state color |
| Secondary newspaper double rule | 3px double ink |
| Masthead double rule | 4px double ink |
| Default public focus ring | 3px solid red; offset 4px |
| Focus on dark navigation | Paper-colored ring, inside the target |
| Paper shell shadow | `0 5px 30px #1c25221c` |
| Ordinary card shadow | None unless its registered component calls for one |

A 2px CSS `double` border does not reliably read as two distinct rules. Use the defined 3px or 4px recipe for new CSS newspaper divisions. Baked image borders are artwork geometry, not CSS borders.

Round shapes remain valid for a trophy medallion, profile symbol, spinner, or numbered step. They do not establish rounded public cards.

### 2.5 Material and texture

Preserve texture in approved paper, title-bar, and illustration assets. The shared page paper uses the existing SVG fractal-noise material in `vintage.css` (160 × 160 tile, frequency .8, three octaves, brown `#7b6246` at .09 opacity). Reuse that material; do not generate a slightly different cream texture for each section.

Desired wear is fine ink variation and subtle paper grain. Avoid paint splatter, large white holes, coarse distress, heavy gradients, and texture that destroys letter shapes.

Live display text may use a restrained **0.94–0.96 opacity treatment** where the registered component calls for it. This is an optical print treatment, not a claim that text has the same raster distress as an image. Body copy, numeric results, input text, and focus rings remain crisp. Do not lower opacity to disguise a wrong color.

**Standard:** dynamic display overlays use the canonical ink/red plus their documented opacity. Existing card-local navy/red values are baseline compatibility details to assess against the approved artwork, not additional public brand tokens.

## 3. Shared public shell

Use `VintageShell`, `VintageToolbar`, and `VintageMasthead`. Do not rebuild their markup on each page.

| Property | Baseline to preserve |
| --- | --- |
| Paper maximum width | 1320px |
| Outer desktop padding | 26px top, 30px sides, 40px bottom |
| Paper desktop padding | 22px top, 35px sides, 0 bottom |
| Medium, 901–1050px | Outer 20px; paper 18px top / 22px sides |
| At 900px and below | No outer padding/border/shadow; paper 0 top / 18px sides |
| Desktop edition header | Sticky, minimum 74px; masthead and shortcut bar share the row |
| Mobile edition header | Shortcut bar sticky; masthead directly below in normal flow |
| Sticky offset | `var(--staging-banner-height, 0px)` |
| Non-production banner | Current application reserves 28px |
| Header layer | z-index 40 |
| Standings sticky controls | z-index 30; below the shared header |
| Non-production banner layer | z-index 60 |

The agreed mobile masthead does **not** acquire a second sticky row. Public pages keep the same header structure and styling even when their content changes.

### Masthead

“WARREN’S MARCH MADNESS” stays on one line, entirely newspaper red. Both spans use the same size, family, weight, and baseline. Current component size is 48px desktop and 40px mobile, with measured horizontal fitting after fonts load. Preserve the entire wording without clipping or forcing separate sizes for the two spans. Do not independently recreate it as an image.

### Shortcut toolbar

Use navy background, paper icons/text, and a 3px red active underline. Baseline icon size is 21px desktop / 20px mobile, stroke width 1.7; account icon is 25px mobile. Bar height is at least 52px desktop / 48px mobile. Visible link targets are at least 44px high desktop / 48px mobile.

Icons come from Lucide by default. Custom SVGs must match the same apparent weight and box, not simply their file dimensions. Decorative icons are hidden from assistive technology; icon-only links have meaningful accessible labels. Preserve selected-page semantics and admin-only visibility.

### Footer

Reuse the shared publication footer and contact treatment. Environment labels and build stamps belong to application chrome; do not bake them into card artwork or published content.

## 4. Reusable public components

### 4.1 Master-art cards

Play Now, Reigning Champ, and Excel Downloads form one art family. Use **one approved plate system** with fixed outer dimensions, border positions, header band, title baseline, icon region, and footer rules. New cards may change their content and registered illustration region, not quietly change the frame.

The repository’s bundled plates are **1024 × 614px**. Runtime uses proportional `width: 100%; height: auto`. These are measured bundle dimensions, not a claim that the published CMS uploads have the same dimensions. Keep native proportions and all four outer borders visible; never use `object-fit: cover`, stretch a plate, or impose a short fixed height.

**Title alignment rule:** use one fixed horizontal text anchor across cards, independent of icon width. Reserve a fixed icon column; size each icon inside it. Maintain the same title font size, cap-height, vertical baseline, and letter spacing. A shorter title does not get larger type. If text cannot fit, shorten the wording before making a new title size.

**Unverified master detail:** the current published image’s exact title anchor, red-band height, border offsets/weights, and footer-rule coordinates are not encoded in the React components. Register them from the approved published master before authoring the next plate. Do not treat coordinates estimated from an older bundled image as approved measurements. See the [asset register](design-system/ASSETS.md).

Dynamic text belongs in HTML overlay regions; it must not be burned into a new image whenever a year, name, motto, availability date, or caption changes. The fixed Play Now title and card ribbon may remain part of approved artwork.

| Component | Fixed art | Layered / configurable content |
| --- | --- | --- |
| Play Now | Bracket icon, title band, PLAY NOW lettering, frame | Destination / account flow and footer caption |
| Reigning Champ | Minimal trophy, title band, gold wreath, frame | Champion name, year, optional motto/caption |
| Excel Downloads | Spreadsheet icon, title band, labels, scenario-specific button/status art, frame | File links, expected dates, bottom caption |

No “New player or returning contender?” subtitle is part of the intended Play Now standard. Footer captions remain blank in the plate itself. A bundled image containing older baked text is a fallback requiring review, not permission to restore that content.

#### Shared overlay geometry — code baseline

Coordinates are percentages of each complete plate, with (0,0) at its top-left. They are distinct from the still-unverified baked border/title measurements.

| Region | Left | Top | Width | Height |
| --- | --- | --- | --- | --- |
| Shared footer caption | 4% | 79.5% | 92% | 14.5% |
| Champ name | 4.5% | 19% | 56% | 58% |
| Champ name without motto | 4.5% | 19% | 56% | 64% |
| Champ year / wreath opening | 69% | 28% | 27% | 42% |
| Picks download hotspot | 6% | 48% | 38% | 18% |
| Tracker download hotspot | 56% | 48% | 38% | 18% |
| Picks expected-date region | 4% | 62% | 42% | Content height |
| Tracker expected-date region | 54% | 62% | 42% | Content height |

The name-hole width is the current 56% implementation; do not silently substitute the earlier conceptual “left 75%” sketch. A different name region requires a coordinated art/component revision.

Use `CardFooterCaption` for all three footers: Oswald 700, uppercase, 1.08 line height, 0.85px tracking, opacity .96; one or two fitted lines. `||` is an authoring line break, never visible punctuation. Current fit limits are 11–28px for a one-line layout and 11–20px for two lines, constrained by available space. Do not hardcode different caption families or heights per card.

Use `ChampCardHoles` for names: Alfa 400; one to three fitted lines; explicit `||` supported; 12–75px fit range constrained by the hole. Current name opacity is .94. The year is straight Alfa Slab, centered in the wreath, not arched or rotated. Test short and long future winners, not just Jared Ingram.

#### Card behavior

- Play Now has one large link target. Preserve the existing authentication destination and return to My Picks; avoid nested links/buttons.
- Champ is informational unless a clear destination is deliberately added. The name remains the main visual emphasis.
- Excel has separate download targets. Coming Soon is informational, not a disabled-looking link that still downloads.
- The three supported Excel states are neither file, Picks only, and both files. Tracker-only is not currently a registered state.
- Expected dates appear only for unavailable files; an empty expected date must not leave placeholder text on the public page.
- Image text needs an accessible HTML equivalent or an appropriately named link. Invisible download hotspots must be keyboard reachable, have descriptive labels, and keep a visible focus outline.
- Main cards use three columns with 18px gaps above 900px and one column with 14px gaps at or below 900px. Do not crop cards to equalize height.

### 4.2 Countdown and tournament-underway band

One full-width module sits directly under the masthead and above the main cards. The countdown and underway message are states of that module, not extra sections stacked together.

Countdown: four equal columns; 1px quiet vertical separators; Oswald 700 numeric values; tabular numerals. Baseline values are 60px desktop and `clamp(36px, 12vw, 58px)` mobile. Label sizes are 12px / 10px. Heading is 20px desktop / 17px mobile, uppercase.

The underway message uses Alfa 400, ink, uppercase: `clamp(36px, 5.5vw, 64px)` desktop; `clamp(30px, 9vw, 52px)` mobile. It replaces the countdown when disabled/finished according to application state.

**Standard:** preserve the band’s full content width and intended place in the page. Exact equal height between countdown and banner states is not currently guaranteed by CSS; measuring and stabilizing that height is a discrete audit item, not a claim this document makes about the implementation. Never show negative countdowns or literal template tokens.

### 4.3 Editorial panels and announcements

Use the existing Explore/Announcement family: 1px ink frame; panel surface; 18px padding; 44px icon column; 16px icon-to-copy gap. Titles use Oswald 700, uppercase, `clamp(15px, 1.7vw, 18px)`; body uses Arial 14px / 1.45.

Explore has two desktop panels and stacks at 900px. Announcements span the content width; date and message form two columns, collapsing to one at 600px. Keep long announcements readable rather than shrinking them into an image card.

### 4.4 Authentication and ordinary forms

Keep sign in/create account as route-based pages under the public shell. A future modal must have a concrete navigation benefit and preserve direct links, password managers, error handling, and mobile keyboard behavior.

Baseline auth panel maximum width is 480px, square-cornered, with 28px desktop body padding and 18px horizontal mobile body padding at 640px. Standardize future double frames to the defined rule recipes; do not repeat a 2px-double pattern simply because it exists.

Inputs are at least 44px tall and 16px type; primary submit is at least 48px tall. Always show field labels. Validation appears beside the field or in a useful summary and preserves entered content. Include password visibility controls, disabled/loading states, and clear success/next-step copy.

### 4.5 Handbook and Hall of Fame

Handbook uses a page introduction, fact strip, compact section navigation, and readable editorial sections. Reading columns must not become full-width long lines merely because the paper is wide; aim for 60–75 characters per line for sustained prose. Mobile sections stack and anchor targets clear sticky navigation.

Hall of Fame uses a reigning-champion feature without a motto section, lifetime summary, and a consistent season-card archive. Initially show six seasons; Show More reveals history in the same format. Keep winning-school logos visible. Special 2020/2016 cards belong to the same card geometry; do not enlarge them because their content differs.

Baseline archive grid: three columns above 900px, two at 601–900px, one at 600px and below; 14px gap; season cards minimum 220px high. Preserve the existing data source; a design change does not authorize duplicating or moving its data.

### 4.6 My Picks landing

Preserve the welcome/entry summary, current versus historical context, year selector, search, status filters, entry list, and appropriate actions. Desktop uses a table; the compact mobile pattern keeps aligned columns rather than turning each entry into a tall generic card.

Mobile baseline below 768px: Entry | Status/payment | Final Four | Champ | Actions; entry name 13px Oswald 600; FF 2 × 2 tiles of 26px with 2px gaps; champ 39px; actions 2 × 2 of 28px with 2px gaps. These dense controls are a documented exception to ordinary 44–48px controls; retain accessible names and target separation, and reassess their usability during the audit.

**Locked — status chips (Warren, 2026-10-24):** Short ovals with one shared fixed width for Submitted, In Progress, and Deleted everywhere they appear (welcome count pills, Show filters, and entry-row badges). Geometry lives in `picks.css` as `--vp-status-chip-width` / `--vp-chip-height` / `--vp-chip-radius` (and related pad/font/icon tokens). Current locked values: **7.25rem** wide, **22px** tall, **pill radius** (`999px`), **10px** Oswald 600, **12px** icon, horizontal pad **8px**. Width is sized to the longest label (“In Progress”); do not shrink-to-fit per label or invent a different shape per status. Color/border semantics stay as in §2 (solid green Submitted, gold In Progress, dashed gray Deleted). Changing chip geometry requires an explicit product decision — not a drive-by layout tweak. Empty, unavailable, historical/read-only, and action-locked states remain part of the component.

### 4.7 Live Standings

Live is the public standings experience. Do not add a Daily/Live switch. Preserve year selection, search, and All Entries / My Entries filters.

Desktop preserves a readable table with rank, entry, payment when enabled, points, points behind, TB, Final Four, and champion. Mobile uses the compact **Option B** row: rank; entry name with points / gap / TB below; payment when enabled; 2 × 2 FF; champion. It has no My Picks action-button grid.

Display points behind as **(-17)**. Suppress that field for leaders, including tied first-place entries. Do not infer rank/gap from row order after filtering.

The two selected finalists have a heavy frame even before semifinals are decided. Pending frames are black; confirmed/correct or wrong/eliminated frames use semantic green/red. Regional cell fill and finalist frame describe separate outcomes. A champion cell must not appear correct merely because its team reached the final.

Baseline shared CMS defaults: FF tile 32px, champ 42px, finalist frame 2px on desktop and mobile. CSS fallbacks and My Picks compact overrides differ; the effective value must be checked with published CMS and cascade. Reuse the result styling logic; do not create another color meaning on each page.

Search/filter/header controls form a secondary sticky band below the masthead: current offsets are banner + 74px desktop and banner + 48px mobile. Ensure the measured header actually clears it at zoom and long labels.

## 5. Bracket workspace standard

### 5.1 Relationship to the publication

The bracket is a precision workspace. Carry the site identity at its entry and ordinary navigation, while allowing clean white working surfaces, compact labels, fine connector lines, and diagram-specific spacing. Do not force a paper-card frame, textured background, or slab headline onto every team row.

A dedicated full-screen/editor layout is a named working mode. It may prioritize the canvas and Save/Close/Submit controls. That does not authorize a different general site header on unrelated pages.

Desktop should support the full bracket. Mobile should prioritize region-by-region interaction and an understandable Final Four step. Preserve the existing flow and save behavior while restyling; discuss behavior changes separately.

### 5.2 Team slots, names, and results

- Keep seed, recognizable school logo, and label together; use `object-fit: contain` for team logos.
- Use crisp sans-serif team labels (12px baseline in the canvas); do not texture or squeeze them horizontally.
- Support selected, unselected, empty future slot, unavailable/read-only, correct, incorrect/eliminated, and still-possible states.
- Existing canvas selection/result treatments include blue for selected/still possible, green for correct, red for wrong/eliminated, and gold for specific champion emphasis. These are workspace semantics; do not reuse that blue as an alternate public navy.
- A state that changes from selection to result review must communicate its meaning in text or an accessible label, not color alone.
- Team colors/logos keep their real colors. They are data, not brand-palette violations.
- Long First Four pairs use the shared abbreviation/override logic. Display labels never become pick identifiers; the winner’s real name/logo replaces the pair while saved picks retain the same slot ID.

### 5.3 Geometry and fitting

Use existing layout configuration and geometry helpers. The current region-step baseline includes a 64.5rem bordered content width, up to 71rem outer frame, and 48rem minimum stage. These are diagram measurements, not public page gutters. Full-canvas dimensions are also controlled by `committedFullBracketLayout.json` and runtime layout settings.

Keep connector endpoints, seed ordering, advancement relationships, and click regions accurate. In a large canvas, scoped pan/scroll/zoom is permissible. Whole-page overflow or clipping an entire region is not a substitute for responsive behavior.

Printing and email/PDF output are separate render contexts: preserve complete brackets, readable names, meaningful result indications, and page bounds. Screenshots of the interactive canvas do not establish a print specification.

### 5.4 Working controls

Save, Close/Cancel, and Submit remain consistent within a working mode. Show unsaved changes, saving, saved, failed, submitted, locked, and read-only states clearly. A completed set of picks is not automatically a submitted entry. Errors must preserve the work and provide a practical next step.

A style change must not alter deadlines, cost, payment truth, scoring, First Four resolution, authentication, or valid actions. Those are product rules, not theme settings.

## 6. Admin experience standard

Admin prioritizes function, clear grouping, and confidence about what will be published. It is deliberately quieter than the public newspaper.

### 6.1 Admin visual vocabulary — registered separate family

| Role | Baseline CMS editor value |
| --- | --- |
| Workspace background | `#f7f5ef` |
| Text / frame | `#182e3b` |
| Primary action / focus | `#a4322b` |
| Panel background | `#fffefa` |
| Input background | White |
| Body / input family | Arial, Helvetica, sans-serif |
| Workspace heading | Georgia, 46px desktop / 36px compact |
| Panel heading | Georgia, 29px |
| Ordinary field text | 14px / 1.5 |

These values belong to the admin family, not a second public palette. Operational tournament tools currently also use utility/Tailwind styling; do not force artwork into them or claim they already use the CMS editor skin.

The common functional standard applies to both: consistent cross-navigation, labeled fields, clear disabled states, useful errors, and predictable Save/Preview/Publish actions. Prefer 44px main interactive targets on touch devices. Dense desktop tools may be smaller when necessary and usable.

### 6.2 Workflow requirements

1. State the current environment, tournament year, editing context, and publication status.
2. Distinguish **Save draft**, **Preview saved draft**, and **Publish**. Say what the action affects.
3. Surface unsaved changes and revision conflicts; never silently discard a newer edit.
4. Group fields in task order. Labels explain the content; help text explains constraints.
5. Preview images without cropping borders or hiding the actual aspect ratio.
6. Make errors actionable; retain entered content. Technical detail can appear in a reference or diagnostic area, not replace a useful instruction.
7. Warn before meaningful destructive actions and publication; do not make routine field changes a sequence of confirmation dialogs.
8. On mobile, stack fields and wrap controls; keep section navigation reachable and save actions visible without covering inputs.
9. Keep branding controls global. Ordinary content edits should not require choosing a different font, red, border, or card size.

### 6.3 Editable content versus design structure

| Content author may change | System-level design change |
| --- | --- |
| Headlines, editorial copy, captions, champion name/year/motto | Font roles, type scale, core palette |
| Countdown date/time and underway message | Header structure, sticky behavior, module geometry |
| Download links, availability dates, sponsor destinations | Master-art frame/title anchor/overlay geometry |
| Approved replacement images in the registered family | New plate dimensions, new texture recipe, new icon style |
| Play-in combined label, through the existing field | Pick IDs, scoring, team identity, winner-resolution behavior |

Existing admin controls expose more flexibility than this distinction. The audit should assess their effective settings and whether to constrain them. This document does not remove those controls.

## 7. Accessibility, responsive behavior, and content resilience

These are acceptance requirements for future changes, not a certification of the current site.

- Maintain readable contrast: target at least 4.5:1 for ordinary text and 3:1 for large text and meaningful non-text controls. Test the actual surface, including opacity and texture.
- Computed solid-color examples: navy on cream 12.07:1; red on cream 5.23:1; gold on cream 2.02:1. Gold is decorative or a background with dark ink, not normal small text on cream.
- All controls work with keyboard and expose clear focus; icon-only actions need accessible names. Do not place a tiny edit gear inside a card’s main link.
- Use semantic headings, table headers, labels, selected/expanded states, and meaningful loading/error announcements. The current masthead is an h1; page-heading hierarchy needs checking during the audit.
- Ordinary mobile controls aim for at least 44px targets; primary form submits 48px. Dense row/canvas exceptions must remain usable and must not be copied to normal forms.
- Text may wrap or use the registered fitting algorithm. Never silently clip a main name, title, or actionable value. If compact rows truncate, make the full value reachable.
- Test at 320, 390, 768, 900, 901, 1050, and 1440px, plus 200% zoom. Test 767/768px for My Picks, 600/601px for archive cards, and 640/641px for auth. These are test widths, not instructions to add new breakpoints.
- Preserve the current 900px shell transition; page-specific density breakpoints are named variants, not an alternate site header.
- Respect reduced-motion settings. Keep routine hover/focus transitions short (roughly 120–150ms); do not animate standings reordering or countdown numbers in a distracting way.
- Test short, long, missing, and future content: champion names/mottos, school pairs, entry names, years, sponsor images, empty results, large scores, and unavailable downloads.
- Communicate dates with the tournament’s intended timezone and a visible timezone label where needed; never infer a user-local timezone in one module while another assumes tournament time.
- Sponsor/advertiser content can retain its own identity inside a clearly bounded placement. Two promotional placements remain a product requirement, but the current homepage component does not render the older promotions grid; inventory/placement belongs to the next audit, not an invented current layout.

## 8. Governance: how consistency survives future work

### One default, a short list of variants

The allowed families are: public editorial, public data, master-art card, bracket workspace, and admin workspace. Variants must have a purpose, a named component, and a documented scope. There is no general “special page” exemption.

When a requested design cannot fit, try content hierarchy, wrapping, shared fitting, or a registered compact variant before adding a font, color, breakpoint, or new card frame.

### Change protocol

1. Read the relevant specification and source component at the current staging revision.
2. Identify whether the request changes content, component behavior, a shared token, or a master asset.
3. Reuse existing primitives; record any new role/variant in this document and the token reference in the same PR.
4. Preserve authorized product behavior and data sources.
5. Verify representative desktop/mobile states and long content.
6. Include screenshots for visual changes and explain any remaining deviations.
7. Update the version/change log when the standard itself changes.

A deviation record needs: component, rule, reason, scope, owner, and whether it is permanent or temporary. Temporary deviations need a follow-up issue or removal condition. Do not expand the accepted-variant list simply to make an audit report green.

### Review boundary and next audit

The next audit should compare rendered staging against this proposal in four passes: shared foundations; public pages/cards; bracket modes; admin workflows. Use a finding table with **rule → observed value → evidence → impact → recommended correction**.

Resolve these evidence gaps first:

- Published CMS font/color overrides and selected card assets.
- Approved master’s exact baked header/title/border/footer coordinates.
- Whether each current asset is a template master, published override, or old fallback.
- Effective computed fonts and logo sizes after the CSS cascade and CMS settings.
- Sticky offsets and countdown/banner height at real viewport sizes.

These are a review agenda, not preapproved code changes. Finish the standard review before doing the page-by-page judgment Warren requested next.

## 9. Implementation reference map

| Area | Primary references |
| --- | --- |
| Theme and shared shell | [vintage.css](../src/components/vintage/vintage.css), [VintageShell](../src/components/vintage/VintageShell.tsx), [font catalog](../src/lib/vintage/fonts.ts), [theme/content defaults](../src/lib/vintage/content.ts) |
| Header and icons | [VintageMasthead](../src/components/vintage/VintageMasthead.tsx), [VintageToolbar](../src/components/vintage/VintageToolbar.tsx), [toolbar icon catalog](../src/lib/vintage/toolbarIcons.ts) |
| Homepage modules | [VintageHomepage](../src/components/vintage/VintageHomepage.tsx), [HomeCardGrid](../src/components/vintage/HomeCardGrid.tsx), [homeCards](../src/lib/vintage/homeCards.ts) |
| Fitted dynamic text | [CardFooterCaption](../src/components/vintage/CardFooterCaption.tsx), [ChampCardHoles](../src/components/vintage/ChampCardHoles.tsx) |
| Handbook and Hall | [info.css](../src/components/vintage/info/info.css), [hof.css](../src/components/vintage/hof/hof.css), [archive](../src/components/vintage/hof/HofSeasonArchive.tsx) |
| Authentication | [auth.css](../src/components/auth/auth.css), [AuthForms](../src/components/auth/AuthForms.tsx) |
| My Picks | [picks.css](../src/components/vintage/picks/picks.css), [Picks content/defaults](../src/lib/vintage/picksContent.ts) |
| Standings | [standings.css](../src/components/vintage/standings/standings.css), [Standings defaults](../src/lib/vintage/standingsContent.ts), [renderer](../src/components/vintage/standings/VintageLiveStandings.tsx) |
| Bracket | [FullBracketCanvas](../src/components/bracket/FullBracketCanvas.tsx), [region editor](../src/components/bracket/RegionBracketLayout.tsx), [step metrics](../src/lib/bracketStepNavMetrics.ts), [committed layout](../src/lib/fullBracket/committedFullBracketLayout.json), [KEY result logic](../src/lib/fullBracket/keyPickResultStyles.ts) |
| Admin | [editor.css](../src/components/vintage/editor.css), [Tournament Builder](../src/app/admin/tournament-builder/page.tsx) |
| First Four display identity | [First Four design](TOURNAMENT_FIRST_FOUR.md), [label helper](../src/lib/playInDisplayName.ts) |

Older [standings shading notes](STANDINGS_SHADING_AND_BORDERS.md) describe legacy Sheets and Daily presentation as well as useful result semantics. Do not use that document to reintroduce a Daily/Live toggle or change the current Live data source. This system governs the presentation direction; authoritative scoring logic remains in application code.

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 proposal | 2026-10-22 | Established the public, bracket, and admin design families; recorded staging evidence, canonical tokens, asset boundaries, component rules, and review workflow. No runtime styles changed. |
