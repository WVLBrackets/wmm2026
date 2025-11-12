import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getAllTeamReferenceData } from '@/lib/secureDatabase';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Fetch ESPN team page
 */
function fetchESPNTeamPage(teamId: number): Promise<{ html: string; statusCode: number } | null> {
  return new Promise((resolve) => {
    const url = `https://www.espn.com/mens-college-basketball/team/_/id/${teamId}`;
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let html = '';
      res.on('data', (chunk) => {
        html += chunk;
      });
      res.on('end', () => {
        resolve({ html, statusCode: res.statusCode || 200 });
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

/**
 * Extract team name from ESPN HTML
 */
function extractTeamNameFromHTML(html: string): string | null {
  // Method 1: Try to extract from embedded JSON data (most reliable)
  try {
    const displayNamePatterns = [
      /"teamData"\s*:\s*\{[^}]{0,2000}?"displayName"\s*:\s*"([^"]+)"/,
      /"clubhouse"\s*:\s*\{[^}]{0,500}?"teamHeader"\s*:\s*\{[^}]{0,500}?"displayName"\s*:\s*"([^"]+)"/,
      /"subNavigation"\s*:\s*\{[^}]{0,500}?"text"\s*:\s*"([^"]+)"/,
      /"displayName"\s*:\s*"([^"]+)"/g,
    ];
    
    for (const pattern of displayNamePatterns) {
      const isGlobal = pattern.global;
      if (isGlobal) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const name = match[1].trim();
            const lowerName = name.toLowerCase();
            if (name.length > 5 && 
                !lowerName.includes('espn') &&
                !lowerName.includes('scores, stats') &&
                !lowerName.includes('highlights') &&
                !lowerName.includes('basketball') &&
                !lowerName.includes('page not found') &&
                name !== 'ESPN' &&
                !name.match(/^\s*[|,\-]\s*$/)) {
              return name;
            }
          }
        }
      } else {
        const match = html.match(pattern);
        if (match && match[1]) {
          const name = match[1].trim();
          const lowerName = name.toLowerCase();
          if (name.length > 5 && 
              !lowerName.includes('espn') &&
              !lowerName.includes('scores, stats') &&
              !lowerName.includes('highlights') &&
              !lowerName.includes('basketball') &&
              !lowerName.includes('page not found') &&
              name !== 'ESPN' &&
              !name.match(/^\s*[|,\-]\s*$/)) {
            return name;
          }
        }
      }
    }
  } catch (error) {
    // Continue to other methods
  }

  // Method 2: Try to find in page title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    const teamNameMatch = title.match(/^([^-|]+?)(?:\s+Scores|\s+-|\s*\|)/i) || title.match(/^([^-|]+)/);
    if (teamNameMatch) {
      let teamName = teamNameMatch[1].trim();
      teamName = teamName
        .replace(/Scores, Stats and Highlights/i, '')
        .replace(/Men's College Basketball/i, '')
        .replace(/Men's Basketball/i, '')
        .replace(/College Basketball/i, '')
        .replace(/Basketball/i, '')
        .replace(/\s+/, ' ')
        .trim();
      
      if (teamName.length > 2) {
        return teamName;
      }
    }
  }

  // Method 3: Try h1 tags
  const h1Match = html.match(/<h1[^>]*class="[^"]*TeamHeader[^"]*"[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }

  const h1GenericMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1GenericMatch) {
    const name = h1GenericMatch[1].trim();
    if (name.length > 2 && !name.includes('404') && !name.includes('Not Found')) {
      return name;
    }
  }

  return null;
}

/**
 * Extract mascot from ESPN HTML
 */
function extractMascotFromHTML(html: string, teamName: string): string | null {
  try {
    // Method 1: Look for "shortDisplayName" in JSON data (most reliable)
    const shortDisplayNameMatch = html.match(/"shortDisplayName"\s*:\s*"([^"]+)"/);
    if (shortDisplayNameMatch && shortDisplayNameMatch[1]) {
      const shortName = shortDisplayNameMatch[1].trim();
      // Filter out invalid values
      if (shortName.length > 2 && 
          !shortName.toLowerCase().includes('espn') &&
          !shortName.toLowerCase().includes('team') &&
          shortName !== 'ESPN') {
        return shortName;
      }
    }
    
    // Method 2: Try to extract mascot from displayName (e.g., "Alaska Anchorage Seawolves" -> "Seawolves")
    const nameParts = teamName.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      // Common pattern: "School Location Mascot" or "School Mascot"
      // Take the last 1-2 words as potential mascot
      const potentialMascot = nameParts.slice(-1).join(' ');
      // Common school name endings that shouldn't be considered mascots
      const schoolEndings = ['State', 'University', 'College', 'Tech', 'A&M', 'A&m'];
      if (!schoolEndings.some(ending => potentialMascot.includes(ending)) && 
          potentialMascot.length > 2) {
        return potentialMascot;
      }
    }
  } catch (error) {
    // If extraction fails, return null
  }
  
  return null;
}

