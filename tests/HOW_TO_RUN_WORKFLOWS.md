# How to Run GitHub Actions Workflows

## Why You Only See "Smoke Tests"

GitHub Actions only shows workflows in the sidebar **after they've run at least once**. Since we just pushed the workflows:
- ✅ **Smoke Tests** - Already ran (triggered by the push to `staging`)
- ⏳ **Health Check Tests** - Will appear after first run
- ⏳ **Full Regression Tests** - Will appear after first run

## How to Run Workflows Manually

### Method 1: From the Workflows List

1. Go to **Actions** tab
2. Click **"All workflows"** in the left sidebar
3. You should see all three workflows listed:
   - Smoke Tests
   - Health Check Tests  
   - Full Regression Tests
4. Click on the workflow name you want to run
5. Click the **"Run workflow"** button (top right, next to "Filter workflow runs")
6. Select the branch (usually `staging` or `main`)
7. Click the green **"Run workflow"** button

### Method 2: From the Sidebar (After First Run)

1. Go to **Actions** tab
2. Click the workflow name in the left sidebar (e.g., "Smoke Tests")
3. Click **"Run workflow"** button (top right)
4. Select branch and click **"Run workflow"**

## Quick Reference: What Each Workflow Does

### 🔥 Smoke Tests
- **When it runs:** Every deployment, PRs, or manually
- **What it tests:** Critical paths (authentication, bracket creation)
- **Duration:** ~5-10 minutes
- **Browsers:** Chromium only

### ❤️ Health Check Tests
- **When it runs:** Every 6 hours (scheduled), push to main, or manually
- **What it tests:** Basic page loads and sign-in
- **Duration:** ~3-5 minutes
- **Browsers:** Chromium only

### 🧪 Full Regression Tests
- **When it runs:** Production deployments, version tags, PRs to main, or manually
- **What it tests:** All tests across all browsers
- **Duration:** ~15-30 minutes
- **Browsers:** Chromium + Firefox

## Making All Workflows Visible

To make all three workflows appear in the sidebar, you need to trigger each one at least once:

### Option 1: Manual Trigger (Easiest)

1. Go to **Actions** → **All workflows**
2. For each workflow:
   - Click on the workflow name
   - Click **"Run workflow"**
   - Select branch: `staging`
   - Click **"Run workflow"**

### Option 2: Push to Main Branch

The Health Check and Full Regression workflows trigger on pushes to `main`. If you merge `staging` into `main`, they'll run automatically.

## Troubleshooting

### "Run workflow" Button Not Visible

- Make sure you're on the workflow's detail page (click the workflow name first)
- Check that you have write access to the repository
- Refresh the page

### Workflow Fails Immediately

- Check that all required secrets are set:
  - `TEST_USER_EMAIL`
  - `TEST_USER_PASSWORD_STAGING`
  - `TEST_USER_PASSWORD_PRODUCTION`
- Check the workflow logs for specific error messages

### Can't See Workflow in Sidebar

- The workflow must have run at least once to appear in the sidebar
- Try clicking "All workflows" to see all workflows regardless
- Refresh the page after triggering a run

## Next Steps

1. ✅ Trigger each workflow manually once to make them all visible
2. ✅ Verify they run successfully
3. ✅ Set up email/Slack alerts (optional but recommended)
4. ✅ Let them run automatically on deployments


