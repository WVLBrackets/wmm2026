# Test Environment Configuration

## Default Behavior: Staging Only

**By default, all tests run against STAGING.** This is the safest configuration to prevent accidental testing against production.

## How to Ensure You're Testing Staging

### Option 1: No Configuration Needed (Recommended)
**Just run the tests!** They default to staging:
```powershell
npm run test:simple
npm run test:e2e
npm run test:api
npm test
```

### Option 2: Explicitly Set Staging (Optional)
If you want to be extra explicit:
```powershell
$env:TEST_ENV="staging"
npm test
```

Or set the staging URL directly:
```powershell
$env:STAGING_URL="https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app"
npm test
```

## How to Test Production (When Ready)

**⚠️ WARNING: Only test production when explicitly needed!**

To test against production, you must explicitly set the environment:
```powershell
$env:TEST_ENV="production"
npm test
```

Or set the production URL directly:
```powershell
$env:PRODUCTION_URL="https://warrensmm.com"
$env:TEST_ENV="production"
npm test
```

## Custom URL (Any Environment)

If you need to test against a custom URL:
```powershell
$env:PLAYWRIGHT_TEST_BASE_URL="https://your-custom-url.com"
npm test
```

## Verifying Which Environment You're Testing

The test output will show which URL is being tested. Look for console logs like:
```
Testing against: https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app
```

Or check the test report for the actual URLs being accessed.

## Current Default URLs

- **Staging (Default)**: `https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app`
- **Production**: `https://warrensmm.com` (only used when `TEST_ENV=production`)

## Summary

✅ **Safe Default**: Tests default to staging  
✅ **No Setup Required**: Just run `npm test`  
⚠️ **Production Testing**: Requires explicit `TEST_ENV=production`  
🔒 **Protection**: Production testing is opt-in, not automatic

