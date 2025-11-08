// Team reference data from database
// Database is the source of truth for team reference data

export interface TeamRefData {
  abbr: string;
  id: string;
  name: string;
}

// Cache for team reference data
let cachedTeamData: TeamRefData[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes - shorter cache for faster new team visibility

/**
 * Fetch team reference data (from database first, then JSON file fallback)
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

  // Try database (server-side only)
  if (typeof window === 'undefined') {
    try {
      const { getAllTeamReferenceData } = await import('@/lib/secureDatabase');
      // Only get active teams for public-facing calls
      const dbTeams = await getAllTeamReferenceData(true);
      
      if (Object.keys(dbTeams).length > 0) {
        const teamData: TeamRefData[] = Object.entries(dbTeams)
          .filter(([_, teamInfo]) => teamInfo.active !== false)
          .map(([abbr, teamInfo]) => ({
            abbr,
            id: teamInfo.id,
            name: teamInfo.name
          }));
        
        console.log(`📋 Loaded ${teamData.length} active teams from database`);
        
        cachedTeamData = teamData;
        lastFetchTime = now;
        
        const totalTime = performance.now() - startTime;
        console.log(`✅ Team reference data ready from database in ${totalTime.toFixed(2)}ms`);
        return teamData;
      }
      
      // Database is empty - this shouldn't happen in production, but use fallback
      console.warn('⚠️ Database has no team data, using fallback data');
      const fallbackStart = performance.now();
      const fallbackData = getFallbackTeamData();
      const fallbackEnd = performance.now();
      console.log(`📋 Fallback data generated in ${(fallbackEnd - fallbackStart).toFixed(2)}ms`);
      
      cachedTeamData = fallbackData;
      lastFetchTime = now;
      
      const totalTime = performance.now() - startTime;
      console.log(`✅ Team reference data ready (fallback) in ${totalTime.toFixed(2)}ms`);
      return fallbackData;
      
    } catch (dbError) {
      console.error('❌ Database error, using fallback:', dbError instanceof Error ? dbError.message : String(dbError));
      // Use hardcoded fallback data if database fails
      const fallbackStart = performance.now();
      const fallbackData = getFallbackTeamData();
      const fallbackEnd = performance.now();
      console.log(`📋 Fallback data generated in ${(fallbackEnd - fallbackStart).toFixed(2)}ms`);
      
      cachedTeamData = fallbackData;
      lastFetchTime = now;
      
      const totalTime = performance.now() - startTime;
      console.log(`✅ Team reference data ready (fallback) in ${totalTime.toFixed(2)}ms`);
      return fallbackData;
    }
  }
  
  // Client-side: fetch from API route which accesses the database
  try {
    console.log('🌐 Client-side call: fetching team data from API');
    const apiStart = performance.now();
    const response = await fetch('/api/team-data?activeOnly=true');
    const apiEnd = performance.now();
    console.log(`📡 API fetch completed in ${(apiEnd - apiStart).toFixed(2)}ms`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
      console.log(`📋 Loaded ${result.data.length} active teams from database via API`);
      
      cachedTeamData = result.data;
      lastFetchTime = now;
      
      const totalTime = performance.now() - startTime;
      console.log(`✅ Team reference data ready from database (via API) in ${totalTime.toFixed(2)}ms`);
      return result.data;
    }
    
    // API returned empty data - this is an error, not a fallback case
    console.error('❌ API returned empty data - database may be empty or inaccessible');
    throw new Error('Team reference data is unavailable. Please contact support.');
    
  } catch (apiError) {
    // Only use fallback for critical system errors (database completely down)
    // For missing teams, we should show errors in UI, not use fallback
    const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
    
    // If it's a network/connection error, we might want to retry or show a different message
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
      console.error('❌ Network error fetching team data:', errorMessage);
      throw new Error('Unable to connect to server. Please check your connection and try again.');
    }
    
    // For other errors, throw them up - let the UI handle it
    console.error('❌ Error fetching team data:', errorMessage);
    throw apiError;
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
      // Don't log as warning - this is expected for some teams (like FF1, FF2, etc.)
      // Return null and let the caller decide how to handle it
      return null;
    }
    return team.id;
  } catch (error) {
    console.error(`Error getting team ID for ${abbr}:`, error);
    // Re-throw to let caller handle the error
    throw error;
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
      'Louisville Cardinals': 'UL',
      'Louisville': 'UL',
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
      'Louisiana Ragin Cajuns': 'Lou',
      'Louisiana': 'Lou',
      'Ragin Cajuns': 'Lou',
      'Cardinals': 'UL',
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
    
    // Team not found - return null (not an error, just not found)
    return null;
  } catch (error) {
    console.error(`Error getting team ID for ${teamName}:`, error);
    // Re-throw to let caller handle the error
    throw error;
  }
}

/**
 * Fallback team data if local JSON is unavailable
 */
function getFallbackTeamData(): TeamRefData[] {
  return [
    // Common tournament teams
    { abbr: 'UConn', id: '41', name: 'Connecticut' },      // Connecticut Huskies
    { abbr: 'UNC', id: '153', name: 'North Carolina' },       // North Carolina Tar Heels  
    { abbr: 'UK', id: '96', name: 'Kentucky' },         // Kentucky Wildcats
    { abbr: 'KU', id: '2305', name: 'Kansas' },       // Kansas Jayhawks
    { abbr: 'Tenn', id: '2633', name: 'Tennessee' },     // Tennessee Volunteers
    { abbr: 'Duke', id: '150', name: 'Duke' },      // Duke Blue Devils
    { abbr: 'Purd', id: '2509', name: 'Purdue' },     // Purdue Boilermakers
    { abbr: 'Hou', id: '248', name: 'Houston' },       // Houston Cougars
    { abbr: 'Cre', id: '156', name: 'Creighton' },       // Creighton Bluejays
    { abbr: 'IoSt', id: '66', name: 'Iowa State' },       // Iowa State Cyclones
    { abbr: 'Zona', id: '12', name: 'Arizona' },       // Arizona Wildcats
    { abbr: 'MicSt', id: '127', name: 'Michigan State' },     // Michigan State Spartans
    { abbr: 'Flo', id: '57', name: 'Florida' },        // Florida Gators
    { abbr: 'Bama', id: '333', name: 'Alabama' },      // Alabama Crimson Tide
    { abbr: 'Aub', id: '2', name: 'Auburn' },        // Auburn Tigers (ESPN ID: 2)
    { abbr: 'NCSt', id: '152', name: 'NC State' },      // NC State Wolfpack
    { abbr: 'Gonz', id: '2250', name: 'Gonzaga' },     // Gonzaga Bulldogs
    { abbr: 'Marq', id: '269', name: 'Marquette' },      // Marquette Golden Eagles
    { abbr: 'Bylr', id: '239', name: 'Baylor' },      // Baylor Bears
    { abbr: 'Ill', id: '356', name: 'Illinois' },       // Illinois Fighting Illini
    { abbr: 'Clem', id: '228', name: 'Clemson' },      // Clemson Tigers
    { abbr: 'Wisc', id: '275', name: 'Wisconsin' },      // Wisconsin Badgers
    { abbr: 'SoCar', id: '2579', name: 'South Carolina' },    // South Carolina Gamecocks
    { abbr: 'Ore', id: '2483', name: 'Oregon' },      // Oregon Ducks
    { abbr: 'Neb', id: '158', name: 'Nebraska' },       // Nebraska Cornhuskers
    { abbr: 'WaSt', id: '265', name: 'Washington State' },      // Washington State Cougars
    { abbr: 'StMary', id: '2608', name: 'Saint Mary\'s' },   // Saint Mary's Gaels
    { abbr: 'Mary', id: '120', name: 'Maryland' },     // Maryland Terrapins
    { abbr: 'StJ', id: '2599', name: 'St. John\'s' },      // St. John's Red Storm
    { abbr: 'MeM', id: '235', name: 'Memphis' },       // Memphis Tigers
    
    // Missing abbreviations from standings data
    { abbr: 'JM', id: '256', name: 'James Madison' },        // James Madison Dukes
    { abbr: 'TA&M', id: '245', name: 'Texas A&M' },      // Texas A&M Aggies
    { abbr: 'Drk', id: '2181', name: 'Drake' },      // Drake Bulldogs
    { abbr: 'FLO', id: '57', name: 'Florida' },        // Florida Gators
    { abbr: 'Texas', id: '251', name: 'Texas' },     // Texas Longhorns
    { abbr: 'TTech', id: '2641', name: 'Texas Tech' },    // Texas Tech Red Raiders
    { abbr: 'FAU', id: '2226', name: 'Florida Atlantic' },      // Florida Atlantic Owls
  ];
}