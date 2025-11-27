# Debugging Sign-In Test Failures

## Step 1: Verify Environment Variables Are Set

First, make sure your environment variables are set in PowerShell:

```powershell
# Check if variables are set
$env:TEST_USER_EMAIL
$env:TEST_USER_PASSWORD_STAGING
```

If they're not set, set them:
```powershell
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING="your-staging-password"
```

Or run the setup script:
```powershell
.\tests\SETUP_ENV_VARS.ps1
```

## Step 2: Run Test in Headed Mode to See What's Happening

Run a single test in headed mode (visible browser) to see what's actually happening:

```powershell
$env:TEST_USER_EMAIL="thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING="your-staging-password"
npx playwright test tests/e2e/authentication.spec.ts -g "should sign in with valid credentials" --project=chromium --headed
```

Watch the browser to see:
- Does the sign-in form fill correctly?
- Does it submit?
- Does it show an error message?
- Does it redirect?
- Where does it go?

## Step 3: Check the Trace Files

Playwright generates trace files for failed tests. View them:

```powershell
npx playwright show-trace test-results\e2e-authentication-Authent-cb3c3-n-in-with-valid-credentials-chromium-retry1\trace.zip
```

This will show you:
- What the page looked like at each step
- Network requests
- Console logs
- DOM snapshots

## Step 4: Test Sign-In Manually

Try signing in manually in a browser to verify:
1. Go to your staging URL: `https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app/auth/signin`
2. Sign in with `thewarren@gmail.com` and your staging password
3. Does it work? Where does it redirect?

## Step 5: Check for Common Issues

### Issue: Wrong Password
- Verify the password is correct for staging
- Try signing in manually first

### Issue: Email Not Confirmed
- Check if the user's email is confirmed in the database
- The error message should say "email not confirmed"

### Issue: Slow Network/Timeout
- The test waits 15 seconds for redirect
- If staging is slow, we might need to increase timeout

### Issue: Different Redirect Behavior
- Maybe it redirects somewhere other than `/bracket`?
- Check the trace to see where it actually goes

## Step 6: Add Debug Logging

If needed, we can add console.log statements to the sign-in helper to see what's happening at each step.




