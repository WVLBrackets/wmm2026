// Team reference data from local JSON file
// Fetches team abbreviations and ESPN IDs from local team-mappings.json

export interface TeamRefData {
  abbr: string;
  id: string;
}

// Local team mappings configuration
const TEAM_MAPPINGS_PATH = '/data/team-mappings.json';

// Cache for team reference data
let cachedTeamData: TeamRefData[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch team reference data from local JSON file
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

  try {
    // Fetch from local JSON file
    console.log('📋 Fetching team reference data from local JSON file');
    const response = await fetch(TEAM_MAPPINGS_PATH);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch team mappings: ${response.status} ${response.statusText}`);
    }
    
    const teamMappings = await response.json();
    
    // Convert to TeamRefData format
    const teamData: TeamRefData[] = Object.entries(teamMappings).map(([abbr, teamInfo]) => ({
      abbr,
      id: (teamInfo as { id: string; name: string; abbr: string }).id,
      name: (teamInfo as { id: string; name: string; abbr: string }).name
    }));
    
    console.log(`📋 Loaded ${teamData.length} teams from local JSON file`);
    
    // Log available team abbreviations for debugging
    console.log(`📋 Available team abbreviations (${teamData.length} total):`, 
      teamData.map(t => t.abbr).sort().join(', '));
    
    cachedTeamData = teamData;
    lastFetchTime = now;
    
    const totalTime = performance.now() - startTime;
    console.log(`✅ Team reference data ready in ${totalTime.toFixed(2)}ms`);
    return teamData;
    
  } catch (error) {
    console.error('❌ Error loading team mappings from local JSON:', error);
    console.log('📋 Falling back to hardcoded team data');
    
    // Use fallback data
  const fallbackStart = performance.now();
  const fallbackData = getFallbackTeamData();
  const fallbackEnd = performance.now();
  console.log(`📋 Fallback data generated in ${(fallbackEnd - fallbackStart).toFixed(2)}ms`);
  
  cachedTeamData = fallbackData;
  lastFetchTime = now;
  
  const totalTime = performance.now() - startTime;
  console.log(`✅ Team reference data ready in ${totalTime.toFixed(2)}ms`);
  return fallbackData;
}
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
      'Florida Gators': 'Flo',
      'UConn Huskies': 'UConn', 
      'UConn': 'UConn',
      'Florida': 'Flo',
      'Gators': 'Flo',
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
      'Arizona': 'Zona',
      'Alabama': 'Bama',
      'Auburn': 'Aub',
      'Arkansas': 'Ark',
      'Tennessee': 'Tenn',
      'Texas': 'Texas',
      'Texas A&M': 'TA&M',
      'Texas Tech': 'TTech',
      'Florida State': 'FSU',
      'Florida Atlantic': 'FAU',
      'Drake': 'Drk',
      'Gonzaga': 'Gonz',
      'Michigan State': 'MicSt',
      'Michigan State Spartans': 'MicSt',
      'Iowa State': 'IoSt',
      'NC State': 'NCSt',
      'Notre Dame': 'ND',
      'Indiana': 'Ind',
      'Georgia Tech': 'GT',
      'California': 'Cal',
      'Colorado': 'Colo',
      'Colorado State': 'ColSt',
      
      // Additional major teams
      'Virginia Cavaliers': 'UVA',
      'Virginia': 'UVA',
      'Cavaliers': 'UVA',
      'Villanova Wildcats': 'Nova',
      'Villanova': 'Nova',
      'Michigan Wolverines': 'Mich',
      'Michigan': 'Mich',
      'Wolverines': 'Mich',
      'Ohio State Buckeyes': 'OhSt',
      'Ohio State': 'OhSt',
      'Buckeyes': 'OhSt',
      'Wisconsin Badgers': 'Wisc',
      'Wisconsin': 'Wisc',
      'Badgers': 'Wisc',
      'Purdue Boilermakers': 'Purd',
      'Purdue': 'Purd',
      'Boilermakers': 'Purd',
      'Illinois Fighting Illini': 'Ill',
      'Illinois': 'Ill',
      'Fighting Illini': 'Ill',
      'Iowa Hawkeyes': 'Iowa',
      'Iowa': 'Iowa',
      'Hawkeyes': 'Iowa',
      'Minnesota Golden Gophers': 'Minn',
      'Minnesota': 'Minn',
      'Golden Gophers': 'Minn',
      'Nebraska Cornhuskers': 'Neb',
      'Nebraska': 'Neb',
      'Cornhuskers': 'Neb',
      'Northwestern Wildcats': 'NW',
      'Northwestern': 'NW',
      'Penn State Nittany Lions': 'PSU',
      'Penn State': 'PSU',
      'Nittany Lions': 'PSU',
      'Rutgers Scarlet Knights': 'Rut',
      'Rutgers': 'Rut',
      'Scarlet Knights': 'Rut',
      'Maryland Terrapins': 'Mary',
      'Maryland': 'Mary',
      'Terrapins': 'Mary',
      'Louisville Cardinals': 'Lou',
      'Louisville': 'Lou',
      'Cardinals': 'Lou',
      'Syracuse Orange': 'Syr',
      'Syracuse': 'Syr',
      'Orange': 'Syr',
      'Orangemen': 'Syr',
      'Syracuse Orangemen': 'Syr',
      'Pittsburgh Panthers': 'Pitt',
      'Pittsburgh': 'Pitt',
      'Boston College Eagles': 'BC',
      'Boston College': 'BC',
      'Clemson Tigers': 'Clem',
      'Clemson': 'Clem',
      'Georgia Bulldogs': 'UGA',
      'Georgia': 'UGA',
      'South Carolina Gamecocks': 'SoCar',
      'South Carolina': 'SoCar',
      'Gamecocks': 'SoCar',
      'Missouri Tigers': 'Mizz',
      'Missouri': 'Mizz',
      'Ole Miss Rebels': 'OM',
      'Ole Miss': 'OM',
      'Rebels': 'OM',
      'Mississippi State Bulldogs': 'MsSt',
      'Mississippi State': 'MsSt',
      'LSU Tigers': 'LSU',
      'LSU': 'LSU',
      'Oklahoma Sooners': 'OU',
      'Oklahoma': 'OU',
      'Oklahoma State Cowboys': 'OkSt',
      'Oklahoma State': 'OkSt',
      'Baylor Bears': 'Bylr',
      'Baylor': 'Bylr',
      'TCU Horned Frogs': 'TCU',
      'TCU': 'TCU',
      'Horned Frogs': 'TCU',
      'West Virginia Mountaineers': 'WV',
      'West Virginia': 'WV',
      'Kansas State Wildcats': 'KSt',
      'Kansas State': 'KSt',
      'Iowa State Cyclones': 'IoSt',
      'Oregon Ducks': 'Ore',
      'Oregon': 'Ore',
      'Oregon State Beavers': 'OrSt',
      'Oregon State': 'OrSt',
      'Washington Huskies': 'Wash',
      'Washington': 'Wash',
      'Washington State Cougars': 'WaSt',
      'Washington State': 'WaSt',
      'UCLA Bruins': 'UCLA',
      'UCLA': 'UCLA',
      'USC Trojans': 'USC',
      'USC': 'USC',
      'Stanford Cardinal': 'Stan',
      'Stanford': 'Stan',
      'California Golden Bears': 'Cal',
      'Utah Utes': 'Utah',
      'Utah': 'Utah',
      'Arizona State Sun Devils': 'AzSt',
      'Arizona State': 'AzSt',
      'Colorado Buffaloes': 'Colo',
      'Utah State Aggies': 'USt',
      'Utah State': 'USt',
      'San Diego State Aztecs': 'SDSU',
      'San Diego State': 'SDSU',
      'Boise State Broncos': 'Boise',
      'Boise State': 'Boise',
      'Nevada Wolf Pack': 'Nev',
      'Nevada': 'Nev',
      'UNLV Runnin Rebels': 'UNLV',
      'UNLV': 'UNLV',
      'New Mexico Lobos': 'NewMx',
      'New Mexico': 'NewMx',
      'Wyoming': 'Wyoming',
      'Air Force': 'AirForce',
      'Army': 'Army',
      'Navy': 'Navy',
      'Memphis Tigers': 'Mem',
      'Memphis': 'Mem',
      'Cincinnati Bearcats': 'Cincinnati',
      'Cincinnati': 'Cincinnati',
      'Bearcats': 'Cincinnati',
      'Houston Cougars': 'Hou',
      'Houston': 'Hou',
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
      'USF Bulls': 'SFla',
      'USF': 'SFla',
      'Bulls': 'SFla',
      'Marshall Thundering Herd': 'Marshall',
      'Marshall': 'Marshall',
      'Thundering Herd': 'Marshall',
      'Western Kentucky Hilltoppers': 'WKy',
      'Western Kentucky': 'WKy',
      'Hilltoppers': 'WKy',
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
      'Liberty Flames': 'Lib',
      'Liberty': 'Lib',
      'Flames': 'Lib',
      'Appalachian State Mountaineers': 'AppSt',
      'Appalachian State': 'AppSt',
      'Georgia Southern Eagles': 'GaSouthern',
      'Georgia Southern': 'GaSouthern',
      'Coastal Carolina Chanticleers': 'Coastal',
      'Coastal Carolina': 'Coastal',
      'Chanticleers': 'Coastal',
      'Troy Trojans': 'Troy',
      'Troy': 'Troy',
      'South Alabama Jaguars': 'SAla',
      'South Alabama': 'SAla',
      'Jaguars': 'SAla',
      'Georgia State Panthers': 'GeoSt',
      'Georgia State': 'GeoSt',
      'UL Monroe Warhawks': 'ULM',
      'UL Monroe': 'ULM',
      'Warhawks': 'ULM',
      'Louisiana Ragin Cajuns': 'UL',
      'Louisiana': 'UL',
      'Ragin Cajuns': 'UL',
      'Arkansas State Red Wolves': 'ArkSt',
      'Arkansas State': 'ArkSt',
      'Red Wolves': 'ArkSt',
      'Texas State Bobcats': 'TxSt',
      'Texas State': 'TxSt',
      'UTEP Miners': 'UTEP',
      'UTEP': 'UTEP',
      'Miners': 'UTEP',
      'New Mexico State Aggies': 'NMSt',
      'New Mexico State': 'NMSt',
      'Idaho Vandals': 'Idaho',
      'Idaho': 'Idaho',
      'Vandals': 'Idaho',
      'Montana Grizzlies': 'Mont',
      'Montana': 'Mont',
      'Grizzlies': 'Mont',
      'Montana State Bobcats': 'MonSt',
      'Montana State': 'MonSt',
      'North Dakota State Bison': 'NorSt',
      'North Dakota State': 'NorSt',
      'South Dakota State Jackrabbits': 'SDkSt',
      'South Dakota State': 'SDkSt',
      'Northern Iowa Panthers': 'UNI',
      'Northern Iowa': 'UNI',
      'South Dakota Coyotes': 'SD',
      'South Dakota': 'SD',
      'North Dakota Fighting Hawks': 'UND',
      'North Dakota': 'UND',
      'Weber State Wildcats': 'WeberSt',
      'Weber State': 'WeberSt',
      'Eastern Washington Eagles': 'EW',
      'Eastern Washington': 'EW',
      'Portland State Vikings': 'PortlandSt',
      'Portland State': 'PortlandSt',
      'Sacramento State Hornets': 'SacSt',
      'Sacramento State': 'SacSt',
      'Cal Poly Mustangs': 'CP',
      'Cal Poly': 'CP',
      'UC Davis Aggies': 'UCDavis',
      'UC Davis': 'UCDavis',
      'Cal State Fullerton Titans': 'CSUF',
      'Cal State Fullerton': 'CSUF',
      'Titans': 'CSUF',
      'Long Beach State 49ers': 'LBSU',
      'Long Beach State': 'LBSU',
      'UC Irvine Anteaters': 'UCI',
      'UC Irvine': 'UCI',
      'Anteaters': 'UCI',
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
      'Lobos': 'NewMx',
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
 * Fallback team data if local JSON is unavailable
 */
function getFallbackTeamData(): TeamRefData[] {
  return [
    // Common tournament teams
    { abbr: 'UConn', id: '41' },      // Connecticut Huskies
    { abbr: 'UNC', id: '153' },       // North Carolina Tar Heels  
    { abbr: 'UK', id: '96' },         // Kentucky Wildcats
    { abbr: 'KU', id: '2305' },       // Kansas Jayhawks
    { abbr: 'Tenn', id: '2633' },     // Tennessee Volunteers
    { abbr: 'Duke', id: '150' },      // Duke Blue Devils
    { abbr: 'Purd', id: '2509' },     // Purdue Boilermakers
    { abbr: 'Hou', id: '248' },       // Houston Cougars
    { abbr: 'Cre', id: '156' },       // Creighton Bluejays
    { abbr: 'IoSt', id: '66' },       // Iowa State Cyclones
    { abbr: 'Zona', id: '12' },       // Arizona Wildcats
    { abbr: 'MicSt', id: '127' },     // Michigan State Spartans
    { abbr: 'Flo', id: '57' },        // Florida Gators
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
    { abbr: 'WaSt', id: '265' },      // Washington State Cougars
    { abbr: 'StMary', id: '2608' },   // Saint Mary's Gaels
    { abbr: 'Mary', id: '2608' },     // Saint Mary's Gaels (alternative abbreviation)
    { abbr: 'StJ', id: '2599' },      // St. John's Red Storm
    { abbr: 'MeM', id: '235' },       // Memphis Tigers
    
    // Missing abbreviations from standings data
    { abbr: 'JM', id: '256' },        // James Madison Dukes
    { abbr: 'TA&M', id: '245' },      // Texas A&M Aggies
    { abbr: 'Drk', id: '2181' },      // Drake Bulldogs
    { abbr: 'FLO', id: '57' },        // Florida Gators
    { abbr: 'Texas', id: '251' },     // Texas Longhorns
    { abbr: 'TTech', id: '2641' },    // Texas Tech Red Raiders
    { abbr: 'FAU', id: '2226' },      // Florida Atlantic Owls
  ];
}