# Setting Up GitHub Secrets for Automated Testing

## Overview

GitHub Secrets store sensitive information (like passwords) that your automated tests need. These are encrypted and only accessible to GitHub Actions workflows.

## Step-by-Step Instructions

### Step 1: Navigate to Secrets

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/wmm2026`
2. Click **Settings** (top menu bar)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret** button

### Step 2: Add Required Secrets

Add each secret one at a time:

#### Secret 1: TEST_USER_EMAIL

1. **Name:** `TEST_USER_EMAIL`
2. **Secret:** `thewarren@gmail.com`
3. Click **Add secret**

#### Secret 2: TEST_USER_PASSWORD_STAGING

1. **Name:** `TEST_USER_PASSWORD_STAGING`
2. **Secret:** Your staging password (from Vercel environment variables)
   - You can get this from Vercel Dashboard → Project → Settings → Environment Variables
   - Or from your local `.env.test` file (if you pulled it)
3. Click **Add secret**

#### Secret 3: TEST_USER_PASSWORD_PRODUCTION

1. **Name:** `TEST_USER_PASSWORD_PRODUCTION`
2. **Secret:** Your production password (from Vercel environment variables)
   - You can get this from Vercel Dashboard → Project → Settings → Environment Variables
   - Or from your local `.env.test` file (if you pulled it)
3. Click **Add secret**

### Step 3: Verify Secrets Are Added

You should now see three secrets in the list:
- ✅ TEST_USER_EMAIL
- ✅ TEST_USER_PASSWORD_STAGING
- ✅ TEST_USER_PASSWORD_PRODUCTION

### Step 4: Get Password Values (If Needed)

If you need to get the passwords from Vercel:

**Option A: From Vercel Dashboard**
1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Find `TEST_USER_PASSWORD_STAGING` (Preview environment)
4. Find `TEST_USER_PASSWORD_PRODUCTION` (Production environment)
5. Click the eye icon to reveal the value
6. Copy and paste into GitHub Secrets

**Option B: From Local .env.test File**
```powershell
# View the values (they're already in your .env.test file)
Get-Content .env.test | Select-String "TEST_USER"
```

## Optional: Set Up Alert Secrets

If you want email or Slack notifications when tests fail:

### Email Alerts Setup

#### Step 1: Create Gmail App Password

1. Go to https://myaccount.google.com/
2. Click **Security** (left sidebar)
3. Under "Signing in to Google", click **2-Step Verification**
   - If not enabled, enable it first
4. Scroll down and click **App passwords**
5. Select app: **Mail**
6. Select device: **Other (Custom name)** → Enter "GitHub Actions"
7. Click **Generate**
8. **Copy the 16-character password** (you'll need this)

#### Step 2: Add Email Secrets to GitHub

1. Go to GitHub → Settings → Secrets and variables → Actions
2. Add these secrets:

**EMAIL_USERNAME**
- **Name:** `EMAIL_USERNAME`
- **Secret:** Your Gmail address (e.g., `yourname@gmail.com`)
- Click **Add secret**

**EMAIL_PASSWORD**
- **Name:** `EMAIL_PASSWORD`
- **Secret:** The 16-character app password you just generated
- Click **Add secret**

**ALERT_EMAIL**
- **Name:** `ALERT_EMAIL`
- **Secret:** Email address where you want to receive alerts (can be same as EMAIL_USERNAME)
- Click **Add secret**

### Slack Alerts Setup

#### Step 1: Create Slack Webhook

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Name: `WMM2026 Test Alerts`
4. Workspace: Select your workspace
5. Click **Create App**
6. In left sidebar, click **Incoming Webhooks**
7. Toggle **Activate Incoming Webhooks** to ON
8. Click **Add New Webhook to Workspace**
9. Select the channel where you want alerts
10. Click **Allow**
11. **Copy the Webhook URL** (starts with `https://hooks.slack.com/services/...`)

#### Step 2: Add Slack Secret to GitHub

1. Go to GitHub → Settings → Secrets and variables → Actions
2. Add secret:

**SLACK_WEBHOOK_URL**
- **Name:** `SLACK_WEBHOOK_URL`
- **Secret:** The webhook URL you just copied
- Click **Add secret**

## Quick Reference: All Secrets

### Required (Must Have)
- ✅ `TEST_USER_EMAIL`
- ✅ `TEST_USER_PASSWORD_STAGING`
- ✅ `TEST_USER_PASSWORD_PRODUCTION`

### Optional (For Alerts)
- 📧 `EMAIL_USERNAME` (for email alerts)
- 📧 `EMAIL_PASSWORD` (Gmail app password)
- 📧 `ALERT_EMAIL` (where to send alerts)
- 💬 `SLACK_WEBHOOK_URL` (for Slack alerts)

## Testing Your Setup

### Test 1: Verify Secrets Are Set

1. Go to GitHub → **Actions** tab
2. Click **Smoke Tests** workflow
3. Click **Run workflow** → **Run workflow**
4. Watch it run - if secrets are missing, you'll see an error

### Test 2: Test Email Alerts (If Configured)

1. Temporarily break a test (or wait for a real failure)
2. Check your email for the alert
3. Check spam folder if you don't see it

### Test 3: Test Slack Alerts (If Configured)

1. Trigger a test failure
2. Check your Slack channel for the notification

## Troubleshooting

### "Secret not found" Error

**Solution:** Make sure you:
- Added the secret with the exact name (case-sensitive)
- Saved the secret (clicked "Add secret")
- The workflow is using the correct secret name

### Email Not Sending

**Check:**
1. Gmail app password is correct (16 characters, no spaces)
2. 2-Step Verification is enabled
3. `ALERT_EMAIL` is set correctly
4. Check spam folder

### Slack Not Working

**Check:**
1. Webhook URL is correct (starts with `https://hooks.slack.com/`)
2. Webhook is active in Slack
3. App has permission to post to the channel

## Security Notes

✅ **Secrets are encrypted** - GitHub encrypts all secrets  
✅ **Only workflows can access** - Secrets are only available to GitHub Actions  
✅ **Never visible in logs** - Secrets are masked in workflow logs  
✅ **Can be updated** - You can update secrets anytime without changing code

## Next Steps

After setting up secrets:

1. ✅ Test a workflow manually (Actions → Run workflow)
2. ✅ Verify tests run successfully
3. ✅ Test alerts (trigger a failure or wait for one)
4. ✅ Monitor results in Actions tab

## Summary

**Minimum Setup (Tests Will Run):**
- TEST_USER_EMAIL
- TEST_USER_PASSWORD_STAGING
- TEST_USER_PASSWORD_PRODUCTION

**Full Setup (Tests + Alerts):**
- All of the above, plus:
- EMAIL_USERNAME, EMAIL_PASSWORD, ALERT_EMAIL (for email)
- SLACK_WEBHOOK_URL (for Slack)

Once secrets are set, your automated tests will run automatically on deployments and schedules!




