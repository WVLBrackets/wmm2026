import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBracketById, Bracket, getUserByEmail } from '@/lib/secureDatabase';
import { getSiteConfigFromGoogleSheets, SiteConfigData } from '@/lib/siteConfig';
import { sendOnDemandPdfEmail, processEmailAsync } from '@/lib/bracketEmailService';
import { TournamentData, TournamentBracket, TournamentTeam } from '@/types/tournament';
// PDF generation using puppeteer
// Install: npm install puppeteer-core @sparticuz/chromium

export async function POST(request: NextRequest) {
  try {
    console.log('[Email PDF] Starting request');
    
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      console.log('[Email PDF] Unauthorized - no session');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { bracketId, siteConfig: providedSiteConfig } = await request.json();
    console.log('[Email PDF] Bracket ID:', bracketId);
    console.log('[Email PDF] Site config provided:', !!providedSiteConfig);

    if (!bracketId) {
      return NextResponse.json(
        { success: false, error: 'Bracket ID is required' },
        { status: 400 }
      );
    }

    // Fetch bracket data
    console.log('[Email PDF] Fetching bracket...');
    const bracket = await getBracketById(bracketId);

    if (!bracket) {
      console.log('[Email PDF] Bracket not found');
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    // Get user by email to verify ownership
    console.log('[Email PDF] Verifying ownership...');
    const user = await getUserByEmail(session.user.email);
    if (!user || bracket.userId !== user.id) {
      console.log('[Email PDF] Ownership verification failed');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Only allow emailing submitted brackets
    if (bracket.status !== 'submitted') {
      console.log('[Email PDF] Bracket not submitted, status:', bracket.status);
      return NextResponse.json(
        { success: false, error: 'Only submitted brackets can be emailed' },
        { status: 400 }
      );
    }

    // Store email in a const for use in async function (TypeScript type narrowing)
    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'User email not available' },
        { status: 400 }
      );
    }

    // Use provided site config from client (already loaded on page), or fetch if not provided
    // This avoids unnecessary fetch calls and timeout issues
    let siteConfig: SiteConfigData | null = providedSiteConfig || null;
    if (!siteConfig) {
      console.log('[Email PDF] Site config not provided, fetching from Google Sheets...');
      try {
        const configStartTime = Date.now();
        siteConfig = await getSiteConfigFromGoogleSheets();
        const configTime = Date.now() - configStartTime;
        console.log(`[Email PDF] Site config loaded successfully in ${configTime}ms`);
        if (!siteConfig) {
          console.warn('[Email PDF] Site config returned null, will use fallback values');
        }
      } catch (configError) {
        console.error('[Email PDF] ERROR: Failed to load site config:', configError);
        // Continue anyway - we'll use fallback values in the template
        siteConfig = null;
      }
    } else {
      console.log('[Email PDF] Using site config provided by client (no fetch needed)');
    }

    // Process PDF generation and email asynchronously using centralized service
    // This keeps the execution context alive after returning the response
    console.log('[Email PDF] Starting background PDF generation and email processing...');
    
    const emailPromise = sendOnDemandPdfEmail(
      bracket,
      { name: session.user.name ?? null, email: userEmail },
      siteConfig
    );
    
    // Use waitUntil to keep execution context alive after response
    processEmailAsync(emailPromise);
    
    // Return success immediately - background processing will continue
    return NextResponse.json({
      success: true,
      message: 'Email is being processed and will be sent shortly',
    });
  } catch (error) {
    console.error('[Email PDF] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Email PDF] Error details:', { 
      errorMessage, 
      errorStack,
      errorName: error instanceof Error ? error.name : undefined
    });
    
    // Return error details in staging/development for debugging
    const isStaging = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'An error occurred while sending the email',
        details: isStaging ? errorMessage : undefined,
        stack: isStaging && errorStack ? errorStack.substring(0, 500) : undefined
      },
      { status: 500 }
    );
  }
}

// Types for puppeteer (optional dependencies)
interface Browser {
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
}



