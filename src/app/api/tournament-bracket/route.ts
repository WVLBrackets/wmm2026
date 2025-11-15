import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  createBracket, 
  getBracketsByUserId, 
  updateBracket, 
  getUserByEmail,
} from '@/lib/secureDatabase';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';
import { sendSubmissionConfirmationEmail, processEmailAsync } from '@/lib/bracketEmailService';

/**
 * POST /api/tournament-bracket - Create a new tournament bracket (submit)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.playerName || !body.playerEmail || !body.entryName || !body.picks) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: playerName, playerEmail, entryName, and picks are required'
        },
        { status: 400 }
      );
    }

    // Ensure the user is only creating brackets for themselves
    if (body.playerEmail !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'You can only create brackets for your own account' },
        { status: 403 }
      );
    }

    // Validate picks structure
    const picks = body.picks;
    if (typeof picks !== 'object' || Object.keys(picks).length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid picks data'
        },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get tournament year from config (same logic as createBracket)
    let tournamentYear = new Date().getFullYear(); // Default fallback
    try {
      const config = await getSiteConfigFromGoogleSheets();
      if (config?.tournamentYear) {
        tournamentYear = parseInt(config.tournamentYear);
      }
    } catch {
      // Use fallback config if Google Sheets fails
      const { FALLBACK_CONFIG } = await import('@/lib/fallbackConfig');
      if (FALLBACK_CONFIG.tournamentYear) {
        tournamentYear = parseInt(FALLBACK_CONFIG.tournamentYear);
      }
    }

    // Get all existing brackets for this user
    const existingBrackets = await getBracketsByUserId(user.id);
    
    // Check if there's already a submitted bracket with this name for the same year
    const duplicateNameExists = existingBrackets.some(
      bracket => bracket.entryName === body.entryName && 
                 bracket.status === 'submitted' && 
                 bracket.year === tournamentYear
    );

    if (duplicateNameExists) {
      return NextResponse.json(
        { 
          success: false, 
          error: `A submitted bracket with the name "${body.entryName}" already exists for ${tournamentYear}. Please choose a different name.`
        },
        { status: 400 }
      );
    }

    // Create new submitted bracket
    const bracket = await createBracket(
      user.id,
      body.entryName,
      body.tieBreaker,
      picks
    );
    
    // Update status to submitted
    const updatedBracket = await updateBracket(bracket.id, { status: 'submitted' });
    
    if (!updatedBracket) {
      return NextResponse.json(
        { success: false, error: 'Failed to submit bracket' },
        { status: 500 }
      );
    }

    // Send automated submission confirmation email in background
    // Process asynchronously using centralized service with waitUntil
    const emailPromise = (async () => {
      try {
        // Get all submitted brackets for this user to calculate counts
        const allUserBrackets = await getBracketsByUserId(user.id);
        const submittedBrackets = allUserBrackets.filter(b => b.status === 'submitted' && b.year === tournamentYear);
        const submissionCount = submittedBrackets.length;
        
        // Get entry cost from config
        let entryCost = 5; // Default
        let siteConfig = null;
        try {
          siteConfig = await getSiteConfigFromGoogleSheets();
          if (siteConfig?.entryCost) {
            entryCost = siteConfig.entryCost;
          }
        } catch {
          // Use default if config fails
          const { FALLBACK_CONFIG } = await import('@/lib/fallbackConfig');
          entryCost = FALLBACK_CONFIG.entryCost;
        }
        
        const totalCost = submissionCount * entryCost;
        
        // Use centralized email service
        await sendSubmissionConfirmationEmail(
          updatedBracket,
          user,
          siteConfig,
          submissionCount,
          totalCost
        );
      } catch (emailError) {
        // Log error but don't fail the submission (already returned success)
        console.error('[Submit Bracket] Error sending confirmation email:', emailError);
      }
    })();
    
    // Use waitUntil to keep execution context alive after response
    processEmailAsync(emailPromise);

    // Return bracket in the format expected by the frontend
    return NextResponse.json({
      success: true,
      data: {
        id: updatedBracket.id,
        playerName: user.name,
        playerEmail: user.email,
        entryName: updatedBracket.entryName,
        tieBreaker: updatedBracket.tieBreaker,
        submittedAt: updatedBracket.updatedAt.toISOString(),
        picks: updatedBracket.picks,
        totalPoints: 0,
        isComplete: true,
        isPublic: true,
        status: updatedBracket.status,
        bracketNumber: updatedBracket.bracketNumber,
        year: updatedBracket.year
      },
      message: 'Tournament bracket submitted successfully'
    });
  } catch (error) {
    console.error('Error creating tournament bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create tournament bracket' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tournament-bracket - Save in-progress bracket
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.playerName || !body.playerEmail || !body.entryName || !body.picks) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: playerName, playerEmail, entryName, and picks are required'
        },
        { status: 400 }
      );
    }

    // Ensure the user is only saving brackets for themselves
    if (body.playerEmail !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'You can only save brackets for your own account' },
        { status: 403 }
      );
    }

    // Get user from database
    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Always create a new in-progress bracket when using PUT without an ID
    // Users can have multiple in-progress brackets with the same name
    console.log('Creating new in-progress bracket for user:', user.id, 'with name:', body.entryName);
    
    const bracket = await createBracket(
      user.id,
      body.entryName,
      body.tieBreaker,
      body.picks
    );
    
    console.log('Bracket created with status:', bracket.status);
    
    // Set status to in_progress
    const updatedBracket = await updateBracket(bracket.id, { status: 'in_progress' });
    
    console.log('Updated bracket status:', updatedBracket?.status);
    
    if (!updatedBracket) {
      return NextResponse.json(
        { success: false, error: 'Failed to save bracket' },
        { status: 500 }
      );
    }

    // Return bracket in the format expected by the frontend
    return NextResponse.json({
      success: true,
      data: {
        id: updatedBracket.id,
        playerName: user.name,
        playerEmail: user.email,
        entryName: updatedBracket.entryName,
        tieBreaker: updatedBracket.tieBreaker,
        lastSaved: updatedBracket.updatedAt.toISOString(),
        picks: updatedBracket.picks,
        totalPoints: 0,
        isComplete: false,
        isPublic: false,
        status: updatedBracket.status,
        bracketNumber: updatedBracket.bracketNumber,
        year: updatedBracket.year
      },
      message: 'Bracket saved successfully'
    });
  } catch (error) {
    console.error('Error saving bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save bracket' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tournament-bracket - Get all tournament brackets for the current user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get tournament year from config
    const config = await getSiteConfigFromGoogleSheets();
    const tournamentYear = config?.tournamentYear ? parseInt(config.tournamentYear) : new Date().getFullYear();
    
    // Get all brackets for this user
    const brackets = await getBracketsByUserId(user.id);
    
    // Filter brackets to only include current tournament year
    const currentYearBrackets = brackets.filter(bracket => bracket.year === tournamentYear);
    
    // Transform to frontend format
    const formattedBrackets = currentYearBrackets.map(bracket => ({
      id: bracket.id,
      playerName: user.name,
      playerEmail: user.email,
      entryName: bracket.entryName,
      tieBreaker: bracket.tieBreaker,
      submittedAt: bracket.status === 'submitted' ? bracket.updatedAt.toISOString() : undefined,
      lastSaved: bracket.status === 'in_progress' ? bracket.updatedAt.toISOString() : undefined,
      picks: bracket.picks,
      totalPoints: 0,
      isComplete: bracket.status === 'submitted',
      bracketNumber: bracket.bracketNumber,
      year: bracket.year,
      isPublic: bracket.status === 'submitted',
      status: bracket.status
    }));
    
    return NextResponse.json({
      success: true,
      data: formattedBrackets,
      count: formattedBrackets.length
    });
  } catch (error) {
    console.error('Error fetching tournament brackets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tournament brackets' },
      { status: 500 }
    );
  }
}
