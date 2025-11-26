import { SiteConfigData } from './siteConfig';
import { FALLBACK_CONFIG } from './fallbackConfig';

/**
 * Template variables that can be used in email content
 */
export interface EmailTemplateVariables {
  name?: string;
  entryName?: string;
  tournamentYear?: string;
  siteName?: string;
  bracketId?: string;
  submissionCount?: number;
  totalCost?: number;
}

/**
 * Email template types
 */
export type EmailTemplateType = 'pdf' | 'submit';

/**
 * Replace template variables in a string
 * Supports both {variable} and {{variable}} syntax
 */
function replaceVariables(text: string, variables: EmailTemplateVariables): string {
  let result = text;
  
  // Replace {variable} syntax
  result = result.replace(/\{name\}/g, variables.name || 'there');
  result = result.replace(/\{entryName\}/g, variables.entryName || 'your bracket');
  result = result.replace(/\{tournamentYear\}/g, variables.tournamentYear || '');
  result = result.replace(/\{siteName\}/g, variables.siteName || 'Warren\'s March Madness');
  result = result.replace(/\{bracketId\}/g, variables.bracketId || '');
  result = result.replace(/\{submissionCount\}/g, variables.submissionCount?.toString() || '0');
  result = result.replace(/\{totalCost\}/g, variables.totalCost?.toString() || '0');
  
  return result;
}

/**
 * Load email template HTML file
 */
