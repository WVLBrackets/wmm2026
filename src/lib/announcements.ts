/**
 * Server-side announcements data fetching
 * Used by the Home page to bake announcements into static HTML
 */

export interface Announcement {
  date: string;
  text: string;
}

// Google Sheet ID for Announcements
const ANNOUNCEMENTS_SHEET_ID = '1_SkkH81ClEFGYyPmo6joN8vV1gdeCtRnzikkMskCB4k';

/**
 * Parse a CSV line with proper handling of quoted fields
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
 * Fetch announcements from Google Sheets (server-side)
 * This is called during static page generation
 */
export async function getAnnouncements(): Promise<Announcement[]> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${ANNOUNCEMENTS_SHEET_ID}/export?format=csv&gid=0`;
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    const announcements: Announcement[] = [];
    
    // Skip header row and parse data
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const fields = parseCSVLine(line);
      if (fields.length >= 2 && fields[1].trim()) {
        announcements.push({
          date: fields[0].trim(),
          text: fields[1].trim()
        });
      }
    }
    
    return announcements;
  } catch (error) {
    console.error('Error loading announcements from Google Sheets:', error);
    // Return fallback announcements if Google Sheets can't be loaded
    return [
      {
        date: "10/1/2025",
        text: "Tournament Registration Opens January 15th"
      },
      {
        date: "10/1/2025",
        text: "Prize Pool Increased to $7,500"
      }
    ];
  }
}

