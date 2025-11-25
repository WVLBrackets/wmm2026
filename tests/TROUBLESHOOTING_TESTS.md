# Troubleshooting Failed Tests

## Step 1: Run the Test and See the Error

```powershell
npm run test:simple
```

Look for the error message - it will tell you:
- Which test failed
- What assertion failed
- What was expected vs. what was found

## Step 2: Check the HTML Report

The test run creates a detailed HTML report:

```powershell
npm run test:report
```

This shows:
- Screenshots of the page when the test failed
- The exact error message
- What the page looked like

## Step 3: Run in Headed Mode (See the Browser)

Watch the test run in a visible browser:

```powershell
$env:PLAYWRIGHT_TEST_BASE_URL="https://your-staging-url.vercel.app"
npx playwright test tests/simple-test.spec.ts --headed
```

You'll see:
- What the browser is doing
- What page it's on
- If there are any redirects or errors

## Step 4: Check Console Output

The updated test now logs debug information:
- Page URL
- Page title
- What headings were found
- What elements exist

Look for these in the test output.

## Step 5: Common Issues

### Issue: "Element not found"
**Possible causes:**
- Page hasn't loaded yet (add `await page.waitForLoadState('networkidle')`)
- Element selector is wrong (check the actual page HTML)
- Page redirected somewhere else (check the URL in logs)

### Issue: "Timeout waiting for element"
**Possible causes:**
- Page is slow to load (increase timeout or wait for specific element)
- Element doesn't exist on the page (check with headed mode)

### Issue: "Page title doesn't match"
**Possible causes:**
- Page redirected to error page
- Authentication required
- Page structure changed

## Step 6: Use Playwright Inspector

For detailed debugging:

```powershell
npx playwright test tests/simple-test.spec.ts --debug
```

This opens Playwright Inspector where you can:
- Step through the test line by line
- See what the browser sees
- Inspect elements
- Run commands interactively

## Quick Debug Checklist

1. ✅ Run test and read the error message
2. ✅ Check HTML report for screenshots
3. ✅ Run in headed mode to see what's happening
4. ✅ Check console logs for debug info
5. ✅ Verify the URL is correct (staging vs prod)
6. ✅ Check if page requires authentication

