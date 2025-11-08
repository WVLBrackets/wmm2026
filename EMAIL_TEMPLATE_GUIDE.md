# Email PDF Template System Guide

## Overview

The email PDF feature now uses a hybrid template system:
- **HTML Template File**: `src/emails/email-pdf.html` - Contains the structure and styling
- **Google Sheets Config**: Contains the editable text content

## How It Works

1. **HTML Template** (`src/emails/email-pdf.html`):
   - Contains the email structure, layout, and styling
   - Uses placeholders like `{{subject}}`, `{{heading}}`, `{{greeting}}`, etc.
   - This file is version-controlled and should only be changed for styling/layout updates

2. **Google Sheets Config**:
   - Add the following fields to your Google Sheets config:
     - `email_pdf_subject` - Email subject line
     - `email_pdf_heading` - Main heading in email
     - `email_pdf_greeting` - Greeting paragraph
     - `email_pdf_message1` - First content paragraph
     - `email_pdf_message2` - Second content paragraph
     - `email_pdf_message3` - Third content paragraph
     - `email_pdf_footer` - Footer text

## Available Variables

You can use these variables in your Google Sheets config fields (use `{variable}` syntax):

- `{name}` - User's name (falls back to "there" if not available)
- `{entryName}` - Bracket entry name
- `{tournamentYear}` - Tournament year
- `{siteName}` - Site name
- `{bracketId}` - Bracket ID

## Example Config Values

Here's an example of what you might put in your Google Sheets:

| Parameter | Value |
|-----------|-------|
| `email_pdf_subject` | Your {tournamentYear} Bracket - {entryName} |
| `email_pdf_heading` | Your Bracket is Attached! |
| `email_pdf_greeting` | Hi {name}, |
| `email_pdf_message1` | Great news! Your bracket "{entryName}" has been successfully submitted and is ready for the tournament! |
| `email_pdf_message2` | We've attached a PDF copy of your bracket for your records. Good luck with your picks! |
| `email_pdf_message3` | Let the madness begin! 🏀 |
| `email_pdf_footer` | This is an automated email from {siteName}. |

## Making Changes

### To Change Text Content:
1. Edit the values in your Google Sheets config
2. Changes take effect immediately (no deployment needed)

### To Change Email Structure/Styling:
1. Edit `src/emails/email-pdf.html`
2. Commit and deploy the changes

## Fallback Values

If the Google Sheets config is unavailable or fields are missing, the system uses fallback values defined in `src/lib/fallbackConfig.ts`. These match the original hardcoded values.

