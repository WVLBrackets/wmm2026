import { emailService, escapeHtml } from './emailService';
import { getPublishedCmsBundle } from './vintage/cmsBundle';
import { formatEmailCopy } from './vintage/emailsContent';

/**
 * Send an auto-reply when someone replies to the do-not-reply address.
 * Copy comes from Emails & Account CMS; blank fields are omitted.
 *
 * @param originalSenderEmail - The address of the person who replied
 * @param originalSubject - Subject of the email they replied to
 */
export async function sendAutoReplyEmail(
  originalSenderEmail: string,
  originalSubject?: string,
): Promise<boolean> {
  try {
    const bundle = await getPublishedCmsBundle();
    const copy = bundle.emails.autoReply;
    const contactEmail = bundle.home.footer.contactEmail?.trim();
    if (!contactEmail) {
      throw new Error('Contact email is not configured in published homepage CMS.');
    }

    const baseSubject = (originalSubject ?? '').replace(/^\s*re:\s*/i, '').trim();
    const subject = formatEmailCopy(copy.subject, { subject: baseSubject }).trim();
    if (!subject) throw new Error('Emails & Account CMS: auto-reply subject is blank.');

    const notice = formatEmailCopy(bundle.emails.doNotReplyNotice, { contactEmail }).trim();
    const safeContact = escapeHtml(contactEmail);
    const noticeHtml = escapeHtml(notice).replace(
      safeContact,
      `<a href="mailto:${safeContact}" style="color: #856404; font-weight: bold;">${safeContact}</a>`,
    );
    const para = (s: string) => (s.trim() ? `<p>${escapeHtml(s.trim())}</p>` : '');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(copy.heading)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          ${copy.heading.trim() ? `<h2 style="color: #2c3e50; text-align: center;">${escapeHtml(copy.heading)}</h2>` : ''}
          ${para(copy.greeting)}
          ${para(copy.mainMessage)}
          ${
            notice
              ? `<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px; color: #856404;">${noticeHtml}</p>
          </div>`
              : ''
          }
          ${para(copy.closing)}
        </div>
      </body>
      </html>
    `;
    const text = [copy.heading, copy.greeting, copy.mainMessage, notice, copy.closing]
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n\n');

    const emailSent = await emailService.sendEmail({
      to: originalSenderEmail,
      subject,
      html,
      text,
    });
    if (!emailSent) console.error(`[AutoReply] Failed to send auto-reply to ${originalSenderEmail}`);
    return emailSent;
  } catch (error) {
    console.error('[AutoReply] Error sending auto-reply:', error);
    return false;
  }
}
