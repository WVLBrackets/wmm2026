# Step-by-Step Guide: Running Playwright Tests

This guide will walk you through executing the Playwright tests and viewing the results.

## Prerequisites

Before running tests, make sure you have:
1. ✅ Node.js and npm installed
2. ✅ All dependencies installed (`npm install`)
3. ✅ Playwright browsers installed (should be done automatically, but if not: `npx playwright install`)

## Step 1: Start Your Development Server (Optional)

Playwright can automatically start your dev server, but if you want to run it manually:

```bash
npm run dev
```

The server should start on `http://localhost:3000`. Keep this terminal window open.

**Note:** If you run tests without starting the server manually, Playwright will automatically start it for you (configured in `playwright.config.ts`).

## Step 2: Choose How to Run Tests

### Option A: Run All Tests (Recommended for First Time)

Open a **new terminal window** (keep the dev server running if you started it manually) and run:

```bash
npm test
```

This will:
- Start the dev server automatically (if not already running)
- Run all tests (API + E2E)
- Show results in the terminal
- Generate an HTML report

### Option B: Run Tests with Interactive UI (Best for Development)

This opens a visual interface where you can:
- See tests running in real-time
- Click on individual tests to run them
- Watch the browser as tests execute
- Debug failed tests easily

```bash
npm run test:ui
```

This will open a browser window with the Playwright Test UI. You can:
- Click "Run all" to run all tests
- Click on individual test files to run just those
- Click on individual tests to run a single test
- Watch the browser as it executes tests

### Option C: Run Tests in Headed Mode (See the Browser)

This runs tests with the browser visible (instead of headless):

```bash
npm run test:headed
```

You'll see the browser windows open and interact with your application as tests run.

### Option D: Run Only API Tests

If you want to test just the backend API endpoints:

```bash
npm run test:api
```

### Option E: Run Only E2E Tests

If you want to test just the user interface:

```bash
npm run test:e2e
```

## Step 3: View Test Results

### Terminal Output

After tests complete, you'll see output like this:

```
Running 15 tests using 3 workers

  ✓ tests/api/auth.spec.ts:5:3 › Account Creation API › should create a new user account successfully (2.1s)
  ✓ tests/api/auth.spec.ts:12:3 › Account Creation API › should reject registration with missing fields (234ms)
  ✓ tests/e2e/account-creation.spec.ts:15:3 › Account Creation › should display signup form with all required fields (1.2s)
  ...

  15 passed (45.2s)
```

### HTML Report (Detailed Results)

After tests complete, Playwright automatically generates an HTML report. To view it:

```bash
npm run test:report
```

This opens a detailed HTML report in your browser showing:
- ✅ Passed tests (green)
- ❌ Failed tests (red) with screenshots and error details
- ⏱️ Test execution times
- 📊 Test summary statistics

**Tip:** The report is also saved in `playwright-report/index.html` - you can open this file directly in your browser.

## Step 4: Understanding Test Output

### Successful Test Run

```
✓ tests/e2e/account-creation.spec.ts:54:3 › Account Creation › should successfully create account with valid data (3.2s)

15 passed (45.2s)
```

All tests passed! ✅

### Failed Test

If a test fails, you'll see:

```
✘ tests/e2e/account-creation.spec.ts:24:3 › Account Creation › should show error when passwords do not match (2.1s)

  1) tests/e2e/account-creation.spec.ts:24:3 › Account Creation › should show error when passwords do not match

    Error: expect(received).toBeVisible()

    Expected: visible
    Received: hidden

    Call log:
      - expect.toBeVisible with timeout 5000ms
      - waiting for getByTestId('signup-error-message')
```

The error message tells you:
- Which test failed
- What assertion failed
- What was expected vs. what was received

## Step 5: Debugging Failed Tests

### View Screenshots

When a test fails, Playwright automatically takes a screenshot. These are saved in:
- `test-results/` directory

### View Test Trace

Playwright can record a trace of the test execution. To view it:

1. Run tests with trace enabled (already configured in `playwright.config.ts`)
2. If a test fails, you'll see a trace file path in the output
3. Open the trace file with: `npx playwright show-trace <trace-file-path>`

### Run a Single Test

To debug a specific failing test, you can run just that test:

```bash
npx playwright test tests/e2e/account-creation.spec.ts -g "should show error when passwords do not match"
```

The `-g` flag filters tests by name pattern.

### Run Tests in Debug Mode

For step-by-step debugging:

```bash
npx playwright test --debug
```

This opens Playwright Inspector where you can:
- Step through test execution
- See what the browser is doing at each step
- Inspect elements
- Modify test code on the fly

## Step 6: Common Issues and Solutions

### Issue: "Port 3000 is already in use"

**Solution:** Either:
- Stop any existing dev server on port 3000, OR
- Let Playwright handle the server (it will use an existing one if available)

### Issue: "Browser not found"

**Solution:** Install browsers:
```bash
npx playwright install
```

### Issue: Tests are slow

**Solution:** 
- Tests run in parallel by default. If you want sequential execution, modify `workers: 1` in `playwright.config.ts`
- Some tests may be slower if the dev server needs to start

### Issue: "Cannot find module" errors

**Solution:** Make sure dependencies are installed:
```bash
npm install
```

## Quick Reference Commands

| Command | What It Does |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:ui` | Open interactive test UI |
| `npm run test:headed` | Run with visible browser |
| `npm run test:api` | Run only API tests |
| `npm run test:e2e` | Run only E2E tests |
| `npm run test:report` | View HTML test report |
| `npx playwright test --debug` | Debug mode with inspector |

## Next Steps

Once you're comfortable running tests:
1. ✅ Try running tests in UI mode to see them execute
2. ✅ Check the HTML report to see detailed results
3. ✅ Try modifying a test to see how it fails
4. ✅ Add new tests for additional scenarios

Happy testing! 🎉