async function loadEmailTemplate(templateType: EmailTemplateType = 'pdf'): Promise<string> {
  try {
    // Check if we're in a server environment (Node.js) or browser
    const isServer = typeof window === 'undefined';
    
    if (isServer) {
      // Server-side: Read directly from filesystem
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      
      const templateFileName = templateType === 'submit' ? 'email-submit.html' : 'email-pdf.html';
      const templatePath = path.join(process.cwd(), 'src', 'emails', templateFileName);
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Email template file not found: ${templatePath}`);
      }
      
      return fs.readFileSync(templatePath, 'utf8');
    } else {
      // Client-side: This shouldn't be called, but handle gracefully
      throw new Error('Email templates can only be loaded server-side');
    }
  } catch (error) {
    console.error('Error loading email template:', error);
    throw error;
  }
}

/**
 * Render email HTML from template and config
 * @param siteConfig - Site configuration data
 * @param variables - Template variables to replace
 * @param templateType - Type of email template ('pdf' for on-demand PDF email, 'submit' for automated submission email)
 */
/**
 * Generate spam reminder HTML and text
 * Uses generic emailSpamReminder or falls back to regEmailSpamReminder
 */
function generateSpamReminder(
  siteConfig: SiteConfigData | null
): { html: string; text: string } {
  const spamReminderText = siteConfig?.emailSpamReminder || 
    siteConfig?.regEmailSpamReminder || 
    FALLBACK_CONFIG.regEmailSpamReminder || 
    '💡 <strong>Can\'t find this email?</strong> Please check your spam or junk mail folder. If you still don\'t see it, the email may take a few minutes to arrive.';
  
  // Generate HTML version (with yellow warning box styling)
  const html = `
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #856404;">
        ${spamReminderText}
      </p>
    </div>
  `;
  
  // Generate text version (strip HTML tags)
  const text = `\n\n${spamReminderText.replace(/<[^>]*>/g, '')}\n`;
  
  return { html, text };
}

/**
 * Generate "Do Not Reply" notice HTML and text
 * Replaces {contactEmail} with the actual contact address from config
 */
function generateDoNotReplyNotice(
  siteConfig: SiteConfigData | null
): { html: string; text: string } {
  const noticeText = siteConfig?.emailDoNotReplyNotice || 
    'Please do not reply to this email. This is an automated message from an unmonitored mailbox. If you need assistance, please contact us at {contactEmail}.';
  const contactEmail = siteConfig?.emailContactAddress || 'support@warrensmm.com';
  
  // Replace {contactEmail} variable
  const noticeWithEmail = noticeText.replace(/\{contactEmail\}/g, contactEmail);
  
  // Generate HTML version (escape HTML for safety)
  const escapeHtml = (text: string): string => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };
  
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

export async function renderEmailTemplate(
  siteConfig: SiteConfigData | null,
  variables: EmailTemplateVariables,
  templateType: EmailTemplateType = 'pdf'
): Promise<{ html: string; text: string; subject: string }> {
  // Load the HTML template
  let template = await loadEmailTemplate(templateType);
  
  // Get content from config based on template type
  let subject: string;
  let heading: string;
  let greeting: string;
  let message1: string;
  let message2: string;
  let message3: string;
  let footer: string;
  
  if (templateType === 'submit') {
    // Automated submission email
    subject = replaceVariables(
      siteConfig?.emailSubmitSubject || 'Bracket Submitted Successfully - Warren\'s March Madness',
      variables
    );
    
    heading = replaceVariables(
      siteConfig?.emailSubmitHeading || 'Bracket Submitted Successfully!',
      variables
    );
    
    greeting = siteConfig?.emailSubmitGreeting 
      ? `<p>${replaceVariables(siteConfig.emailSubmitGreeting, variables)}</p>`
      : `<p>Hi ${variables.name || 'there'},</p>`;
    
    message1 = siteConfig?.emailSubmitMessage1
      ? `<p>${replaceVariables(siteConfig.emailSubmitMessage1, variables)}</p>`
      : '';
    
    message2 = siteConfig?.emailSubmitMessage2
      ? `<p>${replaceVariables(siteConfig.emailSubmitMessage2, variables)}</p>`
      : '';
    
    message3 = siteConfig?.emailSubmitMessage3
      ? `<p>${replaceVariables(siteConfig.emailSubmitMessage3, variables)}</p>`
      : '';
    
    footer = replaceVariables(
      siteConfig?.emailSubmitFooter || 'This is an automated email from Warren\'s March Madness.',
      variables
    );
  } else {
    // On-demand PDF email (default)
    subject = replaceVariables(
      siteConfig?.emailPdfSubject || 'Your Bracket - Warren\'s March Madness',
      variables
    );
    
    heading = replaceVariables(
      siteConfig?.emailPdfHeading || 'Your Bracket is Attached!',
      variables
    );
    
    greeting = siteConfig?.emailPdfGreeting 
      ? `<p>${replaceVariables(siteConfig.emailPdfGreeting, variables)}</p>`
      : `<p>Hi ${variables.name || 'there'},</p>`;
    
    message1 = siteConfig?.emailPdfMessage1
      ? `<p>${replaceVariables(siteConfig.emailPdfMessage1, variables)}</p>`
      : '';
    
    message2 = siteConfig?.emailPdfMessage2
      ? `<p>${replaceVariables(siteConfig.emailPdfMessage2, variables)}</p>`
      : '';
    
    message3 = siteConfig?.emailPdfMessage3
      ? `<p>${replaceVariables(siteConfig.emailPdfMessage3, variables)}</p>`
      : '';
    
    footer = replaceVariables(
      siteConfig?.emailPdfFooter || 'This is an automated email from Warren\'s March Madness.',
      variables
    );
  }
  
  // Generate spam reminder and "Do Not Reply" notice
  const spamReminder = generateSpamReminder(siteConfig);
  const doNotReplyNotice = generateDoNotReplyNotice(siteConfig);
  
  // Replace template placeholders
  template = template.replace(/\{\{subject\}\}/g, subject);
  template = template.replace(/\{\{heading\}\}/g, heading);
  template = template.replace(/\{\{greeting\}\}/g, greeting);
  template = template.replace(/\{\{message1\}\}/g, message1);
  template = template.replace(/\{\{message2\}\}/g, message2);
  template = template.replace(/\{\{message3\}\}/g, message3);
  template = template.replace(/\{\{spamReminder\}\}/g, spamReminder.html);
  template = template.replace(/\{\{doNotReplyNotice\}\}/g, doNotReplyNotice.html);
  template = template.replace(/\{\{footer\}\}/g, footer);
  
  // Generate plain text version
  const greetingText = templateType === 'submit' 
    ? (siteConfig?.emailSubmitGreeting || `Hi ${variables.name || 'there'},`)
    : (siteConfig?.emailPdfGreeting || `Hi ${variables.name || 'there'},`);
  
  const message1Text = templateType === 'submit'
    ? (siteConfig?.emailSubmitMessage1 || '')
    : (siteConfig?.emailPdfMessage1 || '');
  
  const message2Text = templateType === 'submit'
    ? (siteConfig?.emailSubmitMessage2 || '')
    : (siteConfig?.emailPdfMessage2 || '');
  
  const message3Text = templateType === 'submit'
    ? (siteConfig?.emailSubmitMessage3 || '')
    : (siteConfig?.emailPdfMessage3 || '');
  
  const footerText = templateType === 'submit'
    ? (siteConfig?.emailSubmitFooter || 'This is an automated email from Warren\'s March Madness.')
    : (siteConfig?.emailPdfFooter || 'This is an automated email from Warren\'s March Madness.');
  
  const text = `
${heading}

${replaceVariables(greetingText, variables)}

${message1Text ? replaceVariables(message1Text, variables) : ''}

${message2Text ? replaceVariables(message2Text, variables) : ''}

${message3Text ? replaceVariables(message3Text, variables) : ''}

${spamReminder.text}
${doNotReplyNotice.text}${replaceVariables(footerText, variables)}
  `.trim();
  
  return {
    html: template,
    text,
    subject,
  };
}

