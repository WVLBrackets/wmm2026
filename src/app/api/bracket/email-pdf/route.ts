import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBracketById } from '@/lib/repositories/bracketRepository';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { SiteConfigData, SiteConfigError } from '@/lib/siteConfig';
import { getSiteConfigCached } from '@/lib/siteConfigServer';
import { sendOnDemandPdfEmail, processEmailAsync } from '@/lib/bracketEmailService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { bracketId, siteConfig: providedSiteConfig } = await request.json();

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

    // Store email in a const for use in async function (TypeScript type narrowing)
    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'User email not available' },
        { status: 400 }
      );
    }

    let siteConfig: SiteConfigData | null = providedSiteConfig || null;
    if (!siteConfig) {
      try {
        siteConfig = await getSiteConfigCached();
      } catch (configError) {
        console.error('[Email PDF] ERROR: Failed to load site config:', configError);
        const message =
          configError instanceof SiteConfigError
            ? configError.message
            : 'Site configuration is unavailable.';
        return NextResponse.json({ success: false, error: message }, { status: 503 });
      }
    }

    // Process PDF generation and email asynchronously using centralized service
    // This keeps the execution context alive after returning the response
    
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
    
    // Return generic error (never expose details)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'An error occurred while sending the email'
      },
      { status: 500 }
    );
  }
}
