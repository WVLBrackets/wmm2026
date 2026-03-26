/**
 * Server-side announcements data fetching
 * Used by the Home page to bake announcements into static HTML
 */

import { unstable_cache } from 'next/cache';

export interface Announcement {
  date: string;
  text: string;
}

// Google Sheet ID for Announcements
const ANNOUNCEMENTS_SHEET_ID = '1_SkkH81ClEFGYyPmo6joN8vV1gdeCtRnzikkMskCB4k';

/** Must match site config fetch — avoids hung home page when Sheets/network stalls locally */
const ANNOUNCEMENTS_FETCH_TIMEOUT_MS = 10_000;

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

const FALLBACK_ANNOUNCEMENTS: Announcement[] = [
  {
    date: '10/1/2025',
    text: 'Tournament Registration Opens January 15th',
  },
  {
    date: '10/1/2025',
    text: 'Prize Pool Increased to $7,500',
  },
];

/**
 * Whether an error is Next.js "dynamic server" noise from mixing `no-store` fetch with static prerender.
 * Not logged as a Sheets failure once fetch uses ISR-style caching.
 */
function isNextDynamicServerUsageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const msg = 'message' in error && typeof (error as Error).message === 'string' ? (error as Error).message : '';
  const digest = 'digest' in error && typeof (error as { digest?: string }).digest === 'string'
    ? (error as { digest: string }).digest
    : '';
  return (
    msg.includes('Dynamic server usage') ||
    msg.includes('dynamic server') ||
    digest === 'DYNAMIC_SERVER_USAGE'
  );
}

async function fetchAnnouncementsFromSheets(): Promise<Announcement[]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${ANNOUNCEMENTS_SHEET_ID}/export?format=csv&gid=0`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANNOUNCEMENTS_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    // `cache: 'no-store'` forces the home route dynamic; align TTL with site config (5m) for static prerender + ISR
    response = await fetch(csvUrl, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    clearTimeout(timeoutId);
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error(`Announcements fetch timed out after ${ANNOUNCEMENTS_FETCH_TIMEOUT_MS / 1000} seconds`);
    }
    throw fetchError;
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const csvText = await response.text();
  const lines = csvText.split('\n');

  const announcements: Announcement[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length >= 2 && fields[1].trim()) {
      announcements.push({
        date: fields[0].trim(),
        text: fields[1].trim(),
      });
    }
  }

  return announcements;
}

/**
 * Fetch announcements from Google Sheets (server-side), cached for static generation / ISR.
 */
async function getAnnouncementsUncached(): Promise<Announcement[]> {
  try {
    return await fetchAnnouncementsFromSheets();
  } catch (error) {
    if (!isNextDynamicServerUsageError(error)) {
      console.error('Error loading announcements from Google Sheets:', error);
    }
    return FALLBACK_ANNOUNCEMENTS;
  }
}

const getCachedAnnouncements = unstable_cache(getAnnouncementsUncached, ['home-announcements'], {
  revalidate: 300,
  tags: ['announcements'],
});

/**
 * Public entry — uses Next data cache (5m) so home prerender does not opt into dynamic rendering.
 */
export async function getAnnouncements(): Promise<Announcement[]> {
  return getCachedAnnouncements();
}

