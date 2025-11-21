# Start Here: Testing Against Staging/Production

This test suite is designed to test against **staging** and **production** environments, not local dev.

## Step 1: Configure Your URLs

First, update `playwright.config.ts` with your actual URLs:

1. Open `playwright.config.ts`
2. Find the `getBaseURL()` function
3. Replace the placeholder URLs with your actual staging and production URLs:
   - `STAGING_URL` - Your staging environment URL
   - `PRODUCTION_URL` - Your production environment URL

Or set them as environment variables:
```powershell
$env:STAGING_URL="https://your-staging-url.vercel.app"
$env:PRODUCTION_URL="https://your-production-url.vercel.app"
```

## Step 2: Configure Your URLs

You have two options:

### Option A: Set Environment Variables (Recommended)

In PowerShell, set your URLs:

```powershell
$env:STAGING_URL="https://your-staging-url.vercel.app"
$env:PRODUCTION_URL="https://your-production-url.vercel.app"
```

Or edit `playwright.config.ts` directly and replace the placeholder URLs.

### Option B: Use Custom URL for One Test

```powershell
$env:PLAYWRIGHT_TEST_BASE_URL="https://your-staging-url.vercel.app"
npm run test:simple
```

## Step 3: Run a Simple Test Against Staging

**In PowerShell**, set the environment and run:

```powershell
$env:TEST_ENV="staging"
npm run test:simple
```

Or if you set `PLAYWRIGHT_TEST_BASE_URL`:

```powershell
$env:PLAYWRIGHT_TEST_BASE_URL="https://your-staging-url.vercel.app"
npm run test:simple
```

## Step 3: Check the Result

You should see:
```
✓ 1 passed
Testing against: https://your-staging-url.vercel.app
```

## Step 4: Run Against Production

Once staging works, test production:

```powershell
$env:TEST_ENV="production"
npm run test:simple
```

Or with explicit URL:

```powershell
$env:PLAYWRIGHT_TEST_BASE_URL="https://your-production-url.vercel.app"
npm run test:simple
```

## Available Commands (PowerShell)

**Note:** In PowerShell, you need to set environment variables first, then run the test command.

### For Staging:
```powershell
$env:TEST_ENV="staging"
npm test                    # All tests
npm run test:simple         # Just simple test
npm run test:ui            # Interactive UI
```

### For Production:
```powershell
$env:TEST_ENV="production"
npm test                    # All tests
npm run test:simple         # Just simple test
npm run test:ui            # Interactive UI
```

### Custom URL (Any Environment):
```powershell
$env:PLAYWRIGHT_TEST_BASE_URL="https://custom-url.com"
npm test
```

## What's Next?

Once the simple test works:
1. ✅ Verify staging works
2. ✅ Verify production works  
3. ✅ Then we'll add more tests gradually

Let's start with Step 1 - configure your URLs! 🎯