interface Page {
  setContent: (html: string, options?: { waitUntil?: string }) => Promise<void>;
  setRequestInterception: (value: boolean) => Promise<void>;
  setViewport: (viewport: { width: number; height: number; deviceScaleFactor?: number }) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, handler: (arg: any) => void) => void;
  pdf: (options: {
    format?: string;
    landscape?: boolean;
    printBackground?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    preferCSSPageSize?: boolean;
    displayHeaderFooter?: boolean;
  }) => Promise<Buffer>;
}

interface PuppeteerType {
  launch: (options: unknown) => Promise<Browser>;
}

interface ChromiumType {
  args: string[];
  defaultViewport: { width: number; height: number };
  headless: boolean;
  setGraphicsMode: (mode: boolean) => void;
  executablePath: () => Promise<string>;
}

export async function generateBracketPDF(
  bracket: Bracket,
  updatedBracket: TournamentBracket,
  tournamentData: TournamentData,
  siteConfig: SiteConfigData | null
): Promise<Buffer> {
  console.log('[PDF Generation] Starting...');
  
  // Dynamically require puppeteer packages only at runtime (optional dependencies)
  let puppeteer: PuppeteerType | null = null;
  let chromium: ChromiumType | null = null;
  
  try {
    console.log('[PDF Generation] Loading puppeteer-core...');
    // Use dynamic require to avoid build-time module resolution errors
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    puppeteer = require('puppeteer-core') as PuppeteerType;
    console.log('[PDF Generation] puppeteer-core loaded');
  } catch (error) {
    console.error('[PDF Generation] Failed to load puppeteer-core:', error);
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error('[PDF Generation] Error details:', errorDetails);
    throw new Error(`Failed to load puppeteer-core: ${errorDetails}. Make sure puppeteer-core is installed in dependencies.`);
  }
  
  try {
    console.log('[PDF Generation] Loading @sparticuz/chromium...');
    // Use dynamic require to avoid build-time module resolution errors
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    chromium = require('@sparticuz/chromium') as ChromiumType;
    if (chromium && typeof chromium.setGraphicsMode === 'function') {
      chromium.setGraphicsMode(false);
    }
    console.log('[PDF Generation] @sparticuz/chromium loaded');
  } catch (error) {
    console.error('[PDF Generation] Failed to load @sparticuz/chromium:', error);
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error('[PDF Generation] Error details:', errorDetails);
    throw new Error(`Failed to load @sparticuz/chromium: ${errorDetails}. Make sure @sparticuz/chromium is installed in dependencies.`);
  }
  
  if (!puppeteer || !chromium) {
    throw new Error('PDF generation requires puppeteer-core and @sparticuz/chromium. Please install: npm install puppeteer-core @sparticuz/chromium');
  }

  let browser: Browser | null = null;
  
  try {
    // Launch browser with Chromium
    // Use Chromium for both production and preview (staging) environments
    // Only use local Chrome for local development
    const vercelEnv = process.env.VERCEL_ENV;
    const isVercel = vercelEnv === 'production' || vercelEnv === 'preview';
    console.log('[PDF Generation] Environment:', vercelEnv, 'isVercel:', isVercel);
    
    console.log('[PDF Generation] Launching browser...');
    console.log('[PDF Generation] About to call chromium.executablePath()...');
    let executablePath: string;
    if (isVercel) {
      // Add timeout to executablePath call (10 seconds)
      const execPathStartTime = Date.now();
      console.log('[PDF Generation] Setting up executablePath timeout...');
      try {
        console.log('[PDF Generation] Calling chromium.executablePath()...');
        const execPathPromise = chromium.executablePath();
        console.log('[PDF Generation] chromium.executablePath() called, setting up timeout...');
        let timeoutId: NodeJS.Timeout | null = null;
        const execPathTimeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            console.error('[PDF Generation] TIMEOUT: chromium.executablePath() exceeded 10 seconds');
            reject(new Error('chromium.executablePath() timed out after 10 seconds'));
          }, 10000);
        });
        console.log('[PDF Generation] Racing executablePath promise with timeout...');
        try {
          executablePath = await Promise.race([execPathPromise, execPathTimeout]) as string;
          // Clear timeout if operation completed successfully
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          const execPathTime = Date.now() - execPathStartTime;
          console.log(`[PDF Generation] Executable path retrieved in ${execPathTime}ms:`, executablePath);
        } catch (raceError) {
          // Clear timeout on error too
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          throw raceError;
        }
      } catch (execPathError) {
        const execPathTime = Date.now() - execPathStartTime;
        console.error(`[PDF Generation] Failed to get executable path after ${execPathTime}ms:`, execPathError);
        if (execPathError instanceof Error) {
          console.error('[PDF Generation] Error message:', execPathError.message);
          console.error('[PDF Generation] Error stack:', execPathError.stack);
        }
        throw execPathError;
      }
    } else {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome';
      console.log('[PDF Generation] Executable path (local):', executablePath);
    }
    
    // Add timeout to browser launch (30 seconds) to prevent hanging
    const launchTimeout = 30000;
    const launchStartTime = Date.now();
    
    const launchPromise = puppeteer.launch({
      args: isVercel ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    }) as Promise<Browser>;
    
    let launchTimeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      launchTimeoutId = setTimeout(() => {
        reject(new Error(`Browser launch timed out after ${launchTimeout}ms`));
      }, launchTimeout);
    });
    
    try {
      browser = await Promise.race([launchPromise, timeoutPromise]) as Browser;
      // Clear timeout if operation completed successfully
      if (launchTimeoutId) {
        clearTimeout(launchTimeoutId);
      }
      const launchTime = Date.now() - launchStartTime;
      console.log(`[PDF Generation] Browser launched successfully in ${launchTime}ms`);
    } catch (launchError) {
      // Clear timeout on error too
      if (launchTimeoutId) {
        clearTimeout(launchTimeoutId);
      }
      const launchTime = Date.now() - launchStartTime;
      console.error(`[PDF Generation] Browser launch failed after ${launchTime}ms:`, launchError);
      throw launchError;
    }

    const page = await browser.newPage();
    console.log('[PDF Generation] Page created');
    
    // Set viewport to A4 landscape dimensions (297mm x 210mm = 1123px x 794px at 96 DPI)
    await page.setViewport({
      width: 1123,
      height: 794,
      deviceScaleFactor: 1,
    });
    console.log('[PDF Generation] Viewport set to A4 landscape');

    // Generate HTML content for the bracket
    console.log('[PDF Generation] Generating HTML...');
    const htmlContent = await generatePrintPageHTML(bracket, updatedBracket, tournamentData, siteConfig);
    console.log('[PDF Generation] HTML generated, length:', htmlContent.length);
    
    console.log('[PDF Generation] Setting page content...');
    // Images are embedded as base64 data URLs, so no HTTP requests needed
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    console.log('[PDF Generation] Page content set');

    // Generate PDF
    console.log('[PDF Generation] Generating PDF...');
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
    });
    console.log('[PDF Generation] PDF generated, size:', pdf.length, 'bytes');

    return Buffer.from(pdf);
  } catch (error) {
    console.error('[PDF Generation] Error:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('[PDF Generation] Closing browser...');
      await browser.close();
    }
  }
}

