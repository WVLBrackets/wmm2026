# Individual Tests Table

## All Individual Tests

| Test Name | Brief Description | Group | File |
|-----------|-------------------|-------|------|
| `should load the homepage` | Verifies homepage loads correctly | health | `tests/simple-test.spec.ts` |
| `should load the signup page` | Verifies signup page loads with all form fields | health | `tests/simple-test.spec.ts` |
| `should load the signin page` | Verifies signin page loads with form fields | health | `tests/simple-test.spec.ts` |
| `should navigate from signup to signin page` | Tests navigation link from signup to signin | health | `tests/simple-test.spec.ts` |
| `should navigate from signin to signup page` | Tests navigation link from signin to signup | health | `tests/simple-test.spec.ts` |
| `should create a new user account successfully` | API test: Creates user via POST /api/auth/register | api | `tests/api/auth.spec.ts` |
| `should reject registration with missing fields` | API test: Rejects registration without required fields | api | `tests/api/auth.spec.ts` |
| `should reject registration with password too short` | API test: Rejects password less than 6 characters | api | `tests/api/auth.spec.ts` |
| `should reject duplicate email registration` | API test: Rejects duplicate email (409 status) | api | `tests/api/auth.spec.ts` |
| `should reject invalid email format` | API test: Rejects invalid email format | api | `tests/api/auth.spec.ts` |
| `should successfully create user and return userId` | API test: Verifies userId is returned on success | api | `tests/api/auth.spec.ts` |
| `should require email confirmation after registration` | API test: Verifies confirmation message in response | api | `tests/api/auth.spec.ts` |
| `should reject confirmation with invalid token` | API test: Rejects confirmation with bad token | api | `tests/api/auth.spec.ts` |
| `should reject confirmation with missing token` | API test: Rejects confirmation without token | api | `tests/api/auth.spec.ts` |
| `should display signup form with all required fields` | Verifies all signup form fields are visible | account | `tests/e2e/account-creation.spec.ts` |
| `should prevent submission when passwords do not match` | Prevents form submission if passwords don't match | account | `tests/e2e/account-creation.spec.ts` |
| `should prevent submission when password is too short` | Prevents submission if password < 6 characters | account | `tests/e2e/account-creation.spec.ts` |
| `should successfully create account with valid data` | Creates account via UI with valid data | account | `tests/e2e/account-creation.spec.ts` |
| `should prevent submission for duplicate email` | Prevents duplicate email registration (409) | account | `tests/e2e/account-creation.spec.ts` |
| `should toggle password visibility` | Tests password show/hide toggle button | account | `tests/e2e/account-creation.spec.ts` |
| `should navigate to sign in page from signup page` | Tests navigation from signup to signin | account | `tests/e2e/account-creation.spec.ts` |
| `should require all fields to be filled` | Verifies HTML5 required field validation | account | `tests/e2e/account-validation.spec.ts` |
| `should validate email format` | Verifies email format validation | account | `tests/e2e/account-validation.spec.ts` |
| `should validate password minimum length` | Verifies password must be at least 6 characters | account | `tests/e2e/account-validation.spec.ts` |
| `should accept password with exactly 6 characters` | Verifies 6-character password is accepted | account | `tests/e2e/account-validation.spec.ts` |
| `should validate password confirmation match` | Verifies passwords must match | account | `tests/e2e/account-validation.spec.ts` |
| `should handle special characters in name` | Tests names with apostrophes and hyphens | account | `tests/e2e/account-validation.spec.ts` |
| `should handle long email addresses` | Tests very long email addresses | account | `tests/e2e/account-validation.spec.ts` |
| `should disable submit button while loading` | Verifies button disabled during submission | account | `tests/e2e/account-validation.spec.ts` |
| `should successfully create a new user account` | Creates user and verifies success message | account | `tests/e2e/user-creation-confirmation.spec.ts` |
| `should prevent submission for duplicate email during signup` | Prevents duplicate email via UI | account | `tests/e2e/user-creation-confirmation.spec.ts` |
| `should display confirmation page with invalid token` | Tests confirmation page with bad token | account | `tests/e2e/user-creation-confirmation.spec.ts` |
| `should display confirmation page with missing token` | Tests confirmation page without token | account | `tests/e2e/user-creation-confirmation.spec.ts` |
| `should navigate from signup success to signin page` | Tests navigation after successful signup | account | `tests/e2e/user-creation-confirmation.spec.ts` |
| `should sign in with valid credentials` | Signs in with valid test user credentials | auth | `tests/e2e/authentication.spec.ts` |
| `should show error with invalid email` | Shows error when email doesn't exist | auth | `tests/e2e/authentication.spec.ts` |
| `should show error with invalid password` | Shows error when password is wrong | auth | `tests/e2e/authentication.spec.ts` |
| `should maintain session after page refresh` | Verifies session persists after refresh | auth | `tests/e2e/authentication.spec.ts` |
| `should redirect to sign-in when accessing protected route without authentication` | Redirects unauthenticated users | auth | `tests/e2e/authentication.spec.ts` |
| `should navigate to signup page from signin page` | Tests navigation link from signin to signup | auth | `tests/e2e/authentication.spec.ts` |
| `should navigate to signin page from signup page` | Tests navigation link from signup to signin | auth | `tests/e2e/authentication.spec.ts` |
| `should navigate to bracket landing page` | Verifies bracket page loads after sign-in | bracket | `tests/e2e/bracket-creation.spec.ts` |
| `should create a new bracket` | Creates new bracket with entry name | bracket | `tests/e2e/bracket-creation.spec.ts` |
| `should allow saving bracket (validation handled by server)` | Tests bracket save with server validation | bracket | `tests/e2e/bracket-creation.spec.ts` |

