# Quick Checklist: Check Workflow Errors

## Step 1: Open the Failed Workflow Run

1. Go to GitHub → **Actions** tab
2. Click on one of the failed "Smoke Tests" runs
3. Click on **"Smoke Test Suite"** (the job name)

## Step 2: Identify Which Step Failed

Look for the red ❌ mark. Common failure points:

- **"Install dependencies"** - npm install failed
- **"Install Playwright browsers"** - Browser installation failed  
- **"Run smoke tests"** - Tests failed (most common)
- **"Upload test results"** - Only runs if tests complete

## Step 3: Check the Error Message

Click on the failed step to expand it. Look for:

### Common Error Messages:

**"TEST_USER_EMAIL environment variable is required"**
- → Missing GitHub Secret: `TEST_USER_EMAIL`

**"Sign-in failed" or "Invalid credentials"**
- → Wrong password in secrets
- → Test user doesn't exist in target environment

**"net::ERR_NAME_NOT_RESOLVED" or connection errors**
- → Base URL is wrong or unreachable
- → Check `playwright.config.ts` base URL logic

**"Cannot find module" or "File not found"**
- → Test files not committed to the branch

**"Executable doesn't exist" (browser errors)**
- → Playwright browser installation failed

## Step 4: Share the Error

Copy the error message from the failed step and share it. The most important information is:

1. **Which step failed** (e.g., "Run smoke tests")
2. **The error message** (copy the red error text)
3. **Any test names that failed** (if tests ran)

## Quick Test: Run Locally

To verify the tests work, run them locally with the same environment:

```powershell
# Set the same environment variables as GitHub Actions
$env:TEST_USER_EMAIL = "thewarren@gmail.com"
$env:TEST_USER_PASSWORD_STAGING = "7S^Eh1*26E2$3Ao5"
$env:TEST_ENV = "staging"

# Run the same command as the workflow
npm run test:smoke
```

If this works locally but fails in GitHub Actions, it's likely:
- Missing secrets in GitHub
- Environment variable not being passed correctly
- Base URL issue


