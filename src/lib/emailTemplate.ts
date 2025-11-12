import { SiteConfigData } from './siteConfig';

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
  
  // Replace template placeholders
  template = template.replace(/\{\{subject\}\}/g, subject);
  template = template.replace(/\{\{heading\}\}/g, heading);
  template = template.replace(/\{\{greeting\}\}/g, greeting);
  template = template.replace(/\{\{message1\}\}/g, message1);
  template = template.replace(/\{\{message2\}\}/g, message2);
  template = template.replace(/\{\{message3\}\}/g, message3);
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

${replaceVariables(footerText, variables)}
  `.trim();
  
  return {
    html: template,
    text,
    subject,
  };
}