## Running Individual Tests

### Method 1: By Test Name (Recommended)

```bash
# Run a single test by name
npx playwright test -g "should sign in with valid credentials"

# With environment
cross-env TEST_ENV=staging npx playwright test -g "should sign in with valid credentials"
cross-env TEST_ENV=production npx playwright test -g "should sign in with valid credentials"
```

### Method 2: By Test File

```bash
# Run all tests in a specific file
npx playwright test tests/e2e/authentication.spec.ts

# With environment
cross-env TEST_ENV=staging npx playwright test tests/e2e/authentication.spec.ts
```

### Method 3: By Test Name Pattern

```bash
# Run all tests matching a pattern
npx playwright test -g "sign in"
npx playwright test -g "bracket"
npx playwright test -g "password"
```

### Method 4: Using npm Scripts (Groups Only)

```bash
# Run a group of tests
npm run test:auth          # All authentication tests
npm run test:bracket       # All bracket tests
npm run test:account      # All account tests
```

## Test Count Summary

| Group | Number of Tests | Files |
|-------|----------------|-------|
| health | 5 | 1 |
| api | 9 | 1 |
| account | 21 | 3 |
| auth | 7 | 1 |
| bracket | 3 | 1 |
| **Total** | **45** | **7** |

*Note: Tests run on multiple browsers (chromium, firefox) so total test executions is higher*

## Quick Examples

### Run Single Test
```bash
# Sign in test
npx playwright test -g "should sign in with valid credentials"

# Bracket creation test
npx playwright test -g "should create a new bracket"

# Health check test
npx playwright test -g "should load the homepage"
```

### Run Multiple Tests by Pattern
```bash
# All sign-in related tests
npx playwright test -g "sign in"

# All password validation tests
npx playwright test -g "password"

# All navigation tests
npx playwright test -g "navigate"
```

### Run with Environment
```bash
# Staging (default)
npx playwright test -g "should sign in"

# Production
cross-env TEST_ENV=production npx playwright test -g "should sign in"
```

## Notes

- **Individual tests can be run** - Use `-g` flag with test name
- **Groups can be run** - Use npm scripts like `npm run test:auth`
- **Environment switching** - Use `cross-env TEST_ENV=staging/production` or npm scripts with `:prod` suffix
- **Pattern matching** - Use `-g` with partial test names to run multiple tests


