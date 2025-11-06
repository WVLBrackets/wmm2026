import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBracketById, Bracket, getUserByEmail } from '@/lib/secureDatabase';
import { emailService } from '@/lib/emailService';
import { loadTournamentData } from '@/lib/tournamentLoader';
import { generate64TeamBracket, updateBracketWithPicks } from '@/lib/bracketGenerator';
import { getSiteConfigFromGoogleSheets, SiteConfigData } from '@/lib/siteConfig';
import { TournamentData, TournamentBracket } from '@/types/tournament';
// PDF generation using puppeteer
// Install: npm install puppeteer-core @sparticuz/chromium
// Note: These packages are not installed yet, so PDF generation is disabled

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { bracketId } = await request.json();

    if (!bracketId) {
      return NextResponse.json(
        { success: false, error: 'Bracket ID is required' },
        { status: 400 }
      );
    }

    // Fetch bracket data
    const bracket = await getBracketById(bracketId);

    if (!bracket) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    // Get user by email to verify ownership
    const user = await getUserByEmail(session.user.email);
    if (!user || bracket.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Only allow emailing submitted brackets
    if (bracket.status !== 'submitted') {
      return NextResponse.json(
        { success: false, error: 'Only submitted brackets can be emailed' },
        { status: 400 }
      );
    }

    // Load tournament data and site config
    const siteConfig = await getSiteConfigFromGoogleSheets();
    const tournamentYear = siteConfig?.tournamentYear || '2025';
    const tournamentData = await loadTournamentData(tournamentYear);

    // Generate bracket with picks
    const generatedBracket = generate64TeamBracket(tournamentData);
    const updatedBracket = updateBracketWithPicks(generatedBracket, bracket.picks, tournamentData);

    // Generate PDF using Puppeteer
    const pdfBuffer = await generateBracketPDF(bracket, updatedBracket, tournamentData, siteConfig);

    // Send email with PDF attachment
    const entryName = bracket.entryName || `Bracket ${bracket.id}`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your Bracket - Warren's March Madness</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #2c3e50; text-align: center;">Your Bracket is Attached!</h2>
          <p>Hi ${session.user.name || 'there'},</p>
          <p>Great news! Your bracket "${entryName}" has been successfully submitted and is ready for the tournament!</p>
          <p>We've attached a PDF copy of your bracket for your records. Good luck with your picks!</p>
          <p>Let the madness begin! 🏀</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666; text-align: center;">
            This is an automated email from Warren's March Madness.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailText = `
      Your Bracket is Attached!
      
      Hi ${session.user.name || 'there'},
      
      Great news! Your bracket "${entryName}" has been successfully submitted and is ready for the tournament!
      
      We've attached a PDF copy of your bracket for your records. Good luck with your picks!
      
      Let the madness begin! 🏀
      
      This is an automated email from Warren's March Madness.
    `;

    const emailSent = await emailService.sendEmail({
      to: session.user.email,
      subject: `Your ${tournamentYear} Bracket - ${entryName}`,
      html: emailHtml,
      text: emailText,
      attachments: [
        {
          filename: `bracket-${bracket.id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (!emailSent) {
      return NextResponse.json(
        { success: false, error: 'Failed to send email. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Error sending bracket PDF email:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while sending the email' },
      { status: 500 }
    );
  }
}

// Types for puppeteer (optional dependencies)
interface PuppeteerType {
  launch: (options: unknown) => Promise<unknown>;
}

interface ChromiumType {
  args: string[];
  defaultViewport: { width: number; height: number };
  headless: boolean;
  setGraphicsMode: (mode: boolean) => void;
  executablePath: () => Promise<string>;
}

async function generateBracketPDF(
  bracket: Bracket,
  updatedBracket: TournamentBracket,
  tournamentData: TournamentData,
  siteConfig: SiteConfigData | null
): Promise<Buffer> {
  // Dynamically require puppeteer packages only at runtime (optional dependencies)
  let puppeteer: PuppeteerType | null = null;
  let chromium: ChromiumType | null = null;
  
  try {
    // Use dynamic require to avoid build-time module resolution errors
    puppeteer = eval('require')('puppeteer-core') as PuppeteerType;
  } catch {
    // puppeteer-core not installed
  }
  
  try {
    chromium = eval('require')('@sparticuz/chromium') as ChromiumType;
    if (chromium && typeof chromium.setGraphicsMode === 'function') {
      chromium.setGraphicsMode(false);
    }
  } catch {
    // @sparticuz/chromium not installed
  }
  
  if (!puppeteer || !chromium) {
    throw new Error('PDF generation requires puppeteer-core and @sparticuz/chromium. Please install: npm install puppeteer-core @sparticuz/chromium');
  }

  let browser;
  
  try {
    // Launch browser with Chromium
    const isProduction = process.env.VERCEL_ENV === 'production';
    
    browser = await puppeteer.launch({
      args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath: isProduction 
        ? await chromium.executablePath() 
        : process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Generate HTML content for the bracket
    const htmlContent = generatePrintPageHTML(bracket, updatedBracket, tournamentData, siteConfig);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
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
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generatePrintPageHTML(
  bracket: Bracket,
  updatedBracket: TournamentBracket,
  tournamentData: TournamentData,
  siteConfig: SiteConfigData | null
): string {
  // Generate HTML that matches the print-bracket page structure
  // This is a simplified version - should be enhanced to match the actual print-bracket page
  const entryName = bracket.entryName || `Bracket ${bracket.id}`;
  const tournamentYear = siteConfig?.tournamentYear || '2025';
  
  // TODO: Implement full bracket rendering matching the print-bracket page
  // For now, this is a placeholder
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${entryName} - ${tournamentYear} Bracket</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px;
          background: white;
        }
        .bracket-header {
          text-align: center;
          margin-bottom: 20px;
        }
        .bracket-header h1 {
          font-size: 24px;
          color: #333;
        }
        .bracket-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
      </style>
    </head>
    <body>
      <div class="bracket-header">
        <h1>${tournamentYear} Warren's March Madness</h1>
        <h2>${entryName}</h2>
      </div>
      <div class="bracket-container">
        <p>Full bracket rendering will be implemented here to match the print-bracket page.</p>
      </div>
    </body>
    </html>
  `;
}

