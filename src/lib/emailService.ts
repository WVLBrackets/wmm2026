import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import type { SiteConfigData } from '@/lib/siteConfig';

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
    // Determine environment (staging/preview vs production)
    const vercelEnv = process.env.VERCEL_ENV || 'production';
    const isProduction = vercelEnv === 'production';
    
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
    
    // Log which account is being used (for debugging)
    console.log(`[EmailService] Environment: ${vercelEnv} (${isProduction ? 'production' : 'staging/preview'})`);
    
    // Log Gmail configuration
    if (emailUser && emailPass) {
      console.log(`[EmailService] Using Gmail account: ${emailUser.substring(0, emailUser.indexOf('@')) + '@...'} (source: ${source})`);
      console.log(`[EmailService] EMAIL_USER_STAGING: ${process.env.EMAIL_USER_STAGING ? 'set' : 'not set'}`);
      console.log(`[EmailService] EMAIL_PASS_STAGING: ${process.env.EMAIL_PASS_STAGING ? 'set' : 'not set'}`);
      console.log(`[EmailService] EMAIL_USER_PRODUCTION: ${process.env.EMAIL_USER_PRODUCTION ? 'set' : 'not set'}`);
      console.log(`[EmailService] EMAIL_PASS_PRODUCTION: ${process.env.EMAIL_PASS_PRODUCTION ? 'set' : 'not set'}`);
      console.log(`[EmailService] EMAIL_USER (fallback): ${process.env.EMAIL_USER ? 'set' : 'not set'}`);
    }
    
    // Log Resend configuration
    if (process.env.RESEND_API_KEY) {
      const fromEmail = isProduction
        ? (process.env.FROM_EMAIL_PRODUCTION || process.env.FROM_EMAIL || 'not set')
        : (process.env.FROM_EMAIL_STAGING || process.env.FROM_EMAIL || 'not set');
      console.log(`[EmailService] RESEND_API_KEY: set`);
      console.log(`[EmailService] FROM_EMAIL: ${fromEmail}`);
      console.log(`[EmailService] FROM_EMAIL_STAGING: ${process.env.FROM_EMAIL_STAGING ? 'set' : 'not set'}`);
      console.log(`[EmailService] FROM_EMAIL_PRODUCTION: ${process.env.FROM_EMAIL_PRODUCTION ? 'set' : 'not set'}`);
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
    // Determine environment for FROM_EMAIL selection
    const vercelEnv = process.env.VERCEL_ENV || 'production';
    const isProduction = vercelEnv === 'production';
    
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
        console.error('[EmailService] Resend failed, attempting Gmail fallback:', resendError);
        // Fall through to Gmail fallback
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

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(text: string): string {
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
 * Generate "Do Not Reply" notice HTML and text
 * Replaces {contactEmail} with the actual contact address from config
 */
function generateDoNotReplyNotice(
  siteConfig?: Pick<SiteConfigData, 'emailDoNotReplyNotice' | 'emailContactAddress'> | null
): { html: string; text: string } {
  const noticeText = siteConfig?.emailDoNotReplyNotice || 
    'Please do not reply to this email. This is an automated message from an unmonitored mailbox. If you need assistance, please contact us at {contactEmail}.';
  const contactEmail = siteConfig?.emailContactAddress || 'support@warrensmm.com';
  
  // Replace {contactEmail} variable
  const noticeWithEmail = noticeText.replace(/\{contactEmail\}/g, contactEmail);
  
  // Generate HTML version (escape HTML for safety)
  const html = `
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      <p style="font-size: 12px; color: #666; font-style: italic; margin: 0;">
        ${escapeHtml(noticeWithEmail)}
      </p>
    </div>
  `;
  
  // Generate text version
  const text = `\n\n${noticeWithEmail}\n`;
  
  return { html, text };
}

/**
 * Replace template variables in registration email text
 * Supports {Name} and {Year} syntax
 * Note: Values are escaped for HTML safety
 */
function replaceRegEmailVariables(text: string, name: string, tournamentYear: string, escapeForHtml: boolean = false): string {
  let result = text;
  const nameValue = name || 'there';
  const yearValue = tournamentYear || '2026';
  
  // Replace variables (case-insensitive)
  result = result.replace(/\{Name\}/gi, escapeForHtml ? escapeHtml(nameValue) : nameValue);
  result = result.replace(/\{Year\}/gi, escapeForHtml ? escapeHtml(yearValue) : yearValue);
  
  return result;
}

export async function sendConfirmationEmail(
  to: string, 
  name: string, 
  confirmationLink: string, 
  confirmationCode: string,
  siteConfig?: SiteConfigData | null
): Promise<boolean> {
  // Only show badge for non-production environments
  const environment = process.env.VERCEL_ENV || 'production';
  const isProduction = environment === 'production';
  const showBadge = !isProduction;
  
  // Get config values with fallbacks
  const { FALLBACK_CONFIG } = await import('@/lib/fallbackConfig');
  const tournamentYear = siteConfig?.tournamentYear || process.env.NEXT_PUBLIC_TOURNAMENT_YEAR || '2026';
  
  const subject = replaceRegEmailVariables(
    siteConfig?.regEmailSubject || FALLBACK_CONFIG.regEmailSubject || "Confirm Your Warren's March Madness Account",
    name,
    tournamentYear,
    false // Subject doesn't need HTML escaping
  );
  
  const header = replaceRegEmailVariables(
    siteConfig?.regEmailHeader || FALLBACK_CONFIG.regEmailHeader || "Welcome to Warren's March Madness!",
    name,
    tournamentYear,
    true // HTML content needs escaping
  );
  
  const greeting = replaceRegEmailVariables(
    siteConfig?.regEmailGreeting || FALLBACK_CONFIG.regEmailGreeting || 'Hi {Name},',
    name,
    tournamentYear,
    true // HTML content needs escaping
  );
  
  const message1 = replaceRegEmailVariables(
    siteConfig?.regEmailMessage1 || FALLBACK_CONFIG.regEmailMessage1 || 'Thank you for signing up for Warren\'s March Madness {Year}!',
    name,
    tournamentYear,
    true // HTML content needs escaping
  );
  
  const message2 = replaceRegEmailVariables(
    siteConfig?.regEmailMessage2 || FALLBACK_CONFIG.regEmailMessage2 || 'To complete your account setup, please confirm your email address by clicking the button below:',
    name,
    tournamentYear,
    true // HTML content needs escaping
  );
  
  const footer = replaceRegEmailVariables(
    siteConfig?.regEmailFooter || FALLBACK_CONFIG.regEmailFooter || 'If you didn\'t create an account with Warren\'s March Madness, please ignore this email.',
    name,
    tournamentYear,
    true // HTML content needs escaping
  );
  
  // Environment badge (only for Preview/Development)
  const badgeHtml = showBadge ? `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="background-color: #ffc107; color: #000; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">🟡 PREVIEW/TEST ENVIRONMENT</span>
    </div>
  ` : '';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        ${badgeHtml}
        <h2 style="color: #2c3e50; text-align: center;">${header}</h2>
        <p>${greeting}</p>
        <p>${message1}</p>
        <p>${message2}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmationLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Confirm My Account</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${confirmationLink}</p>
        <p>Your confirmation code is: <strong>${confirmationCode}</strong></p>
        <p>This link will expire in 24 hours.</p>
        ${generateDoNotReplyNotice(siteConfig).html}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          ${footer}
        </p>
      </div>
    </body>
    </html>
  `;

  // For text version, use non-escaped values
  const textHeader = replaceRegEmailVariables(
    siteConfig?.regEmailHeader || FALLBACK_CONFIG.regEmailHeader || "Welcome to Warren's March Madness!",
    name,
    tournamentYear,
    false // Text version doesn't need HTML escaping
  );
  
  const textGreeting = replaceRegEmailVariables(
    siteConfig?.regEmailGreeting || FALLBACK_CONFIG.regEmailGreeting || 'Hi {Name},',
    name,
    tournamentYear,
    false // Text version doesn't need HTML escaping
  );
  
  const textMessage1 = replaceRegEmailVariables(
    siteConfig?.regEmailMessage1 || FALLBACK_CONFIG.regEmailMessage1 || 'Thank you for signing up for Warren\'s March Madness {Year}!',
    name,
    tournamentYear,
    false // Text version doesn't need HTML escaping
  );
  
  const textMessage2 = replaceRegEmailVariables(
    siteConfig?.regEmailMessage2 || FALLBACK_CONFIG.regEmailMessage2 || 'To complete your account setup, please confirm your email address by clicking the button below:',
    name,
    tournamentYear,
    false // Text version doesn't need HTML escaping
  );
  
  const textFooter = replaceRegEmailVariables(
    siteConfig?.regEmailFooter || FALLBACK_CONFIG.regEmailFooter || 'If you didn\'t create an account with Warren\'s March Madness, please ignore this email.',
    name,
    tournamentYear,
    false // Text version doesn't need HTML escaping
  );

  const text = `
${textHeader}

${textGreeting}

${textMessage1}

${textMessage2}

To complete your account setup, please confirm your email address by visiting this link:
${confirmationLink}

Your confirmation code is: ${confirmationCode}

This link will expire in 24 hours.

${generateDoNotReplyNotice(siteConfig).text}${textFooter}
  `;

  const emailSent = await emailService.sendEmail({
    to,
    subject,
    html,
    text,
  });

  // Log email event (Account Creation - no attachment expected)
  try {
    const { logEmailEvent } = await import('@/lib/emailLogger');
    await logEmailEvent({
      eventType: 'Account Creation',
      destinationEmail: to,
      attachmentExpected: false,
      attachmentSuccess: null,
      emailSuccess: emailSent,
    });
  } catch (logError) {
    // Don't fail email sending if logging fails
    console.error('[Email Service] Failed to log Account Creation email:', logError);
  }

  return emailSent;
}

export async function sendPasswordResetEmail(
  to: string, 
  name: string, 
  resetLink: string, 
  resetCode: string,
  siteConfig?: SiteConfigData | null
): Promise<boolean> {
  // Only show badge for non-production environments
  const environment = process.env.VERCEL_ENV || 'production';
  const isProduction = environment === 'production';
  const showBadge = !isProduction;
  
  // Environment badge (only for Preview/Development)
  const badgeHtml = showBadge ? `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="background-color: #ffc107; color: #000; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">🟡 PREVIEW/TEST ENVIRONMENT</span>
    </div>
  ` : '';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset - Warren's March Madness</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        ${badgeHtml}
        <h2 style="color: #2c3e50; text-align: center;">Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password for your Warren's March Madness account.</p>
        <p>To reset your password, please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset My Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetLink}</p>
        <p>Your reset code is: <strong>${resetCode}</strong></p>
        <p>This link will expire in 1 hour.</p>
        ${generateDoNotReplyNotice(siteConfig).html}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Password Reset Request
    
    Hi ${name},
    
    We received a request to reset your password for your Warren's March Madness account.
    
    To reset your password, please visit this link:
    ${resetLink}
    
    Your reset code is: ${resetCode}
    
    This link will expire in 1 hour.
    
    ${generateDoNotReplyNotice(siteConfig).text}If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
  `;

  const emailSent = await emailService.sendEmail({
    to,
    subject: "Password Reset - Warren's March Madness",
    html,
    text,
  });

  // Log email event (Password Reset - no attachment expected)
  try {
    const { logEmailEvent } = await import('@/lib/emailLogger');
    await logEmailEvent({
      eventType: 'Password Reset',
      destinationEmail: to,
      attachmentExpected: false,
      attachmentSuccess: null,
      emailSuccess: emailSent,
    });
  } catch (logError) {
    // Don't fail email sending if logging fails
    console.error('[Email Service] Failed to log Password Reset email:', logError);
  }

  return emailSent;
}
