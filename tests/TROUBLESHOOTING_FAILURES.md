# Troubleshooting Test Failures

## Step-by-Step Debugging Process

### Step 1: Identify Which Tests Are Failing

Run tests with more verbose output:
```powershell
npm test -- --reporter=list
```

Or run specific test files:
```powershell
npm run test:e2e
npm run test:api
```

### Step 2: Run Individual Failing Tests

Run a specific test file:
```powershell
npx playwright test tests/e2e/account-creation.spec.ts
```

Run a specific test by name:
```powershell
npx playwright test tests/e2e/account-creation.spec.ts -g "should toggle password visibility"
```

### Step 3: Run in Headed Mode (See What's Happening)

```powershell
npx playwright test tests/e2e/account-creation.spec.ts --headed
```

### Step 4: Use Debug Mode

```powershell
npx playwright test tests/e2e/account-creation.spec.ts --debug
```

This opens Playwright Inspector where you can:
- Step through the test line by line
- See the browser state at each step
- Inspect elements
- See console logs and network requests

### Step 5: Check the HTML Report

After running tests, view the detailed report:
```powershell
npm run test:report
```

This shows:
- Screenshots at failure points
- Video recordings (if enabled)
- Step-by-step trace viewer
- Network requests
- Console logs

## Common Issues and Solutions

### Issue 1: Password Visibility Toggle Test

**Problem**: Button click is intercepted by input field

**Solution**: Use `force: true` in the click action (already implemented)

**Debug**:
```powershell
npx playwright test tests/e2e/account-creation.spec.ts -g "should toggle password visibility" --headed
```

### Issue 2: User Creation Test Timing Out

**Problem**: Success message not appearing within timeout

**Solution**: 
- Wait for API response before checking for success
- Increase timeout for email sending
- Check if email service is configured

**Debug**:
```powershell
npx playwright test tests/e2e/user-creation-confirmation.spec.ts -g "should successfully create" --headed
```

### Issue 3: Confirmation Flow Test

**Problem**: Token retrieval or confirmation failing

**Solution**:
- Verify `/api/test/get-token` endpoint is accessible
- Check that test email pattern matches
- Ensure database connection is working

**Debug**:
```powershell
npx playwright test tests/e2e/user-creation-confirmation.spec.ts -g "should complete full confirmation flow" --debug
```

## Getting Detailed Error Information

### View Full Error Stack Trace

```powershell
npm test -- --reporter=line
```

### Save Test Results to File

```powershell
npm test > test-results.txt 2>&1
```

Then review `test-results.txt` for full error details.

### Check Console Logs

Add more logging to tests:
```typescript
console.log('Current URL:', page.url());
console.log('Page title:', await page.title());
console.log('Element visible:', await element.isVisible());
```

## Next Steps

1. Run the failing tests individually to see specific error messages
2. Use `--headed` mode to watch what's happening
3. Check the HTML report for screenshots and traces
4. Share the specific error messages for targeted fixes

