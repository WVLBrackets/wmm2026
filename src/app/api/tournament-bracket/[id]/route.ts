import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getBracketById, 
  updateBracket, 
  deleteBracket,
  getUserByEmail 
} from '@/lib/secureDatabase';

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
    
    // If changing status to submitted, check for duplicate names within the same year
    if (body.status === 'submitted') {
      const { getBracketsByUserId } = await import('@/lib/secureDatabase');
      const { getSiteConfigFromGoogleSheets } = await import('@/lib/siteConfig');
      const { FALLBACK_CONFIG } = await import('@/lib/fallbackConfig');
      
      // Get tournament year from config (same logic as createBracket)
      let tournamentYear = new Date().getFullYear(); // Default fallback
      try {
        const config = await getSiteConfigFromGoogleSheets();
        if (config?.tournamentYear) {
          tournamentYear = parseInt(config.tournamentYear);
        }
      } catch (error) {
        // Use fallback config if Google Sheets fails
        if (FALLBACK_CONFIG.tournamentYear) {
          tournamentYear = parseInt(FALLBACK_CONFIG.tournamentYear);
        }
      }

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
    if (isBeingSubmitted) {
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
        try {
          const config = await getSiteConfigFromGoogleSheets();
          if (config?.entryCost) {
            entryCost = config.entryCost;
          }
        } catch (error) {
          entryCost = FALLBACK_CONFIG.entryCost;
        }
        
        const totalCost = submissionCount * entryCost;
        
        // Get site config for email template
        const siteConfig = await getSiteConfigFromGoogleSheets();
        
        // Generate PDF for attachment
        let pdfBuffer: Buffer | null = null;
        try {
          const { loadTournamentData } = await import('@/lib/tournamentLoader');
          const { generate64TeamBracket, updateBracketWithPicks } = await import('@/lib/bracketGenerator');
          
          // Load tournament data
          const tournamentYear = updatedBracket.year?.toString() || new Date().getFullYear().toString();
          const tournamentData = await loadTournamentData(tournamentYear);
          
          // Generate bracket structure
          const generatedBracket = generate64TeamBracket(tournamentData);
          const bracketWithPicks = updateBracketWithPicks(generatedBracket, updatedBracket.picks, tournamentData);
          
          // Generate PDF using the same function from email-pdf route
          const { generateBracketPDF } = await import('@/app/api/bracket/email-pdf/route');
          pdfBuffer = await generateBracketPDF(updatedBracket, bracketWithPicks, tournamentData, siteConfig);
          console.log('[Submit Bracket] PDF generated, size:', pdfBuffer.length, 'bytes');
        } catch (pdfError) {
          console.error('[Submit Bracket] Error generating PDF:', pdfError);
          // Continue without PDF - email will still be sent
        }
        
        // Render and send email
        const { renderEmailTemplate } = await import('@/lib/emailTemplate');
        const { emailService } = await import('@/lib/emailService');
        
        const emailContent = await renderEmailTemplate(siteConfig, {
          name: user.name || undefined,
          entryName: updatedBracket.entryName,
          tournamentYear: updatedBracket.year?.toString() || new Date().getFullYear().toString(),
          siteName: siteConfig?.siteName || 'Warren\'s March Madness',
          bracketId: updatedBracket.id.toString(),
          submissionCount,
          totalCost,
        }, 'submit');
        
        // Prepare email with optional PDF attachment
        const emailOptions: {
          to: string;
          subject: string;
          html: string;
          text: string;
          attachments?: Array<{
            filename: string;
            content: Buffer;
            contentType: string;
          }>;
        } = {
          to: user.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        };
        
        // Add PDF attachment if generated successfully
        if (pdfBuffer) {
          emailOptions.attachments = [
            {
              filename: `bracket-${updatedBracket.id}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ];
        }
        
        await emailService.sendEmail(emailOptions);
        
        console.log('[Submit Bracket] Confirmation email sent successfully' + (pdfBuffer ? ' with PDF attachment' : ''));
      } catch (emailError) {
        // Log error but don't fail the submission
        console.error('[Submit Bracket] Error sending confirmation email:', emailError);
        // Continue - email failure shouldn't prevent bracket submission
      }
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
