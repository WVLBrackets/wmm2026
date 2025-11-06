# Print Bracket Page Analysis

## Structure Overview

The print-bracket page (`src/app/print-bracket/page.tsx`) is a client-side React component that renders a complete bracket for printing. It uses:
- React state management
- Next.js `Image` component for logos
- Inline styles throughout
- Session storage for bracket data

## Key Components

### 1. Header Section
- **Left**: Entry Name
- **Center**: "Warren's March Madness {year}"
- **Right**: Trophy icon + Champion team name + mascot + logo

### 2. Bracket Layout
- **Top Row**: Two regions side-by-side (Top Left, Top Right)
- **Middle**: Final Four section (centered)
- **Bottom Row**: Two regions side-by-side (Bottom Left, Bottom Right)

### 3. Region Structure
Each region has 5 columns (rendered in different order for left vs right):
- **Left side regions**: Round of 64 → Round of 32 → Sweet 16 → Elite 8 → Final Four
- **Right side regions**: Final Four → Elite 8 → Sweet 16 → Round of 32 → Round of 64

### 4. Round Details

#### Round of 64
- Shows all 16 teams (8 games)
- Each team cell: `height: 6%`, `fontSize: 8px`
- Format: `#seed Team Name`
- No logos in Round of 64

#### Round of 32
- Shows 8 winners (8 games)
- Each cell: `height: 12%`, `fontSize: 10px`
- Format: Logo (12x12) + `#seed Team Name`
- Logo appears before seed/name

#### Sweet 16
- Shows 4 winners (4 games)
- Each cell: `height: 12%`, `fontSize: 12px`
- Format: Logo (14x14) + `#seed Team Name`
- Has gaps: 6% top, 12% between games, 6% bottom
- Logo appears before seed/name

#### Elite 8
- Shows 2 winners (2 games)
- Each cell: `height: 24%`, `fontSize: 12px`
- Format: Vertical layout
  - Top: `#seed Team Name`
  - Bottom: Logo (20x20)
- Has gaps: 12% top, 24% between games, 12% bottom

#### Final Four (Regional Champion)
- Shows 1 winner (1 game)
- Cell: `height: 24%`, `fontSize: 12px`
- Format: Vertical layout (same as Elite 8)
- Has gaps: 36% top and bottom

### 5. Final Four Section
- Centered between top and bottom regions
- Width: 50%, maxWidth: 500px
- Shows two finalists side-by-side with "VS" in middle
- Format for each finalist:
  - `#seed Team Name` + Logo (24x24)
  - Finalist 1: seed + name + logo (in that order)
  - Finalist 2: logo + seed + name (in that order)
- Tie Breaker below: `Tie Breaker (Finals Total) = {value}`

## Styling Patterns

### Colors
- Border: `#d1d5db` (gray-300)
- Background: `#ffffff` (white)
- Text (normal): `#374151` (gray-700)
- Text (placeholder): `#9ca3af` (gray-400)
- Header border: `#000000` (black)

### Typography
- Header: `fontSize: 20px`
- Region names: `fontSize: 14px`, `fontWeight: bold`
- Round of 64: `fontSize: 8px`
- Round of 32: `fontSize: 10px`
- Sweet 16/Elite 8/Final Four: `fontSize: 12px`
- Final Four section: `fontSize: 14px` (teams), `fontSize: 11px` (tie breaker)

### Spacing
- Padding: `2px 4px` (most cells)
- Gaps between columns: `0px`
- Region padding: `3px`
- Header padding: `8px 0px`

## Logo Handling

### Logo URLs
- Stored in `TournamentTeam.logo` as relative paths
- Format: `/logos/teams/${teamId}.png`
- For PDF: Need to convert to absolute URLs
- Fallback: `/images/basketball icon.png` if logo not found

### Logo Sizes by Round
- Round of 32: 12x12 pixels
- Sweet 16: 14x14 pixels
- Elite 8: 20x20 pixels
- Final Four (regional): 20x20 pixels
- Final Four (championship): 24x24 pixels
- Header (champion): 24x24 pixels

### Logo Display
- Uses Next.js `Image` component (won't work in server-side HTML)
- Need to convert to `<img>` tags with absolute URLs
- `objectFit: 'contain'` to maintain aspect ratio
- `flexShrink: 0` to prevent logo from shrinking

## Helper Functions

### `getWinnerFromGame(game, pickedWinner)`
- Takes a game object and picked winner ID
- Returns the winning team object (team1 or team2)
- Returns null if no pick or invalid game

### `renderRegionColumns(regionKey, regionIndex)`
- Renders all 5 columns for a region
- Handles different column orders for left vs right regions
- Returns array of column divs

### `renderFinalFourSection()`
- Renders the Final Four and Championship section
- Gets picks from bracket data
- Finds finalist teams from tournament data
- Displays tie breaker value

## Data Flow

1. Load site config to get tournament year
2. Load tournament data for that year
3. Get bracket data from session storage
4. Generate bracket structure using `generate64TeamBracket()`
5. Update bracket with picks using `updateBracketWithPicks()`
6. Load champion team info (async) using `getTeamInfo()`
7. Fetch champion mascot from API
8. Render bracket with all data

## Key Considerations for PDF Generation

1. **Logo URLs**: Must convert relative paths to absolute URLs
   - Option: Use `process.env.NEXT_PUBLIC_SITE_URL` or construct from request
   - Option: Use base64 encoding (larger but more reliable)

2. **Image Loading**: Puppeteer needs images to be fully loaded
   - Use `waitUntil: 'networkidle0'` in `page.setContent()`
   - Consider preloading critical images

3. **Styling**: All styles are inline - good for PDF
   - No external CSS needed
   - Ensure all styles are copied exactly

4. **Layout**: Uses flexbox and grid
   - Should work in PDF, but test carefully
   - May need adjustments for PDF rendering

5. **Fonts**: Uses system fonts (Arial, sans-serif)
   - Should work in PDF without issues

6. **Print Styles**: Has `@media print` styles
   - These won't apply to PDF generation (Puppeteer uses screen styles)
   - May need to adjust for PDF-specific rendering

## PDF Layout Requirements

**IMPORTANT**: The PDF must be in **horizontal (landscape) layout** to properly display the bracket structure.

- Puppeteer config already has `landscape: true` ✓
- HTML layout should be optimized for landscape orientation
- Ensure bracket fits well in landscape A4 format

## Next Steps

1. Create helper functions to generate HTML strings
2. Convert React components to HTML string generation
3. Handle logo URL conversion
4. Optimize layout for landscape orientation
5. Test with real bracket data
6. Verify visual similarity to print page

