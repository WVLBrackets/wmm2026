# Troubleshooting GitHub Actions Workflow Failures

## Step 1: Check the Workflow Logs

1. Go to GitHub → **Actions** tab
2. Click on the failed workflow run (e.g., "Smoke Tests #1")
3. Click on the job name (e.g., "Smoke Test Suite")
4. Expand each step to see the error

**Look for:**
- ❌ Red X marks indicating which step failed
- Error messages in the logs
- Missing environment variables
- Test failures

## Common Issues

### Issue 1: Missing Environment Variables

**Symptoms:**
- Error: `TEST_USER_EMAIL environment variable is required`
- Tests fail with "credentials not set"

**Solution:**
- Verify all secrets are set in GitHub → Settings → Secrets and variables → Actions
- Required secrets:
  - `TEST_USER_EMAIL`
  - `TEST_USER_PASSWORD_STAGING`
  - `TEST_USER_PASSWORD_PRODUCTION`

### Issue 2: Base URL Not Set

**Symptoms:**
- Tests fail to connect
- Error: `net::ERR_NAME_NOT_RESOLVED`
- Tests timeout trying to reach the application

**Solution:**
- Check `playwright.config.ts` - it should determine base URL from:
  - `PLAYWRIGHT_TEST_BASE_URL` environment variable
  - `TEST_ENV` (production/staging)
  - Default staging URL

### Issue 3: Test Files Not Found

**Symptoms:**
- Error: `Error: Cannot find module 'tests/e2e/authentication.spec.ts'`
- Tests don't run at all

**Solution:**
- Verify test files exist in the repository
- Check that files are committed to the branch being tested

### Issue 4: Authentication Failures

**Symptoms:**
- Tests fail with "Sign-in failed"
- "Invalid credentials" errors
- Tests timeout on sign-in

**Solution:**
- Verify test user credentials are correct
- Check that test user exists in the target environment (staging/production)
- Verify test user email is confirmed

### Issue 5: Playwright Browsers Not Installed

**Symptoms:**
- Error: `Executable doesn't exist`
- Browser installation fails

**Solution:**
- The workflow should run `npx playwright install --with-deps chromium`
- Check if this step completed successfully

## Step-by-Step Debugging

### 1. Check Which Step Failed

Look at the workflow run and identify the failed step:
- ✅ Checkout code
- ✅ Setup Node.js
- ✅ Install dependencies
- ✅ Install Playwright browsers
- ✅ Determine test environment
- ❌ **Run smoke tests** ← Most likely failure point
- ⏭️ Upload test results (only runs if tests complete)

### 2. Check Test Logs

In the "Run smoke tests" step, look for:
- Which tests ran
- Which tests failed
- Error messages
- Stack traces

### 3. Check Environment Variables

The workflow sets these environment variables:
- `TEST_USER_EMAIL` (from secret)
- `TEST_USER_PASSWORD_STAGING` (from secret)
- `TEST_USER_PASSWORD_PRODUCTION` (from secret)
- `TEST_ENV` (set by "Determine test environment" step)

Verify they're all set correctly.

### 4. Check Base URL

The `playwright.config.ts` determines the base URL from:
1. `PLAYWRIGHT_TEST_BASE_URL` (if set)
2. `TEST_ENV=production` → production URL
3. Default → staging URL

Make sure the correct URL is being used.

## Quick Fixes

### Fix 1: Add Missing Base URL

If tests can't connect, add `PLAYWRIGHT_TEST_BASE_URL` to the workflow:

```yaml
- name: Run smoke tests
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD_STAGING: ${{ secrets.TEST_USER_PASSWORD_STAGING }}
    TEST_USER_PASSWORD_PRODUCTION: ${{ secrets.TEST_USER_PASSWORD_PRODUCTION }}
    PLAYWRIGHT_TEST_BASE_URL: ${{ secrets.STAGING_URL }}  # Add this
  run: npm run test:smoke
```

### Fix 2: Verify Secrets Are Set

Run this to check secrets (in GitHub Actions, not locally):

```yaml
- name: Verify secrets (debug)
  run: |
    echo "Email set: $([ -n "$TEST_USER_EMAIL" ] && echo 'yes' || echo 'no')"
    echo "Staging password set: $([ -n "$TEST_USER_PASSWORD_STAGING" ] && echo 'yes' || echo 'no')"
    echo "Production password set: $([ -n "$TEST_USER_PASSWORD_PRODUCTION" ] && echo 'yes' || echo 'no')"
    echo "Test env: $TEST_ENV"
```

### Fix 3: Test Locally First

Before troubleshooting in GitHub Actions, test locally:

```powershell
# Set environment variables
$env:TEST_USER_EMAIL = "thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING = "your-password"
$env:TEST_ENV = "staging"

# Run the same command as the workflow
npm run test:smoke
```

If it works locally but fails in GitHub Actions, it's likely an environment variable or configuration issue.

## Getting Help

When asking for help, provide:
1. **Which step failed** (screenshot or description)
2. **Error message** (copy from logs)
3. **Which tests failed** (if tests ran)
4. **Workflow run URL** (share the GitHub Actions run link)

## Next Steps

1. ✅ Check the workflow logs (Step 1 above)
2. ✅ Identify which step failed
3. ✅ Look for error messages
4. ✅ Try the quick fixes above
5. ✅ Test locally to reproduce the issue


