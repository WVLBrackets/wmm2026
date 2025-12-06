import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getBracketById, 
  updateBracket, 
  deleteBracket,
  getUserByEmail 
} from '@/lib/secureDatabase';
import { sendSubmissionConfirmationEmail, processEmailAsync } from '@/lib/bracketEmailService';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { checkSubmissionAllowed } from '@/lib/bracketSubmissionValidator';

/**
 * GET /api/tournament-bracket/[id] - Get a specific bracket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bracket = await getBracketById(id);
    
    if (!bracket) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    // Get user to verify ownership
    const user = await getUserByEmail(session.user.email);
    if (!user || bracket.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to access this bracket' },
        { status: 403 }
      );
    }

    // Return bracket in frontend format
    return NextResponse.json({
      success: true,
      data: {
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
        isPublic: bracket.status === 'submitted',
        status: bracket.status
      }
    });
  } catch (error) {
    console.error('Error fetching bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bracket' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tournament-bracket/[id] - Update a specific bracket
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Check for test email suppression headers (from Playwright tests)
    const suppressTestEmails = request.headers.get('X-Suppress-Test-Emails') === 'true';
    if (suppressTestEmails) {
      process.env.SUPPRESS_TEST_EMAILS = 'true';
      // Also capture the test user email for suppression matching
      const testUserEmail = request.headers.get('X-Test-User-Email');
      if (testUserEmail) {
        process.env.TEST_USER_EMAIL = testUserEmail;
      }
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bracket = await getBracketById(id);
    
    if (!bracket) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    // Get user to verify ownership
    const user = await getUserByEmail(session.user.email);
    if (!user || bracket.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to update this bracket' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // If changing status to submitted, check if submission is allowed and validate
    if (body.status === 'submitted') {
      // Get fresh site config to check submission rules (bypass cache for real-time validation)
      let siteConfig = null;
      let tournamentYear = new Date().getFullYear(); // Default fallback
      try {
        siteConfig = await getSiteConfigFromGoogleSheetsFresh();
        if (siteConfig?.tournamentYear) {
          tournamentYear = parseInt(siteConfig.tournamentYear);
        }
      } catch {
        // Use fallback config if Google Sheets fails
        const { FALLBACK_CONFIG } = await import('@/lib/fallbackConfig');
        siteConfig = FALLBACK_CONFIG;
        if (FALLBACK_CONFIG.tournamentYear) {
          tournamentYear = parseInt(FALLBACK_CONFIG.tournamentYear);
        }
      }

      // Check if submission is allowed (deadline/toggle check) BEFORE other validations
      const submissionCheck = checkSubmissionAllowed(siteConfig);
      if (!submissionCheck.allowed) {
        return NextResponse.json(
          { 
            success: false, 
            error: submissionCheck.reason || 'Bracket submission is currently disabled.'
          },
          { status: 400 }
        );
      }
      
      // Check for duplicate names within the same year
      const { getBracketsByUserId } = await import('@/lib/secureDatabase');

      const existingBrackets = await getBracketsByUserId(user.id);
      
      // Check if there's already a submitted bracket with this name for the same year (excluding current bracket)
      const duplicateNameExists = existingBrackets.some(
        b => b.id !== id && 
             b.entryName === body.entryName && 
             b.status === 'submitted' &&
             b.year === tournamentYear
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
    }
    
    // Check if status is being changed to submitted (was previously in_progress)
    const isBeingSubmitted = body.status === 'submitted' && bracket.status === 'in_progress';
    
    // Update the bracket
    const updatedBracket = await updateBracket(id, {
      entryName: body.entryName,
      tieBreaker: body.tieBreaker,
      picks: body.picks,
      status: body.status
    });

    if (!updatedBracket) {
      return NextResponse.json(
        { success: false, error: 'Failed to update bracket' },
        { status: 500 }
      );
    }

    // Send automated submission confirmation email if bracket was just submitted
    // Process asynchronously using centralized service with waitUntil
    if (isBeingSubmitted) {
      const emailPromise = (async () => {
        try {
          const { getBracketsByUserId } = await import('@/lib/secureDatabase');
          const { getSiteConfigFromGoogleSheets } = await import('@/lib/siteConfig');
          const { FALLBACK_CONFIG } = await import('@/lib/fallbackConfig');
          
          // Get all submitted brackets for this user to calculate counts
          const allUserBrackets = await getBracketsByUserId(user.id);
          const submittedBrackets = allUserBrackets.filter(b => b.status === 'submitted' && b.year === updatedBracket.year);
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
    }

    // Return updated bracket in frontend format
    return NextResponse.json({
      success: true,
      data: {
        id: updatedBracket.id,
        playerName: user.name,
        playerEmail: user.email,
        entryName: updatedBracket.entryName,
        tieBreaker: updatedBracket.tieBreaker,
        submittedAt: updatedBracket.status === 'submitted' ? updatedBracket.updatedAt.toISOString() : undefined,
        lastSaved: updatedBracket.status === 'in_progress' ? updatedBracket.updatedAt.toISOString() : undefined,
        picks: updatedBracket.picks,
        totalPoints: 0,
        isComplete: updatedBracket.status === 'submitted',
        isPublic: updatedBracket.status === 'submitted',
        status: updatedBracket.status
      },
      message: 'Bracket updated successfully'
    });
  } catch (error) {
    console.error('Error updating bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bracket' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tournament-bracket/[id] - Delete a specific bracket
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bracket = await getBracketById(id);
    
    if (!bracket) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    // Get user to verify ownership
    const user = await getUserByEmail(session.user.email);
    if (!user || bracket.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to delete this bracket' },
        { status: 403 }
      );
    }

    // Delete the bracket
    const success = await deleteBracket(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete bracket' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bracket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bracket' },
      { status: 500 }
    );
  }
}
