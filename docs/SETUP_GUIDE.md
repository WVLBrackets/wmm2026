# Setup Guide for New Machine

This guide helps you get up and running on a new machine while preserving all context and work completed.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/WVLBrackets/wmm2026.git
   cd wmm2026
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```powershell
   # On Windows PowerShell
   .\scripts\pull-env-all.ps1
   ```
   This creates `.env.test` with all necessary environment variables from Vercel.

4. **Install Playwright browsers** (for testing)
   ```bash
   npx playwright install
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

## Environment Variables

The following environment variables are required (automatically pulled via `pull-env-all.ps1`):

### Required for Development
- `POSTGRES_URL` - Database connection string
- `RESEND_API_KEY` - Email service API key
- `RESEND_WEBHOOK_SECRET` - Webhook signature verification
- `FROM_EMAIL_STAGING` / `FROM_EMAIL_PRODUCTION` - Email sender addresses
- `EMAIL_USER_STAGING` / `EMAIL_PASS_STAGING` - Gmail fallback credentials
- `EMAIL_USER_PRODUCTION` / `EMAIL_PASS_PRODUCTION` - Gmail fallback credentials
- `VERCEL_ENV` - Environment identifier
- `TEST_USER_EMAIL` - Test user email for Playwright tests
- `TEST_USER_PASSWORD_STAGING` / `TEST_USER_PASSWORD_PRODUCTION` - Test user passwords

### Optional
- `SUPPRESS_TEST_EMAILS` - Set to 'true' to suppress emails during test runs

## Key Project Context

### Version History
- **v5.1** (Current Baseline): Admin UI improvements
  - Inline delete confirmations
  - Protect Submitted/Confirmed toggles
  - Status icons (green check/yellow clock)
  - Removed Tie Breaker and Status columns
  - Entry name search on Brackets Admin
  - Totals row on Brackets Admin

- **v5.0**: Full regression testing setup
  - Multi-browser testing (Chrome, Firefox, WebKit/Safari)
  - Mobile device emulation
  - Email suppression for test users
  - GitHub Actions workflows for automated testing

### Architecture Highlights

1. **Email Service**
   - Primary: Resend API
   - Fallback: Gmail SMTP
   - Auto-reply system for do-not-reply addresses
   - Test user detection and email suppression

2. **Testing Setup**
   - Playwright for E2E testing
   - 5 logical test groups:
     - Group 1: Connect/Simple tests
     - Group 2: Account creation
     - Group 3: Authentication
     - Group 4: Bracket management
     - Group 5: API tests
   - GitHub Actions workflows for manual execution
   - Support for desktop and mobile testing
   - Support for Chrome, Firefox, and WebKit browsers

3. **Admin Features**
   - Users Admin: Bulk delete with Protect Confirmed toggle
   - Brackets Admin: Bulk delete with Protect Submitted toggle
   - Inline delete confirmations (replaces popup modals)
   - Status indicators via icons

4. **Configuration**
   - Site configuration via Google Sheets
   - Tournament year and other settings pulled from config
   - Environment-specific settings (staging vs production)

### Important Files

- `playwright.config.ts` - Test configuration with browser/device projects
- `src/lib/emailService.ts` - Email sending logic with Resend/Gmail fallback
- `src/lib/testUserDetection.ts` - Test user identification for email suppression
- `src/components/admin/UsersTab.tsx` - Users admin interface
- `src/components/admin/BracketsTab.tsx` - Brackets admin interface
- `.github/workflows/` - GitHub Actions workflows for testing

### Testing Commands

```bash
# Run all tests locally
npm test

# Run specific test group
npm run test:group-1

# Run tests for specific environment
TEST_ENV=staging npm test

# Run mobile tests
npm run test:mobile

# Run with email suppression
SUPPRESS_TEST_EMAILS=true npm test
```

### Database

- PostgreSQL database hosted on Vercel
- Environment-specific databases (staging vs production)
- Connection via `POSTGRES_URL` environment variable

### Deployment

- **Staging**: Automatically deploys from `staging` branch
- **Production**: Automatically deploys from `main` branch
- Both managed via Vercel

## Cursor-Specific Notes

Since Cursor doesn't automatically sync conversation history:

1. **Document important decisions** in this file or `docs/` folder
2. **Use Git commits** with descriptive messages (already done)
3. **Review recent commits** to understand recent changes:
   ```bash
   git log --oneline -20
   ```
4. **Check tags** for major milestones:
   ```bash
   git tag -l
   ```

## Troubleshooting

### Missing Environment Variables
Run `.\scripts\pull-env-all.ps1` to pull all environment variables from Vercel.

### Playwright Tests Failing
1. Ensure browsers are installed: `npx playwright install`
2. Check `.env.test` exists and has `TEST_USER_EMAIL` and passwords
3. Verify `POSTGRES_URL` is set correctly

### Build Errors
1. Clear `.next` folder: `rm -rf .next` (or `rmdir /s .next` on Windows)
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check TypeScript errors: `npm run build`

## Next Steps After Setup

1. Verify environment variables are loaded: Check `.env.test` exists
2. Run a simple test to verify setup: `npm run test:group-1`
3. Start development server: `npm run dev`
4. Review recent changes: `git log --oneline -10`

