/**
 * ESPN Team Data Sync Script
 * 
 * This script syncs team data from ESPN by checking team IDs 1-20 (or custom range).
 * It can run in two modes:
 * - "report": Only reports differences without updating the database
 * - "update": Reports differences AND updates the database
 * 
 * Usage:
 *   npm run sync-teams report      # Report only mode
 *   npm run sync-teams update      # Report and update mode
 *   npm run sync-teams report 1 50 # Custom range (1 to 50)
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

interface TeamRecord {
  id: string;
  name: string;
  mascot?: string;
  logo: string;
}

interface SyncReport {
  id: string;
  action: 'match' | 'mismatch' | 'created' | 'not_found' | 'error';
  dbName?: string;
  espnName?: string;
  message: string;
}

interface SyncResult {
  startTime: Date;
  endTime: Date;
  duration: number;
  reports: SyncReport[];
  summary: {
    total: number;
    matches: number;
    mismatches: number;
    created: number;
    notFound: number;
    errors: number;
  };
}

/**
 * Fetch HTML from ESPN team page
 */
async function fetchESPNTeamPage(teamId: number): Promise<{ html: string; statusCode: number } | null> {
  return new Promise((resolve, reject) => {
    const url = `https://www.espn.com/mens-college-basketball/team/_/id/${teamId}`;
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          html: data,
          statusCode: res.statusCode || 200
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Extract mascot from ESPN HTML
 * ESPN typically has "shortDisplayName" which is the mascot, or we can extract from displayName
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
    // If teamName is "School Name Mascot", try to extract the last word(s) as mascot
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
 * Extract team name from ESPN HTML
 * Looks for the team name in various places on the page
 */
function extractTeamNameFromHTML(html: string): string | null {
  // Method 1: Try to extract from embedded JSON data (most reliable)
  // ESPN embeds team data in JSON with "displayName" field
  try {
    // Look for "displayName" in various JSON contexts
    // ESPN uses nested JSON, so we need to match flexibly
    const displayNamePatterns = [
      // Pattern 1: "teamData":{"id":"1",...,"displayName":"Team Name"
      /"teamData"\s*:\s*\{[^}]{0,2000}?"displayName"\s*:\s*"([^"]+)"/,
      // Pattern 2: "clubhouse":{"teamHeader":{...,"displayName":"Team Name"
      /"clubhouse"\s*:\s*\{[^}]{0,500}?"teamHeader"\s*:\s*\{[^}]{0,500}?"displayName"\s*:\s*"([^"]+)"/,
      // Pattern 3: "subNavigation":{...,"text":"Team Name"
      /"subNavigation"\s*:\s*\{[^}]{0,500}?"text"\s*:\s*"([^"]+)"/,
      // Pattern 4: Any "displayName":"Team Name" (more flexible)
      /"displayName"\s*:\s*"([^"]+)"/g,
    ];
    
    for (const pattern of displayNamePatterns) {
      // Use matchAll for global patterns, match for non-global
      const isGlobal = pattern.global;
      if (isGlobal) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const name = match[1].trim();
            // Filter out ESPN, generic terms, and invalid names
            const lowerName = name.toLowerCase();
            if (name.length > 5 && 
                !lowerName.includes('espn') &&
                !lowerName.includes('scores, stats') &&
                !lowerName.includes('highlights') &&
                !lowerName.includes('basketball') &&
                !lowerName.includes('page not found') &&
                !lowerName.match(/^(espn|scores|stats|highlights|basketball)$/i) &&
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
          // Filter out ESPN, generic terms, and invalid names
          const lowerName = name.toLowerCase();
          if (name.length > 5 && 
              !lowerName.includes('espn') &&
              !lowerName.includes('scores, stats') &&
              !lowerName.includes('highlights') &&
              !lowerName.includes('basketball') &&
              !lowerName.includes('page not found') &&
              !lowerName.match(/^(espn|scores|stats|highlights|basketball)$/i) &&
              name !== 'ESPN' &&
              !name.match(/^\s*[|,\-]\s*$/)) {
            return name;
          }
        }
      }
    }
  } catch (error) {
    // If JSON parsing fails, continue to other methods
  }

  // Method 2: Try to find the team name in the page title
  // ESPN titles are typically "TeamName Scores, Stats and Highlights - ESPN"
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    // Extract everything before "Scores" or dash or pipe
    const teamNameMatch = title.match(/^([^-|]+?)(?:\s+Scores|\s+-|\s*\|)/i) || title.match(/^([^-|]+)/);
    if (teamNameMatch) {
      let teamName = teamNameMatch[1].trim();
      // Clean up common ESPN suffixes
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

  // Method 3: Try to find in h1 tag (common on ESPN team pages)
  const h1Match = html.match(/<h1[^>]*class="[^"]*TeamHeader[^"]*"[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  // Method 4: Try generic h1
  const h1GenericMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1GenericMatch) {
    const name = h1GenericMatch[1].trim();
    if (name.length > 2 && !name.includes('404') && !name.includes('Not Found')) {
      return name;
    }
  }

  // Method 5: Look for data attributes with team name
  const dataNameMatch = html.match(/data-name=["']([^"']+)["']/i);
  if (dataNameMatch) {
    return dataNameMatch[1].trim();
  }

  return null;
}

/**
 * Check if ESPN page indicates a valid team or a 404/error page
 */
function isValidTeamPage(html: string, statusCode: number): boolean {
  // Check status code first
  if (statusCode === 404) {
    return false;
  }

  // Check for ESPN 404 indicators (but be careful - "404" might appear in other contexts)
  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes('page not found') || 
      lowerHtml.includes('error 404') || 
      lowerHtml.match(/404\s+error/i) ||
      (lowerHtml.includes('not found') && lowerHtml.includes('404'))) {
    return false;
  }

  // Check if page has team-related content indicators
  // ESPN team pages typically have these in the embedded JSON
  if (html.includes('"teamData"') || 
      html.includes('"teamHeader"') || 
      html.includes('"clubhouse"') ||
      html.includes('TeamHeader') || 
      html.includes('team-header') || 
      html.includes('Team__Header')) {
    return true;
  }

  // If we can extract a team name, consider it valid
  const teamName = extractTeamNameFromHTML(html);
  if (teamName && teamName.length > 2 && !teamName.includes('404')) {
    return true;
  }

  // If status code is 200 and page has substantial content, likely valid
  if (statusCode === 200 && html.length > 10000) {
    return true;
  }

  return false;
}

