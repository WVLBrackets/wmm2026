import { escapeHtml, renderDoNotReplyNotice } from './emailService';
import type { VintageEmailsContent } from './vintage/emailsContent';

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

/** Published CMS inputs for bracket emails. */
export interface BracketEmailContext {
  emails: VintageEmailsContent;
  contactEmail: string;
}

/**
 * Fill `{token}` placeholders with raw (unescaped) values; unknown tokens stay.
 *
 * @param text - CMS copy
 * @param variables - Token values
 */
function fillVariables(text: string, variables: EmailTemplateVariables): string {
  const values: Record<string, string> = {
    name: variables.name ?? '',
    entryName: variables.entryName ?? '',
    tournamentYear: variables.tournamentYear ?? '',
    siteName: variables.siteName ?? '',
    bracketId: variables.bracketId ?? '',
    submissionCount: String(variables.submissionCount ?? 0),
    totalCost: String(variables.totalCost ?? 0),
  };
  return text
    .replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m)
    .replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m)
    .trim();
}

/**
 * Load an email HTML shell from `src/emails` (server only).
 *
 * @param templateType - `pdf` or `submit`
 */
async function loadEmailTemplate(templateType: EmailTemplateType): Promise<string> {
  if (typeof window !== 'undefined') {
    throw new Error('Email templates can only be loaded server-side');
  }
  const fs = await import('fs');
  const path = await import('path');
  const templateFileName = templateType === 'submit' ? 'email-submit.html' : 'email-pdf.html';
  const templatePath = path.join(process.cwd(), 'src', 'emails', templateFileName);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template file not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Render a bracket email (submission confirmation or PDF delivery) from
 * Emails & Account CMS copy. Blank fields are omitted; a blank subject is a
 * configuration error.
 *
 * @param ctx - Published CMS context
 * @param variables - Token values (user values are HTML-escaped)
 * @param templateType - `pdf` (on-demand PDF) or `submit` (automated confirmation)
 */
export async function renderEmailTemplate(
  ctx: BracketEmailContext,
  variables: EmailTemplateVariables,
  templateType: EmailTemplateType = 'pdf',
): Promise<{ html: string; text: string; subject: string }> {
  const copy = templateType === 'submit' ? ctx.emails.submit : ctx.emails.pdf;
  const subject = fillVariables(copy.subject, variables);
  if (!subject) {
    throw new Error(`Emails & Account CMS: ${templateType} email subject is blank.`);
  }
  const plain = (s: string) => fillVariables(s, variables);
  const para = (s: string) => (plain(s) ? `<p>${escapeHtml(plain(s))}</p>` : '');
  const notice = renderDoNotReplyNotice(ctx.emails.doNotReplyNotice, ctx.contactEmail);

  let template = await loadEmailTemplate(templateType);
  template = template
    .replace(/\{\{subject\}\}/g, escapeHtml(subject))
    .replace(/\{\{heading\}\}/g, escapeHtml(plain(copy.heading)))
    .replace(/\{\{greeting\}\}/g, para(copy.greeting))
    .replace(/\{\{message1\}\}/g, para(copy.message1))
    .replace(/\{\{message2\}\}/g, para(copy.message2))
    .replace(/\{\{message3\}\}/g, para(copy.message3))
    .replace(/\{\{spamReminder\}\}/g, '')
    .replace(/\{\{doNotReplyNotice\}\}/g, notice.html)
    .replace(/\{\{footer\}\}/g, escapeHtml(plain(copy.footer)));

  const text = [
    plain(copy.heading),
    plain(copy.greeting),
    plain(copy.message1),
    plain(copy.message2),
    plain(copy.message3),
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    html: template,
    text: `${text}${notice.text}${plain(copy.footer) ? `\n${plain(copy.footer)}` : ''}`,
    subject,
  };
}