/**
 * Convert relative logo path to base64 data URL
 * This avoids HTTP requests that might be blocked (401 errors)
 */
function getLogoAsBase64(logoPath: string | null | undefined): string {
  if (!logoPath) return '';
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    
    // Remove leading slash and construct file path
    const cleanPath = logoPath.startsWith('/') ? logoPath.slice(1) : logoPath;
    const filePath = path.join(process.cwd(), 'public', cleanPath);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`[PDF Generation] Logo file not found: ${filePath}`);
      return '';
    }
    
    // Read file and convert to base64
    const imageBuffer = fs.readFileSync(filePath);
    const base64 = imageBuffer.toString('base64');
    
    // Determine MIME type from file extension
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/png'; // default
    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    } else if (ext === '.webp') {
      mimeType = 'image/webp';
    }
    
    const dataUrl = `data:${mimeType};base64,${base64}`;
    console.log(`[PDF Generation] Logo converted to base64: ${logoPath} (${imageBuffer.length} bytes)`);
    return dataUrl;
  } catch (error) {
    console.error(`[PDF Generation] Error converting logo to base64 (${logoPath}):`, error);
    return '';
  }
}

/**
 * Get winner from a game based on picked winner ID
 */
function getWinnerFromGame(
  game: { team1?: TournamentTeam; team2?: TournamentTeam },
  pickedWinner: string | null
): TournamentTeam | null {
  if (!pickedWinner || !game?.team1 || !game?.team2) return null;
  return pickedWinner === game.team1.id ? game.team1 : game.team2;
}

