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
}

export interface StandingsData {
  day: string;
  entries: StandingsEntry[];
  lastUpdated: string;
  sheetLastModified?: string; // Actual Google Sheet modification time
  quarterfinalWinners?: string[]; // Col E-H: Quarterfinal winners (Final Four)
  semifinalWinners?: string[]; // Col I-J: Semifinal winners (Finals)
  semifinalKey?: string[]; // Col I-J: Raw KEY values (including blanks)
  finalWinner?: string; // Col K: Final winner (Champion)
  eliminatedTeams?: string[]; // Column O: Teams that are out
}

const STANDINGS_SHEET_ID = '12c8VEI6ZoIhRXg8b0rEfYWAOI86Ye_ZPY9G1sPaBRFs';

// Cache for standings data to improve performance
const standingsCache = new Map<string, { data: StandingsData; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache

/**
 * Get the last modified time from the Google Sheet
 * This reads a timestamp from cell A1 that should be updated when data changes
 */
async function getSheetLastModified(day: string): Promise<string | null> {
  try {
    // Read from cell A1 which should contain the last modified timestamp
    const timestampUrl = `https://docs.google.com/spreadsheets/d/${STANDINGS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(day)}&range=A1`;
    
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
  
  // Check cache first
  const cached = standingsCache.get(day);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Convert "Day1" to "Day 1", "Day2" to "Day 2", etc.
    // But don't modify "Final" - it should stay as "Final"
    const sheetName = day === 'Final' ? 'Final' : day.replace(/^Day(\d+)$/, 'Day $1');
    const encodedSheetName = encodeURIComponent(sheetName);
    const csvUrl = `https://docs.google.com/spreadsheets/d/${STANDINGS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch standings data: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const { entries, quarterfinalWinners, semifinalWinners, semifinalKey, finalWinner, eliminatedTeams } = parseStandingsCSV(csvText);
    
    // Get the sheet's last modified time
    const sheetLastModified = await getSheetLastModified(day);
    
        const standingsData: StandingsData = {
          day,
          entries,
          lastUpdated: new Date().toISOString(),
          sheetLastModified: sheetLastModified || new Date().toISOString(),
          quarterfinalWinners,
          semifinalWinners,
          semifinalKey,
          finalWinner,
          eliminatedTeams
        };
    
    // Cache the result
    standingsCache.set(day, { data: standingsData, timestamp: Date.now() });
    
    const totalTime = performance.now() - startTime;
    console.log(`[Performance] Standings data loaded: ${totalTime.toFixed(2)}ms (${entries.length} entries)`);
    return standingsData;
  } catch (error) {
    console.error('[Standings] Error fetching standings data:', error);
    // Return fallback data
    return getFallbackStandingsData(day);
  }
}

/**
 * Parse CSV data into standings entries
 */
function parseStandingsCSV(csvText: string): { entries: StandingsEntry[]; quarterfinalWinners: string[]; semifinalWinners: string[]; semifinalKey: string[]; finalWinner: string; eliminatedTeams: string[] } {
  const lines = csvText.split('\n').filter(line => line.trim());
  const entries: StandingsEntry[] = [];
  
  // Extract Row 2 (Key) - actual tournament winners
  const keyRow = lines[1] ? parseCSVLine(lines[1]) : [];
  
  // Extract specific columns from Key row
  // Col E-H (indices 4-7): Quarterfinal winners (Final Four)
  const quarterfinalWinners = [
    keyRow[4]?.trim() || '',
    keyRow[5]?.trim() || '',
    keyRow[6]?.trim() || '',
    keyRow[7]?.trim() || ''
  ].filter(team => team !== '');
  
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
  
  return { entries, quarterfinalWinners, semifinalWinners, semifinalKey, finalWinner, eliminatedTeams };
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
  try {
    // Import the site config to get the number of standings tabs
    const { getSiteConfig } = await import('@/config/site');
    const siteConfig = await getSiteConfig();
    
    const numberOfTabs = siteConfig.standingsTabs || 2;
    const days: string[] = [];
    
    // First, check if "Final" tab exists and add it as the first option
    try {
      const finalUrl = `https://docs.google.com/spreadsheets/d/${STANDINGS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Final`;
      const finalResponse = await fetch(finalUrl);
      if (finalResponse.ok) {
        days.push('Final');
      }
    } catch {
      // Final tab not found, continue without it
    }
    
    // Generate days in descending order (Day 9, Day 8, etc.)
    // Cap at Day 9 since there's no Day 10
    const maxDay = Math.min(numberOfTabs, 9);
    for (let i = maxDay; i >= 1; i--) {
      days.push(`Day${i}`);
    }
    
    return days;
  } catch (error) {
    console.error('Error getting available days:', error);
    // Fallback to Final + Day 9, Day 8, etc.
    return ['Final', 'Day9', 'Day8', 'Day7', 'Day6', 'Day5', 'Day4', 'Day3', 'Day2', 'Day1'];
  }
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

/**
 * Color coding logic for quarterfinals (Final Four backgrounds)
 */
export function getQuarterfinalColor(
  team: string,
  quarterfinalWinners: string[],
  eliminatedTeams: string[]
): 'correct' | 'incorrect' | 'neutral' {
  // PRIORITY: If there are quarterfinal results, use those (winners override eliminated status)
  if (quarterfinalWinners.length > 0) {
    if (quarterfinalWinners.includes(team)) {
      return 'correct';
    } else {
      return 'incorrect';
    }
  }
  
  // If no quarterfinal results yet, check if team is eliminated
  if (eliminatedTeams.includes(team)) {
    return 'incorrect';
  }

  // No results yet and team not eliminated, neutral
  return 'neutral';
}

/**
 * Color coding logic for semifinals (Final Four borders)
 */
export function getSemifinalColor(
  team: string,
  semifinalWinners: string[],
  semifinalKey: string[],
  eliminatedTeams: string[]
): 'correct' | 'incorrect' | 'neutral' {
  // Check if this team's semifinal game has been played (non-blank in KEY)
  const teamSemifinalPlayed = semifinalKey.includes(team);
  
  if (teamSemifinalPlayed) {
    // Team's semifinal has been played - check if they won
    if (semifinalWinners.includes(team)) {
      return 'correct';
    } else {
      return 'incorrect';
    }
  } else {
    // Team's semifinal hasn't been played yet
    if (eliminatedTeams.includes(team)) {
      return 'incorrect';
    } else {
      return 'neutral';
    }
  }
}

/**
 * Color coding logic for finals (Champion background and border)
 */
export function getFinalColor(
  team: string,
  finalWinner: string,
  eliminatedTeams: string[]
): 'correct' | 'incorrect' | 'neutral' {
  // If team is eliminated, it's incorrect
  if (eliminatedTeams.includes(team)) {
    return 'incorrect';
  }
  
  // If there is a final result and team matches, it's correct
  if (finalWinner && finalWinner === team) {
    return 'correct';
  }
  
  // If there is a final result but team doesn't match, it's incorrect
  if (finalWinner && finalWinner !== team) {
    return 'incorrect';
  }
  
  // No result yet and team not eliminated, neutral
  return 'neutral';
}

/**
 * Fallback standings data when Google Sheets is unavailable
 */
function getFallbackStandingsData(day: string): StandingsData {
  return {
    day,
    lastUpdated: new Date().toISOString(),
    sheetLastModified: new Date().toISOString(),
    quarterfinalWinners: [], // No quarterfinal winners in fallback
    semifinalWinners: [], // No semifinal winners in fallback
    semifinalKey: ['', ''], // No semifinal results in fallback
    finalWinner: '', // No final winner in fallback
    eliminatedTeams: [], // No eliminated teams in fallback
    entries: [
      {
        rank: 1,
        player: 'Utes_1',
        points: 56,
        tbDiff: 0,
        finalFour: ['UConn', 'UNC', 'UK', 'Tenn'],
        finals: ['UNC', 'UK'],
        champion: 'UNC',
        tb: 150,
        paid: true
      },
      {
        rank: 2,
        player: 'Kyle Glossy',
        points: 55,
        tbDiff: 1,
        finalFour: ['UConn', 'UNC', 'Duke', 'Purd'],
        finals: ['UConn', 'Purd'],
        champion: 'Purd',
        tb: 145,
        paid: true
      },
      {
        rank: 2,
        player: 'Peter Bernstein 2',
        points: 55,
        tbDiff: 1,
        finalFour: ['UConn', 'UNC', 'Hou', 'Cre'],
        finals: ['UConn', 'Hou'],
        champion: 'Hou',
        tb: 139,
        paid: true
      }
    ]
  };
}