/**
 * Get direct database connection for team data (uses POSTGRES_URL_PROD)
 */
function getTeamDataConnection(): Pool {
  const connectionString = process.env.POSTGRES_URL_PROD || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    throw new Error('POSTGRES_URL_PROD or POSTGRES_URL environment variable is required');
  }
  
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
}

/**
 * Get all teams from database using direct connection
 */
async function getAllTeamsFromDB(): Promise<Record<string, TeamRecord>> {
  const pool = getTeamDataConnection();
  
  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_reference_data (
        key VARCHAR(50) PRIMARY KEY,
        id VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        mascot VARCHAR(255),
        logo VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const result = await pool.query(`
      SELECT key, id, name, mascot, logo
      FROM team_reference_data
      ORDER BY CAST(id AS INTEGER)
    `);
    
    const teams: Record<string, TeamRecord> = {};
    for (const row of result.rows) {
      teams[row.key as string] = {
        id: row.id as string,
        name: row.name as string,
        mascot: (row.mascot as string) || undefined,
        logo: (row.logo as string) || '',
      };
    }
    
    return teams;
  } finally {
    await pool.end();
  }
}

/**
 * Update teams in database using direct connection
 */
async function updateTeamsInDB(teams: Record<string, TeamRecord>): Promise<void> {
  const pool = getTeamDataConnection();
  
  try {
    // Delete all existing teams
    await pool.query('DELETE FROM team_reference_data');
    
    // Insert all teams
    const entries = Object.entries(teams);
    if (entries.length > 0) {
      for (const [key, team] of entries) {
        await pool.query(
          `INSERT INTO team_reference_data (key, id, name, mascot, logo, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE
           SET id = EXCLUDED.id,
               name = EXCLUDED.name,
               mascot = EXCLUDED.mascot,
               logo = EXCLUDED.logo,
               updated_at = CURRENT_TIMESTAMP`,
          [key, team.id, team.name, team.mascot || null, team.logo || null]
        );
      }
    }
  } finally {
    await pool.end();
  }
}

/**
 * Find team in database by ID
 * Returns the team record and its key
 */
function findTeamById(teams: Record<string, TeamRecord>, id: string): { team: TeamRecord; key: string } | null {
  for (const [key, team] of Object.entries(teams)) {
    if (team.id === id) {
      return { team, key };
    }
  }
  return null;
}

