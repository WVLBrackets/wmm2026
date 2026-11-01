import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import {
  formatEmailCopy,
  type VintageAccountEmailCopy,
  type VintageEmailsContent,
} from '@/lib/vintage/emailsContent';
import { isTestUserEmail, getTestUserReason } from '@/lib/testUserDetection';
import { getAppEnvironment, isProductionEnvironment } from '@/lib/appEnvironment';

/**
 * Logs Gmail/Resend credential *hints* at `EmailService` construction.
 * Default off so `next build` and server boot stay quiet; set `EMAIL_SERVICE_DEBUG=1` when debugging SMTP.
 */
function shouldLogEmailServiceInit(): boolean {
  return (
    process.env.EMAIL_SERVICE_DEBUG === 'true' ||
    process.env.EMAIL_SERVICE_DEBUG === '1'
  );
}

export interface EmailServiceConfig {
  provider: 'gmail' | 'sendgrid' | 'resend' | 'console' | 'disabled';
  user?: string;
  pass?: string;
  apiKey?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  suppressTestEmails?: boolean; // Optional flag to suppress emails for test users
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private resend: Resend | null = null;
  private config: EmailServiceConfig;

  constructor() {
    this.config = this.detectEmailConfig();
    this.initializeTransporter();
  }

  private detectEmailConfig(): EmailServiceConfig {
    // Determine environment (local/preview vs production)
    const appEnvironment = getAppEnvironment();
    const isProduction = appEnvironment === 'production';
    
    // Use environment-specific Gmail accounts
    // Staging/Preview: Use EMAIL_USER_STAGING and EMAIL_PASS_STAGING
    // Production: Use EMAIL_USER_PRODUCTION and EMAIL_PASS_PRODUCTION
    // Fallback: Use EMAIL_USER and EMAIL_PASS (for personal/human notifications)
    
    let emailUser: string | undefined;
    let emailPass: string | undefined;
    let source: string;
    
    if (isProduction) {
      // Production: Use production-specific credentials, fallback to general
      emailUser = process.env.EMAIL_USER_PRODUCTION || process.env.EMAIL_USER;
      emailPass = process.env.EMAIL_PASS_PRODUCTION || process.env.EMAIL_PASS;
      source = process.env.EMAIL_USER_PRODUCTION ? 'EMAIL_USER_PRODUCTION' : 
               (process.env.EMAIL_USER ? 'EMAIL_USER (fallback)' : 'none');
    } else {
      // Staging/Preview: Use staging-specific credentials, fallback to general
      emailUser = process.env.EMAIL_USER_STAGING || process.env.EMAIL_USER;
      emailPass = process.env.EMAIL_PASS_STAGING || process.env.EMAIL_PASS;
      source = process.env.EMAIL_USER_STAGING ? 'EMAIL_USER_STAGING' : 
               (process.env.EMAIL_USER ? 'EMAIL_USER (fallback)' : 'none');
    }
    
    if (shouldLogEmailServiceInit()) {
      console.log(`[EmailService] Environment: ${appEnvironment} (${isProduction ? 'production' : 'non-production'})`);

      if (emailUser && emailPass) {
        console.log(
          `[EmailService] Using Gmail account: ${emailUser.substring(0, emailUser.indexOf('@')) + '@...'} (source: ${source})`
        );
        console.log(`[EmailService] EMAIL_USER_STAGING: ${process.env.EMAIL_USER_STAGING ? 'set' : 'not set'}`);
        console.log(`[EmailService] EMAIL_PASS_STAGING: ${process.env.EMAIL_PASS_STAGING ? 'set' : 'not set'}`);
        console.log(`[EmailService] EMAIL_USER_PRODUCTION: ${process.env.EMAIL_USER_PRODUCTION ? 'set' : 'not set'}`);
        console.log(`[EmailService] EMAIL_PASS_PRODUCTION: ${process.env.EMAIL_PASS_PRODUCTION ? 'set' : 'not set'}`);
        console.log(`[EmailService] EMAIL_USER (fallback): ${process.env.EMAIL_USER ? 'set' : 'not set'}`);
      }

      if (process.env.RESEND_API_KEY) {
        const fromEmail = isProduction
          ? process.env.FROM_EMAIL_PRODUCTION || process.env.FROM_EMAIL || 'not set'
          : process.env.FROM_EMAIL_STAGING || process.env.FROM_EMAIL || 'not set';
        console.log(`[EmailService] RESEND_API_KEY: set`);
        console.log(`[EmailService] FROM_EMAIL: ${fromEmail}`);
        console.log(`[EmailService] FROM_EMAIL_STAGING: ${process.env.FROM_EMAIL_STAGING ? 'set' : 'not set'}`);
        console.log(`[EmailService] FROM_EMAIL_PRODUCTION: ${process.env.FROM_EMAIL_PRODUCTION ? 'set' : 'not set'}`);
      }
    }
    
    // Check for SendGrid configuration
    if (process.env.SENDGRID_API_KEY) {
      return {
        provider: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY,
      };
    }

    // Check if Resend is configured (PRIORITY: Resend first, Gmail as fallback)
    // Use environment-specific FROM_EMAIL if available
    let fromEmail: string | undefined;
    if (isProduction) {
      fromEmail = process.env.FROM_EMAIL_PRODUCTION || process.env.FROM_EMAIL;
    } else {
      fromEmail = process.env.FROM_EMAIL_STAGING || process.env.FROM_EMAIL;
    }
    
    if (process.env.RESEND_API_KEY && fromEmail) {
      // Use Resend as primary (Gmail will be used as fallback if Resend fails)
      return {
        provider: 'resend',
      };
    }

    // Check for Gmail configuration (fallback if Resend not configured)
    if (emailUser && emailPass) {
      return {
        provider: 'gmail',
        user: emailUser,
        pass: emailPass,
      };
    }

    // Without email config, disable email service
    return {
      provider: 'disabled',
    };
  }

