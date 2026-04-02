export interface StandingsEntry {
  rank: number;
  player: string;
  points: number;
  tbDiff: number;
  finalFour: string[];
  finals: string[];
  champion: string;
  tb: number;
  paid: boolean;
  /** Pool bracket id (live standings); daily sheet rows omit this and use resolve-bracket API. */
  bracketId?: string;
}

/** Row 2 KEY cells E–H: actual regional champs (TL, BL, TR, BR). Blanks mean game not final yet. */
export type RegionalChampionKeyRow = [string, string, string, string];

export interface StandingsData {
  day: string;
  entries: StandingsEntry[];
  lastUpdated: string;
  sheetLastModified?: string; // Actual Google Sheet modification time
  quarterfinalWinners?: string[]; // Col E-H: non-empty regional champs only (legacy / summaries)
  /** E2,F2,G2,H2 with blanks preserved — drives per-region Daily Standings shading. */
  regionalChampionKey?: RegionalChampionKeyRow;
  semifinalWinners?: string[]; // Col I-J: Semifinal winners (Finals)
  semifinalKey?: string[]; // Col I-J: Raw KEY values (including blanks)
  finalWinner?: string; // Col K: Final winner (Champion)
  eliminatedTeams?: string[]; // Column O: Teams that are out (P = TRUE)
  /**
   * True when KEY L2 holds a non-zero numeric tie-break total: Pts column shows differential (col D)
   * and sort uses tbDiff after points. Blank, `0`, or non-numeric L2 → show pick TB (col L); same
   * points share rank (no tbDiff ordering).
   */
  keyTieBreakerPopulated?: boolean;
}

// Cache for standings data to improve performance
const standingsCache = new Map<string, { data: StandingsData; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache

/**
 * Resolve the Google Spreadsheet ID for standings (see docs/SETUP_GUIDE.md).
 *
 * Priority:
 * 1. `STANDINGS_SHEET_ID` — optional override (useful for `.env.local`)
 * 2. Production (`VERCEL_ENV === 'production'`): `STANDINGS_SHEET_ID_PROD` (required)
 * 3. Staging / preview: `STANDINGS_SHEET_ID_STAGE` (required on Vercel preview)
 * 4. Local `next dev` only (`NODE_ENV === 'development'`): if stage is unset but
 *    `STANDINGS_SHEET_ID_PROD` is set, use prod sheet with a console warning
 */
function getStandingsSheetId(): string {
  const override = process.env.STANDINGS_SHEET_ID?.trim();
  if (override) {
    return override;
  }

  const isVercelProduction = process.env.VERCEL_ENV === 'production';
  const prod = process.env.STANDINGS_SHEET_ID_PROD?.trim();
  const stage = process.env.STANDINGS_SHEET_ID_STAGE?.trim();

  if (isVercelProduction) {
    if (!prod) {
      throw new Error('Missing required environment variable: STANDINGS_SHEET_ID_PROD');
    }
    return prod;
  }

  if (stage) {
    return stage;
  }

  const isLocalNextDev =
    process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production';

  if (isLocalNextDev && prod) {
    console.warn(
      '[standings] STANDINGS_SHEET_ID_STAGE is not set; using STANDINGS_SHEET_ID_PROD for local development. ' +
        'Add STANDINGS_SHEET_ID_STAGE or STANDINGS_SHEET_ID to .env.local to use a different sheet.'
    );
    return prod;
  }

  throw new Error(
    'Missing standings Google Sheet id. Set STANDINGS_SHEET_ID_STAGE (staging / Vercel preview), ' +
      'or STANDINGS_SHEET_ID to force a specific sheet, ' +
      'or for local dev only set STANDINGS_SHEET_ID_PROD to reuse the prod standings sheet. ' +
      'See docs/SETUP_GUIDE.md.'
  );
}

/**
 * Get the last modified time from the Google Sheet
 * This reads a timestamp from cell A1 that should be updated when data changes
 */
async function getSheetLastModified(day: string): Promise<string | null> {
  try {
    const sheetId = getStandingsSheetId();
    // Read from cell A1 which should contain the last modified timestamp
    const timestampUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(day)}&range=A1`;
    
    const response = await fetch(timestampUrl);
    if (response.ok) {
      const timestampText = await response.text();
      const timestamp = timestampText.trim();
      
      // If the cell contains a valid timestamp, use it
      if (timestamp && timestamp !== '' && !timestamp.includes('Error')) {
        return timestamp;
      }
    }
    
    return new Date().toISOString();
  } catch (error) {
    console.warn('Error fetching sheet modification time:', error);
    return new Date().toISOString();
  }
}

/**
 * Fetch standings data from Google Sheets for a specific day
 */
export async function getStandingsData(day: string = 'Day1'): Promise<StandingsData> {
  const startTime = performance.now();
  const sheetId = getStandingsSheetId();
  const cacheKey = `${sheetId}:${day}`;
  
  // Check cache first
  const cached = standingsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  // Convert "Day1" to "Day 1", "Day2" to "Day 2", etc.
  // But don't modify "Final" - it should stay as "Final"
  const sheetName = day === 'Final' ? 'Final' : day.replace(/^Day(\d+)$/, 'Day $1');
  const encodedSheetName = encodeURIComponent(sheetName);
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
  
  const response = await fetch(csvUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch standings data: ${response.status} ${response.statusText}`);
  }
  
  const csvText = await response.text();
  const {
    entries,
    quarterfinalWinners,
    regionalChampionKey,
    semifinalWinners,
    semifinalKey,
    finalWinner,
    eliminatedTeams,
    keyTieBreakerPopulated,
  } = parseStandingsCSV(csvText);
  
  // Get the sheet's last modified time
  const sheetLastModified = await getSheetLastModified(day);
  
  const standingsData: StandingsData = {
    day,
    entries,
    lastUpdated: new Date().toISOString(),
    sheetLastModified: sheetLastModified || new Date().toISOString(),
    quarterfinalWinners,
    regionalChampionKey,
    semifinalWinners,
    semifinalKey,
    finalWinner,
    eliminatedTeams,
    keyTieBreakerPopulated,
  };
  
  // Cache the result
  standingsCache.set(cacheKey, { data: standingsData, timestamp: Date.now() });
  
  const totalTime = performance.now() - startTime;
  console.log(`[Performance] Standings data loaded: ${totalTime.toFixed(2)}ms (${entries.length} entries)`);
  return standingsData;
}

