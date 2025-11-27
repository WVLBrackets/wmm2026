# Sync Test Infrastructure: Action Plan

## Current Situation

**Problem**: Test files and scripts exist on `staging` but are missing on `main`, causing workflow failures.

**Files that need syncing:**
- `package.json` - Test scripts and dependencies
- `playwright.config.ts` - Playwright configuration  
- `tests/` directory - All test files
- `.github/workflows/` - Workflow files (already on main)

## Immediate Action: One-Time Sync

### Step 1: Merge Staging → Main (Recommended)

This is the cleanest approach - merge all test infrastructure at once:

```bash
# On staging branch (current)
git checkout staging
git pull origin staging  # Make sure we're up to date

# Switch to main
git checkout main
git pull origin main

# Merge staging into main
git merge staging

# Resolve any conflicts (if any)
# Then push
git push origin main
```

### Step 2: Verify Sync

```bash
# Check that test files exist on main
git checkout main
ls tests/e2e/authentication.spec.ts
ls tests/e2e/bracket-creation.spec.ts
ls tests/fixtures/auth-helpers.ts

# Check package.json has test scripts
grep "test:smoke" package.json

# Check playwright.config.ts exists
ls playwright.config.ts
```

### Step 3: Test the Workflow

1. Go to GitHub Actions
2. Trigger "Smoke Tests" workflow
3. Select `staging` branch
4. Verify it runs successfully

## Ongoing Process: Keep Branches in Sync

### When Adding New Tests

**Always do this in order:**

1. **Add to staging first** (develop and test)
   ```bash
   git checkout staging
   # Create test file, add script, test locally
   git add tests/ package.json
   git commit -m "Add new test"
   git push origin staging
   ```

2. **Immediately sync to main** (don't wait!)
   ```bash
   git checkout main
   git merge staging  # or cherry-pick the commit
   git push origin main
   ```

3. **Verify workflow works**
   - Trigger workflow manually
   - Or wait for next push to staging

### When Adding Dependencies

**Critical**: Dependencies must be on both branches immediately

```bash
# 1. Add to staging
git checkout staging
# Edit package.json, add dependency
npm install  # Update package-lock.json
git add package.json package-lock.json
git commit -m "Add test dependency"
git push origin staging

# 2. IMMEDIATELY sync to main
git checkout main
git merge staging
git push origin main
```

## Quick Sync Script

Save this as `sync-tests-to-main.ps1`:

```powershell
# Sync test infrastructure from staging to main
# Run this after adding tests or dependencies to staging

Write-Host "Syncing test infrastructure from staging to main..." -ForegroundColor Cyan

# Make sure we're on staging and up to date
git checkout staging
git pull origin staging

# Switch to main
git checkout main
git pull origin main

# Merge staging
Write-Host "Merging staging into main..." -ForegroundColor Yellow
git merge staging

# Check for conflicts
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Merge conflicts detected! Resolve them manually." -ForegroundColor Red
    exit 1
}

# Push to main
Write-Host "Pushing to main..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Sync complete!" -ForegroundColor Green
Write-Host "Test the workflow in GitHub Actions to verify." -ForegroundColor Cyan

# Switch back to staging
git checkout staging
```

## Checklist: Before Pushing to Staging

When you're about to push test-related changes to staging, ask:

- [ ] Are test files committed?
- [ ] Are test scripts in package.json committed?
- [ ] Are dependencies in package.json committed?
- [ ] Have I tested locally?
- [ ] **Have I synced to main?** ← Most important!

## Why This Matters

**GitHub Actions Workflows:**
- Workflow files must be on `main` (for "Run workflow" button)
- But workflows checkout the branch that triggered them
- If that branch doesn't have test files/scripts → failure

**Solution:**
- Keep everything in sync
- Or always merge staging → main after test changes

## Alternative: Workflow Checks Out Main

If you want to avoid syncing, you could modify workflows to always checkout `main`:

```yaml
- name: Checkout code
  uses: actions/checkout@v4
  with:
    ref: main  # Always checkout main, regardless of trigger
```

**But this means:**
- Tests always run against `main` branch code
- Can't test `staging` branch changes
- Not ideal for testing before merging

## Recommended: Keep Everything in Sync

**Best practice:**
1. Develop tests on `staging`
2. Test locally on `staging`
3. Commit to `staging`
4. **Immediately merge to `main`**
5. Push both branches

This way:
- ✅ Tests work on both branches
- ✅ Workflows can test either branch
- ✅ No confusion about what's where
- ✅ Production deployments can be tested too


