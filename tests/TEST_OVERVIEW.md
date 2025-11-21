# Test Suite Overview

This document provides a comprehensive overview of all 35 tests in the Playwright test suite, organized by test file and category.

## Test Organization

The test suite is organized into 5 test files, running on Chromium (35 tests total):

1. **Simple Tests** (`simple-test.spec.ts`) - 5 tests
2. **Account Creation E2E** (`e2e/account-creation.spec.ts`) - 7 tests
3. **Account Validation E2E** (`e2e/account-validation.spec.ts`) - 8 tests
4. **User Creation & Confirmation E2E** (`e2e/user-creation-confirmation.spec.ts`) - 6 tests
5. **Auth API Tests** (`api/auth.spec.ts`) - 9 tests

---

## 1. Simple Tests (`tests/simple-test.spec.ts`)

**Purpose:** Basic smoke tests to verify pages load and navigation works.

### Tests (5 total):

1. **should load the homepage**
   - Verifies homepage loads correctly
   - Checks URL is correct (not redirected to Vercel login)
   - Validates page title and content exist

2. **should load the signup page**
   - Verifies signup page loads correctly
   - Checks all form fields are visible (name, email, password, confirm password, submit button)
   - Validates page title and URL

3. **should load the signin page**
   - Verifies signin page loads correctly
   - Checks form fields are visible (email, password, sign in button)
   - Validates page title and URL

4. **should navigate from signup to signin page**
   - Tests clicking "sign in to your existing account" link
   - Verifies navigation to signin page
   - Validates signin page content is visible

5. **should navigate from signin to signup page**
   - Tests clicking "create a new account" link
   - Verifies navigation to signup page
   - Validates signup page content is visible

---

## 2. Account Creation E2E (`tests/e2e/account-creation.spec.ts`)

**Purpose:** End-to-end tests for the account creation (signup) flow via UI.

### Tests (7 total):

1. **should display signup form with all required fields**
   - Verifies all form fields are visible using stable test IDs
   - Checks: name, email, password, confirm password, submit button

2. **should show error when passwords do not match**
   - Fills form with mismatched passwords
   - Verifies error message appears
   - Validates error message text

3. **should show error when password is too short**
   - Fills form with password less than 6 characters
   - Verifies error message appears
   - Validates error message text

4. **should successfully create account with valid data**
   - Fills form with valid data
   - Submits form
   - Verifies success message appears

5. **should show error for duplicate email**
   - Creates user via API first
   - Attempts to create duplicate via UI
   - Verifies error message appears

6. **should toggle password visibility**
   - Fills password field
   - Clicks visibility toggle button
   - Verifies password type changes from 'password' to 'text'

7. **should navigate to sign in page from signup page**
   - Clicks "sign in to your existing account" link
   - Verifies navigation to signin page

---

## 3. Account Validation E2E (`tests/e2e/account-validation.spec.ts`)

**Purpose:** Tests for form validation and edge cases in account creation.

### Tests (8 total):

1. **should show error for empty name field**
   - Attempts to submit form with empty name
   - Verifies browser validation prevents submission

2. **should show error for invalid email format**
   - Attempts to submit form with invalid email
   - Verifies browser validation prevents submission

3. **should show error for non-matching passwords**
   - Fills form with mismatched passwords
   - Verifies error message appears

4. **should show error for password less than 6 characters**
   - Fills form with short password
   - Verifies error message appears

5. **should handle special characters in name field**
   - Fills name with special characters
   - Verifies form accepts and submits successfully

6. **should show loading state on submit**
   - Intercepts API call to simulate delay
   - Verifies loading indicator appears
   - Verifies submit button is disabled during loading

---

## 4. User Creation & Confirmation E2E (`tests/e2e/user-creation-confirmation.spec.ts`)

**Purpose:** Tests for user creation and email confirmation flow.

### Tests (6 total):

1. **should successfully create a new user account**
   - Fills and submits signup form
   - Waits for API response
   - Verifies success message appears with user email

2. **should show error for duplicate email during signup**
   - Creates user via API first
   - Attempts to create duplicate via UI
   - Verifies error message appears

3. **should display confirmation page with invalid token**
   - Navigates to confirmation page with invalid token
   - Verifies error state is displayed
   - Validates error handling

4. **should display confirmation page with missing token**
   - Navigates to confirmation page without token
   - Verifies error message appears
   - Validates error handling