/**
 * Sort standings for display and assign ranks (1,1,3…). When `keyTieBreakerPopulated`, break ties on
 * points using tbDiff ascending; otherwise same points share a rank (stable by player name).
 */
export function sortAndRankStandingsEntries(
  entries: StandingsEntry[],
  keyTieBreakerPopulated: boolean
): StandingsEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (keyTieBreakerPopulated) {
      const d = a.tbDiff - b.tbDiff;
      if (d !== 0) return d;
    }
    return a.player.localeCompare(b.player, undefined, { sensitivity: 'base' });
  });

  let currentRank = 1;
  return sorted.map((e, i) => {
    if (i > 0) {
      const p = sorted[i - 1];
      const sameGroup =
        e.points === p.points && (!keyTieBreakerPopulated || e.tbDiff === p.tbDiff);
      if (!sameGroup) currentRank = i + 1;
    }
    return { ...e, rank: currentRank };
  });
}

/**
 * Third line of the daily Pts column: bracket TB from column L unless KEY L2 is a non-zero number,
 * then differential from column D.
 */
export function formatStandingsTieBreakerDisplay(entry: StandingsEntry, data: StandingsData): string {
  if (data.keyTieBreakerPopulated) {
    return `TB: ${entry.tbDiff}`;
  }
  return `TB: ${entry.tb}`;
}

/**
 * True when KEY L2 has an entered tie-break total (non-zero number). Blank, `0`, or non-numeric
 * counts as not set.
 */
function isKeyL2TieBreakerActive(raw: string | undefined): boolean {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n !== 0;
}

/**
 * Parse CSV data into standings entries
 */
