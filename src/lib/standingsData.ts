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
    
    const entries = parseStandingsCSV(csvText);
    const parseEnd = performance.now();
    console.log(`🔍 CSV parsing completed in ${(parseEnd - parseStart).toFixed(2)}ms`);
    
    const standingsData: StandingsData = {
      day,
      entries,
      lastUpdated: new Date().toISOString()
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
function parseStandingsCSV(csvText: string): StandingsEntry[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const entries: StandingsEntry[] = [];
  
  // Skip header rows (first 2 rows are headers)
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
  
  return entries;
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
 * Fallback standings data when Google Sheets is unavailable
 */
function getFallbackStandingsData(day: string): StandingsData {
  return {
    day,
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
