# Test Groups Reference

## Group Organization

Tests are organized into 5 groups based on user experience flow and dependencies. Each group can be executed standalone.

| Number | Name | Abbreviation | Test Files | Description |
|--------|------|--------------|------------|-------------|
| 1 | Basic Connectivity & Navigation | `connect` | `tests/simple-test.spec.ts`<br>`tests/e2e/public-pages.spec.ts` | Verifies pages load correctly and navigation works. No authentication required. Tests all public pages including info, rules, prizes, payments, hall-of-fame, standings, and password reset pages. |
| 2 | Account Creation & Validation | `account` | `tests/e2e/account-*.spec.ts` | Tests the complete account creation flow including form validation, password requirements, and duplicate email handling. Creates its own test users, no dependencies. |
| 3 | User Authentication & Session | `auth` | `tests/e2e/authentication.spec.ts` | Tests sign-in, sign-out, session persistence, and protected route access. Requires a pre-existing confirmed test user account. |
| 4 | Bracket Creation & Management | `bracket` | `tests/e2e/bracket-*.spec.ts` | Tests creating, saving, and managing brackets. Requires authenticated user session. Tests core bracket functionality for logged-in users. |
| 5 | Backend API Validation | `api` | `tests/api` | Direct API endpoint testing without browser UI. Validates backend logic, validation rules, and error handling. Can run independently at any time. |

**See `tests/GROUP_TO_FILE_MAPPING.md` for detailed file mappings.**

## Group Execution Order

**Recommended order:** 1 → 2 → 3 → 4 (5 can run anytime)

- **Group 1** has no dependencies
- **Group 2** has no dependencies (creates its own users)
- **Group 3** requires test user to exist (from Group 2 or pre-created)
- **Group 4** requires authenticated session (from Group 3)
- **Group 5** can run independently (API tests)

## Running Groups

### Recommended: Use Group Numbers or Abbreviations

```bash
# By number (recommended)
node scripts/run-test-by-id.js 1          # Group 1 (connect)
node scripts/run-test-by-id.js 2          # Group 2 (account)
node scripts/run-test-by-id.js 3          # Group 3 (auth)
node scripts/run-test-by-id.js 4          # Group 4 (bracket)
node scripts/run-test-by-id.js 5          # Group 5 (api)

# By abbreviation (recommended)
node scripts/run-test-by-id.js connect     # Group 1
node scripts/run-test-by-id.js account     # Group 2
node scripts/run-test-by-id.js auth        # Group 3
node scripts/run-test-by-id.js bracket    # Group 4
node scripts/run-test-by-id.js api         # Group 5

# With environment
cross-env TEST_ENV=staging node scripts/run-test-by-id.js 1
cross-env TEST_ENV=production node scripts/run-test-by-id.js connect
```

### Alternative: npm Scripts

```bash
# By number
npm run test:group:1          # Group 1 (connect)
npm run test:group:2          # Group 2 (account)
npm run test:group:3          # Group 3 (auth)
npm run test:group:4          # Group 4 (bracket)
npm run test:group:5          # Group 5 (api)

# By abbreviation
npm run test:connect          # Group 1
npm run test:account          # Group 2
npm run test:auth             # Group 3
npm run test:bracket          # Group 4
npm run test:api              # Group 5
```

### With Browser Selection

```bash
# Chrome only
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 1 -- --project=chromium

# Firefox only
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js connect -- --project=firefox
```

**Note:** Always use group numbers (1, 2, 3, 4, 5) or abbreviations (`connect`, `account`, `auth`, `bracket`, `api`) rather than file names. This keeps the system organized and flexible.

