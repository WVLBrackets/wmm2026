import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createBracket,
  getUserBracketsForYear,
  updateBracket,
} from '@/lib/repositories/bracketRepository';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { SiteConfigError } from '@/lib/siteConfig';
import { sendSubmissionConfirmationEmail, processEmailAsync } from '@/lib/bracketEmailService';
import { validateBracketSubmission } from '@/lib/bracketSubmissionValidator';
import { tryLoadTournamentData } from '@/lib/tournamentLoaderServer';
import { logError } from '@/lib/serverErrorLogger';
import { csrfProtection } from '@/lib/csrf';
import { normalizeStoredDisplayName } from '@/lib/stringNormalize';
import {
  evaluateBracketMutationAccess,
  type BracketMutationDecision,
} from '@/lib/services/bracketMutationPolicy';
import { getActiveTournamentYear, parseViewingYear } from '@/lib/services/tournamentYearService';
import { loadMyPicksList } from '@/lib/services/myPicksService';
import { formatVintagePicksLabel } from '@/lib/vintage/picksContent';
import { getPublishedCmsBundle } from '@/lib/vintage/cmsBundle';

/**
 * Mutation gate for creating a bracket in the active year. CMS outages map to 503.
 *
 * @param action - `changing` (submit) or `save_wip` (first save)
 */
async function evaluateCreateAccess(
  action: 'changing' | 'save_wip',
): Promise<BracketMutationDecision> {
  try {
    const activeYearHint = await getActiveTournamentYear();
    return await evaluateBracketMutationAccess(activeYearHint, action, { forCreate: true });
  } catch (error) {
    return {
      allowed: false,
      status: 503,
      error:
        error instanceof SiteConfigError
          ? error.message
          : 'Site configuration is unavailable.',
    };
  }
}

/**
 * Published "brackets missing" error for a year (My Picks CMS).
 *
 * @param year - Tournament year
 */
async function bracketsMissingMessage(year: number): Promise<string> {
  const bundle = await getPublishedCmsBundle();
  return formatVintagePicksLabel(bundle.picks.bracketsMissingErrorMessage, { year });
}

/**
 * POST /api/tournament-bracket - Create a new tournament bracket (submit)
 */