/**
 * Render a team cell HTML
 */
function renderTeamCell(
  team: TournamentTeam | null,
  height: string,
  fontSize: string,
  showLogo: boolean,
  logoSize: number,
  placeholder: string = 'Winner'
): string {
  if (!team) {
    return `
      <div style="
        height: ${height};
        border: 1px solid #d1d5db;
        display: flex;
        align-items: center;
        padding: 2px 4px;
        font-size: ${fontSize};
        background-color: #ffffff;
      ">
        <span style="color: #9ca3af;">${placeholder}</span>
      </div>
    `;
  }

  const logoDataUrl = getLogoAsBase64(team.logo);
  const logoHtml = showLogo && logoDataUrl ? `
    <img
      src="${logoDataUrl}"
      alt="${team.name} logo"
      width="${logoSize}"
      height="${logoSize}"
      style="object-fit: contain; margin-right: 4px; flex-shrink: 0;"
    />
  ` : '';

  return `
    <div style="
      height: ${height};
      border: 1px solid #d1d5db;
      display: flex;
      align-items: center;
      padding: 2px 4px;
      font-size: ${fontSize};
      background-color: #ffffff;
    ">
      ${logoHtml}
      <span style="font-weight: bold; margin-right: 2px;">#${team.seed}</span>
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${team.name}
      </span>
    </div>
  `;
}

/**
 * Render a vertical team cell (for Elite 8 and Final Four)
 */
function renderVerticalTeamCell(
  team: TournamentTeam | null,
  height: string,
  fontSize: string,
  logoSize: number,
  placeholder: string = 'Winner'
): string {
  if (!team) {
    return `
      <div style="
        height: ${height};
        border: 1px solid #d1d5db;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2px 4px;
        font-size: ${fontSize};
        background-color: #ffffff;
      ">
        <span style="color: #9ca3af;">${placeholder}</span>
      </div>
    `;
  }

  const logoDataUrl = getLogoAsBase64(team.logo);
  const logoHtml = logoDataUrl ? `
    <img
      src="${logoDataUrl}"
      alt="${team.name} logo"
      width="${logoSize}"
      height="${logoSize}"
      style="object-fit: contain; flex-shrink: 0;"
    />
  ` : '';

  return `
    <div style="
      height: ${height};
      border: 1px solid #d1d5db;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2px 4px;
      font-size: ${fontSize};
      background-color: #ffffff;
    ">
      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 2px;">
        <span style="font-weight: bold; margin-right: 2px;">#${team.seed}</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${team.name}
        </span>
      </div>
      ${logoHtml}
    </div>
  `;
}

/**
 * Render region columns HTML
 */
