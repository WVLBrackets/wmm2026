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
 * Fetch standings data from Google Sheets for a specific day
 */
export async function getStandingsData(day: string = 'Day1'): Promise<StandingsData> {
  const startTime = performance.now();
  console.log(`📊 getStandingsData started for ${day} at ${startTime.toFixed(2)}ms`);
  
  // Check cache first
  const cached = standingsCache.get(day);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    const cacheTime = performance.now() - startTime;
    console.log(`⚡ Using cached standings data for ${day} in ${cacheTime.toFixed(2)}ms`);
    return cached.data;
  }

  try {
    // Use the original working URL format
    const sheetName = encodeURIComponent(day);
    const csvUrl = `https://docs.google.com/spreadsheets/d/${STANDINGS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
    
    console.log(`🌐 Fetching standings data for ${day} from:`, csvUrl);
    const fetchStart = performance.now();
    
    const response = await fetch(csvUrl);
    const fetchEnd = performance.now();
    console.log(`📡 Fetch completed in ${(fetchEnd - fetchStart).toFixed(2)}ms`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch standings data: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const parseStart = performance.now();
    console.log(`📄 Standings CSV response length: ${csvText.length}`);
    console.log(`📄 Standings CSV preview:`, csvText.substring(0, 200));
    
        const { entries, quarterfinalWinners, semifinalWinners, semifinalKey, finalWinner, eliminatedTeams } = parseStandingsCSV(csvText);
    const parseEnd = performance.now();
    console.log(`🔍 CSV parsing completed in ${(parseEnd - parseStart).toFixed(2)}ms`);
    console.log(`📊 Quarterfinal Winners: ${quarterfinalWinners.join(', ')}`);
    console.log(`📊 Semifinal Winners: ${semifinalWinners.join(', ')}`);
    console.log(`📊 Final Winner: ${finalWinner}`);
    console.log(`📊 Eliminated Teams: ${eliminatedTeams.join(', ')}`);
    
        const standingsData: StandingsData = {
          day,
          entries,
          lastUpdated: new Date().toISOString(),
          quarterfinalWinners,
          semifinalWinners,
          semifinalKey,
          finalWinner,
          eliminatedTeams
        };
    
    // Cache the result
    standingsCache.set(day, { data: standingsData, timestamp: Date.now() });
    
    const totalTime = performance.now() - startTime;
    console.log(`✅ Loaded ${entries.length} standings entries for ${day} in ${totalTime.toFixed(2)}ms`);
    return standingsData;
  } catch (error) {
    console.error('Error fetching standings data:', error);
    console.log('Falling back to fallback data for', day);
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
  
  // Extract Column O (Out) - eliminated teams from row 2 (Key row)
  const eliminatedTeams: string[] = [];
  if (keyRow.length > 14) { // Column O is index 14
    const outTeam = keyRow[14]?.trim();
    if (outTeam && outTeam !== '') {
      // Split by comma if multiple teams are listed
      const teams = outTeam.split(',').map(team => team.trim()).filter(team => team !== '');
      eliminatedTeams.push(...teams);
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
    
    // Generate days based on the number of tabs
    for (let i = numberOfTabs; i >= 1; i--) {
      days.push(`Day${i}`);
    }
    
    return days;
  } catch (error) {
    console.error('Error getting available days:', error);
    // Fallback to 2 days
    return ['Day2', 'Day1'];
  }
}

/**
 * Get the current tournament year
 */
export function getCurrentTournamentYear(): string {
  // For now, return 2025. In the future, this could be dynamic
  return '2025';
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
  console.log(`🔍 Quarterfinal color check for "${team}":`);
  console.log(`  - Quarterfinal winners: [${quarterfinalWinners.join(', ')}]`);
  console.log(`  - Eliminated teams: [${eliminatedTeams.join(', ')}]`);
  
  // PRIORITY: If there are quarterfinal results, use those (winners override eliminated status)
  if (quarterfinalWinners.length > 0) {
    if (quarterfinalWinners.includes(team)) {
      console.log(`  - Result: CORRECT (team matches quarterfinal winner)`);
      return 'correct';
    } else {
      console.log(`  - Result: INCORRECT (team doesn't match quarterfinal winners)`);
      return 'incorrect';
    }
  }
  
  // If no quarterfinal results yet, check if team is eliminated
  if (eliminatedTeams.includes(team)) {
    console.log(`  - Result: INCORRECT (team is eliminated)`);
    return 'incorrect';
  }
  
  // No results yet and team not eliminated, neutral
  console.log(`  - Result: NEUTRAL (no results yet)`);
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
  console.log(`🔍 Semifinal color check for "${team}":`);
  console.log(`  - Semifinal winners: [${semifinalWinners.join(', ')}]`);
  console.log(`  - Semifinal key: [${semifinalKey.join(', ')}]`);
  console.log(`  - Eliminated teams: [${eliminatedTeams.join(', ')}]`);
  
  // Check if this team's semifinal game has been played (non-blank in KEY)
  const teamSemifinalPlayed = semifinalKey.includes(team);
  
  if (teamSemifinalPlayed) {
    // Team's semifinal has been played - check if they won
    if (semifinalWinners.includes(team)) {
      console.log(`  - Result: CORRECT (team won their semifinal)`);
      return 'correct';
    } else {
      console.log(`  - Result: INCORRECT (team lost their semifinal)`);
      return 'incorrect';
    }
  } else {
    // Team's semifinal hasn't been played yet
    if (eliminatedTeams.includes(team)) {
      console.log(`  - Result: INCORRECT (team is eliminated)`);
      return 'incorrect';
    } else {
      console.log(`  - Result: NEUTRAL (semifinal not played yet)`);
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
    ],
    lastUpdated: new Date().toISOString()
  };
}