export async function POST(request: NextRequest) {
  // SECURITY: CSRF protection for state-changing operation
  const csrfError = csrfProtection(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    // Check for test email suppression headers (from Playwright tests)
    // SECURITY: Only honor suppression headers in non-production environments
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    const suppressTestEmails = !isProduction && request.headers.get('X-Suppress-Test-Emails') === 'true';
    if (suppressTestEmails) {
      process.env.SUPPRESS_TEST_EMAILS = 'true';
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

    // Resolve year + Changing gates (submit creates a submitted bracket)
    const mutationAccess = await evaluateCreateAccess('changing');
    if (!mutationAccess.allowed) {
      return NextResponse.json(
        { success: false, error: mutationAccess.error },
        { status: mutationAccess.status }
      );
    }
    const { siteConfig, editorCopy } = mutationAccess;
    const tournamentYear = mutationAccess.activeYear;

    const existingBrackets = await getUserBracketsForYear(user.id, tournamentYear);
    const normalizedEntryName = normalizeStoredDisplayName(String(body.entryName ?? ''));

    // Check if there's already a submitted bracket with this name for the same year
    const duplicateNameExists = existingBrackets.some(
      (bracket) => bracket.entryName === normalizedEntryName && bracket.status === 'submitted'
    );

    if (duplicateNameExists) {
      return NextResponse.json(
        { success: false, error: editorCopy.duplicateNameMessage },
        { status: 400 }
      );
    }

    // Load tournament data for pick validation (mutation gate already verified JSON when published)
    const tournamentData = await tryLoadTournamentData(tournamentYear.toString());
    if (!tournamentData) {
      return NextResponse.json(
        { success: false, error: await bracketsMissingMessage(tournamentYear) },
        { status: 403 }
      );
    }

    // Validate bracket submission server-side (data validation; gates ran above)
    const validation = await validateBracketSubmission(
      picks,
      body.tieBreaker,
      tournamentData,
      editorCopy
    );

    // Create new bracket stamped with CMS active Tourney Year (always create, even if invalid data)
    const bracket = await createBracket(
      user.id,
      body.entryName,
      body.tieBreaker,
      picks,
      tournamentYear
    );
    
    // Determine status: 'Invalid' if validation failed (invalid data), otherwise 'submitted'
    // Note: Deadline/toggle checks are handled above, so if we get here, submission is allowed
    const bracketStatus = validation.isValid ? 'submitted' : 'Invalid';
    
    // Update status
    const updatedBracket = await updateBracket(bracket.id, { status: bracketStatus });

    // If validation failed, log error
    if (!validation.isValid) {
      const errorMessage = `Invalid bracket submission: ${validation.errors.join('; ')}`;
      const validationError = new Error(errorMessage);
      await logError(validationError, 'Bracket Submission - Invalid Data', {
        username: user.email,
        isLoggedIn: true,
        additionalInfo: {
          bracketId: bracket.id,
          entryName: body.entryName,
          errors: validation.errors,
          tournamentYear,
        },
      });
    }
    
    if (!updatedBracket) {
      return NextResponse.json(
        { success: false, error: 'Failed to submit bracket' },
        { status: 500 }
      );
    }

    // Only send confirmation email if bracket is valid and submitted (not invalid)
    if (bracketStatus === 'submitted') {
      // Send automated submission confirmation email in background
      // Process asynchronously using centralized service with waitUntil
      const emailPromise = (async () => {
        try {
          await sendSubmissionConfirmationEmail(updatedBracket, user, siteConfig);
        } catch (emailError) {
          // Log error but don't fail the submission (already returned success)
          console.error('[Submit Bracket] Error sending confirmation email:', emailError);
        }
      })();
      
      // Use waitUntil to keep execution context alive after response
      processEmailAsync(emailPromise);
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
        submittedAt:
          updatedBracket.status === 'submitted' && updatedBracket.submittedAt
            ? updatedBracket.submittedAt.toISOString()
            : undefined,
        updatedAt: updatedBracket.updatedAt.toISOString(),
        picks: updatedBracket.picks,
        totalPoints: 0,
        isComplete: bracketStatus === 'submitted',
        isPublic: bracketStatus === 'submitted',
        status: updatedBracket.status,
        bracketNumber: updatedBracket.bracketNumber,
        year: updatedBracket.year
      },
      message: bracketStatus === 'submitted' 
        ? 'Tournament bracket submitted successfully' 
        : 'Bracket saved but marked as invalid due to validation errors'
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
  // SECURITY: CSRF protection for state-changing operation
  const csrfError = csrfProtection(request);
  if (csrfError) {
    return csrfError;
  }

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

    // First Save of a new editor session → create in_progress (save_wip).
    // Year comes from mutation policy (CMS active year).
    const mutationAccess = await evaluateCreateAccess('save_wip');
    if (!mutationAccess.allowed) {
      return NextResponse.json(
        { success: false, error: mutationAccess.error },
        { status: mutationAccess.status }
      );
    }
    const createYear = mutationAccess.activeYear;

    const fieldData = await tryLoadTournamentData(String(createYear));
    if (!fieldData) {
      return NextResponse.json(
        { success: false, error: await bracketsMissingMessage(createYear) },
        { status: 403 }
      );
    }

    // Always create a new in-progress bracket when using PUT without an ID
    // Users can have multiple in-progress brackets with the same name
    // Year comes from mutation policy (homepage CMS Tourney Year).
    const bracket = await createBracket(
      user.id,
      body.entryName,
      body.tieBreaker,
      body.picks,
      createYear
    );
    
    // Set status to in_progress
    const updatedBracket = await updateBracket(bracket.id, { status: 'in_progress' });
    
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
        updatedAt: updatedBracket.updatedAt.toISOString(),
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
 * GET /api/tournament-bracket - Get tournament brackets for the current user.
 * Optional `?year=` scopes the list; defaults to the active tournament year.
 * Response includes `availableYears` for the My Picks year switcher.
 */
export async function GET(request: NextRequest) {
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

    // Active year = published homepage CMS Tourney Year.
    const activeYear = await getActiveTournamentYear();
    const viewingYear = parseViewingYear(request.nextUrl.searchParams.get('year'), activeYear);
    const list = await loadMyPicksList(
      { id: user.id, name: user.name, email: user.email },
      viewingYear,
      activeYear,
    );

    return NextResponse.json(
      {
        success: true,
        data: list.brackets,
        count: list.brackets.length,
        activeYear: list.activeYear,
        viewingYear: list.viewingYear,
        availableYears: list.availableYears,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching tournament brackets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tournament brackets' },
      { status: 500 }
    );
  }
}
