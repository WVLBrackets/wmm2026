# Test Organization & Execution Plan

## Overview

This document outlines the complete test organization strategy, including how to run tests locally and in CI/CD.

## Test Groups & Scripts

### Quick Reference

| Group | Script | Files | Purpose |
|-------|--------|-------|---------|
| Health | `test:health` | `simple-test.spec.ts` | Basic connectivity |
| API | `test:api` | `api/auth.spec.ts` | Backend API tests |
| Account | `test:account` | `account-*.spec.ts` | Account creation/validation |
| Auth | `test:auth` | `authentication.spec.ts` | Sign in/logout/session |
| Bracket | `test:bracket` | `bracket-*.spec.ts` | Bracket features |
| Smoke | `test:smoke` | Auth + Bracket creation | Critical path |
| All | `test:all` | All files | Full regression |

## Script Naming Convention

### Pattern: `test:<group>[:env]`
- Default environment: **staging**
- Explicit environments: `:staging` or `:prod`

### Examples:
```bash
npm run test:health          # Health checks on staging
npm run test:health:prod     # Health checks on production
npm run test:auth:staging    # Auth tests on staging (explicit)
npm run test:smoke:prod      # Smoke tests on production
```

## Running Tests

### By Group (Recommended)

```bash
# Health checks (fastest, no auth needed)
npm run test:health
npm run test:health:prod

# API tests (backend validation)
npm run test:api
npm run test:api:prod

# Account management (signup flow)
npm run test:account
npm run test:account:prod

# Authentication (sign in/logout)
npm run test:auth
npm run test:auth:prod

# Bracket features (requires auth)
npm run test:bracket
npm run test:bracket:prod

# Smoke tests (critical path)
npm run test:smoke
npm run test:smoke:prod

# Full regression (all tests)
npm run test:all
npm run test:all:prod
```

### By Individual File

```bash
# Run specific test file
npx playwright test tests/e2e/authentication.spec.ts
npx playwright test tests/e2e/bracket-creation.spec.ts

# With environment
TEST_ENV=staging npx playwright test tests/e2e/authentication.spec.ts
TEST_ENV=production npx playwright test tests/e2e/authentication.spec.ts
```

### By Test Name

```bash
# Run single test by name
npx playwright test -g "should sign in with valid credentials"

# With environment
TEST_ENV=staging npx playwright test -g "should sign in"
```

### Development Mode

```bash
# Interactive UI mode (recommended for development)
npm run test:ui              # Staging
npm run test:ui:prod        # Production

# Headed mode (see browser)
npm run test:headed

# View last test report
npm run test:report
```

## GitHub Actions Integration

### Smoke Tests Workflow
```yaml
- name: Run smoke tests
  env:
    TEST_ENV: ${{ steps.env.outputs.environment }}
  run: npm run test:smoke
```

### Health Check Workflow
```yaml
- name: Run health checks
  env:
    TEST_ENV: staging
  run: npm run test:health
```

### Full Regression Workflow
```yaml
- name: Run full regression
  env:
    TEST_ENV: ${{ steps.env.outputs.environment }}
  run: npm run test:all
```

## Test Execution Strategy

### Local Development
1. **During development:** Use `test:ui` for interactive testing
2. **Before commit:** Run relevant group (e.g., `test:bracket`)
3. **Before push:** Run `test:smoke` to verify critical path

### CI/CD Pipeline
1. **On every push:** Run `test:smoke` (fast, critical path)
2. **On PR:** Run `test:smoke` + affected groups
3. **On merge to main:** Run `test:all:prod` (full regression)
4. **Scheduled:** Run `test:health` every 6 hours

### Production Validation
1. **After deployment:** Run `test:health:prod` (quick check)
2. **Major releases:** Run `test:all:prod` (full validation)

## Environment Configuration

### Default Behavior
- **No environment specified:** Tests run against **staging**
- **Explicit environment:** Use `:staging` or `:prod` suffix

### Environment Variables
- `TEST_ENV=staging` → Staging environment
- `TEST_ENV=production` → Production environment
- `PLAYWRIGHT_TEST_BASE_URL` → Custom URL override

### Base URLs
- **Staging:** `https://wmm2026-git-staging-...vercel.app`
- **Production:** `https://warrensmm.com`

## Test Dependencies

### No Auth Required
- `test:health` - Basic page loads
- `test:api` - Direct API calls
- `test:account` - Creates its own users

### Auth Required
- `test:auth` - Uses test user account
- `test:bracket` - Requires authenticated user
- `test:smoke` - Requires authenticated user

### Test User Setup
- Email: `thewarren@gmail.com` (from `TEST_USER_EMAIL`)
- Password: From `TEST_USER_PASSWORD_STAGING` or `TEST_USER_PASSWORD_PRODUCTION`
- Must be confirmed in target environment

## Best Practices

### 1. Start Small
- Run `test:health` first to verify connectivity
- Then run specific group you're working on

### 2. Use Interactive Mode
- Use `test:ui` during development
- Faster feedback loop
- Easy to debug

### 3. Test Locally Before CI
- Run tests locally before pushing
- Catch issues early
- Faster iteration

### 4. Use Appropriate Groups
- Don't run `test:all` for small changes
- Use specific group (e.g., `test:bracket`)
- Save time and resources

### 5. Environment Awareness
- Default to staging for development
- Use production only when needed
- Verify environment before running

## Troubleshooting

### Tests Fail to Connect
```bash
# Check environment variable
echo $TEST_ENV

# Verify base URL in playwright.config.ts
# Check network connectivity
```

### Authentication Fails
```bash
# Verify test user credentials
# Check TEST_USER_EMAIL and TEST_USER_PASSWORD_* are set
# Verify user exists and is confirmed in target environment
```

### Can't Find Test File
```bash
# Verify file exists
ls tests/e2e/authentication.spec.ts

# Check file is committed (not just local)
git status tests/e2e/
```

## Next Steps

1. ✅ Create inventory
2. ✅ Define organization plan
3. ⏳ Update package.json scripts
4. ⏳ Test scripts locally
5. ⏳ Update GitHub Actions workflows
6. ⏳ Document in README


