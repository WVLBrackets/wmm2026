# Standings pages: Final Four and Champion shading & borders

This document describes how **cell fill (shading)** and **borders** work for the **Final Four** and **Champion** columns on the **Daily Standings** UI. The same rules are applied in code for **Live Standings** when the assembled `StandingsData` includes the KEY row, semifinal KEY cells, champion KEY cell, and elimination list.

**Source of truth for bracket picks:** Each row’s picks come from that day’s Google Sheet tab (e.g. `Day 1` … `Day 9`, or `Final`), in the player data rows below the KEY row.

**Implementation reference:** Parsing and pure logic live in `src/lib/standingsData.ts` (`getRegionalChampionSquareShade`, `getFinalistBorderTone`, `getChampionDisplayColors`). Rendering uses `src/components/StandingsTable.tsx` (local `TeamLogo` helper: green/red gradients for fill, `ring-2` for heavy borders, black as `ring-gray-900` for “neutral” heavy ring).

---

## Google Sheet layout (KEY row = row 2)

Row **2** is the **KEY** row: actual tournament results as they become known. Blanks mean that game or outcome is **not yet final**. Each KEY cell is evaluated **independently** (games finish in any order).

| Cell | Meaning |
|------|---------|
| **E2** | Winner of the **top-left** regional (Elite Eight). Blank ⇒ regional not decided. |
| **F2** | Winner of the **bottom-left** regional. Blank ⇒ regional not decided. |
| **G2** | Winner of the **top-right** regional. Blank ⇒ regional not decided. |
| **H2** | Winner of the **bottom-right** regional. Blank ⇒ regional not decided. |
| **I2** | Winner of the **left** national semifinal (finalist from the left side of the bracket). Blank ⇒ game not played / not final. |
| **J2** | Winner of the **right** national semifinal (finalist from the right side). Blank ⇒ game not played / not final. |
| **K2** | **National champion** once the title game is final. Blank ⇒ champion not decided. |

**Player row columns (same sheet, data rows):** The parser maps **Final Four picks** to sheet columns **E–H** (indices 4–7) and **finalist picks** to **I–J** (8–9), **champion** to **K** (10), aligned with the KEY row above.

---

## Elimination table (column O / P)

To know if a team is **already out** before the KEY cell for their game is filled:

- **Column O:** team name  
- **Column P:** `TRUE` ⇒ that team is **eliminated**; anything else ⇒ not treated as eliminated for this logic  

Product spec: maintain this table through **O3:P66** (or until you stop listing teams). **Team names must match** how they appear in bracket picks and KEY cells (same spelling/formatting), because matching is done with trimmed string equality in code.

**Sheet convention (matches the parser):** **O2** is always the header **`Team`** (so column O is non-blank on the KEY row and the parser does not stop before the data rows). **O3–O66** are always populated with team names; column **P** holds `TRUE` / not-`TRUE` per row. The CSV parser walks **down column O from row 2** and stops at the **first blank** team in column O, so rows below the last filled team can be left empty.

---

## Final Four column: 2×2 grid (bracket layout)

The UI shows a **2×2** grid of the four **regional winners** from the player’s bracket, aligned with the **full bracket geography**:

| Display position | Regional winner |
|------------------|-----------------|
| Top-left | Top-left region |
| Top-right | Top-right region |
| Bottom-left | Bottom-left region |
| Bottom-right | Bottom-right region |

**Sheet order vs display order:** KEY stores regional champs as **E=TL, F=BL, G=TR, H=BR**. The grid renders **TL, TR / BL, BR** (top row then bottom row), which matches reading order over the bracket.

Empty pick slots render as a small empty dashed cell (no logo).

---

## Two visual layers per regional cell

Each of the four cells has:

1. **Fill / shading** — “Did this player **pick the correct regional champion**?” (driven by **E2–H2** and elimination data).  
2. **Border (heavy ring)** — only for teams that are the player’s **national semifinalist picks** (winners of the two Final Four games). Border color means “Did this player **pick the correct finalist** for that side?” (driven by **I2/J2** and elimination data).

So **at most two** of the four logos show a **heavy** border: the two teams the player picked to win their respective Final Four games. The other two regional winners use the default thin border unless other styles apply.

### Baseline before regional games are final

If **no** regional champ is known yet (all of E2–H2 still blank) **and** no elimination logic applies yet:

- **Shading:** none (neutral / white background).  
- **Heavy border:** still shown for the **two finalist picks**, in **black** (“pending but still alive” state).  

As soon as any regional KEY cell is non-blank or elimination data applies, shading and border colors follow the rules below.

---

## A) Regional champion — square shading (E2, F2, G2, H2)

For **each** of the four cells, use the KEY cell that matches **that region’s** champion (E with TL, F with BL, G with TR, H with BR).

| Condition | Shading |
|-----------|---------|
| Regional champ **known** (corresponding KEY cell **non-blank**) and pick **matches** KEY | **Green** (correct) |
| Regional champ **known** and pick **does not** match KEY | **Red** (incorrect) |
| Regional champ **not** known (KEY cell **blank**) and pick is **eliminated** (`TRUE` in P for that team in column O) | **Red** |
| Regional champ **not** known and pick is **not** eliminated | **No shade** (neutral) |
| No pick in that slot | Neutral / empty cell treatment |

Evaluate **each region independently** — one side can be green while another is still neutral.

---

## B) Finalist — heavy border color (I2, J2)

