# Authentication Test Setup Guide

## Overview

The authentication tests **require** a pre-confirmed test user to avoid manual email confirmation steps. 

**🔒 SECURE SETUP:** Passwords are stored in **Vercel Environment Variables** (encrypted, secure).

**See `tests/VERCEL_ENV_SETUP.md` for the complete setup guide.**

## Quick Start

### Step 1: Set Environment Variables in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add the following:

   **For Preview/Staging:**
   - `TEST_USER_EMAIL` = `thewarren@gmail.com` (Environment: **Preview**)
   - `TEST_USER_PASSWORD_STAGING` = `your-staging-password` (Environment: **Preview**)

   **For Production:**
   - `TEST_USER_EMAIL` = `thewarren@gmail.com` (Environment: **Production**)
   - `TEST_USER_PASSWORD_PRODUCTION` = `your-production-password` (Environment: **Production**)

### Step 2: Run Tests

**In Vercel CI/CD:** Variables are automatically available - just run tests.

**For local runs (testing against staging/prod):**

**Option A - Use Setup Script (Easiest):**
```powershell
# 1. Edit tests/SETUP_ENV_VARS.ps1 and add your passwords
# 2. Run the script
.\tests\SETUP_ENV_VARS.ps1

# 3. Run tests (staging by default)
npx playwright test tests/e2e/authentication.spec.ts

# Or run against production
$env:TEST_ENV="production"
npx playwright test tests/e2e/authentication.spec.ts
```

**Option B - Set manually in PowerShell:**
```powershell
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING="your-staging-password"
npx playwright test tests/e2e/authentication.spec.ts
```

**Option C - Pull from Vercel (requires authentication):**
```powershell
# Install Vercel CLI if needed
npm i -g vercel

# Pull environment variables (will prompt for authentication)
vercel env pull .env.test

# Run tests
npx playwright test tests/e2e/authentication.spec.ts
```

## Required Environment Variables

The authentication tests use the following environment variables:

### Required:
- `TEST_USER_EMAIL` - Email address of the confirmed test user
- `TEST_USER_PASSWORD_STAGING` - Password for staging environment (default)
- `TEST_USER_PASSWORD_PRODUCTION` - Password for production environment (only when `TEST_ENV=production`)

### Optional:
- `TEST_USER_NAME` - Display name (defaults to "Test User")

## Setup Instructions (Alternative: Manual Environment Variables)

If you prefer not to use `.env.test`, you can set environment variables manually:

Open PowerShell and set the following variables:

#### For Staging Tests (Default):
```powershell
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING="your-staging-password-here"
```

#### For Production Tests:
```powershell
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_PRODUCTION="your-production-password-here"
$env:TEST_ENV="production"
```

#### For Both Environments:
```powershell
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING="your-staging-password-here"
$env:TEST_USER_PASSWORD_PRODUCTION="your-production-password-here"
```

### Step 2: Verify the Test User Exists and is Confirmed

Before running tests, ensure:
1. ✅ The user `thewarren@gmail.com` exists in your staging/production database
2. ✅ The user's email is confirmed (can sign in successfully)
3. ✅ You know the correct password for each environment

### Step 3: Run the Authentication Tests

#### Run against Staging (Default):
```powershell
# Set staging password
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING="your-staging-password"

# Run tests
npx playwright test tests/e2e/authentication.spec.ts
```

#### Run against Production:
```powershell
# Set production password and environment
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_PRODUCTION="your-production-password"
$env:TEST_ENV="production"

# Run tests
npx playwright test tests/e2e/authentication.spec.ts
```

## Environment Detection

The tests automatically detect which environment they're running against:

1. **Production**: If `TEST_ENV=production` or `TEST_ENV=prod` is set
2. **Staging**: Default (if not explicitly set to production)

The tests will use:
- `TEST_USER_PASSWORD_STAGING` for staging
- `TEST_USER_PASSWORD_PRODUCTION` for production

If you only set `TEST_USER_PASSWORD` (without `_STAGING` or `_PRODUCTION`), it will be used for both environments.

## Example: Complete Setup for Staging

```powershell
# Set environment variables
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING="your-actual-staging-password"

# Run tests
npx playwright test tests/e2e/authentication.spec.ts
```

## Example: Complete Setup for Production

```powershell
# Set environment variables
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_PRODUCTION="your-actual-production-password"
$env:TEST_ENV="production"

# Run tests
npx playwright test tests/e2e/authentication.spec.ts
```

## Troubleshooting

### Error: "TEST_USER_EMAIL environment variable is required"
**Solution:** Set the `TEST_USER_EMAIL` environment variable before running tests.

### Error: "TEST_USER_PASSWORD_STAGING or TEST_USER_PASSWORD environment variable is required"
**Solution:** Set either `TEST_USER_PASSWORD_STAGING` or `TEST_USER_PASSWORD` before running tests.

### Error: "Sign-in failed - still on sign-in page"
**Possible causes:**
1. Wrong password - Double-check the password for the environment you're testing
2. User not confirmed - Verify the user can sign in manually in a browser
3. User doesn't exist - Verify the user exists in the database

### Tests work in staging but fail in production
**Solution:** Make sure you've set `TEST_USER_PASSWORD_PRODUCTION` with the correct production password.

## Security Notes

⚠️ **Important Security Considerations:**

1. **✅ Use `.env.test` file for local development** - It's gitignored and never committed
2. **✅ Use Vercel Environment Variables for CI/CD** - Encrypted and secure
3. **✅ Never commit passwords to version control** - `.env.test` is already gitignored
4. **✅ Use different passwords for staging and production** - Security best practice
5. **✅ Limit access to production passwords** - Only share with team members who need them

## Recommended Setup

**For Local Development:**
- ✅ Use `.env.test` file (automatic, secure, convenient)
- ✅ No need to set variables each time
- ✅ Defaults to staging (safe)

**For CI/CD (Vercel):**
- ✅ Use Vercel Environment Variables
- ✅ Set in Vercel dashboard (Settings > Environment Variables)
- ✅ Different values for Preview (staging) and Production environments

**See `tests/SECURE_PASSWORD_SETUP.md` for complete security setup guide.**

## Quick Reference

| Environment Variable | Required | Description |
|---------------------|----------|-------------|
| `TEST_USER_EMAIL` | ✅ Yes | Email of confirmed test user |
| `TEST_USER_PASSWORD_STAGING` | ✅ Yes* | Password for staging |
| `TEST_USER_PASSWORD_PRODUCTION` | ✅ Yes* | Password for production |
| `TEST_USER_NAME` | No | Display name (optional) |
| `TEST_ENV` | No | Set to "production" for prod tests |

*At least one password variable is required. Use `TEST_USER_PASSWORD` for both, or separate variables for different passwords.