/**
 * Extract logo URL from ESPN HTML
 */
function extractLogoURLFromHTML(html: string): string | null {
  // Method 1: Look for logo in JSON data (most reliable)
  try {
    const logoPatterns = [
      /"logo"\s*:\s*"([^"]+)"/i,
      /"teamLogo"\s*:\s*"([^"]+)"/i,
      /"image"\s*:\s*"([^"]*logo[^"]+)"/i,
    ];

    for (const pattern of logoPatterns) {
      const matches = html.matchAll(new RegExp(pattern.source, 'g'));
      for (const match of matches) {
        if (match[1]) {
          let url = match[1].trim();
          if (url && !url.includes('espn.com/espn')) {
            if (url.startsWith('//')) {
              url = 'https:' + url;
            } else if (url.startsWith('/')) {
              url = 'https://www.espn.com' + url;
            }
            if (url.startsWith('http')) {
              return url;
            }
          }
        }
      }
    }
  } catch (error) {
    // Continue to other methods
  }

  // Method 2: Look for logo in img tags
  const imgPatterns = [
    /<img[^>]*class="[^"]*ClubhouseHeader__Logo[^"]*"[^>]*src="([^"]+)"/i,
    /<img[^>]*class="[^"]*TeamLogo[^"]*"[^>]*src="([^"]+)"/i,
    /<img[^>]*src="([^"]*logo[^"]*)"[^>]*>/i,
  ];

  for (const pattern of imgPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let url = match[1].trim();
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (url.startsWith('/')) {
        url = 'https://www.espn.com' + url;
      }
      if (url.startsWith('http')) {
        return url;
      }
    }
  }

  return null;
}

/**
 * Download logo and save to public/logos/teams/
 */
async function downloadAndSaveLogo(logoUrl: string, teamId: string): Promise<string | null> {
  try {
    const parsedUrl = new URL(logoUrl);
    const ext = path.extname(parsedUrl.pathname) || '.png';
    const filename = `${teamId}${ext}`;
    const logoDir = path.join(process.cwd(), 'public', 'logos', 'teams');
    const filePath = path.join(logoDir, filename);

    // Ensure directory exists
    if (!fs.existsSync(logoDir)) {
      fs.mkdirSync(logoDir, { recursive: true });
    }

    return new Promise((resolve) => {
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = protocol.get(logoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        const fileStream = fs.createWriteStream(filePath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(`/logos/teams/${filename}`);
        });

        fileStream.on('error', () => {
          resolve(null);
        });
      });

      req.on('error', () => {
        resolve(null);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve(null);
      });
    });
  } catch (error) {
    console.error('Error downloading logo:', error);
    return null;
  }
}

/**
 * Check if ESPN page is valid
 */
function isValidTeamPage(html: string, statusCode: number): boolean {
  if (statusCode !== 200) {
    return false;
  }
  
  // Check for common 404 indicators
  if (html.includes('Page Not Found') || html.includes('404')) {
    return false;
  }

  return true;
}