/**
 * Main sync function
 */
async function syncTeamsFromESPN(
  startId: number,
  endId: number,
  updateMode: boolean
): Promise<SyncResult> {
  const startTime = new Date();
  const reports: SyncReport[] = [];
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ESPN Team Sync Script`);
  console.log(`Mode: ${updateMode ? 'REPORT AND UPDATE' : 'REPORT ONLY'}`);
  console.log(`Range: ${startId} to ${endId}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all existing teams from database
  console.log('Loading existing teams from database...');
  const existingTeams = await getAllTeamsFromDB();
  console.log(`Found ${Object.keys(existingTeams).length} existing teams in database.\n`);

  // Process each team ID
  for (let teamId = startId; teamId <= endId; teamId++) {
    const idString = teamId.toString();
    console.log(`Processing ID ${teamId}...`);

    try {
      // Fetch ESPN page
      const response = await fetchESPNTeamPage(teamId);
      
      if (!response) {
        reports.push({
          id: idString,
          action: 'error',
          message: 'Failed to fetch ESPN page'
        });
        console.log(`  ❌ Error: Failed to fetch page\n`);
        continue;
      }

      const { html, statusCode } = response;

      // Check if page is valid
      if (!isValidTeamPage(html, statusCode)) {
        // Team not found on ESPN
        const existingTeamData = findTeamById(existingTeams, idString);
        
        if (existingTeamData) {
          // Team exists in DB but not on ESPN - this is odd, but we'll report it
          reports.push({
            id: idString,
            action: 'not_found',
            dbName: existingTeamData.team.name,
            message: `Team exists in DB (${existingTeamData.team.name}) but not found on ESPN`
          });
          console.log(`  ⚠️  Team exists in DB but not on ESPN: ${existingTeamData.team.name}\n`);
        } else {
          // Team doesn't exist in either place - skip
          reports.push({
            id: idString,
            action: 'not_found',
            message: `Team not found on ESPN and not in database`
          });
          console.log(`  ⏭️  Not found on ESPN or in DB\n`);
        }
        continue;
      }

      // Extract team name from ESPN
      const espnTeamName = extractTeamNameFromHTML(html);
      
      if (!espnTeamName) {
        reports.push({
          id: idString,
          action: 'error',
          message: 'Could not extract team name from ESPN page'
        });
        console.log(`  ❌ Error: Could not extract team name\n`);
        continue;
      }

      // Extract mascot from ESPN page
      const espnMascot = extractMascotFromHTML(html, espnTeamName);
      
      // Debug output for mascot extraction
      if (espnMascot) {
        console.log(`  📋 Extracted mascot: "${espnMascot}"`);
      }
      
      // Split team name and mascot if needed
      // ESPN typically provides "School Name Mascot" format
      // We'll try to split it intelligently, but keep the full name if we can't determine
      let schoolName = espnTeamName;
      let mascot = espnMascot;
      
      // If we don't have a separate mascot but the name contains typical mascot patterns
      if (!mascot) {
        // Try to extract mascot from the name (common pattern: "School Location Mascot")
        const nameParts = espnTeamName.trim().split(/\s+/);
        if (nameParts.length >= 3) {
          // Likely format: "Alaska Anchorage Seawolves" -> "Alaska Anchorage" / "Seawolves"
          // Or "North Carolina Tar Heels" -> "North Carolina" / "Tar Heels"
          const lastWord = nameParts[nameParts.length - 1];
          const secondLastWord = nameParts[nameParts.length - 2];
          
          // Check if last two words together might be mascot (e.g., "Tar Heels")
          const potentialMascot = `${secondLastWord} ${lastWord}`;
          const schoolEndings = ['State', 'University', 'College', 'Tech', 'A&M'];
          
          // If last word looks like a mascot (not a school ending) and we have multiple words
          if (!schoolEndings.includes(lastWord) && 
              !schoolEndings.includes(secondLastWord) &&
              lastWord.length > 3) {
            mascot = potentialMascot;
            schoolName = nameParts.slice(0, -2).join(' ');
          } else if (!schoolEndings.includes(lastWord) && lastWord.length > 3) {
            mascot = lastWord;
            schoolName = nameParts.slice(0, -1).join(' ');
          }
        } else if (nameParts.length === 2) {
          // Two word format: might be "School Mascot" or just "School Name"
          const lastWord = nameParts[1];
          const schoolEndings = ['State', 'University', 'College', 'Tech', 'A&M'];
          if (!schoolEndings.includes(lastWord) && lastWord.length > 3) {
            // Last word might be mascot
            mascot = lastWord;
            schoolName = nameParts[0];
          }
        }
      }

      // Check if team exists in database
      const existingTeamData = findTeamById(existingTeams, idString);

      if (existingTeamData) {
        // Team exists - check if names match
        const { team: existingTeam, key: teamKey } = existingTeamData;
        const dbName = existingTeam.name.replace(' ERROR', ''); // Remove existing ERROR tag for comparison
        
        // Compare school name (without mascot) for matching
        const dbNameLower = dbName.toLowerCase().trim();
        const schoolNameLower = schoolName.toLowerCase().trim();
        
        if (dbNameLower === schoolNameLower || dbNameLower === espnTeamName.toLowerCase().trim()) {
          // Names match - update mascot if needed
          reports.push({
            id: idString,
            action: 'match',
            dbName: existingTeam.name,
            espnName: espnTeamName,
            message: `Match: ${existingTeam.name}`
          });
          console.log(`  ✅ Match: ${existingTeam.name}`);
          if (mascot && mascot !== existingTeam.mascot) {
            console.log(`      Mascot update: "${existingTeam.mascot || '(none)'}" -> "${mascot}"`);
            if (updateMode) {
              // Update mascot if it changed
              existingTeams[teamKey] = { ...existingTeam, mascot: mascot || undefined };
            }
          } else if (!existingTeam.mascot && mascot) {
            console.log(`      Adding mascot: "${mascot}"`);
            if (updateMode) {
              existingTeams[teamKey] = { ...existingTeam, mascot: mascot };
            }
          }
          console.log('');
        } else {
          // Names don't match - append ERROR
          const updatedName = existingTeam.name.includes(' ERROR') 
            ? existingTeam.name 
            : `${existingTeam.name} ERROR`;
          
          reports.push({
            id: idString,
            action: 'mismatch',
            dbName: existingTeam.name,
            espnName: espnTeamName,
            message: `Mismatch: DB has "${existingTeam.name}" but ESPN shows "${espnTeamName}"`
          });
          
          console.log(`  ⚠️  Mismatch:`);
          console.log(`      DB:    ${existingTeam.name}${existingTeam.mascot ? ` (${existingTeam.mascot})` : ''}`);
          console.log(`      ESPN:  ${espnTeamName}`);
          console.log(`      Parsed: School="${schoolName}"${mascot ? `, Mascot="${mascot}"` : ', Mascot=not detected'}`);
          
          if (updateMode) {
            // Update the team name with ERROR appended, and update mascot if provided
            existingTeams[teamKey] = { 
              ...existingTeam, 
              name: updatedName, 
              mascot: mascot || existingTeam.mascot || undefined 
            };
            console.log(`  ✓ Updated: ${updatedName}${mascot ? ` (mascot: ${mascot})` : existingTeam.mascot ? ` (mascot: ${existingTeam.mascot})` : ''}\n`);
          } else {
            console.log(`  (Report only - not updated)\n`);
          }
        }
      } else {
        // Team doesn't exist in database - create it
        const abbreviation = idString; // Use ID as abbreviation as specified
        const newTeam: TeamRecord = {
          id: idString,
          name: schoolName, // Use school name, not full display name
          mascot: mascot || undefined,
          logo: '' // Logo path will be empty for now
        };

        reports.push({
          id: idString,
          action: 'created',
          espnName: espnTeamName,
          message: `New team created: ${espnTeamName} (ID: ${idString})`
        });

        console.log(`  ✨ New team found: ${espnTeamName} (ID: ${idString})`);
        if (mascot) {
          console.log(`      School: ${schoolName}, Mascot: ${mascot}`);
        } else {
          console.log(`      School: ${schoolName} (mascot not detected)`);
        }
        
        if (updateMode) {
          existingTeams[abbreviation] = newTeam;
          console.log(`  ✓ Added to database\n`);
        } else {
          console.log(`  (Report only - not added)\n`);
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reports.push({
        id: idString,
        action: 'error',
        message: `Error processing: ${errorMessage}`
      });
      console.log(`  ❌ Error: ${errorMessage}\n`);
    }
  }

  // Update database if in update mode
  if (updateMode && Object.keys(existingTeams).length > 0) {
    console.log('Updating database...');
    await updateTeamsInDB(existingTeams);
    console.log('✓ Database updated successfully.\n');
  }

  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();

  // Generate summary
  const summary = {
    total: reports.length,
    matches: reports.filter(r => r.action === 'match').length,
    mismatches: reports.filter(r => r.action === 'mismatch').length,
    created: reports.filter(r => r.action === 'created').length,
    notFound: reports.filter(r => r.action === 'not_found').length,
    errors: reports.filter(r => r.action === 'error').length,
  };

  return {
    startTime,
    endTime,
    duration,
    reports,
    summary
  };
}

/**
 * Print report
 */
function printReport(result: SyncResult) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('SYNC REPORT SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Start Time:    ${result.startTime.toLocaleString()}`);
  console.log(`End Time:      ${result.endTime.toLocaleString()}`);
  console.log(`Duration:      ${(result.duration / 1000).toFixed(2)} seconds`);
  console.log(`\nResults:`);
  console.log(`  Total Processed: ${result.summary.total}`);
  console.log(`  ✅ Matches:      ${result.summary.matches}`);
  console.log(`  ⚠️  Mismatches:   ${result.summary.mismatches}`);
  console.log(`  ✨ Created:       ${result.summary.created}`);
  console.log(`  ⏭️  Not Found:    ${result.summary.notFound}`);
  console.log(`  ❌ Errors:        ${result.summary.errors}`);

  if (result.summary.mismatches > 0) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('MISMATCHES FOUND:');
    console.log(`${'='.repeat(60)}`);
    result.reports
      .filter(r => r.action === 'mismatch')
      .forEach(r => {
        console.log(`ID ${r.id}:`);
        console.log(`  DB:   ${r.dbName}`);
        console.log(`  ESPN: ${r.espnName}`);
        console.log('');
      });
  }

  if (result.summary.created > 0) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('NEW TEAMS CREATED:');
    console.log(`${'='.repeat(60)}`);
    result.reports
      .filter(r => r.action === 'created')
      .forEach(r => {
        console.log(`ID ${r.id}: ${r.espnName}`);
      });
    console.log('');
  }

  if (result.summary.errors > 0) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('ERRORS:');
    console.log(`${'='.repeat(60)}`);
    result.reports
      .filter(r => r.action === 'error')
      .forEach(r => {
        console.log(`ID ${r.id}: ${r.message}`);
      });
    console.log('');
  }
}

