# Click-by-Click Guide: Running GitHub Actions Workflows

## Step 1: Click on "Smoke Tests" in the Left Sidebar

On the Actions page, look at the **left sidebar** under "Actions". You should see:
- All workflows
- **Smoke Tests** ← **CLICK THIS**

## Step 2: You'll See the Workflow Detail Page

After clicking "Smoke Tests", you'll see:
- A page titled "Smoke Tests"
- A list of workflow runs (you should see at least one: "Add GitHub Actions workflows...")
- **A "Run workflow" button in the top right** (next to "Filter workflow runs")

## Step 3: Click "Run workflow"

1. Click the **"Run workflow"** button (top right)
2. A dropdown will appear
3. Select branch: **staging** (from the dropdown)
4. Click the green **"Run workflow"** button

## For the Other Two Workflows

The other workflows ("Health Check Tests" and "Full Regression Tests") won't appear in the sidebar until they've run at least once. Here's how to make them appear:

### Option A: Push to Main Branch (Recommended)

Since these workflows trigger on `main` branch, merge your `staging` branch to `main`:

```powershell
git checkout main
git merge staging
git push origin main
```

This will automatically trigger both workflows, and they'll appear in the sidebar.

### Option B: Access via URL (Quick Test)

You can access the workflows directly via URL:

1. **Health Check Tests:**
   ```
   https://github.com/WVLBrackets/wmm2026/actions/workflows/test-health.yml
   ```

2. **Full Regression Tests:**
   ```
   https://github.com/WVLBrackets/wmm2026/actions/workflows/test-full-regression.yml
   ```

3. Once on those pages, you'll see the "Run workflow" button.

## Visual Guide

```
GitHub Actions Page
│
├── Left Sidebar
│   ├── [All workflows] ← Summary view (where you are now)
│   └── [Smoke Tests] ← CLICK HERE to see "Run workflow" button
│
└── Main Area
    └── When you click "Smoke Tests", you'll see:
        ├── "Run workflow" button (top right) ← CLICK THIS
        └── List of previous runs
```

## Quick Test: Run Smoke Tests Now

1. **Click "Smoke Tests"** in the left sidebar
2. **Click "Run workflow"** (top right button)
3. **Select "staging"** from the branch dropdown
4. **Click green "Run workflow"** button
5. Watch it run! ✅

## Still Can't See It?

If you still don't see the "Run workflow" button after clicking "Smoke Tests":

1. Make sure you're on the workflow's detail page (not "All workflows")
2. Refresh the page (F5)
3. Check that you have write access to the repository
4. Try the direct URL: `https://github.com/WVLBrackets/wmm2026/actions/workflows/test-smoke.yml`


