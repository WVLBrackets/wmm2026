# Testing Recommendations for WMM2026

## Overview

This document provides recommendations for organizing and executing tests for the main application features, with a focus on logged-in user workflows (especially bracket creation and management).

## Recommended Test Organization

### Structure

```
tests/
├── e2e/
│   ├── authentication.spec.ts          # Sign in, logout, session
│   ├── bracket-creation.spec.ts        # Create new brackets
│   ├── bracket-management.spec.ts      # Edit, copy, delete brackets
│   ├── bracket-submission.spec.ts      # Submit brackets
│   ├── bracket-viewing.spec.ts         # View submitted brackets
│   ├── navigation.spec.ts              # Navigation between pages
│   └── public-pages.spec.ts            # Standings, Hall of Fame, etc.
│
└── fixtures/
    └── auth-helpers.ts                  # Authentication helper functions
```

## Key Principles

### 1. **Feature-Based Organization**
- Each test file focuses on one major feature area
- Makes tests easy to find and maintain
- Example: All bracket creation tests in `bracket-creation.spec.ts`

### 2. **Reusable Authentication Helpers**
- Created `tests/fixtures/auth-helpers.ts` with:
  - `signInUser()` - Sign in via UI
  - `createTestUser()` - Create user via API
  - `createAndSignInUser()` - Combined create + sign in
  - `signOutUser()` - Sign out current user

### 3. **Simple, Focused Tests**
- Each test verifies one specific behavior
- Focus on user actions (what users do), not implementation details
- Avoid complex scenarios that are hard to debug

### 4. **Test Data Isolation**
- Use unique test data (timestamps, random IDs)
- Each test should be independent
- Clean up test data after tests (or use cleanup scripts)

## Implementation Priority

### Phase 1: Foundation (Start Here)
1. ✅ **Authentication helpers** - Created `auth-helpers.ts`
2. **Authentication tests** - Test sign-in flow
   - Sign in with valid credentials
   - Sign in with invalid credentials
   - Sign out
   - Session persistence

### Phase 2: Core Features
3. **Bracket creation tests** - Most important feature
   - Navigate to bracket page
   - Create new bracket
   - Save draft bracket
   - Validate required fields

4. **Bracket management tests**
   - Edit existing bracket
   - Copy bracket
   - Delete bracket
   - View bracket list

### Phase 3: Submission & Viewing
5. **Bracket submission tests**
   - Submit complete bracket
   - Validate submission requirements
   - Handle submission deadline

6. **Bracket viewing tests**
   - View submitted bracket
   - Print bracket
   - Email bracket PDF

### Phase 4: Navigation & Public Pages
7. **Navigation tests** - User flow between pages
8. **Public pages tests** - Standings, Hall of Fame, etc.

## Test Execution

### Run All Tests
```powershell
npm test
```

### Run Specific Feature Tests
```powershell
# All bracket-related tests
npx playwright test tests/e2e/bracket-*.spec.ts

# Authentication tests only
npx playwright test tests/e2e/authentication.spec.ts
```

### Run Tests for Logged-In Users
```powershell
# All bracket and management tests (requires auth)
npx playwright test tests/e2e/bracket-*.spec.ts tests/e2e/authentication.spec.ts
```

## Example Test Structure

Here's how a bracket creation test might look:

```typescript
import { test, expect } from '@playwright/test';
import { createAndSignInUser } from '../fixtures/auth-helpers';

test.describe('Bracket Creation', () => {
  test('should create a new bracket', async ({ page, request }) => {
    // Create and sign in a test user
    const email = `bracket-test-${Date.now()}@example.com`;
    await createAndSignInUser(page, request, 'Test User', email, 'password123');
    
    // Navigate to bracket page
    await page.goto('/bracket');
    
    // Create new bracket
    await page.click('button:has-text("New Bracket")');
    
    // Fill in bracket details
    await page.fill('input[name="entryName"]', 'My Test Bracket');
    
    // Make some picks (simplified for example)
    // ... bracket selection logic ...
    
    // Save bracket
    await page.click('button:has-text("Save")');
    
    // Verify bracket was created
    await expect(page.locator('text=My Test Bracket')).toBeVisible();
  });
});
```

## Important Notes

### Test IDs
- The sign-in page currently doesn't have `data-testid` attributes
- Auth helpers use standard HTML selectors (input[type="email"], etc.)
- **Recommendation:** Add test IDs to form elements for more stable selectors:
  - `data-testid="signin-email-input"`
  - `data-testid="signin-password-input"`
  - `data-testid="signin-submit-button"`

### Email Confirmation
- Test users may need email confirmation before they can sign in
- Options:
  1. Add a test-specific confirmation endpoint (test environment only)
  2. Manually confirm test users
  3. Skip confirmation for test users in test environment

### Bracket Test Data
- Use minimal bracket data for tests (just enough to test functionality)
- Don't create full 64-team brackets unless testing that specific feature
- Use mock/simplified tournament data when possible

## Best Practices

1. **Keep tests simple** - One action per test
2. **Use stable selectors** - Prefer test IDs or role-based selectors
3. **Wait for actions** - Use Playwright's auto-wait, avoid fixed timeouts
4. **Clean up data** - Remove test brackets/users after tests
5. **Isolate tests** - Each test should be independent
6. **Focus on behavior** - Test what users do, not implementation

## Next Steps

1. Review the test organization plan: `tests/e2e/TEST_ORGANIZATION_PLAN.md`
2. Start with authentication tests to verify sign-in works
3. Build bracket creation tests (most important feature)
4. Expand to other features incrementally

## Questions to Consider

Before implementing tests, consider:

1. **Test IDs:** Do you want to add `data-testid` attributes to form elements for more stable selectors?
2. **Email Confirmation:** How should test users handle email confirmation?
3. **Test Data:** What's the minimum bracket data needed for tests?
4. **Test Environment:** Are there any test-specific configurations needed?