5. **should navigate from signup success to signin page**
   - Creates account successfully
   - Clicks link to navigate to signin
   - Verifies signin page loads correctly

6. **should complete full confirmation flow** ⚠️ **SKIPPED**
   - **Status:** Intentionally skipped for security reasons
   - **Reason:** Would require API endpoint to retrieve confirmation tokens (security risk)
   - **Alternative:** Test confirmation manually or via admin interface

---

## 5. Auth API Tests (`tests/api/auth.spec.ts`)

**Purpose:** API-level tests for authentication endpoints (no browser UI).

### Tests (9 total):

1. **should create a new user account successfully**
   - POST to `/api/auth/register` with valid data
   - Verifies 200 response
   - Validates response contains userId and success message

2. **should reject registration with missing fields**
   - POST with missing required fields
   - Verifies 400 response
   - Validates error message mentions "required"

3. **should reject registration with password too short**
   - POST with password less than 6 characters
   - Verifies 400 response
   - Validates error message mentions "6 characters"

4. **should reject duplicate email registration**
   - Creates user via API
   - Attempts to create duplicate
   - Verifies 409 response
   - Validates error message mentions "already exists"

5. **should reject invalid email format**
   - POST with invalid email format
   - Verifies 400, 409, or 500 response (depending on validation layer)
   - Validates error is returned

6. **should successfully create user and return userId**
   - POST with valid data
   - Verifies userId is returned and is a string
   - Validates response structure

7. **should require email confirmation after registration**
   - POST to create user
   - Verifies response message indicates email confirmation is required
   - Validates message mentions "check your email" or "confirm"

8. **should reject confirmation with invalid token**
   - POST to `/api/auth/confirm` with invalid token
   - Verifies 400 response
   - Validates error message mentions "invalid" or "expired"

9. **should reject confirmation with missing token**
   - POST to `/api/auth/confirm` without token
   - Verifies 400 response
   - Validates error message mentions "token" and "required"

---

## Test Coverage Summary

### What's Covered ✅

- **Page Loading:** Homepage, signup, signin pages
- **Navigation:** Links between auth pages
- **Form Validation:** Client-side validation (password matching, length, email format)
- **Account Creation:** Successful account creation via UI and API
- **Error Handling:** Duplicate emails, validation errors, invalid tokens
- **UI Interactions:** Password visibility toggle, loading states
- **API Endpoints:** Registration, confirmation endpoint validation

### What's Not Covered (Yet) ⏳

- **Sign-in Flow:** Testing actual login with credentials
- **Password Reset:** Forgot password and reset flow
- **Protected Routes:** Testing authentication-required pages
- **Session Management:** Testing session persistence, logout
- **Admin Functions:** Admin-specific workflows
- **Bracket Creation:** User bracket creation and submission
- **Full Confirmation Flow:** End-to-end email confirmation (skipped for security)

---

## Running Tests

### Run All Tests (Chromium Only)
```powershell
npx playwright test --project=chromium
```

### Run Specific Test File
```powershell
npx playwright test tests/simple-test.spec.ts --project=chromium
npx playwright test tests/e2e/account-creation.spec.ts --project=chromium
```

### Run Specific Test
```powershell
npx playwright test -g "should load the homepage" --project=chromium
```

### View Test Report
```powershell
npm run test:report
```

---

## Test Data Management

**Cleanup:** Use the local cleanup script to remove test data:
```powershell
$env:POSTGRES_URL="your-connection-string"
npm run cleanup:test-data:confirm
```

**Test Email Patterns:**
- `test-*@example.com`
- `testuser-*@example.com`
- `test-*@test.com`

---

## Security Notes

- **No API Endpoints for Test Operations:** We avoid creating API endpoints for test operations to prevent security risks
- **Local Scripts Only:** Test data cleanup uses local scripts, not API endpoints
- **Confirmation Flow:** Full confirmation flow test is skipped because it would require a security-risk endpoint

---

## Next Steps for Expansion

1. **Sign-in Flow Tests:** Test login with valid/invalid credentials
2. **Password Reset Tests:** Test forgot password and reset flow
3. **Protected Routes:** Test authentication-required pages redirect properly
4. **Session Tests:** Test session persistence, logout, token expiration
5. **Bracket Tests:** Test bracket creation, editing, submission (non-admin)

