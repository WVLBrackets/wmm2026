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
}

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
  
  return result;
}

/**
 * Load email template HTML file
 */
async function loadEmailTemplate(): Promise<string> {
  try {
    // Check if we're in a server environment (Node.js) or browser
    const isServer = typeof window === 'undefined';
    
    if (isServer) {
      // Server-side: Read directly from filesystem
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      
      const templatePath = path.join(process.cwd(), 'src', 'emails', 'email-pdf.html');
      
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
 */
export async function renderEmailTemplate(
  siteConfig: SiteConfigData | null,
  variables: EmailTemplateVariables
): Promise<{ html: string; text: string; subject: string }> {
  // Load the HTML template
  let template = await loadEmailTemplate();
  
  // Get content from config or use defaults
  const subject = replaceVariables(
    siteConfig?.emailPdfSubject || 'Your Bracket - Warren\'s March Madness',
    variables
  );
  
  const heading = replaceVariables(
    siteConfig?.emailPdfHeading || 'Your Bracket is Attached!',
    variables
  );
  
  const greeting = siteConfig?.emailPdfGreeting 
    ? `<p>${replaceVariables(siteConfig.emailPdfGreeting, variables)}</p>`
    : `<p>Hi ${variables.name || 'there'},</p>`;
  
  const message1 = siteConfig?.emailPdfMessage1
    ? `<p>${replaceVariables(siteConfig.emailPdfMessage1, variables)}</p>`
    : '';
  
  const message2 = siteConfig?.emailPdfMessage2
    ? `<p>${replaceVariables(siteConfig.emailPdfMessage2, variables)}</p>`
    : '';
  
  const message3 = siteConfig?.emailPdfMessage3
    ? `<p>${replaceVariables(siteConfig.emailPdfMessage3, variables)}</p>`
    : '';
  
  const footer = replaceVariables(
    siteConfig?.emailPdfFooter || 'This is an automated email from Warren\'s March Madness.',
    variables
  );
  
  // Replace template placeholders
  template = template.replace(/\{\{subject\}\}/g, subject);
  template = template.replace(/\{\{heading\}\}/g, heading);
  template = template.replace(/\{\{greeting\}\}/g, greeting);
  template = template.replace(/\{\{message1\}\}/g, message1);
  template = template.replace(/\{\{message2\}\}/g, message2);
  template = template.replace(/\{\{message3\}\}/g, message3);
  template = template.replace(/\{\{footer\}\}/g, footer);
  
  // Generate plain text version
  const text = `
${heading}

${replaceVariables(siteConfig?.emailPdfGreeting || `Hi ${variables.name || 'there'},`, variables)}

${siteConfig?.emailPdfMessage1 ? replaceVariables(siteConfig.emailPdfMessage1, variables) : ''}

${siteConfig?.emailPdfMessage2 ? replaceVariables(siteConfig.emailPdfMessage2, variables) : ''}

${siteConfig?.emailPdfMessage3 ? replaceVariables(siteConfig.emailPdfMessage3, variables) : ''}

${footer}
  `.trim();
  
  return {
    html: template,
    text,
    subject,
  };
}