/**
 * Main entry point
 */
async function main() {
  // Load environment variables from .env.local if it exists
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: false });
    console.log('✓ Loaded environment variables from .env.local');
  } else {
    console.log('ℹ .env.local not found, using system environment variables');
  }
  
  // Also try .env file
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
    console.log('✓ Loaded environment variables from .env');
  }
  
  console.log('');

  const args = process.argv.slice(2);
  const mode = args[0];

  if (!mode || (mode !== 'report' && mode !== 'update')) {
    console.error('Usage: npm run sync-teams [report|update] [startId] [endId]');
    console.error('  report: Report differences only (no database updates)');
    console.error('  update: Report and update database');
    console.error('  startId: Starting team ID (default: 1)');
    console.error('  endId: Ending team ID (default: 20)');
    console.error('\nNote: This script requires POSTGRES_URL_PROD or POSTGRES_URL environment variable');
    process.exit(1);
  }

  // Check for database connection
  if (!process.env.POSTGRES_URL_PROD && !process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL_PROD or POSTGRES_URL environment variable must be set');
    process.exit(1);
  }

  const startId = parseInt(args[1]) || 1;
  const endId = parseInt(args[2]) || 20;

  if (startId > endId) {
    console.error('Error: startId must be less than or equal to endId');
    process.exit(1);
  }

  const updateMode = mode === 'update';

  try {
    const result = await syncTeamsFromESPN(startId, endId, updateMode);
    printReport(result);

    // Estimate time for 1-4000
    const avgTimePerId = result.duration / (endId - startId + 1);
    const estimatedTimeFor4000 = avgTimePerId * 4000;
    const estimatedMinutes = estimatedTimeFor4000 / 1000 / 60;

    console.log(`\n${'='.repeat(60)}`);
    console.log('ESTIMATE FOR 1-4000:');
    console.log(`${'='.repeat(60)}`);
    console.log(`Average time per ID: ${(avgTimePerId / 1000).toFixed(2)} seconds`);
    console.log(`Estimated time for 1-4000: ${estimatedMinutes.toFixed(2)} minutes (${(estimatedMinutes / 60).toFixed(2)} hours)`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();