function parseStandingsCSV(csvText: string): {
  entries: StandingsEntry[];
  quarterfinalWinners: string[];
  regionalChampionKey: RegionalChampionKeyRow;
  semifinalWinners: string[];
  semifinalKey: string[];
  finalWinner: string;
  eliminatedTeams: string[];
  keyTieBreakerPopulated: boolean;
} {
  const lines = csvText.split('\n').filter(line => line.trim());
  const entries: StandingsEntry[] = [];
  
  // Extract Row 2 (Key) - actual tournament winners
  const keyRow = lines[1] ? parseCSVLine(lines[1]) : [];
  
  // Col E-H (indices 4-7): regional champions — keep blanks per slot (E=TL, F=BL, G=TR, H=BR)
  const regionalChampionKey: RegionalChampionKeyRow = [
    keyRow[4]?.trim() || '',
    keyRow[5]?.trim() || '',
    keyRow[6]?.trim() || '',
    keyRow[7]?.trim() || '',
  ];
  const quarterfinalWinners = regionalChampionKey.filter((team) => team !== '');
  
  // Col I-J (indices 8-9): Semifinal winners (Finals)
  const semifinalWinners = [
    keyRow[8]?.trim() || '',
    keyRow[9]?.trim() || ''
  ].filter(team => team !== '');
  
  // Col I-J (indices 8-9): Raw KEY values (including blanks)
  const semifinalKey = [
    keyRow[8]?.trim() || '',
    keyRow[9]?.trim() || ''
  ];
  
  // Col K (index 10): Final winner (Champion)
  const finalWinner = keyRow[10]?.trim() || '';

  // Col L (index 11) on KEY row: non-zero number → use TB differential (col D) + sort by tbDiff
  const keyTieBreakerPopulated = isKeyL2TieBreakerActive(keyRow[11]);

  // Extract eliminated teams using new logic: Column O (teams) + Column P (TRUE/FALSE)
  const eliminatedTeams: string[] = [];
  
  // Check rows starting from row 2 until we find a blank cell in Column O
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) { // Start from row 2 (0-indexed: 1)
    if (lines[rowIndex]) {
      const row = parseCSVLine(lines[rowIndex]);
      if (row.length > 15) { // Need both Column O (14) and Column P (15)
        const teamName = row[14]?.trim(); // Column O: Team name
        const isEliminated = row[15]?.trim().toUpperCase(); // Column P: TRUE/FALSE
        
        // If we hit a blank team name, stop parsing
        if (!teamName || teamName === '') {
          break;
        }
        
        // If Column P is TRUE, the team is eliminated
        if (isEliminated === 'TRUE') {
          eliminatedTeams.push(teamName);
        }
      }
    }
  }
  
  // Parse player entries starting from row 3
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = parseCSVLine(line);
    if (columns.length >= 8) {
      try {
        // Parse Final Four teams (columns 4, 5, 6, 7)
        const finalFourTeams = [
          columns[4] || '',
          columns[5] || '',
          columns[6] || '',
          columns[7] || ''
        ].filter(team => team && team.trim() !== '');
        
        // Parse Finals teams (columns 8, 9) - these are the last two Final Four teams
        const finalsTeams = [
          columns[8] || '',
          columns[9] || ''
        ].filter(team => team && team.trim() !== '');
        
        const entry: StandingsEntry = {
          rank: parseInt(columns[0]) || 0,
          player: columns[1] || '',
          points: parseInt(columns[2]) || 0,
          tbDiff: parseInt(columns[3]) || 0,
          finalFour: finalFourTeams,
          finals: finalsTeams,
          champion: columns[10] || '', // Champion is now column 10
          tb: parseInt(columns[11]) || 0, // TB is now column 11
          paid: columns[12]?.toUpperCase() === 'Y' // Paid is now column 12
        };
        entries.push(entry);
      } catch (error) {
        console.warn('Error parsing standings row:', line, error);
      }
    }
  }

  const rankedEntries = sortAndRankStandingsEntries(entries, keyTieBreakerPopulated);

  return {
    entries: rankedEntries,
    quarterfinalWinners,
    regionalChampionKey,
    semifinalWinners,
    semifinalKey,
    finalWinner,
    eliminatedTeams,
    keyTieBreakerPopulated,
  };
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Get available days/tabs from the standings sheet
 */
