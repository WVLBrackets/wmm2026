# Automated Testing Setup Guide

## Overview

This guide explains how to set up automated testing with three different test suites and alerting.

## Test Suites

### 1. Full Regression Test
**When:** Major builds (production deployments, version releases)  
**What:** All tests across all browsers (~85+ tests)  
**Command:** `npm run test:regression` or `npm test`  
**Duration:** ~5-10 minutes  
**Trigger:** 
- Production deployments (main/master branch)
- Version tags (v1.0.0, etc.)
- Manual trigger via GitHub Actions

### 2. Smoke Test
**When:** Every deployment (preview and production)  
**What:** Critical path tests only (~20 tests)  
**Command:** `npm run test:smoke`  
**Duration:** ~2-3 minutes  
**Trigger:**
- Every push to any branch
- Pull requests
- Manual trigger via GitHub Actions

**Current smoke tests:**
- Authentication tests (sign in, session, etc.)
- Bracket creation tests (create, save, etc.)

### 3. Health Check Test
**When:** Scheduled (every 6 hours)  
**What:** Basic health checks (~5 tests)  
**Command:** `npm run test:health`  
**Duration:** ~1-2 minutes  
**Trigger:**
- Scheduled (every 6 hours)
- Manual trigger via GitHub Actions
- After production deployments

**Current health tests:**
- Homepage loads
- Sign in works
- Basic connectivity

## Setup Instructions

### Step 1: Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add the following secrets:

#### Required Secrets:
- `TEST_USER_EMAIL` - Test user email (e.g., `thewarren@gmail.com`)
- `TEST_USER_PASSWORD_STAGING` - Password for staging environment
- `TEST_USER_PASSWORD_PRODUCTION` - Password for production environment

#### Optional (for alerts):
- `SLACK_WEBHOOK_URL` - Slack webhook URL for notifications
- `EMAIL_USERNAME` - Email address for sending alerts (Gmail)
- `EMAIL_PASSWORD` - Gmail app password (not your regular password)
- `ALERT_EMAIL` - Email address to receive alerts

### Step 2: Verify Workflows Are Created

The following GitHub Actions workflows are already created:
- `.github/workflows/test-full-regression.yml`
- `.github/workflows/test-smoke.yml`
- `.github/workflows/test-health.yml`

### Step 3: Test the Workflows

1. **Manual Trigger:**
   - Go to GitHub → **Actions** tab
   - Select a workflow (e.g., "Smoke Tests")
   - Click **Run workflow** → **Run workflow**

2. **Automatic Trigger:**
   - Push to any branch → Smoke tests run automatically
   - Push to main → Full regression + Smoke tests run
   - Wait 6 hours → Health check runs automatically

## Alerting Configuration

### Option 1: Email Alerts (Recommended for Start)

**Setup:**
1. Create a Gmail account for alerts (or use existing)
2. Enable 2-factor authentication
3. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Create app password for "Mail"
4. Add to GitHub Secrets:
   - `EMAIL_USERNAME` = your Gmail address
   - `EMAIL_PASSWORD` = the app password (not your regular password)
   - `ALERT_EMAIL` = where to send alerts

**Result:** You'll receive emails when tests fail.

### Option 2: Slack Alerts

**Setup:**
1. Create a Slack webhook:
   - Go to https://api.slack.com/apps
   - Create new app → Incoming Webhooks
   - Add webhook to your Slack workspace
   - Copy webhook URL
2. Add to GitHub Secrets:
   - `SLACK_WEBHOOK_URL` = your Slack webhook URL

**Result:** You'll receive Slack messages when tests fail.

### Option 3: GitHub Notifications

**Setup:**
- Configure GitHub notifications in your account settings
- Enable email notifications for workflow failures

**Result:** You'll receive GitHub notifications when tests fail.

## How It Works

### Full Regression (Major Builds)

**Triggered by:**
- Push to `main` or `master` branch
- Version tags (e.g., `v1.0.0`)
- Manual trigger

**Runs:**
- All tests (~85+ tests)
- All browsers (Chromium, Firefox)
- ~5-10 minutes

**Alerts:**
- Email on failure
- Slack notification on failure
- GitHub notification

### Smoke Tests (Every Deployment)

**Triggered by:**
- Every push to any branch
- Pull requests
- Manual trigger

**Runs:**
- Critical tests only (~20 tests)
- Chromium only (faster)
- ~2-3 minutes

**Alerts:**
- Email on failure
- Slack notification on failure

### Health Checks (Scheduled)

**Triggered by:**
- Scheduled (every 6 hours)
- Manual trigger
- After production deployments

**Runs:**
- Basic health tests (~5 tests)
- Chromium only
- ~1-2 minutes

**Alerts:**
- Email on failure
- Slack notification on failure

## Customizing Test Suites

### Add Tests to Smoke Suite

Edit `package.json`:
```json
"test:smoke": "playwright test tests/e2e/authentication.spec.ts tests/e2e/bracket-creation.spec.ts tests/e2e/your-new-test.spec.ts"
```

### Add Tests to Health Suite

Edit `package.json`:
```json
"test:health": "playwright test tests/simple-test.spec.ts tests/e2e/authentication.spec.ts -g \"should sign in with valid credentials\" tests/your-health-test.spec.ts"
```

### Change Schedule

Edit `.github/workflows/test-health.yml`:
```yaml
schedule:
  - cron: '0 */6 * * *'  # Every 6 hours
  # Or:
  - cron: '0 0 * * *'    # Daily at midnight
  - cron: '0 */1 * * *'  # Every hour
```

## Viewing Test Results

### In GitHub Actions

1. Go to GitHub → **Actions** tab
2. Click on a workflow run
3. View test results and logs
4. Download artifacts (HTML reports, traces)

### HTML Reports

After tests run, download the artifact:
1. Go to workflow run
2. Scroll to **Artifacts** section
3. Download `playwright-report` or `smoke-test-report`
4. Extract and open `index.html` in browser

### Local Viewing

```powershell
# View last test report
npx playwright show-report
```

## Troubleshooting

### Tests Not Running

**Check:**
1. Workflows are in `.github/workflows/` directory
2. GitHub Actions are enabled for your repository
3. Secrets are configured correctly

### Tests Failing in CI but Passing Locally

**Common causes:**
1. Environment variables not set in GitHub Secrets
2. Different test environment (staging vs production)
3. Network/timeout issues in CI

**Solution:**
- Verify secrets are set correctly
- Check workflow logs for specific errors
- Test locally with same environment variables

### Alerts Not Working

**Email:**
- Verify Gmail app password is correct
- Check spam folder
- Verify `ALERT_EMAIL` secret is set

**Slack:**
- Verify webhook URL is correct
- Test webhook manually
- Check Slack app permissions

## Summary

✅ **Full Regression:** Major builds, all tests, ~5-10 min  
✅ **Smoke Tests:** Every deployment, critical tests, ~2-3 min  
✅ **Health Checks:** Scheduled (6 hours), basic tests, ~1-2 min  
✅ **Alerts:** Email + Slack notifications on failures  
✅ **Reports:** HTML reports available as artifacts

## Next Steps

1. **Add GitHub Secrets** (TEST_USER_EMAIL, passwords, alert settings)
2. **Test workflows** (manual trigger first)
3. **Verify alerts** (trigger a failure to test notifications)
4. **Monitor results** (check Actions tab regularly)