/**
 * Sync a single team from ESPN
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Admin access required'
        },
        { status: 403 }
      );
    }

    const { teamId, mode } = await request.json();

    if (!teamId || typeof teamId !== 'number' || teamId < 1 || teamId > 9999) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid team ID. Must be a number between 1 and 9999'
        },
        { status: 400 }
      );
    }

    if (mode !== 'report' && mode !== 'update') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid mode. Must be "report" or "update"'
        },
        { status: 400 }
      );
    }

    const updateMode = mode === 'update';
    const idString = teamId.toString();

    // Get all existing teams from database
    const existingTeams = await getAllTeamReferenceData(false);
    
    // Find team in database by ID
    const existingTeam = Object.values(existingTeams).find(t => t.id === idString);
    const existingTeamKey = existingTeam ? Object.keys(existingTeams).find(k => existingTeams[k].id === idString) : null;

    // Fetch ESPN page
    const response = await fetchESPNTeamPage(teamId);
    
    if (!response) {
      return NextResponse.json({
        success: true,
        report: {
          id: idString,
          action: 'error',
          message: 'Failed to fetch ESPN page'
        }
      });
    }

    const { html, statusCode } = response;

    // Check if page is valid
    if (!isValidTeamPage(html, statusCode)) {
      if (existingTeam) {
        return NextResponse.json({
          success: true,
          report: {
            id: idString,
            action: 'not_found',
            dbName: existingTeam.name,
            message: `Team exists in DB (${existingTeam.name}) but not found on ESPN`
          }
        });
      } else {
        return NextResponse.json({
          success: true,
          report: {
            id: idString,
            action: 'not_found',
            message: 'Team not found on ESPN and not in database'
          }
        });
      }
    }

    // Extract team name from ESPN
    const espnTeamName = extractTeamNameFromHTML(html);
    
    if (!espnTeamName || espnTeamName.trim().toUpperCase() === 'ESPN') {
      return NextResponse.json({
        success: true,
        report: {
          id: idString,
          action: 'not_found',
          message: 'Could not extract team name from ESPN page or page is invalid'
        }
      });
    }

    // Extract mascot and logo
    const espnMascot = extractMascotFromHTML(html, espnTeamName);
    const espnLogoUrl = extractLogoURLFromHTML(html);

    // Compare with database
    if (existingTeam) {
      // Team exists in DB
      const nameMatch = existingTeam.name === espnTeamName;
      const mascotMatch = existingTeam.mascot === espnMascot;
      const logoMatch = existingTeam.logo && existingTeam.logo !== '';

      if (nameMatch && mascotMatch && logoMatch) {
        // Perfect match
        return NextResponse.json({
          success: true,
          report: {
            id: idString,
            action: 'match',
            dbName: existingTeam.name,
            espnName: espnTeamName,
            mascot: espnMascot,
            message: 'Team matches between DB and ESPN'
          }
        });
      } else {
        // Mismatch - report differences
        const differences: string[] = [];
        if (!nameMatch) differences.push(`Name: DB="${existingTeam.name}" vs ESPN="${espnTeamName}"`);
        if (!mascotMatch) differences.push(`Mascot: DB="${existingTeam.mascot || 'none'}" vs ESPN="${espnMascot || 'none'}"`);
        if (!logoMatch && espnLogoUrl) differences.push(`Logo: DB has no logo, ESPN has logo`);

        // If update mode, update the database
        if (updateMode) {
          // Import update functions
          const { updateTeamReferenceData } = await import('@/lib/secureDatabase');
          
          // Download logo if needed
          let logoPath = existingTeam.logo;
          if (espnLogoUrl && !logoPath) {
            logoPath = await downloadAndSaveLogo(espnLogoUrl, idString) || '';
          }

          // Update team in database
          const updatedTeams = { ...existingTeams };
          if (existingTeamKey) {
            updatedTeams[existingTeamKey] = {
              ...existingTeam,
              name: espnTeamName,
              mascot: espnMascot || existingTeam.mascot,
              logo: logoPath || existingTeam.logo
            };
            await updateTeamReferenceData(updatedTeams);
          }
        }

        return NextResponse.json({
          success: true,
          report: {
            id: idString,
            action: 'mismatch',
            dbName: existingTeam.name,
            espnName: espnTeamName,
            mascot: espnMascot,
            logoUrl: espnLogoUrl,
            message: `Differences found: ${differences.join('; ')}${updateMode ? ' (Updated in DB)' : ''}`
          }
        });
      }
    } else {
      // Team doesn't exist in DB
      if (updateMode) {
        // Import update functions
        const { updateTeamReferenceData } = await import('@/lib/secureDatabase');
        
        // Download logo
        let logoPath = '';
        if (espnLogoUrl) {
          logoPath = await downloadAndSaveLogo(espnLogoUrl, idString) || '';
        }

        // Create new team - use team name as key (normalized)
        // Generate a unique key by normalizing the team name
        let teamKey = espnTeamName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        // If key already exists, append the ID to make it unique
        if (existingTeams[teamKey]) {
          teamKey = `${teamKey}${idString}`;
        }
        
        const updatedTeams = { ...existingTeams };
        updatedTeams[teamKey] = {
          id: idString,
          name: espnTeamName,
          mascot: espnMascot || undefined,
          logo: logoPath,
          active: false
        };

        await updateTeamReferenceData(updatedTeams);

        return NextResponse.json({
          success: true,
          report: {
            id: idString,
            action: 'created',
            espnName: espnTeamName,
            mascot: espnMascot,
            logoUrl: espnLogoUrl,
            message: `New team created: ${espnTeamName}${espnMascot ? ` (${espnMascot})` : ''}${logoPath ? ' (Logo saved)' : ''}`
          }
        });
      } else {
        return NextResponse.json({
          success: true,
          report: {
            id: idString,
            action: 'created',
            espnName: espnTeamName,
            mascot: espnMascot,
            logoUrl: espnLogoUrl,
            message: `Team found on ESPN but not in DB: ${espnTeamName}${espnMascot ? ` (${espnMascot})` : ''}${espnLogoUrl ? ' (Logo available)' : ''}`
          }
        });
      }
    }
  } catch (error) {
    console.error('Error syncing team from ESPN:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync team from ESPN',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

