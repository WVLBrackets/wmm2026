import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import path from 'path';

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use App Password for Gmail
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const mailOptions = {
      from: `"Warren's March Madness" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Simple template renderer and loader
function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => variables[key] ?? "");
}

async function loadTemplate(templateFile: string): Promise<string | null> {
  try {
    const fullPath = path.join(process.cwd(), "src", "emails", templateFile);
    const content = await fs.readFile(fullPath, "utf8");
    return content;
  } catch {
    return null;
  }
}

export async function generateConfirmationEmail(confirmationCode: string, userName: string): Promise<string> {
  const fallback = `<!DOCTYPE html><html><body><h2>Confirm Your Account</h2><p>Hi ${userName},</p><p>Your confirmation code is: <strong>${confirmationCode}</strong></p><p><a href="${process.env.NEXTAUTH_URL}/auth/confirm?token=${confirmationCode}">Confirm My Account</a></p></body></html>`;
  const tpl = await loadTemplate("confirm.html");
  if (!tpl) {
    return fallback;
  }
  
  const variables = {
    name: userName,
    code: confirmationCode,
    link: `${process.env.NEXTAUTH_URL}/auth/confirm?token=${confirmationCode}`,
    siteName: "Warren's March Madness",
    year: process.env.NEXT_PUBLIC_TOURNAMENT_YEAR || "2026",
  };
  
  return renderTemplate(tpl, variables);
}

export async function generatePasswordResetEmail(resetCode: string, userName: string): Promise<string> {
  const fallback = `<!DOCTYPE html><html><body><h2>Reset Your Password</h2><p>Hi ${userName},</p><p>Your reset code is: <strong>${resetCode}</strong></p><p><a href="${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetCode}">Reset My Password</a></p></body></html>`;
  const tpl = await loadTemplate("reset.html");
  if (!tpl) return fallback;
  return renderTemplate(tpl, {
    name: userName,
    code: resetCode,
    link: `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetCode}`,
    siteName: "Warren's March Madness",
    year: process.env.NEXT_PUBLIC_TOURNAMENT_YEAR || "2026",
  });
}

// Backward-compatible helpers used by API routes
export async function sendConfirmationEmail(to: string, name: string, confirmationLink: string, confirmationCode: string): Promise<boolean> {
  const html = await generateConfirmationEmail(confirmationCode, name);
  const subject = "Confirm Your Warren's March Madness Account";
  return await sendEmail({ to, subject, html });
}

export async function sendPasswordResetEmail(to: string, name: string, resetLink: string, resetCode: string): Promise<boolean> {
  const html = await generatePasswordResetEmail(resetCode, name);
  const subject = "Password Reset for Warren's March Madness";
  return await sendEmail({ to, subject, html });
}
