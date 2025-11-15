/**
 * Centralized service for sending bracket-related emails
 * Handles both on-demand PDF emails and submission confirmation emails
 */

import { waitUntil } from '@vercel/functions';
import { Bracket } from '@/lib/secureDatabase';
import { SiteConfigData } from '@/lib/siteConfig';
import { emailService } from '@/lib/emailService';
import { renderEmailTemplate } from '@/lib/emailTemplate';
import { generateBracketPDF } from '@/app/api/bracket/email-pdf/route';
import { logError } from '@/lib/serverErrorLogger';
import { notifyAdminOfError } from '@/lib/adminNotifications';

/**
 * Generate a sanitized filename for bracket PDF
 */
function generateBracketFilename(entryName: string | null | undefined, tournamentYear: string, bracketId: string): string {
  let sanitized = entryName || `bracket-${bracketId}`;
  sanitized = sanitized.toLowerCase();
  sanitized = sanitized.replace(/[\s_]+/g, '-');
  sanitized = sanitized.replace(/[^a-z0-9.-]/g, '');
  sanitized = sanitized.replace(/-+/g, '-');
  sanitized = sanitized.replace(/^[-.]+|[-.]+$/g, '');
  if (!sanitized || sanitized.length === 0) {
    sanitized = `bracket-${bracketId}`;
  }
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }
  return `WMM-${tournamentYear}-${sanitized}.pdf`;
}

/**
 * Send submission confirmation email with PDF attachment
 * This function processes asynchronously and should be wrapped with waitUntil
 */
export async function sendSubmissionConfirmationEmail(
  bracket: Bracket,
  user: { id: string; name: string | null; email: string },
  siteConfig: SiteConfigData | null,
  submissionCount: number,
  totalCost: number
): Promise<void> {
  console.log('[Bracket Email] Starting submission confirmation email process...');
  
  // Calculate tournament year outside try block so it's available in catch block
  const tournamentYear = siteConfig?.tournamentYear || bracket.year?.toString() || new Date().getFullYear().toString();
  
  try {
    // Load tournament data
    console.log('[Bracket Email] Loading tournament data for year:', tournamentYear);
    
    const { loadTournamentData } = await import('@/lib/tournamentLoader');
    const tournamentData = await loadTournamentData(tournamentYear);
    console.log('[Bracket Email] Tournament data loaded');
    
    // Generate bracket structure
    console.log('[Bracket Email] Generating bracket structure...');
    const { generate64TeamBracket, updateBracketWithPicks } = await import('@/lib/bracketGenerator');
    const generatedBracket = generate64TeamBracket(tournamentData);
    const bracketWithPicks = updateBracketWithPicks(generatedBracket, bracket.picks, tournamentData);
    console.log('[Bracket Email] Bracket structure generated');
    
    // Generate PDF for attachment
    let pdfBuffer: Buffer | null = null;
    try {
      console.log('[Bracket Email] Generating PDF...');
      pdfBuffer = await generateBracketPDF(bracket, bracketWithPicks, tournamentData, siteConfig);
      console.log('[Bracket Email] PDF generated, size:', pdfBuffer.length, 'bytes');
    } catch (pdfError) {
      console.error('[Bracket Email] Error generating PDF:', pdfError);
      
      // Log error to database
      const error = pdfError instanceof Error ? pdfError : new Error(String(pdfError));
      await logError(error, 'Bracket Email - PDF Generation (Submission)', {
        username: user.email,
        isLoggedIn: true,
        additionalInfo: {
          bracketId: bracket.id.toString(),
          entryName: bracket.entryName,
          tournamentYear,
        },
      });
      
      // Notify admin of critical error
      await notifyAdminOfError(error, 'Bracket Email - PDF Generation (Submission)', {
        bracketId: bracket.id.toString(),
        userEmail: user.email,
        additionalDetails: {
          entryName: bracket.entryName,
          tournamentYear,
        },
      });
      
      // Continue without PDF - email will still be sent
    }
    
    // Render email template
    console.log('[Bracket Email] Rendering email template...');
    const emailContent = await renderEmailTemplate(siteConfig, {
      name: user.name || undefined,
      entryName: bracket.entryName,
      tournamentYear,
      siteName: siteConfig?.siteName || 'Warren\'s March Madness',
      bracketId: bracket.id.toString(),
      submissionCount,
      totalCost,
    }, 'submit');
    console.log('[Bracket Email] Email template rendered');
    
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
      const pdfFilename = generateBracketFilename(bracket.entryName, tournamentYear, bracket.id.toString());
      emailOptions.attachments = [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];
    }
    
    // Send email
    console.log('[Bracket Email] Sending email...');
    const emailSent = await emailService.sendEmail(emailOptions);
    console.log('[Bracket Email] Confirmation email sent successfully' + (pdfBuffer ? ' with PDF attachment' : ''));

    // Log email event (Bracket Submit - attachment expected)
    try {
      const { logEmailEvent } = await import('@/lib/emailLogger');
      await logEmailEvent({
        eventType: 'Bracket Submit',
        destinationEmail: user.email,
        attachmentExpected: true,
        attachmentSuccess: pdfBuffer !== null,
        emailSuccess: emailSent,
      });
    } catch (logError) {
      // Don't fail email sending if logging fails
      console.error('[Bracket Email] Failed to log Bracket Submit email:', logError);
    }
  } catch (error) {
    console.error('[Bracket Email] Error in submission confirmation email process:', error);
    
    // Log error to database
    const err = error instanceof Error ? error : new Error(String(error));
    await logError(err, 'Bracket Email - Submission Confirmation', {
      username: user.email,
      isLoggedIn: true,
      additionalInfo: {
        bracketId: bracket.id.toString(),
        entryName: bracket.entryName,
        tournamentYear,
      },
    });
    
    // Notify admin of critical error
    await notifyAdminOfError(err, 'Bracket Email - Submission Confirmation', {
      bracketId: bracket.id.toString(),
      userEmail: user.email,
      additionalDetails: {
        entryName: bracket.entryName,
        tournamentYear,
      },
    });
    
    // Don't throw - we don't want to fail the submission if email fails
  }
}

