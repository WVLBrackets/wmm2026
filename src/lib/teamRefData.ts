// Team reference data from Google Sheets
// Fetches team abbreviations and ESPN IDs from the RefData tab

export interface TeamRefData {
  abbr: string;
  id: string;
}

// Google Sheets configuration (currently using fallback data due to CORS)
// const TEAM_REF_SHEET_ID = '1qFjvpimsmilkuJT_zOn3IhidkqLpzbX8MRn1cQxjuHw';


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

  // Use fallback data for now - Google Sheets has CORS issues
  console.log('📋 Using fallback team reference data (Google Sheets has CORS issues)');
  const fallbackStart = performance.now();
  const fallbackData = getFallbackTeamData();
  const fallbackEnd = performance.now();
  console.log(`📋 Fallback data generated in ${(fallbackEnd - fallbackStart).toFixed(2)}ms`);
  
  // Log available team abbreviations for debugging
  console.log(`📋 Available team abbreviations (${fallbackData.length} total):`, 
    fallbackData.map(t => t.abbr).sort().join(', '));
  
  cachedTeamData = fallbackData;
  lastFetchTime = now;
  
  const totalTime = performance.now() - startTime;
  console.log(`✅ Team reference data ready in ${totalTime.toFixed(2)}ms`);
  return fallbackData;
}

/**
 * Parse CSV data into team reference entries (currently unused)
 */
/* function parseTeamRefCSV(csvText: string): TeamRefData[] {
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
} */

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
    if (!team) {
      console.warn(`⚠️ Team abbreviation not found: "${abbr}" - Please add to team reference data`);
    }
    return team ? team.id : null;
  } catch (error) {
    console.error(`Error getting team ID for ${abbr}:`, error);
    return null;
  }
}

/**
 * Get team ID by full team name (e.g., "Florida Gators" -> "57")
 */
