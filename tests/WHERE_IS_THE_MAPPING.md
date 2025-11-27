# Where Is The Mapping?

## Quick Answer

The mapping chain `connect = Group 1 = simple-test.spec.ts` is defined in **two places**:

1. **Source of Truth (Code):** `scripts/run-test-by-id.js` - Lines 117-128
2. **Documentation:** `tests/GROUP_TO_FILE_MAPPING.md` - Complete reference table

## Detailed Locations

### 1. The Actual Mapping (Source Code)

**File:** `scripts/run-test-by-id.js`  
**Lines:** 117-128

```javascript
// Group mappings: number/abbreviation -> file pattern
const groupMapping = {
  '1': 'tests/simple-test.spec.ts',
  'connect': 'tests/simple-test.spec.ts',  // ← Here!
  '2': 'tests/e2e/account-*.spec.ts',
  'account': 'tests/e2e/account-*.spec.ts',
  '3': 'tests/e2e/authentication.spec.ts',
  'auth': 'tests/e2e/authentication.spec.ts',
  '4': 'tests/e2e/bracket-*.spec.ts',
  'bracket': 'tests/e2e/bracket-*.spec.ts',
  '5': 'tests/api',
  'api': 'tests/api',
};
```

**This is the source of truth** - the actual code that executes when you run commands.

### 2. Documentation Reference

**File:** `tests/GROUP_TO_FILE_MAPPING.md`  
**Lines:** 5-23

```markdown
## Group 1: Basic Connectivity & Navigation (`connect`)

| Group ID | Name | Abbreviation | Test Files |
|----------|------|--------------|------------|
| 1 | Basic Connectivity & Navigation | `connect` | `tests/simple-test.spec.ts` |
```

**This is the human-readable reference** - easy to view and understand.

### 3. Quick Reference Table

**File:** `tests/TEST_GROUPS_REFERENCE.md`  
**Lines:** 7-13

```markdown
| Number | Name | Abbreviation | Test Files | Description |
|--------|------|--------------|------------|-------------|
| 1 | Basic Connectivity & Navigation | `connect` | `tests/simple-test.spec.ts` | ... |
```

**This is the summary table** - shows all groups at a glance.

## The Complete Mapping Chain

```
┌─────────────────────────────────────────────────────────┐
│ User Input: "connect"                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ scripts/run-test-by-id.js                                │
│ groupMapping['connect']                                  │
│ → 'tests/simple-test.spec.ts'                           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Playwright Command:                                      │
│ npx playwright test tests/simple-test.spec.ts           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 5 tests executed from simple-test.spec.ts               │
└─────────────────────────────────────────────────────────┘
```

## How to View/Edit the Mapping

### To View:
1. **Quick reference:** Open `tests/GROUP_TO_FILE_MAPPING.md`
2. **Summary table:** Open `tests/TEST_GROUPS_REFERENCE.md`
3. **Source code:** Open `scripts/run-test-by-id.js` (lines 117-128)

### To Edit:
1. **Edit the mapping:** Modify `scripts/run-test-by-id.js` (lines 117-128)
2. **Update documentation:** Update `tests/GROUP_TO_FILE_MAPPING.md`
3. **Update reference:** Update `tests/TEST_GROUPS_REFERENCE.md`

## All Mappings in One Place

| Group | Number | Abbreviation | File(s) | Location in Code |
|-------|--------|--------------|---------|------------------|
| Basic Connectivity | 1 | `connect` | `tests/simple-test.spec.ts` | Line 118-119 |
| Account Creation | 2 | `account` | `tests/e2e/account-*.spec.ts` | Line 120-121 |
| Authentication | 3 | `auth` | `tests/e2e/authentication.spec.ts` | Line 122-123 |
| Bracket Management | 4 | `bracket` | `tests/e2e/bracket-*.spec.ts` | Line 124-125 |
| API Validation | 5 | `api` | `tests/api` | Line 126-127 |

## Best Practice

**✅ DO:**
- View mappings in `tests/GROUP_TO_FILE_MAPPING.md` (human-readable)
- Edit mappings in `scripts/run-test-by-id.js` (source of truth)
- Keep both in sync when making changes

**❌ DON'T:**
- Hard-code file paths in workflows or scripts
- Reference file names directly - use group numbers/abbreviations instead