  private initializeTransporter(): void {
    switch (this.config.provider) {
      case 'gmail':
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: this.config.user,
            pass: this.config.pass,
          },
        });
        break;
      
      case 'sendgrid':
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: this.config.apiKey,
          },
        });
        break;
      
      case 'resend':
        if (process.env.RESEND_API_KEY) {
          this.resend = new Resend(process.env.RESEND_API_KEY);
        }
        break;
      
      case 'console':
      case 'disabled':
        this.transporter = null;
        break;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    // Check for email suppression (test users only)
    // Check both environment variable and explicit option flag
    const suppressEmails = process.env.SUPPRESS_TEST_EMAILS === 'true' || options.suppressTestEmails === true;
    const recipientEmail = options.to;
    
    if (suppressEmails) {
      const isTestUser = isTestUserEmail(recipientEmail);
      
      if (isTestUser) {
        const reason = getTestUserReason(recipientEmail);
        console.log(`[EmailService] 🚫 EMAIL SUPPRESSED - Test user detected`);
        console.log(`[EmailService]    Recipient: ${recipientEmail}`);
        console.log(`[EmailService]    Subject: ${options.subject}`);
        console.log(`[EmailService]    Suppression Condition: SUPPRESS_TEST_EMAILS=true AND test user detected`);
        console.log(`[EmailService]    Test User Reason: ${reason || 'pattern match'}`);
        console.log(`[EmailService]    Email would have been sent but was suppressed to avoid hitting email limits`);
        // Return true to indicate "success" (email was handled, just suppressed)
        // This allows tests to pass even when emails are suppressed
        return true;
      } else {
        // Real user - always send email regardless of suppression flag
        console.log(`[EmailService] ✅ Email will be sent - Real user detected (not a test user)`);
        console.log(`[EmailService]    Recipient: ${recipientEmail}`);
        console.log(`[EmailService]    Note: SUPPRESS_TEST_EMAILS=true but recipient is not a test user, so email will be sent`);
      }
    }
    
    // Determine environment for FROM_EMAIL selection
    const isProduction = isProductionEnvironment();
    
    // Try Resend first if configured
    if (this.config.provider === 'resend' && this.resend) {
      try {
        const fromEmail = isProduction
          ? (process.env.FROM_EMAIL_PRODUCTION || process.env.FROM_EMAIL)
          : (process.env.FROM_EMAIL_STAGING || process.env.FROM_EMAIL);
        
        if (!fromEmail) {
          throw new Error('FROM_EMAIL not configured for Resend');
        }
        
        console.log(`[EmailService] Attempting to send via Resend from: ${fromEmail}`);

        const resendOptions: {
          from: string;
          to: string;
          subject: string;
          html: string;
          text?: string;
          attachments?: Array<{
            filename: string;
            content: Buffer | string;
          }>;
        } = {
          from: `"Warren's March Madness" <${fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
        };

        if (options.text) {
          resendOptions.text = options.text;
        }

        // Add attachments if provided
        if (options.attachments && options.attachments.length > 0) {
          resendOptions.attachments = options.attachments.map(att => ({
            filename: att.filename,
            content: att.content instanceof Buffer ? att.content : Buffer.from(att.content),
          }));
        }

        const result = await this.resend.emails.send(resendOptions);
        if (result.error) {
          throw new Error(result.error.message || 'Resend API error');
        }
        console.log(`[EmailService] ✅ Email sent successfully via Resend: ${result.data?.id || 'unknown'}`);
        return true;
      } catch (resendError) {
        const errorMessage = resendError instanceof Error ? resendError.message : String(resendError);
        
        // Don't fall back to Gmail for "internal server error" - email may have been sent
        // Resend's "Internal server error" often means the email was queued/sent but they had an issue processing the response
        // This prevents duplicate sends when Resend times out or has server issues
        if (errorMessage.includes('Internal server error') || 
            errorMessage.includes('unable to process your request') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('timed out')) {
          console.error(`[EmailService] ⚠️ Resend error (${errorMessage}). Email may have been sent. Not using Gmail fallback to prevent duplicates.`);
          // Return true to indicate we attempted to send (even if we're not sure)
          // This prevents duplicate sends via Gmail fallback
          return true;
        }
        
        console.error('[EmailService] Resend failed, attempting Gmail fallback:', resendError);
        // Fall through to Gmail fallback for other errors
      }
    }

    // Fallback to Gmail if Resend failed or not configured
    try {
      // Get Gmail credentials for fallback
      let emailUser: string | undefined;
      let emailPass: string | undefined;
      
      if (isProduction) {
        emailUser = process.env.EMAIL_USER_PRODUCTION || process.env.EMAIL_USER;
        emailPass = process.env.EMAIL_PASS_PRODUCTION || process.env.EMAIL_PASS;
      } else {
        emailUser = process.env.EMAIL_USER_STAGING || process.env.EMAIL_USER;
        emailPass = process.env.EMAIL_PASS_STAGING || process.env.EMAIL_PASS;
      }

      if (emailUser && emailPass) {
        console.log(`[EmailService] Attempting Gmail fallback using: ${emailUser.substring(0, emailUser.indexOf('@'))}@...`);
        
        // Create Gmail transporter for fallback
        const gmailTransporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailUser,
            pass: emailPass,
          },
        });

        interface MailOptions {
          from: string;
          to: string;
          subject: string;
          html: string;
          text?: string;
          attachments?: Array<{
            filename: string;
            content: Buffer | string;
            contentType: string;
          }>;
        }

        const mailOptions: MailOptions = {
          from: `"Warren's March Madness" <${emailUser}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        };

        // Add attachments if provided
        if (options.attachments && options.attachments.length > 0) {
          mailOptions.attachments = options.attachments.map(att => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType || 'application/pdf',
          }));
        }

        const gmailResult = await gmailTransporter.sendMail(mailOptions);
        console.log(`[EmailService] ✅ Email sent successfully via Gmail (fallback): ${gmailResult.messageId}`);
        return true;
      } else {
        console.error('[EmailService] ❌ Gmail fallback not available - credentials not configured');
      }
    } catch (gmailError) {
      console.error('[EmailService] ❌ Gmail fallback failed:', gmailError);
    }

    // If we get here, both Resend and Gmail failed
    console.error('[EmailService] ❌ All email providers failed. Email not sent.');
    return false;
  }

  isConfigured(): boolean {
    return this.config.provider !== 'disabled';
  }

  getProvider(): string {
    return this.config.provider;
  }

  getStatus(): { configured: boolean; provider: string; message: string } {
    switch (this.config.provider) {
      case 'gmail':
        return {
          configured: true,
          provider: 'Gmail SMTP',
          message: 'Gmail SMTP is configured and ready to send emails',
        };
      case 'sendgrid':
        return {
          configured: true,
          provider: 'SendGrid',
          message: 'SendGrid is configured and ready to send emails',
        };
      case 'resend':
        return {
          configured: true,
          provider: 'Resend',
          message: 'Resend is configured and ready to send emails',
        };
      case 'console':
        return {
          configured: true,
          provider: 'Console (Development)',
          message: 'Emails will be logged to console in development mode',
        };
      case 'disabled':
        return {
          configured: false,
          provider: 'Disabled',
          message: 'Email service is not configured. Please set up EMAIL_USER/EMAIL_PASS or SENDGRID_API_KEY',
        };
      default:
        return {
          configured: false,
          provider: 'Unknown',
          message: 'Unknown email configuration',
        };
    }
  }
}

