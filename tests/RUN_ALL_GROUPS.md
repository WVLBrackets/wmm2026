# Running All Five Test Groups

## Quick Reference

### Option 1: Run All Tests at Once (Simplest)
```powershell
$env:TEST_ENV='staging'; npx playwright test
```

**What it does:**
- Runs all 5 groups
- Both browsers (Chromium + Firefox)
- All tests in parallel
- Single summary at the end

**Best for:** Quick full test run, CI/CD

---

### Option 2: Run Groups Sequentially (Recommended for Debugging)
```powershell
# Run each group one at a time
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 1
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 2
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 3
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 4
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 5
```

**What it does:**
- Runs each group separately
- Shows results for each group
- Both browsers per group
- Easier to identify which group has issues

**Best for:** Debugging, seeing group-by-group results

---

### Option 3: Run All Groups in One Command (PowerShell)
```powershell
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 1; node scripts/run-test-by-id.js 2; node scripts/run-test-by-id.js 3; node scripts/run-test-by-id.js 4; node scripts/run-test-by-id.js 5
```

**What it does:**
- Runs all groups sequentially in one command
- Shows group-by-group results
- Stops if a group fails (unless you add error handling)

**Best for:** Running everything but seeing group results

---

### Option 4: Using Abbreviations
```powershell
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js connect
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js account
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js auth
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js bracket
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js api
```

Same as Option 2, but using group abbreviations.

---

## For Production

To run against production instead of staging:

```powershell
$env:TEST_ENV='production'; npx playwright test
```

Or:
```powershell
$env:TEST_ENV='production'; node scripts/run-test-by-id.js 1
$env:TEST_ENV='production'; node scripts/run-test-by-id.js 2
# ... etc
```

---

## What Gets Tested

| Group | Name | Tests | Browsers |
|-------|------|-------|----------|
| 1 | connect | 5 | Chromium + Firefox |
| 2 | account | 20 | Chromium + Firefox |
| 3 | auth | 7 | Chromium + Firefox |
| 4 | bracket | 3 | Chromium + Firefox |
| 5 | api | 9 | Chromium + Firefox |
| **Total** | | **44 tests** | **88 test runs** (44 × 2 browsers) |

---

## Expected Runtime

- **Option 1 (Parallel):** ~5-10 minutes (all tests run in parallel)
- **Option 2 (Sequential):** ~10-15 minutes (groups run one after another)

---

## Recommendation

**For first-time full run:** Use **Option 2** (sequential) so you can see which group has issues.

**For regular runs:** Use **Option 1** (all at once) for speed.