The **heavy** border is only on cells whose team is the player’s pick to **win that side’s Final Four game** (i.e. appears as the **left** finalist pick → compare to **I2**; **right** finalist pick → compare to **J2**).

| Condition | Border color (heavy ring) |
|-----------|---------------------------|
| That semifinal **decided** (I2 or J2 **non-blank** for that side) and pick **matches** KEY | **Green** |
| Semifinal decided and pick **does not** match KEY | **Red** |
| Semifinal **not** decided (KEY **blank**) and that finalist pick is **eliminated** | **Red** |
| Semifinal **not** decided and pick is **not** eliminated | **Black** (pending) |

Again, **left** and **right** semifinals are evaluated **separately**.

---

## Champion column (K2)

Single logo; **both** fill and **heavy** border use the same outcome (fewer combinations than Final Four).

| Condition | Fill | Border |
|-----------|------|--------|
| **K2** populated and pick **matches** champion | **Green** | **Heavy green** |
| **K2** populated and pick **does not** match | **Red** | **Heavy red** |
| **K2** blank and pick **eliminated** | **Red** | **Heavy red** |
| **K2** blank and pick **not** eliminated | **No shade** | **No heavy border** |

---

## Copy of original product notes (verbatim aside from typo)

The following is the author’s write-up as provided, with one spelling fix (`player` → `played` in the K2 bullet).

Let me explain how the "Final Four" column on the Daily Standings page should work.  
You already know that the content for each daily standings page comes from the matching tab in the daily standings google sheet.  
The display should be a 2x2 grid showing the four regional winners for the bracket. They should align with the layout of the bracket:  
Top Left Region Winner, top left square.  
Top Right Region Winner, top right square.  
Bottom Left Region Winner, bottom left square.  
Bottom Right Region Winner, Bottom Right square.  

Each team selected to win in their final four matchup and become a finalist should get a heavy border.  
Now, let's talk about the shading of the four squares and the coloring of the borders.  
Before any games are played, there is no shading and the heavy borders should be black.  

The shading of the square indicates if the regional winner was correctly picked or not.  
If correctly picked - shade green  
If not correctly picked - shade red  
If not sure yet - no shade  
You can tell if the regional winners have been determined or not based on row 2 in the standings google sheet.  
The regional finals will be played at different days and times, so it is possible for one game to be complete, but not the others.  
Don't assume the order that the games will be played and check each game separately.  
E2 - will have the winner of the top left region. If it is blank, the game hasn't been played.  
F2 - will have the winner of the bottom left region. If it is blank, the game hasn't been played.  
G2 - will have the winner of the top right region. If it is blank, the game hasn't been played.  
H2 - will have the winner of the bottom right region. If it is blank, the game hasn't been played.  

If a regional champ has been determined (based on the cell in row 2 being populated) then:  
- If the bracket pick matches the winner, the square should be shaded green.  
- If the bracket pick does not match the winner, the square should be shaded red.  
If a regional champ has not been determined (based on the cell in row 2 not being populated) then:  
- If the bracket pick has already been eliminated, the square should be shaded red.  
- If the bracket pick has not already been eliminated, the square should not be shaded.  

Remember, you can check the data in o3:P66 to see if a team has been eliminated. If the lookup value for the team is 'TRUE', they have been eliminated.  

The border of the square indicates if the finalists were correctly picked or not.  
If correctly picked - color green  
If not correctly picked - color red  
If not sure yet - remain black  
You can tell if the finalists have been determined or not based on row 2 in the standings google sheet.  
The semi finals will be played at different days and times, so it is possible for one game to be complete, but not the other.  
Don't assume the order that the games will be played and check each game separately.  
I2 - will have the finalist of the left side games. If it is blank, the game hasn't been played.  
J2 - will have the finalist of the right side games. If it is blank, the game hasn't been played.  

If a finalist has been determined (based on the cell in row 2 being populated) then:  
- If the bracket pick matches the winner, the border should be colored green.  
- If the bracket pick does not match the winner, the border should be colored red.  
If a finalist has not been determined (based on the cell in row 2 not being populated) then:  
- If the bracket pick has already been eliminated, the border should be colored red.  
- If the bracket pick has not already been eliminated, the border should remain black.  

The CHAMP column is a similar situation, but with much fewer situations to consider.  
K2 - will have the Champ if the game has been played. If it is blank, the game hasn't been played.  
If the Champ has been determined (based k2 being populated) then:  
- If the bracket pick matches the winner, the square should be shaded green and the border should be heavy green.  
- If the bracket pick does not match the winner, the square should be shaded red and the border should be heavy red.  
If the Champ has not been determined (based K2 not being populated) then:  
- If the bracket pick has already been eliminated, the square should be shaded red and the border should be heavy red.  
- If the bracket pick has not already been eliminated, the square should remain unshaded with no heavy border.  

---

## Clarifications captured in this doc (no change to your intent)

1. **“Row 2”** means the **KEY** row (E2–K2), not player rows.  
2. **Finalist border** applies only to the **two** teams picked to win the Final Four games; the other two regional cells do not get finalist border styling.  
3. **“Black”** pending borders are implemented as a **heavy neutral ring** (`ring-gray-900`) in the standings `TeamLogo` helper.  
4. **Elimination table:** **O2 = `Team`** header; **O3–O66** always filled in the sheet. That aligns with `parseStandingsCSV` in `standingsData.ts`, which reads column O from row 2 onward; no parser change is required.
