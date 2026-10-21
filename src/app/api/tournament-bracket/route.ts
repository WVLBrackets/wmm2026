import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createBracket, getBracketsByUserId, updateBracket } from '@/lib/repositories/bracketRepository';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { getSiteConfigFromGoogleSheets, getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { sendSubmissionConfirmationEmail, processEmailAsync } from '@/lib/bracketEmailService';
import { validateBracketSubmission } from '@/lib/bracketSubmissionValidator';
import { tryLoadTournamentData } from '@/lib/tournamentLoaderServer';
import { logError } from '@/lib/serverErrorLogger';
import { csrfProtection } from '@/lib/csrf';
import { normalizeStoredDisplayName } from '@/lib/stringNormalize';
import { evaluateBracketMutationAccess } from '@/lib/services/bracketMutationPolicy';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

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
    let siteConfig = null;
    try {
      siteConfig = await getSiteConfigFromGoogleSheetsFresh();
    } catch {
      siteConfig = FALLBACK_CONFIG;
    }
    const sheetYear = siteConfig?.tournamentYear
      ? parseInt(String(siteConfig.tournamentYear), 10)
      : parseInt(String(FALLBACK_CONFIG.tournamentYear), 10);

    const mutationAccess = await evaluateBracketMutationAccess(
      sheetYear,
      'changing',
      { forCreate: true },
    );
    if (!mutationAccess.allowed) {
      return NextResponse.json(
        { success: false, error: mutationAccess.error },
        { status: mutationAccess.status }
      );
    }
    siteConfig = mutationAccess.siteConfig;
    const tournamentYear = mutationAccess.activeYear;

    // Get all existing brackets for this user
    const existingBrackets = await getBracketsByUserId(user.id);

    const normalizedEntryName = normalizeStoredDisplayName(String(body.entryName ?? ''));
    
    // Check if there's already a submitted bracket with this name for the same year
    const duplicateNameExists = existingBrackets.some(
      bracket => bracket.entryName === normalizedEntryName && 
                 bracket.status === 'submitted' && 
                 bracket.year === tournamentYear
    );

    if (duplicateNameExists) {
      return NextResponse.json(
        { 
          success: false, 
          error: `A submitted bracket with the name "${normalizedEntryName}" already exists for ${tournamentYear}. Please choose a different name.`
        },
        { status: 400 }
      );
    }

    // Load tournament data for pick validation (mutation gate already verified JSON when available=YES)
    const tournamentData = await tryLoadTournamentData(tournamentYear.toString());
    if (!tournamentData) {
      return NextResponse.json(
        {
          success: false,
          error:
            siteConfig?.bracketsMissingErrorMessage ||
            FALLBACK_CONFIG.bracketsMissingErrorMessage ||
            `Bracket field data is missing for ${tournamentYear}.`,
        },
        { status: 403 }
      );
    }

    // Validate bracket submission server-side (for data validation, not deadline/toggle)
    const validation = await validateBracketSubmission(
      picks,
      body.tieBreaker,
      tournamentData,
      siteConfig
    );

    // Create new bracket (always create, even if invalid data)
    const bracket = await createBracket(
      user.id,
      body.entryName,
      body.tieBreaker,
      picks
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
          // Get all submitted brackets for this user to calculate counts
          const allUserBrackets = await getBracketsByUserId(user.id);
          const submittedBrackets = allUserBrackets.filter(b => b.status === 'submitted' && b.year === tournamentYear);
          const submissionCount = submittedBrackets.length;
          
          // Get entry cost from config
          let entryCost = 5; // Default
          if (siteConfig?.entryCost) {
            entryCost = siteConfig.entryCost;
          } else {
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
    // Year comes from mutation policy (CMS active year for vintage).
    let siteConfig = null;
    try {
      siteConfig = await getSiteConfigFromGoogleSheetsFresh();
    } catch {
      siteConfig = FALLBACK_CONFIG;
    }
    const sheetYear = siteConfig?.tournamentYear
      ? parseInt(String(siteConfig.tournamentYear), 10)
      : parseInt(String(FALLBACK_CONFIG.tournamentYear), 10);

    const mutationAccess = await evaluateBracketMutationAccess(
      sheetYear,
      'save_wip',
      { forCreate: true },
    );
    if (!mutationAccess.allowed) {
      return NextResponse.json(
        { success: false, error: mutationAccess.error },
        { status: mutationAccess.status }
      );
    }
    siteConfig = mutationAccess.siteConfig;
    const createYear = mutationAccess.activeYear;

    const fieldData = await tryLoadTournamentData(String(createYear));
    if (!fieldData) {
      return NextResponse.json(
        {
          success: false,
          error:
            mutationAccess.siteConfig?.bracketsMissingErrorMessage ||
            FALLBACK_CONFIG.bracketsMissingErrorMessage ||
            `Bracket field data is missing for ${createYear}.`,
        },
        { status: 403 }
      );
    }

    // Always create a new in-progress bracket when using PUT without an ID
    // Users can have multiple in-progress brackets with the same name
    const bracket = await createBracket(
      user.id,
      body.entryName,
      body.tieBreaker,
      body.picks
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

    const { mergeAvailableYears, parseViewingYear } = await import(
      '@/lib/services/tournamentYearService'
    );

    // Get tournament year from config
    const config = await getSiteConfigFromGoogleSheets();
    const activeYear = config?.tournamentYear
      ? parseInt(String(config.tournamentYear), 10)
      : new Date().getFullYear();
    const safeActiveYear = Number.isNaN(activeYear) ? new Date().getFullYear() : activeYear;

    const yearParam = request.nextUrl.searchParams.get('year');
    const viewingYear = parseViewingYear(yearParam, safeActiveYear);
    
    // Get all brackets for this user
    const brackets = await getBracketsByUserId(user.id);
    const availableYears = mergeAvailableYears(
      brackets.map((b) => b.year),
      safeActiveYear
    );
    
    const yearBrackets = brackets.filter((bracket) => bracket.year === viewingYear);
    
    // Transform to frontend format
    const formattedBrackets = yearBrackets.map(bracket => ({
      id: bracket.id,
      playerName: user.name,
      playerEmail: user.email,
      entryName: bracket.entryName,
      tieBreaker: bracket.tieBreaker,
      submittedAt:
        bracket.status === 'submitted' && bracket.submittedAt
          ? bracket.submittedAt.toISOString()
          : undefined,
      updatedAt: bracket.updatedAt.toISOString(),
      lastSaved: bracket.status === 'in_progress' ? bracket.updatedAt.toISOString() : undefined,
      picks: bracket.picks,
      totalPoints: 0,
      isComplete: bracket.status === 'submitted',
      bracketNumber: bracket.bracketNumber,
      year: bracket.year,
      isPublic: bracket.status === 'submitted',
      status: bracket.status,
      paymentStatus: bracket.paymentStatus || null,
    }));
    
    return NextResponse.json(
      {
        success: true,
        data: formattedBrackets,
        count: formattedBrackets.length,
        activeYear: safeActiveYear,
        viewingYear,
        availableYears,
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