export async function getTeamIdByName(teamName: string): Promise<string | null> {
  try {
    const teamData = await getTeamRefData();
    
    // First try exact match
    let team = teamData.find(t => t.abbr === teamName);
    if (team) {
      return team.id;
    }
    
    // Map common full team names to abbreviations
    const teamNameMap: { [key: string]: string } = {
      // Major teams
      'Florida Gators': 'Fla',
      'UConn Huskies': 'UConn', 
      'UConn': 'UConn',
      'Florida': 'Fla',
      'Gators': 'Fla',
      'North Carolina': 'UNC',
      'North Carolina Tar Heels': 'UNC',
      'Tar Heels': 'UNC',
      'UNC': 'UNC',
      'Duke': 'Duke',
      'Duke Blue Devils': 'Duke',
      'Blue Devils': 'Duke',
      'Kentucky': 'UK',
      'Kentucky Wildcats': 'UK',
      'Kansas': 'KU',
      'Kansas Jayhawks': 'KU',
      'Jayhawks': 'KU',
      'Arizona': 'Arizona',
      'Alabama': 'Alabama',
      'Auburn': 'Auburn',
      'Arkansas': 'Arkansas',
      'Tennessee': 'Tennessee',
      'Texas': 'Texas',
      'Texas A&M': 'TA&M',
      'Texas Tech': 'TTech',
      'Florida State': 'FlaSt',
      'Florida Atlantic': 'FAU',
      'Drake': 'DRK',
      'Gonzaga': 'Gonz',
      'Michigan State': 'MicSt',
      'Michigan State Spartans': 'MicSt',
      'Iowa State': 'IoSt',
      'NC State': 'NCSt',
      'Notre Dame': 'ND',
      'Indiana': 'Ind',
      'Georgia Tech': 'GaTech',
      'California': 'Cal',
      'Colorado': 'Colo',
      'Colorado State': 'ColoSt',
      
      // Additional major teams
      'Virginia Cavaliers': 'UVA',
      'Virginia': 'UVA',
      'Cavaliers': 'UVA',
      'Villanova Wildcats': 'Vill',
      'Villanova': 'Vill',
      'Michigan Wolverines': 'Michigan',
      'Michigan': 'Michigan',
      'Wolverines': 'Michigan',
      'Ohio State Buckeyes': 'OhioSt',
      'Ohio State': 'OhioSt',
      'Buckeyes': 'OhioSt',
      'Wisconsin Badgers': 'Wisconsin',
      'Wisconsin': 'Wisconsin',
      'Badgers': 'Wisconsin',
      'Purdue Boilermakers': 'Purdue',
      'Purdue': 'Purdue',
      'Boilermakers': 'Purdue',
      'Illinois Fighting Illini': 'Illinois',
      'Illinois': 'Illinois',
      'Fighting Illini': 'Illinois',
      'Iowa Hawkeyes': 'Iowa',
      'Iowa': 'Iowa',
      'Hawkeyes': 'Iowa',
      'Minnesota Golden Gophers': 'Minnesota',
      'Minnesota': 'Minnesota',
      'Golden Gophers': 'Minnesota',
      'Nebraska Cornhuskers': 'Nebraska',
      'Nebraska': 'Nebraska',
      'Cornhuskers': 'Nebraska',
      'Northwestern Wildcats': 'Northwestern',
      'Northwestern': 'Northwestern',
      'Penn State Nittany Lions': 'PennSt',
      'Penn State': 'PennSt',
      'Nittany Lions': 'PennSt',
      'Rutgers Scarlet Knights': 'Rutgers',
      'Rutgers': 'Rutgers',
      'Scarlet Knights': 'Rutgers',
      'Maryland Terrapins': 'Maryland',
      'Maryland': 'Maryland',
      'Terrapins': 'Maryland',
      'Louisville Cardinals': 'Louisville',
      'Louisville': 'Louisville',
      'Cardinals': 'Louisville',
      'Syracuse Orange': 'Syra',
      'Syracuse': 'Syra',
      'Orange': 'Syra',
      'Orangemen': 'Syra',
      'Syracuse Orangemen': 'Syra',
      'Pittsburgh Panthers': 'Pitt',
      'Pittsburgh': 'Pitt',
      'Boston College Eagles': 'BC',
      'Boston College': 'BC',
      'Clemson Tigers': 'Clemson',
      'Clemson': 'Clemson',
      'Georgia Bulldogs': 'Georgia',
      'Georgia': 'Georgia',
      'South Carolina Gamecocks': 'SCar',
      'South Carolina': 'SCar',
      'Gamecocks': 'SCar',
      'Missouri Tigers': 'Missouri',
      'Missouri': 'Missouri',
      'Ole Miss Rebels': 'Miss',
      'Ole Miss': 'Miss',
      'Rebels': 'Miss',
      'Mississippi State Bulldogs': 'MissSt',
      'Mississippi State': 'MissSt',
      'LSU Tigers': 'LSU',
      'LSU': 'LSU',
      'Oklahoma Sooners': 'Oklahoma',
      'Oklahoma': 'Oklahoma',
      'Oklahoma State Cowboys': 'OkSt',
      'Oklahoma State': 'OkSt',
      'Baylor Bears': 'Baylor',
      'Baylor': 'Baylor',
      'TCU Horned Frogs': 'TCU',
      'TCU': 'TCU',
      'Horned Frogs': 'TCU',
      'West Virginia Mountaineers': 'WVU',
      'West Virginia': 'WVU',
      'Kansas State Wildcats': 'KState',
      'Kansas State': 'KState',
      'Iowa State Cyclones': 'IoSt',
      'Oregon Ducks': 'Oregon',
      'Oregon': 'Oregon',
      'Oregon State Beavers': 'OregonSt',
      'Oregon State': 'OregonSt',
      'Washington Huskies': 'Washington',
      'Washington': 'Washington',
      'Washington State Cougars': 'WashSt',
      'Washington State': 'WashSt',
      'UCLA Bruins': 'UCLA',
      'UCLA': 'UCLA',
      'USC Trojans': 'USC',
      'USC': 'USC',
      'Stanford Cardinal': 'Stanford',
      'Stanford': 'Stanford',
      'California Golden Bears': 'Cal',
      'Utah Utes': 'Utah',
      'Utah': 'Utah',
      'Arizona State Sun Devils': 'ASU',
      'Arizona State': 'ASU',
      'Colorado Buffaloes': 'Colo',
      'Utah State Aggies': 'UtahSt',
      'Utah State': 'UtahSt',
      'San Diego State Aztecs': 'SDSU',
      'San Diego State': 'SDSU',
      'Boise State Broncos': 'BoiseSt',
      'Boise State': 'BoiseSt',
      'Nevada Wolf Pack': 'Nevada',
      'Nevada': 'Nevada',
      'UNLV Runnin Rebels': 'UNLV',
      'UNLV': 'UNLV',
      'New Mexico Lobos': 'NewMex',
      'New Mexico': 'NewMex',
      'Wyoming': 'Wyoming',
      'Air Force': 'AirForce',
      'Army': 'Army',
      'Navy': 'Navy',
      'Memphis Tigers': 'Memphis',
      'Memphis': 'Memphis',
      'Cincinnati Bearcats': 'Cincinnati',
      'Cincinnati': 'Cincinnati',
      'Bearcats': 'Cincinnati',
      'Houston Cougars': 'Houston',
      'Houston': 'Houston',
      'Tulane Green Wave': 'Tulane',
      'Tulane': 'Tulane',
      'Green Wave': 'Tulane',
      'Tulsa Golden Hurricane': 'Tulsa',
      'Tulsa': 'Tulsa',
      'Golden Hurricane': 'Tulsa',
      'SMU Mustangs': 'SMU',
      'SMU': 'SMU',
      'Temple Owls': 'Temple',
      'Temple': 'Temple',
      'Owls': 'Temple',
      'East Carolina Pirates': 'ECU',
      'East Carolina': 'ECU',
      'Pirates': 'ECU',
      'UCF Knights': 'UCF',
      'UCF': 'UCF',
      'Knights': 'UCF',
      'USF Bulls': 'USF',
      'USF': 'USF',
      'Bulls': 'USF',
      'Marshall Thundering Herd': 'Marshall',
      'Marshall': 'Marshall',
      'Thundering Herd': 'Marshall',
      'Western Kentucky Hilltoppers': 'WKU',
      'Western Kentucky': 'WKU',
      'Hilltoppers': 'WKU',
      'Middle Tennessee Blue Raiders': 'MTSU',
      'Middle Tennessee': 'MTSU',
      'Blue Raiders': 'MTSU',
      'Louisiana Tech Bulldogs': 'LaTech',
      'Louisiana Tech': 'LaTech',
      'Southern Miss Golden Eagles': 'SoMiss',
      'Southern Miss': 'SoMiss',
      'Rice Owls': 'Rice',
      'Rice': 'Rice',
      'North Texas Mean Green': 'UNT',
      'North Texas': 'UNT',
      'Mean Green': 'UNT',
      'UTSA Roadrunners': 'UTSA',
      'UTSA': 'UTSA',
      'Roadrunners': 'UTSA',
      'Charlotte 49ers': 'Charlotte',
      'Charlotte': 'Charlotte',
      'Florida International Panthers': 'FIU',
      'FIU': 'FIU',
      'Old Dominion Monarchs': 'ODU',
      'Old Dominion': 'ODU',
      'Monarchs': 'ODU',
      'Liberty Flames': 'Liberty',
      'Liberty': 'Liberty',
      'Flames': 'Liberty',
      'Appalachian State Mountaineers': 'AppSt',
      'Appalachian State': 'AppSt',
      'Georgia Southern Eagles': 'GaSouthern',
      'Georgia Southern': 'GaSouthern',
      'Coastal Carolina Chanticleers': 'Coastal',
      'Coastal Carolina': 'Coastal',
      'Chanticleers': 'Coastal',
      'Troy Trojans': 'Troy',
      'Troy': 'Troy',
      'South Alabama Jaguars': 'USA',
      'South Alabama': 'USA',
      'Jaguars': 'USA',
      'Georgia State Panthers': 'GaState',
      'Georgia State': 'GaState',
      'UL Monroe Warhawks': 'ULM',
      'UL Monroe': 'ULM',
      'Warhawks': 'ULM',
      'Louisiana Ragin Cajuns': 'ULL',
      'Louisiana': 'ULL',
      'Ragin Cajuns': 'ULL',
      'Arkansas State Red Wolves': 'ArkSt',
      'Arkansas State': 'ArkSt',
      'Red Wolves': 'ArkSt',
      'Texas State Bobcats': 'TxSt',
      'Texas State': 'TxSt',
      'UTEP Miners': 'UTEP',
      'UTEP': 'UTEP',
      'Miners': 'UTEP',
      'New Mexico State Aggies': 'NMSU',
      'New Mexico State': 'NMSU',
      'Idaho Vandals': 'Idaho',
      'Idaho': 'Idaho',
      'Vandals': 'Idaho',
      'Montana Grizzlies': 'Montana',
      'Montana': 'Montana',
      'Grizzlies': 'Montana',
      'Montana State Bobcats': 'MontSt',
      'Montana State': 'MontSt',
      'North Dakota State Bison': 'NDSU',
      'North Dakota State': 'NDSU',
      'South Dakota State Jackrabbits': 'SDSU',
      'South Dakota State': 'SDSU',
      'Northern Iowa Panthers': 'UNI',
      'Northern Iowa': 'UNI',
      'South Dakota Coyotes': 'SD',
      'South Dakota': 'SD',
      'North Dakota Fighting Hawks': 'UND',
      'North Dakota': 'UND',
      'Weber State Wildcats': 'WeberSt',
      'Weber State': 'WeberSt',
      'Eastern Washington Eagles': 'EWU',
      'Eastern Washington': 'EWU',
      'Portland State Vikings': 'PortlandSt',
      'Portland State': 'PortlandSt',
      'Sacramento State Hornets': 'SacSt',
      'Sacramento State': 'SacSt',
      'Cal Poly Mustangs': 'CalPoly',
      'Cal Poly': 'CalPoly',
      'UC Davis Aggies': 'UCDavis',
      'UC Davis': 'UCDavis',
      'Cal State Fullerton Titans': 'CSFullerton',
      'Cal State Fullerton': 'CSFullerton',
      'Titans': 'CSFullerton',
      'Long Beach State 49ers': 'LBSU',
      'Long Beach State': 'LBSU',
      'UC Irvine Anteaters': 'UCIrvine',
      'UC Irvine': 'UCIrvine',
      'Anteaters': 'UCIrvine',
      'UC Santa Barbara Gauchos': 'UCSB',
      'UC Santa Barbara': 'UCSB',
      'Gauchos': 'UCSB',
      'UC Riverside Highlanders': 'UCRiverside',
      'UC Riverside': 'UCRiverside',
      'Highlanders': 'UCRiverside',
      'Cal State Northridge Matadors': 'CSUN',
      'Cal State Northridge': 'CSUN',
      'Matadors': 'CSUN',
      'Hawaii Rainbow Warriors': 'Hawaii',
      'Hawaii': 'Hawaii',
      'Rainbow Warriors': 'Hawaii',
      'Fresno State Bulldogs': 'FresnoSt',
      'Fresno State': 'FresnoSt',
      'San Jose State Spartans': 'SJSU',
      'San Jose State': 'SJSU',
      'Lobos': 'NewMex',
      'Falcons': 'AirForce',
      'Black Knights': 'Army',
    };
    
    const mappedAbbr = teamNameMap[teamName];
    if (mappedAbbr) {
      team = teamData.find(t => t.abbr === mappedAbbr);
      if (team) {
        console.log(`🏀 Mapped "${teamName}" -> "${mappedAbbr}" -> ID: ${team.id}`);
        return team.id;
      }
    }
    
    console.warn(`⚠️ Team name not found: "${teamName}" - Please add to team name mapping`);
    return null;
  } catch (error) {
    console.error(`Error getting team ID for ${teamName}:`, error);
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
    { abbr: 'Mary', id: '2608' },      // Saint Mary's Gaels (alternative abbreviation)
    { abbr: 'StJ', id: 'PLACEHOLDER' }, // St. John's Red Storm (NEED ESPN ID FROM GOOGLE SHEET)
    
    // Missing abbreviations from standings data (from Google Sheet)
    { abbr: 'JM', id: '256' },         // James Madison Dukes (Row 137)
    { abbr: 'TA&M', id: '245' },       // Texas A&M Aggies (Row 63)
    { abbr: 'DRK', id: '2181' },       // Drake Bulldogs (Row 90)
    { abbr: 'Drk', id: '2181' },       // Drake Bulldogs (alternative case)
    { abbr: 'FLO', id: '57' },         // Florida Gators
    { abbr: 'Flo', id: '57' },         // Florida Gators (alternative case)
    { abbr: 'Texas', id: '251' },      // Texas Longhorns
    { abbr: 'TTech', id: '2641' },     // Texas Tech Red Raiders
    { abbr: 'FAU', id: '2229' },       // Florida Atlantic Owls
    
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
    
    // Missing major teams
    { abbr: 'UVA', id: '258' },        // Virginia Cavaliers
    { abbr: 'Maryland', id: '120' },   // Maryland Terrapins
    { abbr: 'Louisville', id: '97' },  // Louisville Cardinals
    
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