function renderRegionColumns(
  regionKey: string,
  regionIndex: number,
  bracket: TournamentBracket,
  picks: Record<string, string>,
  tournamentData: TournamentData
): string {
  const isRightSide = regionIndex >= 2;
  const columnOrder = isRightSide 
    ? ['Final Four', 'Elite 8', 'Sweet 16', 'Round of 32', 'Round of 64']
    : ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four'];
  
  const regionGames = bracket.regions[regionKey] || [];
  
  return columnOrder.map(round => {
    if (round === 'Round of 64') {
      const region = tournamentData.regions[regionIndex];
      return `
        <div style="min-width: 90px; flex: 1 1 0; display: flex; flex-direction: column;">
          <div style="display: flex; flex-direction: column; gap: 0px; flex: 1;">
            ${region.teams.map((team) => {
              return renderTeamCell(team, '6%', '8px', false, 0);
            }).join('')}
          </div>
        </div>
      `;
    } else if (round === 'Round of 32') {
      return `
        <div style="min-width: 90px; flex: 1 1 0; display: flex; flex-direction: column;">
          <div style="display: flex; flex-direction: column; gap: 0px; flex: 1;">
            ${Array.from({ length: 8 }, (_, gameIndex) => {
              const roundOf64Game = regionGames.find(g => g.round === 'Round of 64' && g.gameNumber === gameIndex + 1);
              const winner = roundOf64Game ? getWinnerFromGame(roundOf64Game, picks[roundOf64Game.id]) : null;
              return renderTeamCell(winner, '12%', '10px', true, 12);
            }).join('')}
          </div>
        </div>
      `;
    } else if (round === 'Sweet 16') {
      return `
        <div style="min-width: 90px; flex: 1 1 0; display: flex; flex-direction: column;">
          <div style="display: flex; flex-direction: column; gap: 0px; flex: 1;">
            <div style="height: 6%;"></div>
            ${Array.from({ length: 4 }, (_, gameIndex) => {
              const roundOf32Game = regionGames.find(g => g.round === 'Round of 32' && g.gameNumber === gameIndex + 1);
              const winner = roundOf32Game ? getWinnerFromGame(roundOf32Game, picks[roundOf32Game.id]) : null;
              return `
                <div style="height: 12%;">
                  ${renderTeamCell(winner, '100%', '12px', true, 14)}
                </div>
                ${gameIndex < 3 ? '<div style="height: 12%;"></div>' : ''}
              `;
            }).join('')}
            <div style="height: 6%;"></div>
          </div>
        </div>
      `;
    } else if (round === 'Elite 8') {
      return `
        <div style="min-width: 90px; flex: 1 1 0; display: flex; flex-direction: column;">
          <div style="display: flex; flex-direction: column; gap: 0px; flex: 1;">
            <div style="height: 12%;"></div>
            ${Array.from({ length: 2 }, (_, gameIndex) => {
              const sweet16Game = regionGames.find(g => g.round === 'Sweet 16' && g.gameNumber === gameIndex + 1);
              const winner = sweet16Game ? getWinnerFromGame(sweet16Game, picks[sweet16Game.id]) : null;
              return `
                <div style="height: 24%;">
                  ${renderVerticalTeamCell(winner, '100%', '12px', 20)}
                </div>
                ${gameIndex < 1 ? '<div style="height: 24%;"></div>' : ''}
              `;
            }).join('')}
            <div style="height: 12%;"></div>
          </div>
        </div>
      `;
    } else if (round === 'Final Four') {
      return `
        <div style="min-width: 90px; flex: 1 1 0; display: flex; flex-direction: column;">
          <div style="display: flex; flex-direction: column; gap: 0px; flex: 1;">
            <div style="height: 36%;"></div>
            ${(() => {
              const elite8Game = regionGames.find(g => g.round === 'Elite 8' && g.gameNumber === 1);
              const winner = elite8Game ? getWinnerFromGame(elite8Game, picks[elite8Game.id]) : null;
              return `
                <div style="height: 24%;">
                  ${renderVerticalTeamCell(winner, '100%', '12px', 20)}
                </div>
              `;
            })()}
            <div style="height: 36%;"></div>
          </div>
        </div>
      `;
    }
    return '';
  }).join('');
}

/**
 * Render Final Four section HTML
 */
