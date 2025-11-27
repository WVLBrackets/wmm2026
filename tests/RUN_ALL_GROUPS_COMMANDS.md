# Commands to Run All 5 Groups in Staging and Production

## Step-by-Step Commands (PowerShell)

Run these commands **one at a time** in your PowerShell terminal.

### Part 1: Staging Environment (Both Browsers)

**Command 1: Group 1 (connect) - Staging**
```powershell
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js connect
```

**Command 2: Group 2 (account) - Staging**
```powershell
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js account
```

**Command 3: Group 3 (auth) - Staging**
```powershell
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js auth
```

**Command 4: Group 4 (bracket) - Staging**
```powershell
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js bracket
```

**Command 5: Group 5 (api) - Staging**
```powershell
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js api
```

### Part 2: Production Environment (Both Browsers)

**Command 6: Group 1 (connect) - Production**
```powershell
$env:TEST_ENV='production'; node scripts/run-test-by-id.js connect
```

**Command 7: Group 2 (account) - Production**
```powershell
$env:TEST_ENV='production'; node scripts/run-test-by-id.js account
```

**Command 8: Group 3 (auth) - Production**
```powershell
$env:TEST_ENV='production'; node scripts/run-test-by-id.js auth
```

**Command 9: Group 4 (bracket) - Production**
```powershell
$env:TEST_ENV='production'; node scripts/run-test-by-id.js bracket
```

**Command 10: Group 5 (api) - Production**
```powershell
$env:TEST_ENV='production'; node scripts/run-test-by-id.js api
```

## What Each Command Does

Each command will:
1. Set the environment (staging or production)
2. Run the specified group using its abbreviation
3. Execute tests on **both browsers** (chromium and firefox) by default
4. Display results for each browser

## Expected Output

For each command, you'll see:
```
📋 Running Group <abbreviation> (<number>)
   Files: <test files>
   Environment: <staging or production>
   
Running X tests using 2 workers

[chromium] ✓ Test 1
[chromium] ✓ Test 2
[firefox] ✓ Test 1
[firefox] ✓ Test 2
...
```

## Notes

- **Both browsers run automatically** - Playwright runs all configured browsers (chromium and firefox) unless you specify `--project=chromium` or `--project=firefox`
- **Wait for each to complete** - Run commands one at a time and wait for results
- **Environment persists** - The `$env:TEST_ENV` setting applies only to that command
- **Total tests** - Each group runs on both browsers, so you'll see double the number of individual tests

## Quick Copy-Paste (All 10 Commands)

```powershell
# Staging
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js connect
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js account
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js auth
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js bracket
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js api

# Production
$env:TEST_ENV='production'; node scripts/run-test-by-id.js connect
$env:TEST_ENV='production'; node scripts/run-test-by-id.js account
$env:TEST_ENV='production'; node scripts/run-test-by-id.js auth
$env:TEST_ENV='production'; node scripts/run-test-by-id.js bracket
$env:TEST_ENV='production'; node scripts/run-test-by-id.js api
```