/**
 * Send on-demand PDF email (for email icon button)
 * This function processes asynchronously and should be wrapped with waitUntil
 */
export async function sendOnDemandPdfEmail(
  bracket: Bracket,
  user: { name: string | null | undefined; email: string },
  siteConfig: SiteConfigData | null
): Promise<void> {
  console.log('[Bracket Email] Starting on-demand PDF email process...');
  
  try {
    // Load tournament data
    const tournamentYear = siteConfig?.tournamentYear || bracket.year?.toString() || new Date().getFullYear().toString();
    console.log('[Bracket Email] Loading tournament data for year:', tournamentYear);
    
    const { loadTournamentData } = await import('@/lib/tournamentLoader');
    const tournamentData = await loadTournamentData(tournamentYear);
    console.log('[Bracket Email] Tournament data loaded');
    
    // Generate bracket structure
    console.log('[Bracket Email] Generating bracket structure...');
    const { generate64TeamBracket, updateBracketWithPicks } = await import('@/lib/bracketGenerator');
    const generatedBracket = generate64TeamBracket(tournamentData);
    const bracketWithPicks = updateBracketWithPicks(generatedBracket, bracket.picks, tournamentData);
    console.log('[Bracket Email] Bracket structure generated');
    
    // Generate PDF
    console.log('[Bracket Email] Generating PDF...');
    const pdfBuffer = await generateBracketPDF(bracket, bracketWithPicks, tournamentData, siteConfig);
    console.log('[Bracket Email] PDF generated, size:', pdfBuffer.length, 'bytes');
    
    // Render email template
    console.log('[Bracket Email] Rendering email template...');
    const entryName = bracket.entryName || `Bracket ${bracket.id}`;
    const emailContent = await renderEmailTemplate(siteConfig, {
      name: user.name || undefined,
      entryName,
      tournamentYear,
      siteName: siteConfig?.siteName || 'Warren\'s March Madness',
      bracketId: bracket.id.toString(),
    }, 'pdf');
    console.log('[Bracket Email] Email template rendered');
    
    // Send email with PDF attachment
    console.log('[Bracket Email] Sending email...');
    const pdfFilename = generateBracketFilename(bracket.entryName, tournamentYear, bracket.id.toString());
    const emailSent = await emailService.sendEmail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
    
    // Log email event (Bracket Email - attachment expected)
    try {
      const { logEmailEvent } = await import('@/lib/emailLogger');
      await logEmailEvent({
        eventType: 'Bracket Email',
        destinationEmail: user.email,
        attachmentExpected: true,
        attachmentSuccess: emailSent ? true : false, // PDF was generated, so attachment success = email success
        emailSuccess: emailSent,
      });
    } catch (logError) {
      // Don't fail email sending if logging fails
      console.error('[Bracket Email] Failed to log Bracket Email event:', logError);
    }

    if (!emailSent) {
      console.error('[Bracket Email] Email service returned false');
    } else {
      console.log('[Bracket Email] Email sent successfully to:', user.email);
    }
  } catch (error) {
    console.error('[Bracket Email] Error in on-demand PDF email process:', error);
    
    // Log error to database
    const err = error instanceof Error ? error : new Error(String(error));
    const tournamentYear = siteConfig?.tournamentYear || bracket.year?.toString() || new Date().getFullYear().toString();
    await logError(err, 'Bracket Email - PDF Generation (On-Demand)', {
      username: user.email,
      isLoggedIn: true,
      additionalInfo: {
        bracketId: bracket.id.toString(),
        entryName: bracket.entryName,
        tournamentYear,
      },
    });
    
    // Notify admin of critical error
    await notifyAdminOfError(err, 'Bracket Email - PDF Generation (On-Demand)', {
      bracketId: bracket.id.toString(),
      userEmail: user.email,
      additionalDetails: {
        entryName: bracket.entryName,
        tournamentYear,
      },
    });
    
    throw error; // Re-throw for on-demand emails so user knows it failed
  }
}

/**
 * Helper to process email asynchronously with waitUntil
 * Use this wrapper to ensure emails are processed in background
 * Always uses waitUntil from @vercel/functions
 */
export function processEmailAsync(emailPromise: Promise<void>): void {
  // Use waitUntil to keep execution context alive after response
  waitUntil(emailPromise);
}

