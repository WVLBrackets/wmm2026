/**
 * Centralized service for sending bracket-related emails
 * Handles both on-demand PDF emails and submission confirmation emails
 */

import { waitUntil } from '@vercel/functions';
import { Bracket } from '@/lib/types/database';
import { SiteConfigData } from '@/lib/siteConfig';
import { emailService } from '@/lib/emailService';
import { renderEmailTemplate, type BracketEmailContext } from '@/lib/emailTemplate';
import { generateBracketPDF } from '@/lib/pdf/bracketPdf';
import { logError } from '@/lib/serverErrorLogger';
import { notifyAdminOfError } from '@/lib/adminNotifications';

/**
 * Published Emails & Account copy plus the footer contact address.
 *
 * @param siteConfig - Published site config
 */
async function loadBracketEmailContext(siteConfig: SiteConfigData): Promise<BracketEmailContext> {
  const { getPublishedCmsBundle } = await import('@/lib/vintage/cmsBundle');
  const bundle = await getPublishedCmsBundle();
  return { emails: bundle.emails, contactEmail: siteConfig.contactEmail };
}

/**
 * Absolute My Picks URL for emails. Adds `?year=` when the bracket year is
 * not the active tournament year.
 *
 * @param bracketYear - Year stamped on the emailed bracket
 * @param activeYear - Published active Tourney Year
 */
async function buildBracketsEmailUrl(
  bracketYear: string | number,
  activeYear: string | number,
): Promise<string> {
  const { requireAppOrigin } = await import('@/lib/env');
  const { buildYearScopedPath } = await import('@/lib/services/tournamentYearHelpers');
  const yearNum = typeof bracketYear === 'number' ? bracketYear : parseInt(String(bracketYear), 10);
  const activeNum = typeof activeYear === 'number' ? activeYear : parseInt(String(activeYear), 10);
  const path = buildYearScopedPath(
    '/bracket',
    Number.isFinite(yearNum) ? yearNum : activeNum,
    Number.isFinite(activeNum) ? activeNum : yearNum,
  );
  return `${requireAppOrigin()}${path}`;
}

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
  siteConfig: SiteConfigData,
): Promise<void> {
  // Prefer the bracket’s stamped year (historical email/print), else the active Tourney Year.
  const tournamentYear = bracket.year?.toString() || siteConfig.tournamentYear;
  
  try {
    // Load tournament data
    const { loadTournamentWithDisplayNames } = await import('@/lib/loadTournamentWithDisplayNames');
    const tournamentData = await loadTournamentWithDisplayNames(tournamentYear);
    
    // Generate bracket structure
    const { generate64TeamBracket, updateBracketWithPicks } = await import('@/lib/bracketGenerator');
    const generatedBracket = generate64TeamBracket(tournamentData);
    const bracketWithPicks = updateBracketWithPicks(generatedBracket, bracket.picks, tournamentData);
    
    // Generate PDF for attachment
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await generateBracketPDF(bracket, bracketWithPicks, tournamentData, siteConfig);
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

    const { formatVintageTipoffDate } = await import('@/lib/vintage/picksContent');
    const bracketsUrl = await buildBracketsEmailUrl(tournamentYear, siteConfig.tournamentYear);
    const tipoff = formatVintageTipoffDate(siteConfig.tournamentStartDate);
    
    // Render email template
    const emailContent = await renderEmailTemplate(await loadBracketEmailContext(siteConfig), {
      name: user.name || undefined,
      entryName: bracket.entryName,
      tournamentYear,
      siteName: siteConfig.siteName,
      bracketId: bracket.id.toString(),
      bracketsUrl,
      tipoff,
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
    const emailSent = await emailService.sendEmail(emailOptions);

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
  siteConfig: SiteConfigData
): Promise<void> {
  try {
    const tournamentYear = bracket.year?.toString() || siteConfig.tournamentYear;
    
    const { loadTournamentWithDisplayNames } = await import('@/lib/loadTournamentWithDisplayNames');
    const tournamentData = await loadTournamentWithDisplayNames(tournamentYear);
    
    // Generate bracket structure
    const { generate64TeamBracket, updateBracketWithPicks } = await import('@/lib/bracketGenerator');
    const generatedBracket = generate64TeamBracket(tournamentData);
    const bracketWithPicks = updateBracketWithPicks(generatedBracket, bracket.picks, tournamentData);
    
    // Generate PDF
    const pdfBuffer = await generateBracketPDF(bracket, bracketWithPicks, tournamentData, siteConfig);

    const bracketsUrl = await buildBracketsEmailUrl(tournamentYear, siteConfig.tournamentYear);
    
    // Render email template
    const entryName = bracket.entryName || `Bracket ${bracket.id}`;
    const emailContent = await renderEmailTemplate(await loadBracketEmailContext(siteConfig), {
      name: user.name || undefined,
      entryName,
      tournamentYear,
      siteName: siteConfig.siteName,
      bracketId: bracket.id.toString(),
      bracketsUrl,
    }, 'pdf');
    
    // Send email with PDF attachment
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
    }
  } catch (error) {
    console.error('[Bracket Email] Error in on-demand PDF email process:', error);
    
    // Log error to database
    const err = error instanceof Error ? error : new Error(String(error));
    const tournamentYear = bracket.year?.toString() || siteConfig.tournamentYear;
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