function renderFinalFourSection(
  picks: Record<string, string>,
  tournamentData: TournamentData,
  tieBreaker: string | number | undefined
): string {
  const semifinal1Pick = picks['final-four-1'];
  const semifinal2Pick = picks['final-four-2'];

  const finalist1 = semifinal1Pick 
    ? tournamentData.regions.flatMap(r => r.teams).find(t => t.id === semifinal1Pick) 
    : null;
  const finalist2 = semifinal2Pick 
    ? tournamentData.regions.flatMap(r => r.teams).find(t => t.id === semifinal2Pick) 
    : null;

  const finalist1Logo = getLogoAsBase64(finalist1?.logo);
  const finalist2Logo = getLogoAsBase64(finalist2?.logo);

  return `
    <div style="
      width: 50%;
      max-width: 500px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      padding: 6px 8px;
      align-items: center;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background-color: #ffffff;
      min-height: 40px;
    ">
      <div style="
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        width: 100%;
        margin-bottom: 4px;
      ">
        <div style="flex: 1; display: flex; justify-content: center; align-items: center; padding-right: 10px; min-width: 0;">
          <div style="font-size: 14px; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 4px; min-width: 0; width: 100%;">
            ${finalist1 ? `
              <span style="font-weight: bold; flex-shrink: 0;">#${finalist1.seed}</span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;">${finalist1.name}</span>
              ${finalist1Logo ? `<img src="${finalist1Logo}" alt="${finalist1.name} logo" width="24" height="24" style="object-fit: contain; flex-shrink: 0;" />` : ''}
            ` : '<span style="color: #9ca3af;">Finalist 1</span>'}
          </div>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; width: 60px; flex-shrink: 0;">
          <div style="font-size: 14px; font-weight: bold; color: #374151;">VS</div>
        </div>
        <div style="flex: 1; display: flex; justify-content: center; align-items: center; padding-left: 10px; min-width: 0;">
          <div style="font-size: 14px; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 4px; min-width: 0; width: 100%;">
            ${finalist2 ? `
              ${finalist2Logo ? `<img src="${finalist2Logo}" alt="${finalist2.name} logo" width="24" height="24" style="object-fit: contain; flex-shrink: 0;" />` : ''}
              <span style="font-weight: bold; flex-shrink: 0;">#${finalist2.seed}</span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;">${finalist2.name}</span>
            ` : '<span style="color: #9ca3af;">Finalist 2</span>'}
          </div>
        </div>
      </div>
      <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
        Tie Breaker (Finals Total) = ${tieBreaker !== undefined && tieBreaker !== null ? tieBreaker.toString() : '—'}
      </div>
    </div>
  `;
}

/**
 * Generate complete HTML for print bracket page
 */
