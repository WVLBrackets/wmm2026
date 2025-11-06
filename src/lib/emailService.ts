import nodemailer from 'nodemailer';

export interface EmailServiceConfig {
  provider: 'gmail' | 'sendgrid' | 'console' | 'disabled';
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
  private config: EmailServiceConfig;

  constructor() {
    this.config = this.detectEmailConfig();
    this.initializeTransporter();
  }

  private detectEmailConfig(): EmailServiceConfig {
    // Check for Gmail configuration
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      return {
        provider: 'gmail',
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      };
    }

    // Check for SendGrid configuration
    if (process.env.SENDGRID_API_KEY) {
      return {
        provider: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY,
      };
    }

    // In development, use console logging
    if (process.env.NODE_ENV === 'development') {
      return {
        provider: 'console',
      };
    }

    // In production without email config, disable email service
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
      
      case 'console':
      case 'disabled':
        this.transporter = null;
        break;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case 'gmail':
        case 'sendgrid':
          if (!this.transporter) {
            throw new Error('Email transporter not initialized');
          }
          
          const mailOptions: any = {
            from: `"Warren's March Madness" <${this.config.user || 'noreply@warrensmarchmadness.com'}>`,
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

          const result = await this.transporter.sendMail(mailOptions);
          console.log('Email sent successfully:', result.messageId);
          return true;

        case 'console':
          console.log('📧 EMAIL (Development Mode):');
          console.log('To:', options.to);
          console.log('Subject:', options.subject);
          console.log('HTML:', options.html);
          console.log('Text:', options.text);
          if (options.attachments && options.attachments.length > 0) {
            console.log('Attachments:', options.attachments.map(att => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.content instanceof Buffer ? att.content.length : att.content.length,
            })));
          }
          return true;

        case 'disabled':
          console.error('Email service is disabled. Cannot send email to:', options.to);
          return false;

        default:
          throw new Error(`Unknown email provider: ${this.config.provider}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
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

export async function sendConfirmationEmail(to: string, name: string, confirmationLink: string, confirmationCode: string): Promise<boolean> {
  // Only show badge for non-production environments
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
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
      <title>Confirm Your Account - Warren's March Madness</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        ${badgeHtml}
        <h2 style="color: #2c3e50; text-align: center;">Welcome to Warren's March Madness!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for signing up for Warren's March Madness ${process.env.NEXT_PUBLIC_TOURNAMENT_YEAR || '2026'}!</p>
        <p>To complete your account setup, please confirm your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmationLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Confirm My Account</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${confirmationLink}</p>
        <p>Your confirmation code is: <strong>${confirmationCode}</strong></p>
        <p>This link will expire in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          If you didn't create an account with Warren's March Madness, please ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to Warren's March Madness!
    
    Hi ${name},
    
    Thank you for signing up for Warren's March Madness ${process.env.NEXT_PUBLIC_TOURNAMENT_YEAR || '2026'}!
    
    To complete your account setup, please confirm your email address by visiting this link:
    ${confirmationLink}
    
    Your confirmation code is: ${confirmationCode}
    
    This link will expire in 24 hours.
    
    If you didn't create an account with Warren's March Madness, please ignore this email.
  `;

  return emailService.sendEmail({
    to,
    subject: "Confirm Your Warren's March Madness Account",
    html,
    text,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetLink: string, resetCode: string): Promise<boolean> {
  // Only show badge for non-production environments
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
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
    
    If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
  `;

  return emailService.sendEmail({
    to,
    subject: "Password Reset - Warren's March Madness",
    html,
    text,
  });
}
