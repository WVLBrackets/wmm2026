# How to Validate Your Tests Are Actually Working

## The Problem

Tests can pass even if they're not actually validating what you want. Here's how to ensure your tests are robust.

## Method 1: Make Tests Fail Intentionally

Temporarily break your site or change the test to see if it catches the problem:

### Example: Test Homepage
```typescript
test('should load the homepage', async ({ page }) => {
  await page.goto('/');
  
  // This should pass
  await expect(page).toHaveTitle(/.*/);
  
  // Temporarily change this to expect something wrong:
  // await expect(page).toHaveTitle(/This Title Does Not Exist/);
  // If the test still passes, your test is too weak!
});
```

### Example: Test Signup Page
```typescript
test('should load signup page', async ({ page }) => {
  await page.goto('/auth/signup');
  
  // Temporarily change to wrong heading:
  // await expect(page.getByRole('heading', { name: /wrong text/i })).toBeVisible();
  // If test passes, the assertion isn't working!
});
```

## Method 2: Check What the Test Actually Validates

Look at your test assertions:

### Weak Test (Bad)
```typescript
await expect(page).toHaveTitle(/.*/); // Matches ANY title - too weak!
```

### Strong Test (Good)
```typescript
await expect(page).toHaveTitle(/Warren|March Madness/i); // Checks for specific content
await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
await expect(page.getByTestId('signup-name-input')).toBeVisible();
```

## Method 3: Add Negative Assertions

Test that bad things DON'T happen:

```typescript
// Make sure we're NOT on Vercel login
expect(page.url()).not.toContain('vercel.com/login');

// Make sure we're NOT on an error page
expect(page.url()).not.toContain('/error');
```

## Method 4: Run in Headed Mode and Watch

See what's actually happening:

```powershell
npx playwright test tests/simple-test.spec.ts --headed
```

You'll see the browser and can verify:
- Is it actually on the right page?
- Are the elements actually visible?
- Is the test checking the right things?

## Method 5: Check the HTML Report

After tests run, check the detailed report:

```powershell
npm run test:report
```

Look at:
- Screenshots (if any failures)
- What the page actually looked like
- Network requests (did it load correctly?)

## Method 6: Add Console Logging

Add logs to see what's happening:

```typescript
console.log('Page URL:', page.url());
console.log('Page title:', await page.title());
console.log('Found elements:', await page.locator('h1').count());
```

## Red Flags: Tests That Are Too Weak

❌ **Bad**: `expect(page).toHaveTitle(/.*/)` - Matches anything  
✅ **Good**: `expect(page).toHaveTitle(/Warren/i)` - Matches specific content

❌ **Bad**: `expect(page.locator('div').first()).toBeVisible()` - Too generic  
✅ **Good**: `expect(page.getByTestId('signup-name-input')).toBeVisible()` - Specific element

❌ **Bad**: No negative checks  
✅ **Good**: `expect(page.url()).not.toContain('vercel.com/login')`

## Quick Validation Checklist

Before trusting a test:
1. ✅ Does it check for specific content (not just "something exists")?
2. ✅ Does it verify we're on the RIGHT page (not just "a page loaded")?
3. ✅ Does it check that bad things DON'T happen (negative assertions)?
4. ✅ Can you make it fail by breaking the site?
5. ✅ Have you watched it run in headed mode?

## Next Steps

The updated `simple-test.spec.ts` now includes:
- ✅ URL validation (not on Vercel login)
- ✅ Specific element checks (test IDs)
- ✅ Multiple assertions (heading, form fields, button)
- ✅ Console logging for debugging

Try running it and see if it catches issues!

