// Team reference data from Google Sheets
// Fetches team abbreviations and ESPN IDs from the RefData tab

export interface TeamRefData {
  abbr: string;
  id: string;
}


// Cache for team reference data
let cachedTeamData: TeamRefData[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch team reference data from Google Sheets
 */
export async function getTeamRefData(): Promise<TeamRefData[]> {
  const startTime = performance.now();
  console.log(`🏈 getTeamRefData started at ${startTime.toFixed(2)}ms`);
  
  // Check cache first
  const now = Date.now();
  if (cachedTeamData && (now - lastFetchTime) < CACHE_DURATION) {
    const cacheTime = performance.now() - startTime;
    console.log(`⚡ Using cached team reference data in ${cacheTime.toFixed(2)}ms`);
    return cachedTeamData;
  }

  // Temporarily use fallback data due to Google Sheets fetch issues
  // TODO: Fix Google Sheets access and re-enable fetch
  console.log('📋 Using fallback team reference data (Google Sheets temporarily disabled)');
  const fallbackStart = performance.now();
  const fallbackData = getFallbackTeamData();
  const fallbackEnd = performance.now();
  console.log(`📋 Fallback data generated in ${(fallbackEnd - fallbackStart).toFixed(2)}ms`);
  
  cachedTeamData = fallbackData;
  lastFetchTime = now;
  
  const totalTime = performance.now() - startTime;
  console.log(`✅ Team reference data ready in ${totalTime.toFixed(2)}ms`);
  return fallbackData;

  /* 
  // Commented out due to fetch issues - need to investigate Google Sheets access
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${TEAM_REF_SHEET_ID}/export?format=csv&gid=0`;
    
    console.log('Fetching team reference data from:', csvUrl);
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
      },
    });
    
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      throw new Error(`Failed to fetch team reference data: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log('CSV response length:', csvText.length);
    console.log('CSV preview:', csvText.substring(0, 500));
    
    const teamData = parseTeamRefCSV(csvText);
    console.log('Parsed team data count:', teamData.length);
    console.log('First 10 teams:', teamData.slice(0, 10));
    console.log('Looking for specific teams:');
    console.log('UConn:', teamData.find(t => t.abbr === 'UConn'));
    console.log('UNC:', teamData.find(t => t.abbr === 'UNC'));
    console.log('UK:', teamData.find(t => t.abbr === 'UK'));
    console.log('Tenn:', teamData.find(t => t.abbr === 'Tenn'));
    
    // Update cache
    cachedTeamData = teamData;
    lastFetchTime = now;
    
    return teamData;
  } catch (error) {
    console.error('Error fetching team reference data:', error);
    console.log('Falling back to static team data');
    // Return fallback data if fetch fails
    const fallbackData = getFallbackTeamData();
    cachedTeamData = fallbackData;
    lastFetchTime = now;
    return fallbackData;
  }
  */
}

/**
 * Parse CSV data into team reference entries
 */
function parseTeamRefCSV(csvText: string): TeamRefData[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const teamData: TeamRefData[] = [];
  
  console.log('Total lines in CSV:', lines.length);
  console.log('First few lines:', lines.slice(0, 3));
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = parseCSVLine(line);
    if (i <= 10) { // Only log first 10 rows to avoid spam
      console.log(`Row ${i}:`, columns);
    }
    
    if (columns.length >= 3) {
      try {
        const team: TeamRefData = {
          abbr: columns[1] || '', // Column B (Abbr)
          id: columns[2] || ''    // Column C (ID)
        };
        
        // Only add if both abbr and id are present
        if (team.abbr && team.id) {
          teamData.push(team);
          if (i <= 10) { // Only log first 10 teams to avoid spam
            console.log(`Added team: ${team.abbr} -> ${team.id}`);
          }
        } else {
          if (i <= 10) { // Only log first 10 skips to avoid spam
            console.log(`Skipped row ${i}: missing abbr or id`, team);
          }
        }
      } catch (error) {
        console.warn('Error parsing team reference row:', line, error);
      }
    } else {
      if (i <= 10) { // Only log first 10 skips to avoid spam
        console.log(`Skipped row ${i}: not enough columns`, columns);
      }
    }
  }
  
  return teamData;
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
 * Get team ID by abbreviation
 */
export async function getTeamIdByAbbr(abbr: string): Promise<string | null> {
  try {
    const teamData = await getTeamRefData();
    const team = teamData.find(t => t.abbr === abbr);
    return team ? team.id : null;
  } catch (error) {
    console.error(`Error getting team ID for ${abbr}:`, error);
    return null;
  }
}

/**
 * Fallback team data if Google Sheets is unavailable
 */
function getFallbackTeamData(): TeamRefData[] {
  return [
    // Common tournament teams - CORRECTED MAPPINGS from Google Sheet
    { abbr: 'UConn', id: '41' },      // Connecticut Huskies
    { abbr: 'UNC', id: '153' },       // North Carolina Tar Heels  
    { abbr: 'UK', id: '96' },         // Kentucky Wildcats
    { abbr: 'KU', id: '2305' },       // Kansas Jayhawks
    { abbr: 'Tenn', id: '2633' },     // Tennessee Volunteers
    { abbr: 'Duke', id: '150' },      // Duke Blue Devils
    { abbr: 'Purd', id: '2509' },     // Purdue Boilermakers
    { abbr: 'Hou', id: '248' },       // Houston Cougars
    { abbr: 'Cre', id: '228' },       // Creighton Bluejays
    { abbr: 'IoSt', id: '66' },       // Iowa State Cyclones
    { abbr: 'Zona', id: '12' },       // Arizona Wildcats
    { abbr: 'MicSt', id: '127' },     // Michigan State Spartans
    { abbr: 'Fla', id: '57' },        // Florida Gators
    { abbr: 'Bama', id: '333' },      // Alabama Crimson Tide
    { abbr: 'NCSt', id: '152' },      // NC State Wolfpack
    { abbr: 'Gonz', id: '2250' },     // Gonzaga Bulldogs
    { abbr: 'Marq', id: '269' },      // Marquette Golden Eagles
    { abbr: 'Bylr', id: '239' },      // Baylor Bears
    { abbr: 'Ill', id: '356' },       // Illinois Fighting Illini
    { abbr: 'Clem', id: '228' },      // Clemson Tigers
    { abbr: 'Wisc', id: '275' },      // Wisconsin Badgers
    { abbr: 'SoCar', id: '2579' },    // South Carolina Gamecocks
    { abbr: 'Ore', id: '2483' },      // Oregon Ducks
    { abbr: 'Neb', id: '158' },       // Nebraska Cornhuskers
    { abbr: 'WaSt', id: '2655' },     // Washington State Cougars
    { abbr: 'StMary', id: '2608' },   // Saint Mary's Gaels
    
    // Teams from Google Sheet
    { abbr: 'AA', id: '1' },          // Alaska Anchorage Seawolves
    { abbr: 'Aub', id: '2' },         // Auburn Tigers
    { abbr: 'UAB', id: '5' },         // UAB Blazers
    { abbr: 'SAla', id: '6' },        // South Alabama Jaguars
    { abbr: 'Ark', id: '8' },         // Arkansas Razorbacks
    { abbr: 'ArizSt', id: '9' },      // Arizona State Sun Devils
    { abbr: 'Ariz', id: '12' },       // Arizona Wildcats
    { abbr: 'SDSU', id: '21' },       // San Diego State Aztecs
    { abbr: 'Stan', id: '24' },       // Stanford Cardinal
    { abbr: 'UCLA', id: '26' },       // UCLA Bruins
    { abbr: 'USC', id: '30' },        // USC Trojans
    { abbr: 'ColoSt', id: '36' },     // Colorado State Rams
    { abbr: 'Colo', id: '38' },       // Colorado Buffaloes
    { abbr: 'Cal', id: '25' },        // California Golden Bears
    { abbr: 'FlaSt', id: '52' },      // Florida State Seminoles
    { abbr: 'GaTech', id: '59' },     // Georgia Tech Yellow Jackets
    { abbr: 'Ind', id: '84' },        // Indiana Hoosiers
    { abbr: 'ND', id: '87' },         // Notre Dame Fighting Irish
    { abbr: 'LSU', id: '99' },        // LSU Tigers
    { abbr: 'Ariz', id: '12' },       // Arizona Wildcats
    { abbr: 'BYU', id: '252' },       // BYU Cougars
    { abbr: 'Iowa', id: '2294' },     // Iowa Hawkeyes
    { abbr: 'KSU', id: '2306' },      // Kansas State Wildcats
    { abbr: 'Miami', id: '2390' },    // Miami Hurricanes
    { abbr: 'Mich', id: '130' },      // Michigan Wolverines
    { abbr: 'Minn', id: '135' },      // Minnesota Golden Gophers
    { abbr: 'Miss', id: '145' },      // Ole Miss Rebels
    { abbr: 'MissSt', id: '344' },    // Mississippi State Bulldogs
    { abbr: 'Mizzou', id: '142' },    // Missouri Tigers
    { abbr: 'Nev', id: '2440' },      // Nevada Wolf Pack
    { abbr: 'NMex', id: '167' },      // New Mexico Lobos
    { abbr: 'OhioSt', id: '194' },    // Ohio State Buckeyes
    { abbr: 'Okla', id: '201' },      // Oklahoma Sooners
    { abbr: 'OkSt', id: '197' },      // Oklahoma State Cowboys
    { abbr: 'OreSt', id: '204' },     // Oregon State Beavers
    { abbr: 'PennSt', id: '213' },    // Penn State Nittany Lions
    { abbr: 'Pitt', id: '221' },      // Pittsburgh Panthers
    { abbr: 'Rut', id: '164' },       // Rutgers Scarlet Knights
    { abbr: 'Syra', id: '183' },      // Syracuse Orange
    { abbr: 'TCU', id: '2628' },      // TCU Horned Frogs
    { abbr: 'Tex', id: '251' },       // Texas Longhorns
    { abbr: 'TexA&M', id: '245' },    // Texas A&M Aggies
    { abbr: 'Utah', id: '254' },      // Utah Utes
    { abbr: 'UtahSt', id: '328' },    // Utah State Aggies
    { abbr: 'Vandy', id: '238' },     // Vanderbilt Commodores
    { abbr: 'Vill', id: '222' },      // Villanova Wildcats
    { abbr: 'VT', id: '259' },        // Virginia Tech Hokies
    { abbr: 'Wash', id: '264' },      // Washington Huskies
    { abbr: 'WVU', id: '277' },       // West Virginia Mountaineers
    { abbr: 'Xav', id: '2752' },      // Xavier Musketeers
    
    // Additional teams from Google Sheet
    { abbr: 'GeoSt', id: '2247' },    // Georgia State Panthers
    { abbr: 'GCU', id: '2253' },      // Grand Canyon Lopes
    { abbr: 'Lib', id: '2335' },      // Liberty Flames
    
    // Common alternative abbreviations
    { abbr: 'Conn', id: '41' },       // Connecticut Huskies
    { abbr: 'NC', id: '153' },        // North Carolina Tar Heels
    { abbr: 'Kent', id: '96' },       // Kentucky Wildcats
    { abbr: 'Kansas', id: '2305' },   // Kansas Jayhawks
    { abbr: 'Tennessee', id: '2633' }, // Tennessee Volunteers
    { abbr: 'Arizona', id: '12' },    // Arizona Wildcats
    { abbr: 'Florida', id: '57' },    // Florida Gators
    { abbr: 'Alabama', id: '333' },   // Alabama Crimson Tide
    { abbr: 'Auburn', id: '2' },      // Auburn Tigers
    { abbr: 'Arkansas', id: '8' },    // Arkansas Razorbacks
    { abbr: 'Houston', id: '248' },   // Houston Cougars
    { abbr: 'Creighton', id: '228' }, // Creighton Bluejays
    { abbr: 'Iowa State', id: '66' }, // Iowa State Cyclones
    { abbr: 'Michigan State', id: '127' }, // Michigan State Spartans
    { abbr: 'Gonzaga', id: '2250' },  // Gonzaga Bulldogs
    { abbr: 'Marquette', id: '269' }, // Marquette Golden Eagles
    { abbr: 'Baylor', id: '239' },    // Baylor Bears
    { abbr: 'Illinois', id: '356' },  // Illinois Fighting Illini
    { abbr: 'Clemson', id: '228' },   // Clemson Tigers
    { abbr: 'Wisconsin', id: '275' }, // Wisconsin Badgers
    { abbr: 'South Carolina', id: '2579' }, // South Carolina Gamecocks
    { abbr: 'Oregon', id: '2483' },   // Oregon Ducks
    { abbr: 'Nebraska', id: '158' },  // Nebraska Cornhuskers
    { abbr: 'Washington State', id: '2655' }, // Washington State Cougars
    { abbr: 'Saint Mary\'s', id: '2608' }, // Saint Mary's Gaels
    { abbr: 'St Mary\'s', id: '2608' }, // Saint Mary's Gaels
    { abbr: 'St. Mary\'s', id: '2608' } // Saint Mary's Gaels
  ];
}