export async function getAvailableDays(): Promise<string[]> {
  const sheetId = getStandingsSheetId();
  // Import the site config to get the number of standings tabs
  const { getSiteConfig } = await import('@/config/site');
  const siteConfig = await getSiteConfig();
  
  const numberOfTabs = siteConfig.standingsTabs || 2;
  const days: string[] = [];
  
  // Business rule:
  // - standingsTabs = 10 => include Final + Day9..Day1
  // - standingsTabs != 10 => include DayN..Day1 only (no Final)
  const includeFinalTab = numberOfTabs === 10;
  if (includeFinalTab) {
    const finalUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Final`;
    const finalResponse = await fetch(finalUrl);
    if (finalResponse.ok) {
      days.push('Final');
    }
  }

  // Generate days in descending order:
  // - For 10 tabs, show 9..1
  // - For any other value, show N..1
  const maxDay = includeFinalTab ? 9 : numberOfTabs;
  for (let i = maxDay; i >= 1; i--) {
    days.push(`Day${i}`);
  }
  
  return days;
}

/**
 * Get the current tournament year from Google Sheets config
 */
export async function getCurrentTournamentYear(): Promise<string> {
  try {
    // Import the site config to get the tournament year
    const { getSiteConfig } = await import('@/config/site');
    const siteConfig = await getSiteConfig();
    
    return siteConfig.tournamentYear || '2025'; // Fallback to 2025 if not found
  } catch (error) {
    console.error('Error fetching tournament year from config:', error);
    return '2025'; // Fallback to 2025 on error
  }
}

/**
 * Clear standings cache - useful for testing or forcing refresh
 */
export function clearStandingsCache(): void {
  standingsCache.clear();
  console.log('Standings cache cleared');
}

/**
 * Get cache statistics for monitoring
 */
export function getStandingsCacheStats(): { size: number; entries: string[] } {
  return {
    size: standingsCache.size,
    entries: Array.from(standingsCache.keys())
  };
}

export type StandingsShade = 'correct' | 'incorrect' | 'neutral';

/** Border tone for heavy ring; `neutral` = black when game still pending but pick alive. */
export type StandingsBorderTone = 'correct' | 'incorrect' | 'neutral';

function isEliminated(team: string, eliminatedTeams: string[]): boolean {
  const t = team.trim();
  if (!t) return false;
  return eliminatedTeams.some((e) => e.trim() === t);
}

/**
 * Regional champ cell fill: compare player pick to one KEY cell (E/F/G/H). If blank, use elimination only.
 */
export function getRegionalChampionSquareShade(
  pick: string,
  keyCellWinner: string,
  eliminatedTeams: string[]
): StandingsShade {
  const p = pick.trim();
  if (!p) return 'neutral';
  const actual = keyCellWinner.trim();
  if (actual !== '') {
    return p === actual ? 'correct' : 'incorrect';
  }
  if (isEliminated(p, eliminatedTeams)) return 'incorrect';
  return 'neutral';
}

/**
 * Heavy border on finalist picks: one KEY cell (I or J) for that semi. `neutral` → black ring.
 */
export function getFinalistBorderTone(
  pick: string,
  keyCellWinner: string,
  eliminatedTeams: string[]
): StandingsBorderTone {
  const p = pick.trim();
  if (!p) return 'neutral';
  const actual = keyCellWinner.trim();
  if (actual !== '') {
    return p === actual ? 'correct' : 'incorrect';
  }
  if (isEliminated(p, eliminatedTeams)) return 'incorrect';
  return 'neutral';
}

export interface ChampionDisplayColors {
  shade: StandingsShade;
  /** `undefined` = no heavy border (pick still alive, K2 blank). */
  borderTone: StandingsBorderTone | undefined;
}

/**
 * Champ column: K2 populated → green/red fill + border; K2 blank → eliminated only red; else neutral + no heavy border.
 */
export function getChampionDisplayColors(
  pick: string,
  k2Winner: string,
  eliminatedTeams: string[]
): ChampionDisplayColors {
  const p = pick.trim();
  if (!p) return { shade: 'neutral', borderTone: undefined };
  const actual = k2Winner.trim();
  if (actual !== '') {
    const ok = p === actual;
    return {
      shade: ok ? 'correct' : 'incorrect',
      borderTone: ok ? 'correct' : 'incorrect',
    };
  }
  if (isEliminated(p, eliminatedTeams)) {
    return { shade: 'incorrect', borderTone: 'incorrect' };
  }
  return { shade: 'neutral', borderTone: undefined };
}

