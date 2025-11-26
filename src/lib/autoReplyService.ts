import { emailService } from './emailService';
import { getSiteConfigFromGoogleSheets } from './siteConfig';
import type { SiteConfigData } from './siteConfig';

/**
 * Send an auto-reply email when someone replies to a do-not-reply address
 * 
 * @param originalSenderEmail - The email address of the person who replied
 * @param originalSubject - The subject of the original email they replied to
 * @param siteConfig - Site configuration (optional, will fetch if not provided)
 */
export async function sendAutoReplyEmail(
  originalSenderEmail: string,
  originalSubject?: string,
  siteConfig?: SiteConfigData | null
): Promise<boolean> {
  try {
    // Get site config if not provided
    if (!siteConfig) {
      siteConfig = await getSiteConfigFromGoogleSheets();
    }

    // Get contact email from config
    const contactEmail = siteConfig?.emailContactAddress || 'support@warrensmm.com';
    
    // Get do-not-reply notice text from config
    const doNotReplyNotice = siteConfig?.emailDoNotReplyNotice || 
      'Please do not reply to this email. This is an automated message from an unmonitored mailbox. If you need assistance, please contact us at {contactEmail}.';
    
    // Replace {contactEmail} variable
    const noticeWithEmail = doNotReplyNotice.replace(/\{contactEmail\}/g, contactEmail);

    // Create auto-reply HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Auto-Reply: Do Not Reply Address</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #2c3e50; text-align: center;">Automatic Reply</h2>
          <p>Hello,</p>
          <p>Thank you for your message. However, you have replied to an automated email address that is not monitored.</p>
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px; color: #856404;">
              <strong>This mailbox is not monitored.</strong> If you need assistance, please contact us directly at:
            </p>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #856404;">
              <a href="mailto:${contactEmail}" style="color: #856404; font-weight: bold;">${contactEmail}</a>
            </p>
          </div>
          <p>We apologize for any inconvenience. For the fastest response, please send your inquiry directly to the email address above.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666; text-align: center;">
            ${noticeWithEmail}
          </p>
        </div>
      </body>
      </html>
    `;

    // Create plain text version
    const text = `
Automatic Reply

Hello,

Thank you for your message. However, you have replied to an automated email address that is not monitored.

This mailbox is not monitored. If you need assistance, please contact us directly at: ${contactEmail}

We apologize for any inconvenience. For the fastest response, please send your inquiry directly to the email address above.

${noticeWithEmail}
    `.trim();

    // Create auto-reply subject
    const replySubject = originalSubject?.startsWith('Re:') 
      ? `${originalSubject} - Do Not Reply`
      : `Re: ${originalSubject || 'Your Message'} - Do Not Reply`;

    // Send the auto-reply email
    const emailSent = await emailService.sendEmail({
      to: originalSenderEmail,
      subject: replySubject,
      html,
      text,
    });

    if (emailSent) {
      console.log(`[AutoReply] Auto-reply sent successfully to ${originalSenderEmail}`);
    } else {
      console.error(`[AutoReply] Failed to send auto-reply to ${originalSenderEmail}`);
    }

    return emailSent;
  } catch (error) {
    console.error('[AutoReply] Error sending auto-reply:', error);
    return false;
  }
}

