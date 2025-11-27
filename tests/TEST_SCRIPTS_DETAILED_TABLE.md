# Test Scripts Detailed Table - Individual Test Files

## Test Groups and Their Component Files

| Script Name | Group | Test Files | Individual Tests | Description |
|-------------|-------|------------|------------------|-------------|
| `test:health` | health | `tests/simple-test.spec.ts` | ~5 tests | Basic page loads, navigation, connectivity |
| `test:api` | api | `tests/api/auth.spec.ts` | ~9 tests | Backend API authentication endpoints |
| `test:account` | account | `tests/e2e/account-creation.spec.ts`<br>`tests/e2e/account-validation.spec.ts`<br>`tests/e2e/user-creation-confirmation.spec.ts` | ~21 tests | Account creation, validation, email confirmation |
| `test:auth` | auth | `tests/e2e/authentication.spec.ts` | ~14 tests | Sign in, logout, session management |
| `test:bracket` | bracket | `tests/e2e/bracket-creation.spec.ts` | ~3 tests | Bracket creation and management |
| `test:smoke` | smoke | `tests/e2e/authentication.spec.ts`<br>`tests/e2e/bracket-creation.spec.ts` | ~17 tests | Critical path: auth + bracket creation |
| `test:all` | all | All test files:<br>`tests/simple-test.spec.ts`<br>`tests/api/auth.spec.ts`<br>`tests/e2e/account-creation.spec.ts`<br>`tests/e2e/account-validation.spec.ts`<br>`tests/e2e/user-creation-confirmation.spec.ts`<br>`tests/e2e/authentication.spec.ts`<br>`tests/e2e/bracket-creation.spec.ts` | ~70+ tests | Complete test suite |

## Individual Test Files Breakdown

| Test File | Group | Tests | Auth Required | Description |
|-----------|-------|-------|---------------|-------------|
| `tests/simple-test.spec.ts` | health | ~5 | No | Basic page loads, navigation between pages |
| `tests/api/auth.spec.ts` | api | ~9 | No | API endpoint tests (direct HTTP calls) |
| `tests/e2e/account-creation.spec.ts` | account | ~7 | No | End-to-end account creation flow |
| `tests/e2e/account-validation.spec.ts` | account | ~8 | No | Form validation for account creation |
| `tests/e2e/user-creation-confirmation.spec.ts` | account | ~6 | No | Email confirmation flow |
| `tests/e2e/authentication.spec.ts` | auth | ~14 | Yes | Sign in, logout, session persistence |
| `tests/e2e/bracket-creation.spec.ts` | bracket | ~3 | Yes | Creating new brackets, saving drafts |

## Running Individual Test Files

You can run individual test files directly:

```bash
# Run a specific test file
npx playwright test tests/e2e/authentication.spec.ts

# With environment
cross-env TEST_ENV=staging npx playwright test tests/e2e/authentication.spec.ts
cross-env TEST_ENV=production npx playwright test tests/e2e/authentication.spec.ts

# Run by pattern (all account tests)
npx playwright test tests/e2e/account-*.spec.ts

# Run by pattern (all bracket tests)
npx playwright test tests/e2e/bracket-*.spec.ts
```

## Test File Details

### Health Group
- **File:** `tests/simple-test.spec.ts`
- **Tests:**
  - should load the homepage
  - should load the signup page
  - should load the signin page
  - should navigate from signup to signin page
  - should navigate from signin to signup page

### API Group
- **File:** `tests/api/auth.spec.ts`
- **Tests:** API endpoint validation (account creation, validation, duplicate email, etc.)

### Account Group
- **Files:**
  - `tests/e2e/account-creation.spec.ts` - Account creation E2E flow
  - `tests/e2e/account-validation.spec.ts` - Form validation
  - `tests/e2e/user-creation-confirmation.spec.ts` - Email confirmation

### Auth Group
- **File:** `tests/e2e/authentication.spec.ts`
- **Tests:** Sign in, logout, session management, protected routes

### Bracket Group
- **File:** `tests/e2e/bracket-creation.spec.ts`
- **Tests:** Navigate to bracket page, create bracket, save bracket

### Smoke Group
- **Files:** Combines `authentication.spec.ts` + `bracket-creation.spec.ts`
- **Purpose:** Critical path validation for CI/CD

## Group Composition Summary

| Group | Number of Files | Total Tests | Auth Required |
|-------|----------------|-------------|---------------|
| health | 1 | ~5 | No |
| api | 1 | ~9 | No |
| account | 3 | ~21 | No |
| auth | 1 | ~14 | Yes |
| bracket | 1 | ~3 | Yes |
| smoke | 2 | ~17 | Yes |
| all | 7 | ~70+ | Mixed |


