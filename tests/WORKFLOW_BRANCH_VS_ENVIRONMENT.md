# Understanding Workflow Branch vs Test Environment

## Two Independent Choices

When running a GitHub Actions workflow manually, you have two separate options that control different things:

### 1. "Use workflow from" (Branch Selection)
**What it controls:** Which **version of the workflow code** to execute

**Options:**
- `main` - Uses the workflow definition from the main branch
- `staging` - Uses the workflow definition from the staging branch
- Any other branch - Uses the workflow definition from that branch

**What this means:**
- If you select `main`, GitHub will use the `.github/workflows/test-group-1-connect.yml` file from the `main` branch
- If you select `staging`, GitHub will use the `.github/workflows/test-group-1-connect.yml` file from the `staging` branch
- This is about **which workflow code to run**, not which environment to test

### 2. "Test environment" (Environment Selection)
**What it controls:** Which **application environment** the tests will run against

**Options:**
- `staging` - Tests run against staging URL (e.g., `wmm2026-git-staging-...vercel.app`)
- `production` - Tests run against production URL (e.g., `warrensmm.com`)

**What this means:**
- Sets the `TEST_ENV` environment variable in the workflow
- Determines which credentials to use (`TEST_USER_PASSWORD_STAGING` vs `TEST_USER_PASSWORD_PRODUCTION`)
- Determines which base URL Playwright uses (via `playwright.config.ts`)

## Common Scenarios

### ✅ Scenario 1: Test Staging with Workflow from Main
**Branch:** `main`  
**Environment:** `staging`

**When to use:**
- You've merged workflow changes to main and want to test them
- You want to validate staging environment with the latest workflow code
- **Most common scenario** - testing staging with stable workflow code

**Is this wrong?** ✅ **No, this is perfectly fine!**

### ✅ Scenario 2: Test Production with Workflow from Main
**Branch:** `main`  
**Environment:** `production`

**When to use:**
- Production testing with stable workflow code
- Final validation before release
- **Common for production deployments**

**Is this wrong?** ✅ **No, this is correct!**

### ✅ Scenario 3: Test Staging with Workflow from Staging
**Branch:** `staging`  
**Environment:** `staging`

**When to use:**
- You're developing new workflow features on staging branch
- You want to test workflow changes before merging to main
- Validating new workflow code against staging environment
- **Common during workflow development**

**Is this wrong?** ✅ **No, this is correct!**

### ⚠️ Scenario 4: Test Production with Workflow from Staging
**Branch:** `staging`  
**Environment:** `production`

**When to use:**
- You're testing new workflow code against production
- **Use with caution** - only if you're confident in the workflow changes
- Generally not recommended unless you're specifically testing workflow changes

**Is this wrong?** ⚠️ **Generally not recommended** - use main branch workflow for production testing

## Key Distinction

| Option | Controls | Example |
|--------|----------|---------|
| **Branch** | Which workflow code to run | `main` = stable workflow, `staging` = experimental workflow |
| **Environment** | Which app to test | `staging` = test server, `production` = live server |

## Recommended Practices

### For Regular Testing
1. **Test Staging:** Use workflow from `main`, environment `staging`
2. **Test Production:** Use workflow from `main`, environment `production`

### For Workflow Development
1. **Test New Workflow:** Use workflow from `staging`, environment `staging`
2. **After Merging:** Switch to workflow from `main` for regular use

### For Production Validation
1. **Always use:** Workflow from `main` (stable code)
2. **Environment:** `production` (to test the live site)

## Technical Details

### How Branch Selection Works
```yaml
# GitHub Actions uses the workflow file from the selected branch
# If you select "main", it uses .github/workflows/test-group-1-connect.yml from main
# If you select "staging", it uses .github/workflows/test-group-1-connect.yml from staging
```

### How Environment Selection Works
```yaml
# The workflow sets TEST_ENV based on your selection
env:
  TEST_ENV: ${{ inputs.environment }}  # staging or production

# This is then used by:
# 1. playwright.config.ts to determine baseURL
# 2. Test scripts to select correct credentials
```

### Example: Workflow from Main, Test Staging
1. GitHub checks out the workflow file from `main` branch
2. Workflow sets `TEST_ENV=staging`
3. Playwright config uses staging URL
4. Tests use `TEST_USER_PASSWORD_STAGING`
5. Tests run against staging environment ✅

### Example: Workflow from Staging, Test Production
1. GitHub checks out the workflow file from `staging` branch
2. Workflow sets `TEST_ENV=production`
3. Playwright config uses production URL
4. Tests use `TEST_USER_PASSWORD_PRODUCTION`
5. Tests run against production environment ⚠️ (but using experimental workflow code)

## Summary

**Branch = Which workflow code**  
**Environment = Which app to test**

**Most common combinations:**
- ✅ `main` + `staging` = Test staging with stable workflow
- ✅ `main` + `production` = Test production with stable workflow
- ✅ `staging` + `staging` = Test staging with experimental workflow

**Generally avoid:**
- ⚠️ `staging` + `production` = Testing production with experimental workflow (risky)


