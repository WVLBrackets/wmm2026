# Handling Vercel Authentication for Staging Tests

Your staging deployment appears to be protected by Vercel authentication. Here are solutions:

## Option 1: Make Staging Public (Recommended for Testing)

In your Vercel dashboard:
1. Go to your project settings
2. Navigate to "Deployments" 
3. Find your staging deployment
4. Check "Deployment Protection" settings
5. **Disable password protection** for the staging branch/preview deployments

This allows tests to run without authentication.

## Option 2: Use Vercel Preview URL with Auth Token

If you need to keep protection, you can use Vercel's API to get an authenticated preview URL.

1. Get a Vercel API token from: https://vercel.com/account/tokens
2. Set it as an environment variable:
   ```powershell
   $env:VERCEL_TOKEN="your-token-here"
   ```
3. We can update the test to use authenticated preview URLs

## Option 3: Use Production URL for Tests

If staging is always protected, you could:
- Test against production (which should be public)
- Or create a separate "test" branch that's public

## Option 4: Handle Authentication in Tests

If you must keep protection, we can add authentication steps to tests:

```typescript
// Login to Vercel first, then continue
await page.goto('https://vercel.com/login');
// ... handle login ...
// Then navigate to your app
```

## Recommended: Option 1

For automated testing, **Option 1 is best** - make staging preview deployments public. This is common practice for staging environments used for testing.

## Quick Check

To verify if this is the issue, try accessing your staging URL in an incognito/private window. If you see the Vercel login page, that confirms it's protected.

