# GitHub Actions - Test Groups

## Overview

GitHub Actions workflows are available for each of the 5 test groups, allowing you to run tests by group number or abbreviation directly from GitHub.

## Available Workflows

| Group | Workflow Name | Files | Tests |
|-------|---------------|-------|-------|
| **1 - Connect** | `Test Group 1 - Connect` | `tests/simple-test.spec.ts` | ~5 tests |
| **2 - Account** | `Test Group 2 - Account` | `tests/e2e/account-*.spec.ts` | ~21 tests |
| **3 - Auth** | `Test Group 3 - Auth` | `tests/e2e/authentication.spec.ts` | ~14 tests |
| **4 - Bracket** | `Test Group 4 - Bracket` | `tests/e2e/bracket-creation.spec.ts` | ~3 tests |
| **5 - API** | `Test Group 5 - API` | `tests/api` | ~9 tests |

## How to Run

### Step 1: Go to GitHub Actions

1. Navigate to your repository: `https://github.com/WVLBrackets/wmm2026`
2. Click the **"Actions"** tab
3. In the left sidebar, you'll see all 5 group workflows:
   - `Test Group 1 - Connect`
   - `Test Group 2 - Account`
   - `Test Group 3 - Auth`
   - `Test Group 4 - Bracket`
   - `Test Group 5 - API`

### Step 2: Select a Workflow

Click on the workflow you want to run (e.g., `Test Group 1 - Connect`)

### Step 3: Run the Workflow

1. Click **"Run workflow"** button (top right)
2. Select options:
   - **Environment:** Choose `staging` or `production`
   - **Browser:** Choose `all`, `chromium`, or `firefox`
3. Click **"Run workflow"**

## Workflow Options

### Environment Selection
- **staging** (default) - Tests against staging environment
- **production** - Tests against production environment

### Browser Selection
- **all** (default) - Runs tests on both Chromium and Firefox
- **chromium** - Runs tests on Chromium only
- **firefox** - Runs tests on Firefox only

## Example: Running Group 1 (Connect) on Staging

1. Go to Actions → `Test Group 1 - Connect`
2. Click "Run workflow"
3. Select:
   - Environment: `staging`
   - Browser: `all`
4. Click "Run workflow"

## What Each Group Tests

### Group 1 - Connect
- Homepage loads
- Signup page loads
- Signin page loads
- Navigation between pages
- Basic connectivity

### Group 2 - Account
- Account creation form
- Form validation
- Password requirements
- Duplicate email handling
- Email confirmation flow

### Group 3 - Auth
- Sign in with valid credentials
- Sign in error handling
- Session persistence
- Protected route access
- Sign out functionality

### Group 4 - Bracket
- Navigate to bracket page
- Create new bracket
- Save bracket
- Bracket management

### Group 5 - API
- API endpoint validation
- Backend validation rules
- Error handling
- Direct HTTP testing (no browser)

## Workflow Files

The workflows are located in:
- `.github/workflows/test-group-1-connect.yml`
- `.github/workflows/test-group-2-account.yml`
- `.github/workflows/test-group-3-auth.yml`
- `.github/workflows/test-group-4-bracket.yml`
- `.github/workflows/test-group-5-api.yml`

## Technical Details

Each workflow:
- Uses `node scripts/run-test-by-id.js <group-number>` to execute tests
- Supports environment selection (staging/production)
- Supports browser selection (all/chromium/firefox)
- Uploads test reports as artifacts
- Uploads test traces on failure
- Uses GitHub Secrets for test credentials

## Required GitHub Secrets

All workflows require these secrets:
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD_STAGING`
- `TEST_USER_PASSWORD_PRODUCTION`

See `tests/AUTOMATED_TESTING_SETUP.md` for setup instructions.

