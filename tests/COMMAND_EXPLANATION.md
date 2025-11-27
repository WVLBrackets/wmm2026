# Command Explanation

## Breaking Down the Command

```bash
npx cross-env TEST_ENV=staging npx playwright test -g "should prevent submission for duplicate email" --project=firefox
```

### Part by Part:

1. **`npx cross-env TEST_ENV=staging`**
   - `npx` - Runs npm packages without installing globally
   - `cross-env` - Cross-platform way to set environment variables (works on Windows, Mac, Linux)
   - `TEST_ENV=staging` - Sets the environment to staging (determines which URL to test)

2. **`npx playwright test`**
   - Runs Playwright test runner
   - Executes all tests by default (unless filtered)

3. **`-g "should prevent submission for duplicate email"`**
   - `-g` = "grep" - filters tests by name pattern
   - Matches any test whose name contains this text
   - This is the **original Playwright way** to run specific tests

4. **`--project=firefox`**
   - `--project` - Specifies which browser to use
   - `firefox` - Runs only Firefox (instead of both Chromium and Firefox)
   - Other options: `chromium`, or omit to run both

### Additional Options You Can Add:

- **`--headed`** - Opens visible browser (instead of headless)
- **`--debug`** - Runs in debug mode (slower, more verbose)
- **`--ui`** - Opens Playwright UI mode
- **`--workers=1`** - Runs tests sequentially (instead of parallel)

## Easier Way: Using Test Numbers/Abbreviations

The test "should prevent submission for duplicate email" is:
- **Test Number:** `2.14`
- **Abbreviation:** `dup-email-ui`

### Simple Command (Using Helper Script):

```powershell
# Run test 2.14 in Firefox (headless)
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 2.14 --project=firefox

# Or by abbreviation
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js dup-email-ui --project=firefox

# Run in Firefox with headed mode
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 2.14 --project=firefox --headed

# Or by abbreviation with headed
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js dup-email-ui --project=firefox --headed
```

### Even Simpler: Using npm Scripts

```powershell
# Set environment first
$env:TEST_ENV='staging'

# Then run (if npm script exists)
npm run test:2.14 -- --project=firefox --headed
npm run test:dup-email-ui -- --project=firefox --headed
```

## Comparison

| Method | Command Length | Easy to Remember? |
|--------|---------------|------------------|
| **Original** | `npx cross-env TEST_ENV=staging npx playwright test -g "should prevent submission for duplicate email" --project=firefox` | ❌ Long, hard to remember |
| **By Number** | `$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 2.14 --project=firefox` | ✅ Short, easy |
| **By Abbreviation** | `$env:TEST_ENV='staging'; node scripts/run-test-by-id.js dup-email-ui --project=firefox` | ✅ Short, descriptive |

## All Available Options

The `run-test-by-id.js` script passes through any additional arguments to Playwright, so you can use:

- `--project=firefox` or `--project=chromium`
- `--headed` (visible browser)
- `--debug` (debug mode)
- `--ui` (Playwright UI)
- `--workers=1` (sequential execution)
- Any other Playwright CLI options

## Examples

```powershell
# Run test 2.14 in Firefox, headed mode
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 2.14 --project=firefox --headed

# Run test 2.14 in Chromium, debug mode
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 2.14 --project=chromium --debug

# Run test 2.14 in both browsers, headed mode
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js 2.14 --headed

# Run by abbreviation
$env:TEST_ENV='staging'; node scripts/run-test-by-id.js dup-email-ui --project=firefox --headed
```


