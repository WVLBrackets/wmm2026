# Email Template System Guide

## Overview

The application now uses a hybrid template system for two types of emails:
- **On-Demand PDF Email** - User clicks button to email their bracket PDF
- **Automated Submission Email** - Sent automatically when user submits a bracket

Both use:
- **HTML Template Files**: Contains the structure and styling
- **Google Sheets Config**: Contains the editable text content

## Email Types

### 1. On-Demand PDF Email (Button-Triggered)

**Template File**: `src/emails/email-pdf.html`  
**Config Prefix**: `email_pdf_*`  
**Trigger**: User clicks "Email PDF" button on My Brackets page  
**Includes**: PDF attachment of the bracket

**Config Fields**:
- `email_pdf_subject` - Email subject line
- `email_pdf_heading` - Main heading in email
- `email_pdf_greeting` - Greeting paragraph
- `email_pdf_message1` - First content paragraph
- `email_pdf_message2` - Second content paragraph
- `email_pdf_message3` - Third content paragraph
- `email_pdf_footer` - Footer text

### 2. Automated Submission Email

**Template File**: `src/emails/email-submit.html`  
**Config Prefix**: `email_submit_*`  
**Trigger**: Automatically sent when user submits a bracket  
**Purpose**: Congratulates user, shows submission count and total cost, encourages more submissions

**Config Fields**:
- `email_submit_subject` - Email subject line
- `email_submit_heading` - Main heading in email
- `email_submit_greeting` - Greeting paragraph
- `email_submit_message1` - First content paragraph
- `email_submit_message2` - Second content paragraph
- `email_submit_message3` - Third content paragraph
- `email_submit_footer` - Footer text

## Available Variables

You can use these variables in your Google Sheets config fields (use `{variable}` syntax):

**Common Variables** (available in both email types):
- `{name}` - User's name (falls back to "there" if not available)
- `{entryName}` - Bracket entry name
- `{tournamentYear}` - Tournament year
- `{siteName}` - Site name
- `{bracketId}` - Bracket ID

**Submission Email Only**:
- `{submissionCount}` - Number of submitted brackets for this user
- `{totalCost}` - Total cost (submissionCount × entryCost)

## Example Config Values

### On-Demand PDF Email

| Parameter | Value |
|-----------|-------|
| `email_pdf_subject` | Your {tournamentYear} Bracket - {entryName} |
| `email_pdf_heading` | Your Bracket is Attached! |
| `email_pdf_greeting` | Hi {name}, |
| `email_pdf_message1` | Great news! Your bracket "{entryName}" has been successfully submitted and is ready for the tournament! |
| `email_pdf_message2` | We've attached a PDF copy of your bracket for your records. Good luck with your picks! |
| `email_pdf_message3` | Let the madness begin! 🏀 |
| `email_pdf_footer` | This is an automated email from {siteName}. |

### Automated Submission Email

| Parameter | Value |
|-----------|-------|
| `email_submit_subject` | Bracket Submitted Successfully - {siteName} |
| `email_submit_heading` | Bracket Submitted Successfully! |
| `email_submit_greeting` | Hi {name}, |
| `email_submit_message1` | Congratulations! Your bracket "{entryName}" has been successfully submitted for the {tournamentYear} tournament. |
| `email_submit_message2` | You currently have {submissionCount} submitted bracket(s) with a total cost of ${totalCost}. |
| `email_submit_message3` | Want to increase your chances? Submit more brackets and invite your friends to join the fun! |
| `email_submit_footer` | This is an automated email from {siteName}. |

## Making Changes

### To Change Text Content:
1. Edit the values in your Google Sheets config
2. Changes take effect immediately (no deployment needed)

### To Change Email Structure/Styling:
1. Edit the appropriate template file:
   - `src/emails/email-pdf.html` for on-demand PDF email
   - `src/emails/email-submit.html` for automated submission email
2. Commit and deploy the changes

## Fallback Values

If the Google Sheets config is unavailable or fields are missing, the system uses fallback values defined in `src/lib/fallbackConfig.ts`. These provide sensible defaults for both email types.

