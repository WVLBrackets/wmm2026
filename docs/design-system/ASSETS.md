# Visual asset register

**Status:** Baseline inventory supporting the [Design System](../DESIGN_SYSTEM.md).  
**Source:** staging commit `373f6bb47ed478ad96dc4aa1e9eb65a55a4a83d2` · October 22, 2026.

## Asset authority

The authoritative published card is the asset selected in staging’s published CMS document, when present. React falls back to a bundled path only when the corresponding override is empty.

The following table verifies repository file dimensions by reading the PNG/JPEG headers. It does not certify pixel colors, frame alignment, title placement, or that these are the images currently visible on staging.

| Bundled file | Native dimensions | Git blob | Role / authority |
| --- | --- | --- | --- |
| [card-play-now-master.jpg](../../public/images/vintage/card-play-now-master.jpg) | 1024 × 614px | `b1e41ddbfbb5` | Bundled fallback; published selection unverified |
| [card-excel-picks.jpg](../../public/images/vintage/card-excel-picks.jpg) | 1024 × 614px | `8827138a5f90` | Bundled fallback; published selection unverified |
| [card-excel-neither.jpg](../../public/images/vintage/card-excel-neither.jpg) | 1024 × 614px | `b063e6ecc491` | Bundled fallback; published selection unverified |
| [card-plate-blank.png](../../public/images/vintage/card-plate-blank.png) | 1024 × 614px | `e6de12570ede` | Blank plate candidate; approval unverified |
| [card-champ-master.jpg](../../public/images/vintage/card-champ-master.jpg) | 1024 × 614px | `485bcdb338b2` | Bundled fallback; published selection unverified |
| [card-excel-both.jpg](../../public/images/vintage/card-excel-both.jpg) | 1024 × 614px | `6394cbadac4c` | Bundled fallback; published selection unverified |

The source also contains `card-excel-master.jpg`. The runtime resolver uses the three availability variants instead; the generic file is not an additional supported state.

**Known provenance caution:** visual inspection of the bundled Play Now file shows the older subtitle and baked bottom caption. Warren’s intended standard removes the subtitle and keeps the art footer blank for HTML captions. Therefore this fallback is not sufficient evidence of an approved current master. Do not use its pixels to undo the later design decisions.

## Resolver references

| Component | CMS field | Fallback |
| --- | --- | --- |
| Play Now | `playImageSrc` | `card-play-now-master.jpg` |
| Reigning Champ | `champImageSrc` | `card-champ-master.jpg` |
| Excel: neither available | `excelNeitherImageSrc` | `card-excel-neither.jpg` |
| Excel: Picks only | `excelPicksImageSrc` | `card-excel-picks.jpg` |
| Excel: both available | `excelBothImageSrc` | `card-excel-both.jpg` |

Implementation: [homeCards.ts](../../src/lib/vintage/homeCards.ts), [HomeCardGrid.tsx](../../src/components/vintage/HomeCardGrid.tsx). Default content can point at hosted media; a default URL is not proof of the current CMS selection.

## Register the approved published masters during the audit

For each image, record:

| Field | Required evidence |
| --- | --- |
| Asset ID and version | Stable descriptive name plus content hash/blob identity |
| Source | Published staging CMS field and immutable source copy |
| Native size / color space | Exact pixels; sRGB |
| Outer border | Left/top/right/bottom coordinates, stroke thickness and ink |
| Inner border | Same measurements; gap to outer frame |
| Red title band | Bounding box and fill target |
| Icon region | Fixed bounding box, optical center and stroke style |
| Title region | Fixed left anchor, top/cap-height/baseline, type treatment |
| Footer double rules | Each rule’s y-coordinate, stroke weight and separation |
| Blank content regions | Boxes for name/year/caption/dates and corresponding HTML overlays |
| Texture | Same paper/ink source and strength as the approved family |
| Approval | Warren, date, and review reference |
| Rights/provenance | Artwork source and any required attribution |

Use pixel coordinates relative to the native canvas. Also record percentages so overlays scale consistently. An image’s nominal DPI is not its web geometry.

The fixed title anchor is shared across the family. A trophy that is narrower than the bracket icon is centered inside the icon region; it does not pull the title to the left. Short titles retain the same cap-height and spacing. If the text cannot fit, revise the copy or the family deliberately.

## Creating the next card

1. Start from the approved blank master and preserve its frame/material. Do not regenerate the whole card from a text prompt.
2. Keep dimensions and every shared measurement unchanged. Use a separate content/illustration layer inside the permitted region.
3. Keep captions, year, names, dates, and variable availability text out of the immutable artwork.
4. Export a complete sRGB PNG when lossless text/line edges are needed; high-quality JPEG is acceptable for approved textured plates. Keep the editable source.
5. Compare the new card beside the approved master at native size and at the actual mobile/desktop rendered sizes. Check top, bottom, corners, title baseline, and footer holes.
6. Add the new asset/version to this register. Replacing an image requires checking all overlay and click-target boxes.

Do not resize the existing 1024 × 614 bundle to an assumed 1440 × 864 canvas as a side effect of documenting it. If the published approved master uses another size, register that exact size first and migrate the family together only when requested.

## Fonts, icons, photography, and sponsor art

- **Fonts:** local Alfa Slab One and Oswald files under [public/fonts/vintage](../../public/fonts/vintage); retain both OFL license files.
- **Icons:** Lucide by default; custom SVGs use the same target box/optical weight. Preserve vector masters. Rasterized icons are not replacements for the shared icon system.
- **Champion decoration:** gold wreath/trophy; year stays live HTML; approved master may have the wreath baked in.
- **Team logos:** supplied reference identity; show with contain sizing and no forced brand recoloring.
- **Photography:** retain the approved crop/treatment for the specific component; do not apply a blanket sepia filter to functional logos.
- **Sponsor art:** bounded placement retaining the sponsor’s identity, with a clear destination and meaningful accessible label.
- **Page paper:** use the single shared material in vintage.css. Do not upload a different cream background for each editorial section.

## Before declaring an asset “master”

The file must be complete, approved, registered, reusable without variable content, and compatible with its component’s overlay geometry. A file named `master`, a generated mockup, and a current production image are not automatically approved staging masters.
