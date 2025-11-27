# Group to File Mapping

This document clearly maps test groups (by number and abbreviation) to their actual test files.

## Group 1: Basic Connectivity & Navigation (`connect`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 1 | Basic Connectivity & Navigation | `connect` | `tests/simple-test.spec.ts` |

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 1
npm run test:group:1

# Using abbreviation
node scripts/run-test-by-id.js connect
npm run test:connect

# Direct file (not recommended - use group ID instead)
npx playwright test tests/simple-test.spec.ts
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
| 4 | Bracket Creation & Management | `bracket` | `tests/e2e/bracket-creation.spec.ts`<br>`tests/e2e/bracket-*.spec.ts` |

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 4
npm run test:group:4

# Using abbreviation
node scripts/run-test-by-id.js bracket
npm run test:bracket

# Direct files (not recommended - use group ID instead)
npx playwright test tests/e2e/bracket-*.spec.ts
```

## Group 5: Backend API Validation (`api`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 5 | Backend API Validation | `api` | `tests/api/auth.spec.ts`<br>`tests/api/**/*.spec.ts` |

**Execution:**
```bash
# Using group number
node scripts/run-test-by-id.js 5
npm run test:group:5

# Using abbreviation
node scripts/run-test-by-id.js api
npm run test:api

# Direct files (not recommended - use group ID instead)
npx playwright test tests/api
```

## Summary Table

| Group | Number | Abbreviation | File Pattern |
|-------|--------|--------------|--------------|
| Basic Connectivity & Navigation | 1 | `connect` | `tests/simple-test.spec.ts` |
| Account Creation & Validation | 2 | `account` | `tests/e2e/account-*.spec.ts` |
| User Authentication & Session | 3 | `auth` | `tests/e2e/authentication.spec.ts` |
| Bracket Creation & Management | 4 | `bracket` | `tests/e2e/bracket-*.spec.ts` |
| Backend API Validation | 5 | `api` | `tests/api` |

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


