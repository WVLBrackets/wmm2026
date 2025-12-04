# Group to File Mapping

This document clearly maps test groups (by number and abbreviation) to their actual test files.

## Group 1: Basic Connectivity & Navigation (`connect`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 1 | Basic Connectivity & Navigation | `connect` | `tests/simple-test.spec.ts`<br>`tests/e2e/public-pages.spec.ts` |

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 1
npm run test:group:1

# Using abbreviation
node scripts/run-test-by-id.js connect
npm run test:connect

# Direct files (not recommended - use group ID instead)
npx playwright test tests/simple-test.spec.ts tests/e2e/public-pages.spec.ts
```

## Group 2: Account Creation & Validation (`account`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 2 | Account Creation & Validation | `account` | `tests/e2e/account-creation.spec.ts`<br>`tests/e2e/account-validation.spec.ts`<br>`tests/e2e/user-creation-confirmation.spec.ts` |

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 2
npm run test:group:2

# Using abbreviation
node scripts/run-test-by-id.js account
npm run test:account

# Direct files (not recommended - use group ID instead)
npx playwright test tests/e2e/account-*.spec.ts
```

## Group 3: User Authentication & Session (`auth`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 3 | User Authentication & Session | `auth` | `tests/e2e/authentication.spec.ts` |

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 3
npm run test:group:3

# Using abbreviation
node scripts/run-test-by-id.js auth
npm run test:auth

# Direct file (not recommended - use group ID instead)
npx playwright test tests/e2e/authentication.spec.ts
```

## Group 4: Bracket Creation & Management (`bracket`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 4 | Bracket Creation & Management | `bracket` | `tests/e2e/bracket-creation.spec.ts`<br>`tests/e2e/bracket-interaction.spec.ts` |

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 4
npm run test:group:4

# Using abbreviation
node scripts/run-test-by-id.js bracket
npm run test:bracket

# Direct files (not recommended - use group ID instead)
npx playwright test tests/e2e/bracket-creation.spec.ts tests/e2e/bracket-interaction.spec.ts
```

## Group 5: Full Bracket Workflow (`workflow`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 5 | Full Bracket Workflow | `workflow` | `tests/e2e/bracket-full-workflow.spec.ts` |

**Note:** This group contains comprehensive end-to-end tests that simulate complete user workflows. These tests are longer-running (3 min timeout per test) and should be run sparingly.

**Tests Include:**
- Full bracket completion (happy path)
- Pick invalidation logic across regions
- Tiebreaker validation
- Entry name validation
- Submission flow
- Copy bracket functionality
- Read-only submitted bracket view
- Print and Email functionality

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 5
npm run test:group:5

# Using abbreviation
node scripts/run-test-by-id.js workflow
npm run test:workflow

# Direct file (not recommended - use group ID instead)
npx playwright test tests/e2e/bracket-full-workflow.spec.ts
```

## Group 6: Reserved

Group 6 is reserved for future UI-based use case groups.

## Group 7: Password Reset & Sign Out (`pwdlogout`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 7 | Password Reset & Sign Out | `pwdlogout` | `tests/e2e/password-reset.spec.ts`<br>`tests/e2e/sign-out.spec.ts` |

**Tests Include:**
- Forgot password page UI and flow
- Reset password with valid/invalid tokens
- Password validation during reset
- Logout button visibility
- Logout flow and redirect
- Session cleared after logout

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 7
npm run test:group:7

# Using abbreviation
node scripts/run-test-by-id.js pwdlogout
npm run test:pwdlogout

# Direct files (not recommended - use group ID instead)
npx playwright test tests/e2e/password-reset.spec.ts tests/e2e/sign-out.spec.ts
```

## Group 8: Backend API Validation (`api`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 8 | Backend API Validation | `api` | `tests/api/auth.spec.ts`<br>`tests/api/**/*.spec.ts` |

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 8
npm run test:group:8

# Using abbreviation
node scripts/run-test-by-id.js api
npm run test:api

# Direct files (not recommended - use group ID instead)
npx playwright test tests/api
```

## Smoke Test (`smoke`)

| Type | Abbreviation | Test File |
|------|--------------|-----------|
| Smoke Test | `smoke` | `tests/e2e/smoke-test.spec.ts` |

**Purpose:** Quick verification of the critical user journey in a single test (~3-5 minutes).

**Coverage:**
1. Homepage loads successfully
2. Navigate public pages (Info, Hall of Fame, Standings)
3. Sign in with test user
4. Access authenticated bracket page
5. Create a new bracket
6. Fill out the bracket
7. Submit the bracket
8. Verify bracket appears in list

**Execution:**
```bash
# Using abbreviation
node scripts/run-test-by-id.js smoke
npm run test:smoke

# Via GitHub Actions workflow
# Use "Smoke Test" workflow with platform/browser options
```

---

## Summary Table

| Group | Number | Abbreviation | File Pattern |
|-------|--------|--------------|--------------|
| Basic Connectivity & Navigation | 1 | `connect` | `tests/simple-test.spec.ts tests/e2e/public-pages.spec.ts` |
| Account Creation & Validation | 2 | `account` | `tests/e2e/account-*.spec.ts` |
| User Authentication & Session | 3 | `auth` | `tests/e2e/authentication.spec.ts` |
| Bracket Creation & Management | 4 | `bracket` | `tests/e2e/bracket-creation.spec.ts tests/e2e/bracket-interaction.spec.ts` |
| Full Bracket Workflow | 5 | `workflow` | `tests/e2e/bracket-full-workflow.spec.ts` |
| *(Reserved)* | 6 | - | *(Future UI use cases)* |
| Password Reset & Sign Out | 7 | `pwdlogout` | `tests/e2e/password-reset.spec.ts tests/e2e/sign-out.spec.ts` |
| Backend API Validation | 8 | `api` | `tests/api` |
| **Smoke Test** | - | `smoke` | `tests/e2e/smoke-test.spec.ts` |

## Best Practice

**✅ DO:**
- Use group number: `node scripts/run-test-by-id.js 1`
- Use abbreviation: `node scripts/run-test-by-id.js connect`
- Use npm scripts: `npm run test:group:1` or `npm run test:connect`

**❌ DON'T:**
- Reference file names directly in commands
- Use `tests/simple-test.spec.ts` - use `1` or `connect` instead
- Hard-code file paths in scripts or documentation

## Why This Matters

1. **Abstraction**: Users don't need to know file names
2. **Flexibility**: Files can be renamed/reorganized without breaking commands
3. **Clarity**: Group numbers/abbreviations are more meaningful than file names
4. **Consistency**: All execution goes through the organized system


