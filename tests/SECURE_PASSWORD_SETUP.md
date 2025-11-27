# Secure Password Setup for Authentication Tests

## Overview

Since we only test against **staging (preview)** and **production** (not localhost), we use **Vercel Environment Variables** to securely store test user passwords.

**Primary Method**: Vercel Environment Variables (for CI/CD and local runs)

**See `tests/VERCEL_ENV_SETUP.md` for the complete setup guide.**

## Option 1: Local Development - .env.test File (Recommended)

### Step 1: Create .env.test File

1. Copy the example file:
   ```powershell
   copy .env.test.example .env.test
   ```

2. Edit `.env.test` and add your actual passwords:
   ```env
   TEST_USER_EMAIL=thewarren@gmail.com
   TEST_USER_PASSWORD_STAGING=your-actual-staging-password
   TEST_USER_PASSWORD_PRODUCTION=your-actual-production-password
   TEST_USER_NAME=Test User
   ```

### Step 2: Verify .env.test is Gitignored

The `.env.test` file is already gitignored (via `.env*` pattern in `.gitignore`), so it will never be committed to version control.

### Step 3: Run Tests

The tests will automatically load variables from `.env.test`:

```powershell
# Run against staging (default)
npx playwright test tests/e2e/authentication.spec.ts

# Run against production (requires TEST_ENV=production)
$env:TEST_ENV="production"
npx playwright test tests/e2e/authentication.spec.ts
```

**✅ Benefits:**
- Passwords stored locally, never committed
- No need to enter passwords each time
- Works automatically when you run tests
- Defaults to staging (safe)

## Option 2: Vercel Environment Variables (For CI/CD)

If you're running tests in CI/CD (like Vercel), use Vercel Environment Variables:

### Step 1: Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add the following variables:

   **For Staging:**
   - `TEST_USER_EMAIL` = `thewarren@gmail.com`
   - `TEST_USER_PASSWORD_STAGING` = `your-staging-password`
   - Environment: **Preview** (or **Development**)

   **For Production:**
   - `TEST_USER_EMAIL` = `thewarren@gmail.com`
   - `TEST_USER_PASSWORD_PRODUCTION` = `your-production-password`
   - Environment: **Production**

### Step 2: Configure Test Environment

In your Vercel project settings or CI/CD configuration, ensure:
- Staging tests run by default (no `TEST_ENV` set)
- Production tests only run when `TEST_ENV=production` is explicitly set

**✅ Benefits:**
- Secure storage in Vercel (encrypted)
- No passwords in code or local files
- Works automatically in CI/CD pipelines
- Different passwords for staging and production

## Security Best Practices

### ✅ DO:
- ✅ Use `.env.test` for local development (gitignored)
- ✅ Use Vercel Environment Variables for CI/CD
- ✅ Use different passwords for staging and production
- ✅ Never commit `.env.test` to version control
- ✅ Share passwords only with team members who need them

### ❌ DON'T:
- ❌ Commit passwords to version control
- ❌ Hardcode passwords in test files
- ❌ Share passwords in chat or email (use secure channels)
- ❌ Use production passwords for staging

## How It Works

### Environment Detection

The tests automatically detect which environment they're running against:

1. **Staging (Default)**: 
   - No `TEST_ENV` set, or `TEST_ENV=staging`
   - Uses `TEST_USER_PASSWORD_STAGING`

2. **Production (Opt-in)**:
   - `TEST_ENV=production` or `TEST_ENV=prod` must be set
   - Uses `TEST_USER_PASSWORD_PRODUCTION`

### Password Loading Priority

1. **Environment variables** (set in PowerShell/terminal) - highest priority
2. **`.env.test` file** (loaded automatically by Playwright config)
3. **Vercel Environment Variables** (for CI/CD)

## Quick Start Guide

### For Local Development:

1. **Create `.env.test` file:**
   ```powershell
   copy .env.test.example .env.test
   ```

2. **Edit `.env.test` with your passwords**

3. **Run tests:**
   ```powershell
   # Staging (default)
   npx playwright test tests/e2e/authentication.spec.ts
   
   # Production (explicit)
   $env:TEST_ENV="production"
   npx playwright test tests/e2e/authentication.spec.ts
   ```

### For CI/CD (Vercel):

1. **Add environment variables in Vercel dashboard**
2. **Tests will automatically use them** (no `.env.test` needed)

## Troubleshooting

### Error: "TEST_USER_EMAIL environment variable is required"

**Solution:** Make sure you've created `.env.test` file or set environment variables.

### Tests use wrong password

**Solution:** 
- Check which environment you're testing against
- Verify the correct password variable is set (`TEST_USER_PASSWORD_STAGING` vs `TEST_USER_PASSWORD_PRODUCTION`)

### .env.test file not loading

**Solution:**
- Verify the file is named exactly `.env.test` (not `.env.test.txt`)
- Check that the file is in the project root (same directory as `playwright.config.ts`)
- Try setting variables directly in PowerShell to test

## File Structure

```
wmm2026/
├── .env.test              # Your local passwords (gitignored)
├── .env.test.example      # Template (committed to git)
├── playwright.config.ts    # Loads .env.test automatically
└── tests/
    └── e2e/
        └── authentication.spec.ts
```

## Summary

- **Local**: Use `.env.test` file (gitignored, secure, convenient)
- **CI/CD**: Use Vercel Environment Variables (encrypted, automatic)
- **Default**: Staging (safe)
- **Production**: Only when `TEST_ENV=production` is set (explicit opt-in)

