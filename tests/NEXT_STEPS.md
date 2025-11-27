# Next Steps: After Syncing Test Infrastructure

## ✅ What We Just Did

1. Synced all test files from `staging` → `main`
2. Synced `package.json` with test scripts
3. Synced `playwright.config.ts`
4. Pushed everything to `main`

## 🧪 Test the Workflow

### Step 1: Verify Files Are on Main

The sync should have copied:
- ✅ `tests/e2e/authentication.spec.ts`
- ✅ `tests/e2e/bracket-creation.spec.ts`
- ✅ `tests/fixtures/auth-helpers.ts`
- ✅ `package.json` with `test:smoke` script
- ✅ `playwright.config.ts`

### Step 2: Trigger a Test Run

1. Go to GitHub → **Actions** tab
2. Click **"Smoke Tests"** workflow
3. Click **"Run workflow"** button (top right)
4. Select branch: **`staging`**
5. Click **"Run workflow"** (green button)

### Step 3: Watch It Run

The workflow should:
- ✅ Checkout `staging` branch
- ✅ Find `package.json` with `test:smoke` script
- ✅ Find test files (`authentication.spec.ts`, `bracket-creation.spec.ts`)
- ✅ Install dependencies (including `@playwright/test`)
- ✅ Run the tests
- ✅ Show results

## 🎯 Expected Results

### Success ✅
- All steps complete with green checkmarks
- Tests run and pass (or fail with actual test failures, not "missing file" errors)
- You see test output in the logs

### If It Still Fails ❌

**Check the error message:**
- If "Missing script" → `package.json` might not be synced (check it exists on main)
- If "Cannot find module" → Test files might not be synced
- If "Sign-in failed" → This is a real test failure (credentials or app issue)
- If "net::ERR_NAME_NOT_RESOLVED" → Base URL issue (check `playwright.config.ts`)

## 📋 Going Forward: Process

### When Adding New Tests

1. **Add to staging** (as usual)
   ```bash
   git checkout staging
   # Create test file, add script, test locally
   git add tests/ package.json
   git commit -m "Add new test"
   git push origin staging
   ```

2. **Immediately sync to main**
   ```bash
   .\sync-tests-to-main.ps1
   ```

3. **Verify workflow works**
   - Trigger workflow manually
   - Or wait for next push to staging

### When Adding Dependencies

**Critical**: Must sync immediately!

1. Add dependency to `package.json` on staging
2. Run `npm install` to update `package-lock.json`
3. Commit and push to staging
4. **Immediately** run `.\sync-tests-to-main.ps1`
5. Verify workflow can install dependencies

## 🔍 Troubleshooting

### Workflow Still Fails?

1. **Check which branch it's testing:**
   - Look at the workflow run details
   - See which branch it checked out

2. **Verify files exist on that branch:**
   ```bash
   git checkout <branch-name>
   ls tests/e2e/authentication.spec.ts
   grep "test:smoke" package.json
   ```

3. **Check if files are committed (not just local):**
   ```bash
   git log --oneline --all -- tests/e2e/authentication.spec.ts
   ```

4. **Verify remote has the files:**
   ```bash
   git fetch origin
   git show origin/main:tests/e2e/authentication.spec.ts
   ```

## ✅ Success Checklist

After running the workflow, verify:
- [ ] Workflow completes (doesn't fail on "missing script")
- [ ] Tests actually run (you see test output)
- [ ] Tests pass or fail for real reasons (not infrastructure issues)
- [ ] You can see test results in the workflow logs

## 🎉 Once It Works

You're all set! The automated testing is now properly configured:
- ✅ Workflows trigger on pushes to `staging`
- ✅ Test infrastructure is synced between branches
- ✅ Process is documented for future changes

Just remember: **Always sync to main after adding tests or dependencies!**


