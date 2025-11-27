# Vercel Environment Variables Setup for Authentication Tests

## Overview

Since we only test against **staging (preview)** and **production** (not localhost), we use **Vercel Environment Variables** to securely store test user passwords.

## Setup in Vercel Dashboard

### Step 1: Add Environment Variables

1. Go to your **Vercel Dashboard**
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Add the following variables:

#### For Staging/Preview Environment:
- **Name**: `TEST_USER_EMAIL`
- **Value**: `thewarren@gmail.com`
- **Environment**: Select **Preview** (and optionally **Development**)

- **Name**: `TEST_USER_PASSWORD_STAGING`
- **Value**: `your-staging-password`
- **Environment**: Select **Preview** (and optionally **Development**)

#### For Production Environment:
- **Name**: `TEST_USER_EMAIL`
- **Value**: `thewarren@gmail.com`
- **Environment**: Select **Production**

- **Name**: `TEST_USER_PASSWORD_PRODUCTION`
- **Value**: `your-production-password`
- **Environment**: Select **Production**

### Step 2: Verify Variables

Make sure:
- ✅ `TEST_USER_EMAIL` is set for both Preview and Production
- ✅ `TEST_USER_PASSWORD_STAGING` is set for Preview
- ✅ `TEST_USER_PASSWORD_PRODUCTION` is set for Production

## Running Tests

### Option 1: CI/CD (Vercel) - Automatic

When tests run in Vercel CI/CD, environment variables are **automatically available**. No additional setup needed.

### Option 2: Local Test Runs - Manual Environment Variables (Easiest)

The simplest way to run tests locally is to set environment variables manually in PowerShell:

#### Quick Setup Script:
1. Edit `tests/SETUP_ENV_VARS.ps1` and add your passwords
2. Run the script:
   ```powershell
   .\tests\SETUP_ENV_VARS.ps1
   ```
3. Run tests:
   ```powershell
   npx playwright test tests/e2e/authentication.spec.ts
   ```

#### Or Set Manually in PowerShell:
```powershell
# For staging tests (default)
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING="your-staging-password"
npx playwright test tests/e2e/authentication.spec.ts

# For production tests
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_PRODUCTION="your-production-password"
$env:TEST_ENV="production"
npx playwright test tests/e2e/authentication.spec.ts
```

**Note:** These variables are only active in the current PowerShell session. Close PowerShell and you'll need to set them again.

### Option 3: Local Test Runs - Pull from Vercel (Alternative)

If you prefer to pull from Vercel (requires Vercel CLI authentication):

#### Install Vercel CLI:
```powershell
npm i -g vercel
```

#### Authenticate and Pull:
```powershell
# This will prompt you to authenticate via browser
vercel env pull .env.test
```

**Note:** The first time you run this, you'll need to authenticate with Vercel in your browser.

#### Run Tests:
```powershell
# Staging (default)
npx playwright test tests/e2e/authentication.spec.ts

# Production (explicit)
$env:TEST_ENV="production"
npx playwright test tests/e2e/authentication.spec.ts
```

If you prefer not to use Vercel CLI, you can set environment variables manually in PowerShell:

```powershell
# For staging tests
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING="your-staging-password"
npx playwright test tests/e2e/authentication.spec.ts

# For production tests
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_PRODUCTION="your-production-password"
$env:TEST_ENV="production"
npx playwright test tests/e2e/authentication.spec.ts
```

## Environment Detection

The tests automatically detect which environment they're running against:

- **Staging (Default)**: No `TEST_ENV` set, or `TEST_ENV=staging`
  - Uses `TEST_USER_PASSWORD_STAGING`
  - Tests against preview/staging URL

- **Production (Opt-in)**: `TEST_ENV=production` must be explicitly set
  - Uses `TEST_USER_PASSWORD_PRODUCTION`
  - Tests against production URL

## Security Notes

✅ **Best Practices:**
- ✅ Store passwords in Vercel Environment Variables (encrypted)
- ✅ Use different passwords for staging and production
- ✅ Never commit passwords to version control
- ✅ Limit access to production passwords

❌ **Don't:**
- ❌ Commit `.env.test` to version control (it's gitignored)
- ❌ Share passwords in chat or email
- ❌ Use production passwords for staging

## Quick Reference

| Variable | Required | Environment | Description |
|----------|----------|-------------|-------------|
| `TEST_USER_EMAIL` | ✅ Yes | Preview + Production | Test user email |
| `TEST_USER_PASSWORD_STAGING` | ✅ Yes | Preview | Staging password |
| `TEST_USER_PASSWORD_PRODUCTION` | ✅ Yes | Production | Production password |
| `TEST_USER_NAME` | No | Any | Display name (optional) |
| `TEST_ENV` | No | Local only | Set to "production" for prod tests |

## Troubleshooting

### Error: "TEST_USER_EMAIL environment variable is required"

**Solution:** Make sure environment variables are set in Vercel or pulled locally.

### Tests use wrong password

**Solution:** 
- Check which environment you're testing (staging vs production)
- Verify the correct password variable is set in Vercel
- If running locally, ensure variables are pulled or set manually

### Vercel CLI not working

**Solution:**
- Make sure you're logged in: `vercel login`
- Make sure you're in the project directory
- Try pulling again: `vercel env pull .env.test`

## Summary

1. **Set variables in Vercel Dashboard** (Settings → Environment Variables)
2. **For CI/CD**: Variables are automatically available
3. **For local runs**: Use `vercel env pull .env.test` or set manually
4. **Default**: Staging (safe)
5. **Production**: Only when `TEST_ENV=production` is set

