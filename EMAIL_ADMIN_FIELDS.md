# Email Admin Fields

## Overview

Email and account-page copy lives in the **Emails & Account** CMS sidecar (`__emailsContent` on `vintage_homepage`). Edit in Vintage Admin → Emails & Account, then publish.

Blank CMS fields hide/omit the element. `DEFAULT_VINTAGE_EMAILS_CONTENT` is an **editor seed only** — it is not merged on the public send or account-page read path (`blankMissingStrings` after normalize).

## Table of Contents

1. [Shared notice](#shared-notice)
2. [On-Demand PDF Email](#on-demand-pdf-email)
3. [Automated Submission Email](#automated-submission-email)
4. [Registration and password reset emails](#registration-and-password-reset-emails)
5. [Auto-reply](#auto-reply)
6. [Account pages](#account-pages)
7. [Email PDF dialog](#email-pdf-dialog)
8. [Available Variables](#available-variables)
9. [Usage Notes](#usage-notes)

---

## Shared notice

### `doNotReplyNotice`

- **Tokens**: `{contactEmail}`
- **Description**: Footer notice on outbound mail that the mailbox is unmonitored
- Blank: omit the notice

---

## On-Demand PDF Email

CMS object `pdf`. Sent when the user clicks Email PDF (attachment included).

| Field | Description | Tokens |
|-------|-------------|--------|
| `pdf.subject` | Subject line. **Required** (blank subject fails the send). | Common |
| `pdf.heading` | Main heading | Common |
| `pdf.greeting` | Greeting | Common |
| `pdf.message1` | First body paragraph; blank = omit | Common |
| `pdf.message2` | Second body paragraph; blank = omit | Common |
| `pdf.message3` | Third body paragraph; blank = omit | Common |
| `pdf.footer` | Footer; blank = omit | Common |

---

## Automated Submission Email

CMS object `submit`. Same field names as `pdf`, plus submission tokens.

---

## Registration and password reset emails

CMS objects `registration` and `passwordReset`. Templates: `src/emails/confirm.html`, `src/emails/reset.html`.

| Field | Description | Tokens |
|-------|-------------|--------|
| `subject` | Required subject | `{name}`, `{year}`, … |
| `heading`, `greeting`, `message1`, `message2` | Body; blank paragraphs omitted | same |
| `buttonLabel` | CTA button | |
| `linkFallbackLabel` | Text before the raw URL | |
| `codeLabel` | `{code}` | |
| `expiryNote` | Expiry copy | |
| `footer` | Footer | |

---

## Auto-reply

CMS object `autoReply` (inbound replies to do-not-reply).

| Field | Description | Tokens |
|-------|-------------|--------|
| `autoReply.subject` | Required. | `{subject}` (original subject without a leading `Re:`) |
| `autoReply.heading` | Heading | |
| `autoReply.greeting` | Greeting | |
| `autoReply.mainMessage` | Body | |
| `autoReply.closing` | Closing | |

Also uses `doNotReplyNotice` and the homepage **contact email**.

---

## Account pages

CMS object `account`. Sign-in errors, create-account success, confirm, forgot/reset **on-site** copy (`||` line breaks where noted).

Examples: `signInInvalid`, `signInNotConfirmed`, `createSuccessHeading`, `createSuccessMessage1` (`{email}`), `forgotSuccessMessage` (`{email}`), `resetSuccessHeading`, `confirmFailureMessage`. Blank fields hide the corresponding UI string.

---

## Email PDF dialog

CMS object `pdfDialog` (My Picks modal, not the email body).

| Field | Tokens |
|-------|--------|
| `pdfDialog.title` | none |
| `pdfDialog.message` | `{entry}`, `{email}` |
| `pdfDialog.sendLabel` | |
| `pdfDialog.cancelLabel` | |
| `pdfDialog.sendingMessage` | |
| `pdfDialog.successMessage` | |
| `pdfDialog.failureMessage` | |

---

## Available Variables

### Common (PDF + submit)

| Variable | Description |
|----------|-------------|
| `{name}` | User's name (mail-merge uses "there" if the profile has no name) |
| `{entryName}` | Bracket entry name |
| `{tournamentYear}` | Key Data Tourney Year |
| `{siteName}` | Key Data site name |
| `{bracketId}` | Bracket ID |

### Submission only

| Variable | Description |
|----------|-------------|
| `{submissionCount}` | Submitted brackets for this user |
| `{totalCost}` | `submissionCount × entryCost` |

### Dialog / notice

| Variable | Where |
|----------|--------|
| `{entry}`, `{email}` | PDF dialog |
| `{contactEmail}` | `doNotReplyNotice` |
| `{subject}` | Auto-reply subject |
| `{code}` | Account emails |

---

## Usage Notes

1. **Variable syntax**: `{variableName}` (curly braces). PDF dialog uses `{entry}` and `{email}`.
2. **Blank fields**: Optional paragraphs and UI strings are omitted/hidden. Subjects must be non-blank to send.
3. **No sheet / no public fallback merge**: Changes are CMS publish, not Google Sheets. Editor seeds are not substituted for visitors.
4. **HTML**: Body fields may include simple markup; the HTML wrapper lives in `src/emails/`.
5. **Line breaks**: Visitor-facing CMS strings use `||` as a hard line break (`CmsText` / `splitCmsLines`).

## Troubleshooting

- **Variables not replacing**: Check token spelling and that the field is for that email type.
- **Email not sending**: Confirm Resend/Gmail env vars; a blank CMS **subject** also fails the send.
- **Template not found**: Ensure files exist in `src/emails/`.
- **Copy not updating**: Publish Emails & Account; wait for `vintage-cms` invalidation (or Rebuild Home).
