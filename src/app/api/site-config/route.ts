import { NextResponse } from 'next/server';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';

/**
 * API route to get site configuration
 * This allows client-side components to fetch config without calling unstable_cache directly
 */
export async function GET() {
  try {
    const config = await getSiteConfigFromGoogleSheets();
    
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Failed to load site configuration' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching site config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load site configuration' },
      { status: 500 }
    );
  }
}

