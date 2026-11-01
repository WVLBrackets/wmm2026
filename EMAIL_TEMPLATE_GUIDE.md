# Email Template System Guide

## Overview

Transactional emails use a hybrid of:

- **HTML template files** in `src/emails/` (structure and styling)
- **Emails & Account CMS** (`__emailsContent` on the published `vintage_homepage` row) for editable copy

Published CMS is the only source of email copy. There is no Google Sheets Config Sheet. `DEFAULT_VINTAGE_EMAILS_CONTENT` seeds the **editor** only; the public send path uses `blankMissingStrings` after normalize.

Edit copy in Vintage Admin → **Emails & Account**. Publish before expecting live mail to change. CMS writes invalidate the `vintage-cms` cache.

## Email Types

### 1. On-Demand PDF Email (Button-Triggered)

**Template File**: `src/emails/email-pdf.html`  
**CMS object**: `pdf`  
**Trigger**: User clicks "Email PDF" on My Picks  
**Includes**: PDF attachment of the bracket

| CMS field | Purpose |
|-----------|---------|
| `pdf.subject` | Email subject line |
| `pdf.heading` | Main heading |
| `pdf.greeting` | Greeting paragraph |
| `pdf.message1` … `pdf.message3` | Body paragraphs (blank = omitted) |
| `pdf.footer` | Footer text |

On-site dialog copy is `pdfDialog` (title, message, send/cancel, status strings).

### 2. Automated Submission Email

**Template File**: `src/emails/email-submit.html`  
**CMS object**: `submit`  
**Trigger**: Automatically sent when a user submits a bracket

Same field shape as `pdf` (`subject`, `heading`, `greeting`, `message1`–`message3`, `footer`).

### 3. Account emails

**Templates**: `src/emails/confirm.html`, `src/emails/reset.html`  
**CMS objects**: `registration`, `passwordReset`

These include `buttonLabel`, `linkFallbackLabel`, `codeLabel` (`{code}`), and `expiryNote` in addition to subject/heading/greeting/body/footer.

### 4. Auto-reply

Sent when someone replies to the do-not-reply mailbox. CMS object `autoReply` plus shared `doNotReplyNotice` (`{contactEmail}`). See `docs/AUTO_REPLY_SETUP.md`.

## Available Variables

Use `{variable}` syntax in CMS fields.

**Common** (PDF + submit): `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`

`{name}` uses `"there"` only when the user record has no name — that is a mail merge fallback, not CMS copy.

**Submission email only**: `{submissionCount}`, `{totalCost}`

**Account emails**: `{name}`, `{year}`, `{code}`, and contact tokens as implemented in `emailService.ts`

**PDF dialog**: `{entry}`, `{email}`

**Do-not-reply notice**: `{contactEmail}` (from homepage footer / Key Data contact)

## Example CMS values

### On-Demand PDF Email

| Field | Example |
|-------|---------|
| `pdf.subject` | Your {tournamentYear} Bracket - {entryName} |
| `pdf.heading` | Your Bracket is Attached! |
| `pdf.greeting` | Hi {name}, |
| `pdf.message1` | Great news! Your bracket "{entryName}" has been successfully submitted and is ready for the tournament! |
| `pdf.message2` | We've attached a PDF copy of your bracket for your records. Good luck with your picks! |
| `pdf.message3` | Let the madness begin! 🏀 |
| `pdf.footer` | This is an automated email from {siteName}. |

### Automated Submission Email

| Field | Example |
|-------|---------|
| `submit.subject` | Bracket Submitted Successfully - {siteName} |
| `submit.heading` | Bracket Submitted Successfully! |
| `submit.greeting` | Hi {name}, |
| `submit.message1` | Congratulations! Your bracket "{entryName}" has been successfully submitted for the {tournamentYear} tournament. |
| `submit.message2` | You currently have {submissionCount} submitted bracket(s) with a total cost of ${totalCost}. |
| `submit.message3` | Want to increase your chances? Submit more brackets and invite your friends to join the fun! |
| `submit.footer` | This is an automated email from {siteName}. |

## Making Changes

### To Change Text Content

1. Open Vintage Admin → Emails & Account
2. Edit and **publish**
3. Cache invalidates on publish (`vintage-cms`). No code deploy needed for copy.

### To Change Email Structure/Styling

1. Edit the template file under `src/emails/`
2. Commit and deploy

## Blank fields and required subjects

- Empty `message1` / `message2` / `message3` (and other optional paragraphs) are **omitted** from the rendered email.
- A **blank subject** is an error (`Emails & Account CMS: … subject is blank`) — the send fails rather than substituting editor seed copy.
- CMS load failure follows the site-wide rule: throw, vintage `SiteErrorPanel` on pages, `notifyAdminOfError` for the admin.
