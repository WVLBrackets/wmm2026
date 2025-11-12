# Email Admin Fields Documentation

## Overview

This document lists all email-related configuration fields that can be set in your Google Sheets config. These fields allow you to customize email content without code changes.

## Table of Contents

1. [On-Demand PDF Email Fields](#on-demand-pdf-email-fields)
2. [Automated Submission Email Fields](#automated-submission-email-fields)
3. [Email Modal Window Fields](#email-modal-window-fields)
4. [Available Variables](#available-variables)
5. [Quick Reference Table](#quick-reference-table)

---

## On-Demand PDF Email Fields

These fields control the email sent when a user clicks the "Email PDF" button on the My Brackets page. This email includes a PDF attachment of the bracket.

### `email_pdf_subject`
- **Type**: String
- **Description**: Email subject line for the PDF email
- **Required**: No (defaults to "Your Bracket - Warren's March Madness")
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`
- **Example**: `Your {tournamentYear} Bracket - {entryName}`

### `email_pdf_heading`
- **Type**: String
- **Description**: Main heading displayed at the top of the email
- **Required**: No (defaults to "Your Bracket is Attached!")
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`
- **Example**: `Your Bracket is Attached!`

### `email_pdf_greeting`
- **Type**: String
- **Description**: Greeting paragraph at the start of the email body
- **Required**: No (defaults to "Hi {name},")
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`
- **Example**: `Hi {name},`

### `email_pdf_message1`
- **Type**: String
- **Description**: First content paragraph in the email body
- **Required**: No (defaults to empty)
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`
- **Example**: `Great news! Your bracket "{entryName}" has been successfully submitted and is ready for the tournament!`

### `email_pdf_message2`
- **Type**: String
- **Description**: Second content paragraph in the email body
- **Required**: No (defaults to empty)
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`
- **Example**: `We've attached a PDF copy of your bracket for your records. Good luck with your picks!`

### `email_pdf_message3`
- **Type**: String
- **Description**: Third content paragraph in the email body
- **Required**: No (defaults to empty)
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`
- **Example**: `Let the madness begin! 🏀`

### `email_pdf_footer`
- **Type**: String
- **Description**: Footer text displayed at the bottom of the email
- **Required**: No (defaults to "This is an automated email from Warren's March Madness.")
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`
- **Example**: `This is an automated email from {siteName}.`

---

## Automated Submission Email Fields

These fields control the email sent automatically when a user submits a bracket. This email congratulates the user and provides submission statistics.

### `email_submit_subject`
- **Type**: String
- **Description**: Email subject line for the submission confirmation email
- **Required**: No (defaults to "Bracket Submitted Successfully - Warren's March Madness")
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`, `{submissionCount}`, `{totalCost}`
- **Example**: `Bracket Submitted Successfully - {siteName}`

### `email_submit_heading`
- **Type**: String
- **Description**: Main heading displayed at the top of the email
- **Required**: No (defaults to "Bracket Submitted Successfully!")
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`, `{submissionCount}`, `{totalCost}`
- **Example**: `Bracket Submitted Successfully!`

### `email_submit_greeting`
- **Type**: String
- **Description**: Greeting paragraph at the start of the email body
- **Required**: No (defaults to "Hi {name},")
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`, `{submissionCount}`, `{totalCost}`
- **Example**: `Hi {name},`

### `email_submit_message1`
- **Type**: String
- **Description**: First content paragraph in the email body (typically congratulatory message)
- **Required**: No (defaults to empty)
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`, `{submissionCount}`, `{totalCost}`
- **Example**: `Congratulations! Your bracket "{entryName}" has been successfully submitted for the {tournamentYear} tournament.`

### `email_submit_message2`
- **Type**: String
- **Description**: Second content paragraph in the email body (typically submission statistics)
- **Required**: No (defaults to empty)
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`, `{submissionCount}`, `{totalCost}`
- **Example**: `You currently have {submissionCount} submitted bracket(s) with a total cost of ${totalCost}.`

### `email_submit_message3`
- **Type**: String
- **Description**: Third content paragraph in the email body (typically call-to-action)
- **Required**: No (defaults to empty)
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`, `{submissionCount}`, `{totalCost}`
- **Example**: `Want to increase your chances? Submit more brackets and invite your friends to join the fun!`

### `email_submit_footer`
- **Type**: String
- **Description**: Footer text displayed at the bottom of the email
- **Required**: No (defaults to "This is an automated email from Warren's March Madness.")
- **Variables Supported**: `{name}`, `{entryName}`, `{tournamentYear}`, `{siteName}`, `{bracketId}`, `{submissionCount}`, `{totalCost}`
- **Example**: `This is an automated email from {siteName}.`

---

## Email Modal Window Fields

These fields control the modal dialog that appears when a user clicks the "Email PDF" button.

### `email_window_title`
- **Type**: String
- **Description**: Title displayed at the top of the email confirmation modal
- **Required**: No (defaults to "Email Bracket PDF")
- **Variables Supported**: None (static text only)
- **Example**: `Email Bracket PDF`

### `email_window_message`
- **Type**: String
- **Description**: Message text displayed in the email confirmation modal
- **Required**: No (defaults to "Would you like to send yourself an email with a PDF of your bracket?")
- **Variables Supported**: `{Entry Name}`, `{email}` (note: uses capital E in "Entry Name")
- **Example**: `Would you like to send yourself an email with a PDF of your bracket "{Entry Name}"? The email will be sent to {email}.`

---

## Available Variables

### Common Variables (Available in All Email Types)

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `{name}` | User's full name | "John Smith" |
| `{entryName}` | Bracket entry name | "My Championship Picks" |
| `{tournamentYear}` | Tournament year | "2026" |
| `{siteName}` | Site name from config | "Warren's March Madness" |
| `{bracketId}` | Bracket ID | "123456" |

### Submission Email Only Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `{submissionCount}` | Number of submitted brackets for this user | "3" |
| `{totalCost}` | Total cost (submissionCount × entryCost) | "15" |

### Modal Window Variables

| Variable | Description | Example Value | Notes |
|----------|-------------|---------------|-------|
| `{Entry Name}` | Bracket entry name | "My Championship Picks" | Note: Capital E and space |
| `{email}` | User's email address | "user@example.com" | |

---

## Quick Reference Table

| Field Name | Email Type | Purpose | Variables |
|------------|------------|---------|-----------|
| `email_pdf_subject` | PDF | Subject line | All common |
| `email_pdf_heading` | PDF | Main heading | All common |
| `email_pdf_greeting` | PDF | Greeting paragraph | All common |
| `email_pdf_message1` | PDF | First content paragraph | All common |
| `email_pdf_message2` | PDF | Second content paragraph | All common |
| `email_pdf_message3` | PDF | Third content paragraph | All common |
| `email_pdf_footer` | PDF | Footer text | All common |
| `email_submit_subject` | Submit | Subject line | All + submission stats |
| `email_submit_heading` | Submit | Main heading | All + submission stats |
| `email_submit_greeting` | Submit | Greeting paragraph | All + submission stats |
| `email_submit_message1` | Submit | First content paragraph | All + submission stats |
| `email_submit_message2` | Submit | Second content paragraph | All + submission stats |
| `email_submit_message3` | Submit | Third content paragraph | All + submission stats |
| `email_submit_footer` | Submit | Footer text | All + submission stats |
| `email_window_title` | Modal | Modal title | None |
| `email_window_message` | Modal | Modal message | `{Entry Name}`, `{email}` |

---

## Usage Notes

1. **Variable Syntax**: Use `{variableName}` (curly braces, lowercase) in email fields. For modal window, use `{Entry Name}` (capital E, space) and `{email}` (lowercase).

2. **Empty Fields**: If a message field (`message1`, `message2`, `message3`) is empty or not set, that paragraph will be omitted from the email.

3. **Fallback Values**: If any field is not set in Google Sheets, the system uses fallback values defined in `src/lib/fallbackConfig.ts`.

4. **Immediate Effect**: Changes to Google Sheets config take effect immediately without requiring a deployment.

5. **HTML Support**: Email content fields support basic HTML formatting (paragraphs, line breaks, etc.). The template structure handles the HTML wrapper.

6. **Special Characters**: You can use emojis and special characters in your config fields (e.g., 🏀, $, etc.).

---

## Example Complete Configuration

Here's an example of how you might configure all fields in your Google Sheets:

### On-Demand PDF Email
```
email_pdf_subject: Your {tournamentYear} Bracket - {entryName}
email_pdf_heading: Your Bracket is Attached!
email_pdf_greeting: Hi {name},
email_pdf_message1: Great news! Your bracket "{entryName}" has been successfully submitted and is ready for the tournament!
email_pdf_message2: We've attached a PDF copy of your bracket for your records. Good luck with your picks!
email_pdf_message3: Let the madness begin! 🏀
email_pdf_footer: This is an automated email from {siteName}.
```

### Automated Submission Email
```
email_submit_subject: Bracket Submitted Successfully - {siteName}
email_submit_heading: Bracket Submitted Successfully!
email_submit_greeting: Hi {name},
email_submit_message1: Congratulations! Your bracket "{entryName}" has been successfully submitted for the {tournamentYear} tournament.
email_submit_message2: You currently have {submissionCount} submitted bracket(s) with a total cost of ${totalCost}.
email_submit_message3: Want to increase your chances? Submit more brackets and invite your friends to join the fun!
email_submit_footer: This is an automated email from {siteName}.
```

### Modal Window
```
email_window_title: Email Bracket PDF
email_window_message: Would you like to send yourself an email with a PDF of your bracket "{Entry Name}"? The email will be sent to {email}.
```

---

## Troubleshooting

- **Variables not replacing**: Make sure you're using the correct variable syntax (`{variableName}`) and that the variable is available for that email type.

- **Email not sending**: Check that email service is configured (EMAIL_USER/EMAIL_PASS or SENDGRID_API_KEY environment variables).

- **Template not found**: Ensure template files exist in `src/emails/` directory.

- **Config not loading**: Verify Google Sheets config is accessible and fields are spelled correctly (case-insensitive, but use underscores).

