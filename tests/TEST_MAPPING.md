# Test Number to Playwright Test Name Mapping

This file maps the numbered test system to actual Playwright test names for execution.

## Group 1: Basic Connectivity & Navigation (`connect`)

| Number | Abbreviation | Playwright Test Name | File |
|--------|--------------|---------------------|------|
| 1.1 | `homepage` | `should load the homepage` | `tests/simple-test.spec.ts` |
| 1.2 | `signup-page` | `should load the signup page` | `tests/simple-test.spec.ts` |
| 1.3 | `signin-page` | `should load the signin page` | `tests/simple-test.spec.ts` |
| 1.4 | `nav-up-in` | `should navigate from signup to signin page` | `tests/simple-test.spec.ts` |
| 1.5 | `nav-in-up` | `should navigate from signin to signup page` | `tests/simple-test.spec.ts` |

## Group 2: Account Creation & Validation (`account`)

| Number | Abbreviation | Playwright Test Name | File |
|--------|--------------|---------------------|------|
| 2.1 | `form-fields` | `should display signup form with all required fields` | `tests/e2e/account-creation.spec.ts` |
| 2.2 | `req-fields` | `should require all fields to be filled` | `tests/e2e/account-validation.spec.ts` |
| 2.3 | `email-format` | `should validate email format` | `tests/e2e/account-validation.spec.ts` |
| 2.4 | `pwd-length` | `should validate password minimum length` | `tests/e2e/account-validation.spec.ts` |
| 2.5 | `pwd-min-ok` | `should accept password with exactly 6 characters` | `tests/e2e/account-validation.spec.ts` |
| 2.6 | `pwd-match` | `should validate password confirmation match` | `tests/e2e/account-validation.spec.ts` |
| 2.7 | `pwd-short` | `should prevent submission when password is too short` | `tests/e2e/account-creation.spec.ts` |
| 2.8 | `pwd-mismatch` | `should prevent submission when passwords do not match` | `tests/e2e/account-creation.spec.ts` |
| 2.9 | `name-special` | `should handle special characters in name` | `tests/e2e/account-validation.spec.ts` |
| 2.10 | `email-long` | `should handle long email addresses` | `tests/e2e/account-validation.spec.ts` |
| 2.11 | `submit-load` | `should disable submit button while loading` | `tests/e2e/account-validation.spec.ts` |
| 2.12 | `pwd-toggle` | `should toggle password visibility` | `tests/e2e/account-creation.spec.ts` |
| 2.13 | `create-ok` | `should successfully create account with valid data` | `tests/e2e/account-creation.spec.ts` |
| 2.14 | `dup-email-ui` | `should prevent submission for duplicate email` | `tests/e2e/account-creation.spec.ts` |
| 2.15 | `nav-up-in2` | `should navigate to sign in page from signup page` | `tests/e2e/account-creation.spec.ts` |
| 2.16 | `create-msg` | `should successfully create a new user account` | `tests/e2e/user-creation-confirmation.spec.ts` |
| 2.17 | `dup-signup` | `should prevent submission for duplicate email during signup` | `tests/e2e/user-creation-confirmation.spec.ts` |
| 2.18 | `token-inv-page` | `should display confirmation page with invalid token` | `tests/e2e/user-creation-confirmation.spec.ts` |
| 2.19 | `token-miss-page` | `should display confirmation page with missing token` | `tests/e2e/user-creation-confirmation.spec.ts` |
| 2.20 | `nav-success` | `should navigate from signup success to signin page` | `tests/e2e/user-creation-confirmation.spec.ts` |

## Group 3: User Authentication & Session (`auth`)

| Number | Abbreviation | Playwright Test Name | File |
|--------|--------------|---------------------|------|
| 3.1 | `signin-ok` | `should sign in with valid credentials` | `tests/e2e/authentication.spec.ts` |
| 3.2 | `signin-bad-email` | `should show error with invalid email` | `tests/e2e/authentication.spec.ts` |
| 3.3 | `signin-bad-pwd` | `should show error with invalid password` | `tests/e2e/authentication.spec.ts` |
| 3.4 | `session-refresh` | `should maintain session after page refresh` | `tests/e2e/authentication.spec.ts` |
| 3.5 | `protect-route` | `should redirect to sign-in when accessing protected route without authentication` | `tests/e2e/authentication.spec.ts` |
| 3.6 | `nav-in-up2` | `should navigate to signup page from signin page` | `tests/e2e/authentication.spec.ts` |
| 3.7 | `nav-up-in3` | `should navigate to signin page from signup page` | `tests/e2e/authentication.spec.ts` |

## Group 4: Bracket Creation & Management (`bracket`)

| Number | Abbreviation | Playwright Test Name | File |
|--------|--------------|---------------------|------|
| 4.1 | `bracket-land` | `should navigate to bracket landing page` | `tests/e2e/bracket-creation.spec.ts` |
| 4.2 | `bracket-new` | `should create a new bracket` | `tests/e2e/bracket-creation.spec.ts` |
| 4.3 | `bracket-save` | `should allow saving bracket (validation handled by server)` | `tests/e2e/bracket-creation.spec.ts` |

## Group 5: Backend API Validation (`api`)

| Number | Abbreviation | Playwright Test Name | File |
|--------|--------------|---------------------|------|
| 5.1 | `api-create` | `should create a new user account successfully` | `tests/api/auth.spec.ts` |
| 5.2 | `api-missing` | `should reject registration with missing fields` | `tests/api/auth.spec.ts` |
| 5.3 | `api-pwd-short` | `should reject registration with password too short` | `tests/api/auth.spec.ts` |
| 5.4 | `api-dup-email` | `should reject duplicate email registration` | `tests/api/auth.spec.ts` |
| 5.5 | `api-inv-email` | `should reject invalid email format` | `tests/api/auth.spec.ts` |
| 5.6 | `api-userid` | `should successfully create user and return userId` | `tests/api/auth.spec.ts` |
| 5.7 | `api-confirm-req` | `should require email confirmation after registration` | `tests/api/auth.spec.ts` |
| 5.8 | `api-token-inv` | `should reject confirmation with invalid token` | `tests/api/auth.spec.ts` |
| 5.9 | `api-token-miss` | `should reject confirmation with missing token` | `tests/api/auth.spec.ts` |

## Running Tests

### By Number
```bash
npx playwright test -g "should load the homepage"          # Test 1.1
npx playwright test -g "should sign in with valid credentials"  # Test 3.1
```

### By Abbreviation (via npm scripts)
```bash
npm run test:1.1          # Test 1.1 (homepage)
npm run test:homepage      # Test 1.1 (by abbreviation)
npm run test:3.1          # Test 3.1 (signin-ok)
npm run test:signin-ok    # Test 3.1 (by abbreviation)
```