async function generatePrintPageHTML(
  bracket: Bracket,
  updatedBracket: TournamentBracket,
  tournamentData: TournamentData,
  siteConfig: SiteConfigData | null
): Promise<string> {
  const entryName = bracket.entryName || `Bracket ${bracket.id}`;
  const tournamentYear = siteConfig?.tournamentYear || '2025';
  const picks = bracket.picks || {};
  const tieBreaker = bracket.tieBreaker;
  
  // Get region names and indices
  const getRegionNameByPosition = (position: string): string => {
    const region = tournamentData.regions.find(r => r.position === position);
    return region?.name || position;
  };
  
  const getRegionIndexByPosition = (position: string): number => {
    const index = tournamentData.regions.findIndex(r => r.position === position);
    if (index !== -1) return index;
    if (position === 'Top Left') return 0;
    if (position === 'Bottom Left') return 1;
    if (position === 'Top Right') return 2;
    if (position === 'Bottom Right') return 3;
    return 0;
  };
  
  const topLeftRegionName = getRegionNameByPosition('Top Left');
  const topRightRegionName = getRegionNameByPosition('Top Right');
  const bottomLeftRegionName = getRegionNameByPosition('Bottom Left');
  const bottomRightRegionName = getRegionNameByPosition('Bottom Right');
  
  const topLeftIndex = getRegionIndexByPosition('Top Left');
  const topRightIndex = getRegionIndexByPosition('Top Right');
  const bottomLeftIndex = getRegionIndexByPosition('Bottom Left');
  const bottomRightIndex = getRegionIndexByPosition('Bottom Right');
  
  // Get champion info
  const championshipPick = picks['championship'];
  const championTeam = championshipPick 
    ? tournamentData.regions.flatMap(r => r.teams).find(t => t.id === championshipPick) 
    : null;
  const championLogo = getLogoAsBase64(championTeam?.logo);
  
  // Get champion mascot from team reference data
  let championMascot: string | null = null;
  if (championTeam) {
    try {
      const { getAllTeamReferenceData } = await import('@/lib/secureDatabase');
      const allTeams = await getAllTeamReferenceData(false);
      const teamMatch = Object.values(allTeams).find(team => team.id === championTeam.id);
      championMascot = teamMatch?.mascot || null;
    } catch (error) {
      console.error('[PDF Generation] Error loading champion mascot:', error);
      // Continue without mascot if lookup fails
    }
  }
  
  // Trophy icon PNG - get filename from config, convert to base64 for embedding in PDF
  const trophyIconFilename = siteConfig?.printBracketTrophy || 'trophy-icon.png';
  const trophyIconPath = `/images/${trophyIconFilename}`;
  const trophyIconBase64 = getLogoAsBase64(trophyIconPath);
  const trophyIconHTML = trophyIconBase64 
    ? `<img src="${trophyIconBase64}" alt="Trophy" width="20" height="20" style="object-fit: contain; flex-shrink: 0;" />`
    : '';
  
  // WMM Logo - convert to base64 for embedding in PDF, absolutely positioned to overlay content
  const wmmLogoBase64 = getLogoAsBase64('/images/WMM Logo.png');
  const wmmLogoHTML = wmmLogoBase64
    ? `<div style="position: absolute; top: 60px; left: 50%; transform: translateX(-50%); z-index: 10; pointer-events: none;">
        <img src="${wmmLogoBase64}" alt="WMM Logo" width="120" height="60" style="object-fit: contain;" />
      </div>`
    : '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${entryName} - ${tournamentYear} Bracket</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          font-family: Arial, sans-serif; 
          background: white;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        @page {
          size: A4 landscape;
          margin: 0;
        }
        body {
          height: 210mm;
          max-height: 210mm;
          overflow: hidden;
          page-break-inside: avoid;
          page-break-after: avoid;
          page-break-before: avoid;
          position: relative;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div style="
        padding: 8px 0px;
        border-bottom: 2px solid #000000;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 20px;
      ">
        <div style="flex: 1; display: flex; justify-content: flex-start; align-items: center; padding-left: 20px;">
          <span>${entryName}</span>
        </div>
        <div style="flex: 1; display: flex; justify-content: center; align-items: center;">
          <span>${tournamentYear}</span>
        </div>
        <div style="flex: 1; display: flex; justify-content: flex-end; align-items: center; gap: 6px; padding-right: 20px;">
          ${championTeam ? `
            ${trophyIconHTML}
            <span>${championTeam.name}</span>
            ${championMascot ? `<span>${championMascot}</span>` : ''}
            ${championLogo ? `<img src="${championLogo}" alt="${championTeam.name} logo" width="24" height="24" style="object-fit: contain; flex-shrink: 0;" />` : ''}
          ` : ''}
        </div>
      </div>
      
      <!-- WMM Logo - Absolutely positioned, overlaying content -->
      ${wmmLogoHTML}
      
      <!-- Bracket Content -->
      <div style="padding: 10px;">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- Top Row - Top Left and Top Right Regions -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <!-- Top Left Region -->
            <div style="padding: 3px; display: flex; flex-direction: column;">
              <div style="text-align: left; padding: 2px 15px; font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 2px;">
                ${topLeftRegionName}
              </div>
              <div style="display: flex; gap: 0px;">
                ${renderRegionColumns('Top Left', topLeftIndex, updatedBracket, picks, tournamentData)}
              </div>
            </div>
            
            <!-- Top Right Region -->
            <div style="padding: 3px; display: flex; flex-direction: column;">
              <div style="text-align: right; padding: 2px 15px; font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 2px;">
                ${topRightRegionName}
              </div>
              <div style="display: flex; gap: 0px;">
                ${renderRegionColumns('Top Right', topRightIndex, updatedBracket, picks, tournamentData)}
              </div>
            </div>
          </div>
          
          <!-- Final Four Section - Middle -->
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: -5px;
            margin-bottom: -5px;
            position: relative;
            z-index: 1;
          ">
            ${renderFinalFourSection(picks, tournamentData, tieBreaker)}
          </div>
          
          <!-- Bottom Row - Bottom Left and Bottom Right Regions -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <!-- Bottom Left Region -->
            <div style="padding: 3px; display: flex; flex-direction: column;">
              <div style="text-align: left; padding: 2px 15px; font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 2px;">
                ${bottomLeftRegionName}
              </div>
              <div style="display: flex; gap: 0px;">
                ${renderRegionColumns('Bottom Left', bottomLeftIndex, updatedBracket, picks, tournamentData)}
              </div>
            </div>
            
            <!-- Bottom Right Region -->
            <div style="padding: 3px; display: flex; flex-direction: column;">
              <div style="text-align: right; padding: 2px 15px; font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 2px;">
                ${bottomRightRegionName}
              </div>
              <div style="display: flex; gap: 0px;">
                ${renderRegionColumns('Bottom Right', bottomRightIndex, updatedBracket, picks, tournamentData)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

