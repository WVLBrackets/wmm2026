# Automated Testing Strategy & Plan

## Current Problems

1. **Branch Sync Issues**: Test scripts and files exist on `staging` but not always on `main` (or vice versa)
2. **Reactive Fixes**: We're fixing issues as they come up rather than planning ahead
3. **Workflow Location**: Workflows must be on `main` (for "Run workflow" button), but tests run from `staging`
4. **Missing Dependencies**: `@playwright/test` and test files need to be on the branch being tested

## Recommended Approach

### Option 1: Keep Everything in Sync (Recommended)

**Strategy**: Maintain identical test infrastructure on both `main` and `staging`

**Pros:**
- ✅ Tests work regardless of which branch triggers them
- ✅ No confusion about what's where
- ✅ Easy to test both environments

**Cons:**
- ⚠️ Need to keep branches in sync (but this is good practice anyway)

**Implementation:**
1. All test files, scripts, and dependencies on both branches
2. Workflows on `main` (required by GitHub)
3. When adding new tests, add to `staging` first, then merge to `main`
4. Use a checklist to ensure nothing is missed

### Option 2: Test Files Only on Staging

**Strategy**: Keep all test infrastructure on `staging`, workflows checkout `staging` branch

**Pros:**
- ✅ Single source of truth
- ✅ No sync issues

**Cons:**
- ⚠️ Can't test production deployments directly
- ⚠️ Workflows must explicitly checkout `staging` branch
- ⚠️ More complex workflow configuration

### Option 3: Separate Test Branches

**Strategy**: Create a dedicated `tests` branch with all test infrastructure

**Pros:**
- ✅ Completely separate from code branches
- ✅ Can update tests independently

**Cons:**
- ⚠️ More complex to manage
- ⚠️ Workflows need to checkout multiple branches
- ⚠️ Overkill for most projects

## Recommended: Option 1 (Keep Everything in Sync)

### Implementation Plan

#### Phase 1: Initial Setup (One-time)

1. **Audit Current State**
   - [ ] List all test files on `staging`
   - [ ] List all test scripts in `package.json` on `staging`
   - [ ] List all test dependencies
   - [ ] Check what's missing on `main`

2. **Sync Everything to Main**
   - [ ] Merge `staging` → `main` (or cherry-pick test-related commits)
   - [ ] Verify all test files exist on `main`
   - [ ] Verify all scripts exist on `main`
   - [ ] Verify all dependencies exist on `main`

3. **Verify Workflows**
   - [ ] All workflows on `main` (required)
   - [ ] Workflows configured to test `staging` environment by default
   - [ ] Workflows can test `main` branch → production environment

#### Phase 2: Standard Process (Ongoing)

**When Adding New Tests:**

1. **On Staging Branch:**
   ```bash
   # 1. Create test file
   # 2. Add test script to package.json (if needed)
   # 3. Test locally
   # 4. Commit to staging
   ```

2. **Sync to Main:**
   ```bash
   # Option A: Merge staging → main (recommended)
   git checkout main
   git merge staging
   git push origin main
   
   # Option B: Cherry-pick test commits
   git checkout main
   git cherry-pick <test-commit-hash>
   git push origin main
   ```

3. **Verify:**
   - [ ] Test file exists on `main`
   - [ ] Test script exists on `main`
   - [ ] Workflow can find the test

**When Adding New Dependencies:**

1. Add to `package.json` on `staging`
2. Test locally
3. Commit to `staging`
4. **Immediately** merge to `main` (don't wait)
5. Push both branches

#### Phase 3: Automation (Future)

**GitHub Actions Workflow to Auto-Sync:**
- When test files change on `staging`, automatically sync to `main`
- Or: Require PR from `staging` → `main` for test changes

**Pre-commit Hooks:**
- Check that test files exist on both branches
- Warn if test scripts are missing

## File Organization Checklist

### Required on BOTH `main` and `staging`:

- [ ] `package.json` - All test scripts (`test:smoke`, `test:health`, etc.)
- [ ] `playwright.config.ts` - Playwright configuration
- [ ] `tests/` directory - All test files
- [ ] `.github/workflows/` - All workflow files (must be on `main`)
- [ ] Dependencies: `@playwright/test` in `devDependencies`

### Test Files Structure:
```
tests/
├── e2e/
│   ├── authentication.spec.ts
│   ├── bracket-creation.spec.ts
│   └── ...
├── api/
│   └── auth.spec.ts
├── fixtures/
│   └── auth-helpers.ts
└── simple-test.spec.ts
```

## Workflow Configuration

### Current Setup:
- **Workflows Location**: `.github/workflows/` on `main` branch (required by GitHub)
- **Test Execution**: Runs against code from the branch that triggered it
- **Environment**: 
  - `staging` branch → tests staging environment
  - `main` branch → tests production environment

### Workflow Triggers:
- **Smoke Tests**: Every push to `staging` (and other branches)
- **Health Checks**: Every 6 hours + pushes to `staging`/`main`
- **Full Regression**: Pushes to `staging`/`main` + version tags

## Quick Reference: Adding a New Test

```bash
# 1. On staging branch
git checkout staging

# 2. Create test file
# tests/e2e/my-new-test.spec.ts

# 3. Add to package.json if needed
# "test:myfeature": "playwright test tests/e2e/my-new-test.spec.ts"

# 4. Test locally
npm run test:myfeature

# 5. Commit
git add tests/e2e/my-new-test.spec.ts package.json
git commit -m "Add my new test"

# 6. Push staging
git push origin staging

# 7. Sync to main (IMPORTANT!)
git checkout main
git merge staging  # or cherry-pick
git push origin main

# 8. Verify workflow can find it
# Go to GitHub Actions and trigger a test
```

## Troubleshooting Checklist

When a workflow fails with "Missing script" or "File not found":

1. ✅ Check if file/script exists on the branch being tested
2. ✅ Check if it's committed (not just local changes)
3. ✅ Check if it's pushed to remote
4. ✅ Verify the branch the workflow is checking out
5. ✅ Check if it exists on `main` (if workflow is on `main`)

## Next Steps

1. **Immediate**: Sync all test infrastructure from `staging` → `main`
2. **Short-term**: Create a checklist for adding new tests
3. **Long-term**: Consider automation to keep branches in sync

## Questions to Answer

1. **Do we want to test production deployments?**
   - If yes: Keep tests on `main` too
   - If no: Can keep tests only on `staging`

2. **How often do we merge staging → main?**
   - Frequent merges = easier to keep in sync
   - Infrequent merges = need cherry-pick strategy

3. **Do we want automated syncing?**
   - GitHub Actions can auto-sync test files
   - Or manual process with checklist


