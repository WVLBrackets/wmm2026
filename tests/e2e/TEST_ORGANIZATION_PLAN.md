# Test Organization Plan for WMM2026 Application

## Overview

This document outlines the recommended test organization structure for testing the main application features, focusing on logged-in user workflows, particularly bracket creation and management.

## Test Structure

```
tests/
├── api/                    # API endpoint tests
│   └── auth.spec.ts        # ✅ Already exists
│
├── e2e/                    # End-to-end UI tests
│   ├── account-creation.spec.ts        # ✅ Already exists
│   ├── account-validation.spec.ts      # ✅ Already exists
│   ├── user-creation-confirmation.spec.ts  # ✅ Already exists
│   ├── authentication.spec.ts          # 🆕 Sign in, logout, session
│   ├── bracket-creation.spec.ts        # 🆕 Create new brackets
│   ├── bracket-management.spec.ts      # 🆕 Edit, copy, delete brackets
│   ├── bracket-submission.spec.ts       # 🆕 Submit brackets
│   ├── bracket-viewing.spec.ts         # 🆕 View submitted brackets
│   ├── navigation.spec.ts              # 🆕 Navigation between pages
│   └── public-pages.spec.ts            # 🆕 Standings, Hall of Fame, etc.
│
├── fixtures/
│   ├── test-helpers.ts     # ✅ Already exists
│   ├── test-data.ts        # ✅ Already exists
│   └── auth-helpers.ts     # 🆕 Authentication helper functions
│
└── simple-test.spec.ts     # ✅ Already exists
```

## Test Organization Principles

### 1. **Feature-Based Organization**
- Group tests by user-facing features (bracket creation, bracket management, etc.)
- Each test file focuses on one major feature area
- Makes it easy to find and maintain tests

### 2. **Authentication Helpers**
- Create reusable authentication helpers to sign in users
- Avoid duplicating login logic across tests
- Use test-specific user accounts

### 3. **Test Data Management**
- Use unique test data (timestamps, random IDs)
- Clean up test data after tests (or use cleanup scripts)
- Isolate tests from each other

### 4. **Simple, Focused Tests**
- Each test should verify one specific behavior
- Avoid complex test scenarios that are hard to debug
- Focus on user actions, not implementation details

## Recommended Test Files

### 1. `tests/fixtures/auth-helpers.ts` (NEW)
**Purpose:** Reusable authentication helpers

**Functions:**
- `signInUser(page, email, password)` - Sign in a user via UI
- `createTestUser(request)` - Create a test user via API
- `createAndSignInUser(page, request)` - Create user and sign in (combined)
- `signOutUser(page)` - Sign out current user

### 2. `tests/e2e/authentication.spec.ts` (NEW)
**Purpose:** Test sign-in, sign-out, and session management

**Tests:**
- Sign in with valid credentials
- Sign in with invalid credentials
- Sign out
- Session persistence (refresh page, still logged in)
- Protected route access (redirect if not logged in)

### 3. `tests/e2e/bracket-creation.spec.ts` (NEW)
**Purpose:** Test creating new brackets

**Tests:**
- Navigate to bracket creation page
- Create a new bracket with valid data
- Save draft bracket
- Validate required fields (entry name, picks)
- Handle bracket creation errors

### 4. `tests/e2e/bracket-management.spec.ts` (NEW)
**Purpose:** Test editing, copying, and deleting brackets

**Tests:**
- Edit existing bracket
- Copy existing bracket
- Delete bracket (with confirmation)
- View bracket list
- Navigate between brackets

### 5. `tests/e2e/bracket-submission.spec.ts` (NEW)
**Purpose:** Test submitting brackets

**Tests:**
- Submit a complete bracket
- Validate submission requirements
- Handle submission deadline
- Verify submission success

### 6. `tests/e2e/bracket-viewing.spec.ts` (NEW)
**Purpose:** Test viewing submitted brackets

**Tests:**
- View submitted bracket
- Print bracket
- Email bracket PDF
- View bracket details

### 7. `tests/e2e/navigation.spec.ts` (NEW)
**Purpose:** Test navigation between pages

**Tests:**
- Navigate from home to bracket page
- Navigate from bracket to standings
- Navigate from standings to hall of fame
- Mobile navigation menu

### 8. `tests/e2e/public-pages.spec.ts` (NEW)
**Purpose:** Test public pages (no login required)

**Tests:**
- View standings page
- View hall of fame
- View rules page
- View info page
- View prizes page

## Test Execution Strategy

### Run All Tests
```powershell
npm test
```

### Run Specific Feature Tests
```powershell
# Bracket-related tests only
npx playwright test tests/e2e/bracket-*.spec.ts

# Authentication tests only
npx playwright test tests/e2e/authentication.spec.ts
```

### Run Tests for Logged-In Users
```powershell
# All bracket and management tests (requires auth)
npx playwright test tests/e2e/bracket-*.spec.ts tests/e2e/authentication.spec.ts
```

## Authentication Helper Pattern

The authentication helpers use standard HTML selectors (input[type="email"], etc.) since test IDs may not be present on all pages. If you prefer more stable selectors, consider adding `data-testid` attributes to form elements.

```typescript
// tests/fixtures/auth-helpers.ts
export async function signInUser(
  page: Page, 
  email: string, 
  password: string
): Promise<void> {
  await page.goto('/auth/signin');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for successful sign-in (redirect away from signin page)
  await page.waitForURL(/^(?!.*\/auth\/signin)/);
}
```

## Test Data Strategy

### Use Test-Specific Users
- Create users with unique emails: `bracket-test-${Date.now()}@example.com`
- Clean up after tests (or use cleanup script)
- Don't reuse users across tests to avoid conflicts

### Bracket Test Data
- Use minimal bracket data for tests (just enough to test functionality)
- Don't create full 64-team brackets unless testing that specific feature
- Use mock/simplified tournament data when possible

## Priority Order for Implementation

1. **Authentication helpers** - Foundation for all logged-in tests
2. **Authentication tests** - Verify sign-in works
3. **Bracket creation tests** - Core feature
4. **Bracket management tests** - Edit, copy, delete
5. **Bracket submission tests** - Final step
6. **Navigation tests** - User flow
7. **Public pages tests** - Lower priority

## Best Practices

1. **Keep tests simple** - One action per test
2. **Use test IDs** - Stable selectors
3. **Wait for actions** - Don't use fixed timeouts
4. **Clean up data** - Remove test brackets/users
5. **Isolate tests** - Each test should be independent
6. **Focus on behavior** - Test what users do, not implementation

## Implementation Notes

### Test IDs
- The sign-in page currently doesn't have `data-testid` attributes
- The auth helpers use standard HTML selectors (input[type="email"], etc.)
- Consider adding test IDs to form elements for more stable selectors:
  - `data-testid="signin-email-input"`
  - `data-testid="signin-password-input"`
  - `data-testid="signin-submit-button"`

### Email Confirmation
- Test users may need email confirmation before they can sign in
- You may need to:
  1. Add a test-specific confirmation endpoint (for test environment only)
  2. Or manually confirm test users
  3. Or skip confirmation for test users in test environment

## Next Steps

1. ✅ Create `auth-helpers.ts` with sign-in functions (DONE)
2. Create `authentication.spec.ts` to test sign-in flow
3. Add test IDs to sign-in form (optional but recommended)
4. Create `bracket-creation.spec.ts` for bracket creation
5. Build out remaining test files incrementally