// Export a singleton instance
export const emailService = new EmailService();

// Backward compatibility functions
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  return emailService.sendEmail(options);
}

/** Published CMS inputs for account emails. */
export interface AccountEmailContext {
  emails: VintageEmailsContent;
  tournamentYear: string;
  contactEmail: string;
}

/**
 * Escape HTML entities to prevent XSS.
 *
 * @param text - Untrusted text
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * "Do Not Reply" notice from CMS (`{contactEmail}` filled). Blank → omitted.
 *
 * @param notice - CMS `doNotReplyNotice`
 * @param contactEmail - Homepage footer contact address
 */
export function renderDoNotReplyNotice(
  notice: string,
  contactEmail: string,
): { html: string; text: string } {
  const filled = formatEmailCopy(notice, { contactEmail }).trim();
  if (!filled) return { html: '', text: '' };
  return {
    html: `
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      <p style="font-size: 12px; color: #666; font-style: italic; margin: 0;">
        ${escapeHtml(filled)}
      </p>
    </div>
  `,
    text: `\n\n${filled}\n`,
  };
}

/**
 * Case-insensitive `{token}` fill for account emails (accepts legacy `{Name}`/`{Year}`).
 *
 * @param template - CMS copy
 * @param vars - Lower-case token values
 */
function fillAccountTokens(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key.toLowerCase()];
    return value === undefined ? match : value;
  });
}

/**
 * Render a link-based account email (registration confirm / password reset).
 * Blank CMS fields are omitted; a blank subject is a configuration error.
 *
 * @param copy - CMS copy for this email
 * @param vars - `{name}`, `{year}` values
 * @param link - Action URL
 * @param code - Confirmation / reset code
 * @param ctx - Published CMS context
 * @param label - Section label for errors
 */
function renderAccountEmail(
  copy: VintageAccountEmailCopy,
  vars: { name: string; year: string },
  link: string,
  code: string,
  ctx: AccountEmailContext,
  label: string,
): { subject: string; html: string; text: string } {
  const tokens = { name: vars.name, year: vars.year, code };
  const plain = (s: string) => fillAccountTokens(s, tokens).trim();
  const html = (s: string) => escapeHtml(plain(s));
  const subject = plain(copy.subject);
  if (!subject) {
    throw new Error(`Emails & Account CMS: ${label} subject is blank.`);
  }
  const para = (s: string, style = '') =>
    plain(s) ? `<p${style ? ` style="${style}"` : ''}>${html(s)}</p>` : '';
  const notice = renderDoNotReplyNotice(ctx.emails.doNotReplyNotice, ctx.contactEmail);
  const badgeHtml = isProductionEnvironment()
    ? ''
    : `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="background-color: #ffc107; color: #000; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">🟡 PREVIEW/TEST ENVIRONMENT</span>
    </div>
  `;
  const safeLink = escapeHtml(link);
  const button = plain(copy.buttonLabel)
    ? `<div style="text-align: center; margin: 30px 0;">
          <a href="${safeLink}" style="background-color: #152c3a; color: #f2ead8; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">${html(copy.buttonLabel)}</a>
        </div>`
    : '';
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        ${badgeHtml}
        ${plain(copy.heading) ? `<h2 style="color: #2c3e50; text-align: center;">${html(copy.heading)}</h2>` : ''}
        ${para(copy.greeting)}
        ${para(copy.message1)}
        ${para(copy.message2)}
        ${button}
        ${para(copy.linkFallbackLabel)}
        <p style="word-break: break-all; color: #666;">${safeLink}</p>
        ${para(copy.codeLabel)}
        ${para(copy.expiryNote)}
        ${notice.html}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        ${para(copy.footer, 'font-size: 12px; color: #666; text-align: center;')}
      </div>
    </body>
    </html>
  `;
  const textBody = [
    plain(copy.heading),
    plain(copy.greeting),
    plain(copy.message1),
    plain(copy.message2),
    [plain(copy.linkFallbackLabel), link].filter(Boolean).join('\n'),
    plain(copy.codeLabel),
    plain(copy.expiryNote),
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    subject,
    html: htmlBody,
    text: `${textBody}${notice.text}${plain(copy.footer) ? `\n${plain(copy.footer)}` : ''}`,
  };
}

/**
 * Log an account email event without failing the send.
 *
 * @param eventType - Email log category
 * @param to - Recipient
 * @param emailSent - Send result
 */
async function logAccountEmail(
  eventType: 'Account Creation' | 'Password Reset',
  to: string,
  emailSent: boolean,
): Promise<void> {
  try {
    const { logEmailEvent } = await import('@/lib/emailLogger');
    await logEmailEvent({
      eventType,
      destinationEmail: to,
      attachmentExpected: false,
      attachmentSuccess: null,
      emailSuccess: emailSent,
    });
  } catch (logError) {
    console.error(`[Email Service] Failed to log ${eventType} email:`, logError);
  }
}

/**
 * Send the registration confirmation email (copy from Emails & Account CMS).
 *
 * @param to - Recipient
 * @param name - Account display name
 * @param confirmationLink - Confirm URL
 * @param confirmationCode - Confirmation code
 * @param ctx - Published CMS context
 */
export async function sendConfirmationEmail(
  to: string,
  name: string,
  confirmationLink: string,
  confirmationCode: string,
  ctx: AccountEmailContext,
): Promise<boolean> {
  const rendered = renderAccountEmail(
    ctx.emails.registration,
    { name, year: ctx.tournamentYear },
    confirmationLink,
    confirmationCode,
    ctx,
    'registration',
  );
  const emailSent = await emailService.sendEmail({ to, ...rendered });
  await logAccountEmail('Account Creation', to, emailSent);
  return emailSent;
}

/**
 * Send the password reset email (copy from Emails & Account CMS).
 *
 * @param to - Recipient
 * @param name - Account display name
 * @param resetLink - Reset URL
 * @param resetCode - Reset code
 * @param ctx - Published CMS context
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetLink: string,
  resetCode: string,
  ctx: AccountEmailContext,
): Promise<boolean> {
  const rendered = renderAccountEmail(
    ctx.emails.passwordReset,
    { name, year: ctx.tournamentYear },
    resetLink,
    resetCode,
    ctx,
    'password reset',
  );
  const emailSent = await emailService.sendEmail({ to, ...rendered });
  await logAccountEmail('Password Reset', to, emailSent);
  return emailSent;
}

