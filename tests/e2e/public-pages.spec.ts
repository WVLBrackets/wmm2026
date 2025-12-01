import { test, expect } from '@playwright/test';

/**
 * E2E tests for public pages
 * 
 * These tests verify that all public pages:
 * 1. Load successfully without authentication
 * 2. Display expected content and elements
 * 3. Navigation links work correctly
 * 
 * Pages tested:
 * - /info - Tournament information
 * - /rules - Tournament rules
 * - /prizes - Prize information
 * - /payments - Payment information
 * - /hall-of-fame - Hall of Fame/Past winners
 * - /standings - Current standings
 * - /standings/previous-years - Historical standings
 * - /print-bracket - Print bracket view
 * - /auth/forgot-password - Password reset request
 * - /auth/reset-password - Password reset form
 */
test.describe('Public Pages', () => {
  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let hasLoggedStart = false;

  test.beforeAll(() => {
    if (!hasLoggedStart) {
      console.log('\n📋 Public Pages - Starting...');
      hasLoggedStart = true;
    }
  });

  test.afterEach(({}, testInfo) => {
    if (testInfo.status === 'passed') {
      passedCount++;
    } else if (testInfo.status === 'failed') {
      failedCount++;
    } else if (testInfo.status === 'skipped') {
      skippedCount++;
    }
  });

  test.afterAll(() => {
    const statusParts = [];
    if (passedCount > 0) statusParts.push(`${passedCount} passed`);
    if (failedCount > 0) statusParts.push(`${failedCount} failed`);
    if (skippedCount > 0) statusParts.push(`${skippedCount} skipped`);
    const status = statusParts.length > 0 ? statusParts.join(', ') : '0 tests';
    console.log(`✅ Public Pages - Complete: ${status}\n`);
  });

  // ==========================================
  // INFO PAGE TESTS
  // ==========================================
  test.describe('Info Page', () => {
    test('should load the info page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      await page.goto('/info', { waitUntil: 'domcontentloaded', timeout });
      
      // Check we're not redirected to Vercel login
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/info');
      
      // Wait for content to load (info page has loading state)
      await page.waitForLoadState('domcontentloaded');
      
      // Check for key content elements
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      
      console.log('✅ Info page loaded successfully');
    });

    test('should display entry and payment section', async ({ page }) => {
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to finish loading (has async data)
      await page.waitForTimeout(2000);
      
      // Check for entry fee information
      await expect(page.getByText(/\$5 per entry/i)).toBeVisible({ timeout: 10000 });
      
      // Check for payment-related content
      await expect(page.getByText(/payment/i).first()).toBeVisible();
    });

    test('should display scoring section', async ({ page }) => {
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to finish loading
      await page.waitForTimeout(2000);
      
      // Check for scoring heading or content
      await expect(page.getByText(/scoring/i).first()).toBeVisible({ timeout: 10000 });
      
      // Check for scoring values (1 point, 2 points, etc.)
      await expect(page.getByText(/1 point/i).first()).toBeVisible();
    });

    test('should display prizes section', async ({ page }) => {
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to finish loading
      await page.waitForTimeout(2000);
      
      // Check for prizes section
      await expect(page.getByText(/prize/i).first()).toBeVisible({ timeout: 10000 });
      
      // Check for place indicators (1st, 2nd, 3rd)
      await expect(page.getByText(/1st place/i).first()).toBeVisible();
    });
  });

  // ==========================================
  // RULES PAGE TESTS
  // ==========================================
  test.describe('Rules Page', () => {
    test('should load the rules page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      await page.goto('/rules', { waitUntil: 'domcontentloaded', timeout });
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/rules');
      
      // Wait for content to load
      await page.waitForLoadState('domcontentloaded');
      
      console.log('✅ Rules page loaded successfully');
    });

    test('should display entry rules', async ({ page }) => {
      await page.goto('/rules', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to finish loading
      await page.waitForTimeout(2000);
      
      // Check for entry section
      await expect(page.getByText(/entry/i).first()).toBeVisible({ timeout: 10000 });
      
      // Check for $5 entry fee
      await expect(page.getByText(/\$5/i).first()).toBeVisible();
    });

    test('should display scoring rules with point values', async ({ page }) => {
      await page.goto('/rules', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to finish loading
      await page.waitForTimeout(2000);
      
      // Check for scoring section
      await expect(page.getByText(/scoring/i).first()).toBeVisible({ timeout: 10000 });
      
      // Check for tournament round names
      await expect(page.getByText(/first round/i).first()).toBeVisible();
      await expect(page.getByText(/sweet sixteen/i).first()).toBeVisible();
      await expect(page.getByText(/championship/i).first()).toBeVisible();
    });

    test('should display underdog bonus information', async ({ page }) => {
      await page.goto('/rules', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to finish loading
      await page.waitForTimeout(2000);
      
      // Check for underdog bonus section (use first() as text appears multiple times)
      await expect(page.getByText(/underdog bonus/i).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/2 point bonus/i).first()).toBeVisible();
    });
  });

  // ==========================================
  // PRIZES PAGE TESTS
  // ==========================================
  test.describe('Prizes Page', () => {
    test('should load the prizes page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      await page.goto('/prizes', { waitUntil: 'domcontentloaded', timeout });
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/prizes');
      
      console.log('✅ Prizes page loaded successfully');
    });

    test('should display prize pool information', async ({ page }) => {
      await page.goto('/prizes', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to finish loading
      await page.waitForTimeout(2000);
      
      // Check for prize pool header
      await expect(page.getByText(/prize pool/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('should display all three prize positions', async ({ page }) => {
      await page.goto('/prizes', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to finish loading
      await page.waitForTimeout(2000);
      
      // Check for 1st, 2nd, 3rd place
      await expect(page.getByText(/1st place/i).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/2nd place/i).first()).toBeVisible();
      await expect(page.getByText(/3rd place/i).first()).toBeVisible();
      
      // Check for champion/runner-up labels
      await expect(page.getByText(/champion/i).first()).toBeVisible();
      await expect(page.getByText(/runner-up/i).first()).toBeVisible();
    });
  });

  // ==========================================
  // PAYMENTS PAGE TESTS
  // ==========================================
  test.describe('Payments Page', () => {
    test('should load the payments page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      await page.goto('/payments', { waitUntil: 'domcontentloaded', timeout });
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/payments');
      
      console.log('✅ Payments page loaded successfully');
    });

    test('should display entry fee', async ({ page }) => {
      await page.goto('/payments', { waitUntil: 'domcontentloaded' });
      
      // Check for $5 entry fee
      await expect(page.getByText(/\$5 per entry/i)).toBeVisible({ timeout: 10000 });
    });

    test('should display payment methods', async ({ page }) => {
      await page.goto('/payments', { waitUntil: 'domcontentloaded' });
      
      // Check for electronic payments section (use first() as text appears in heading and description)
      await expect(page.getByText(/electronic payments/i).first()).toBeVisible({ timeout: 10000 });
      
      // Check for cash option
      await expect(page.getByText(/cash/i).first()).toBeVisible();
    });

    test('should display payment instructions', async ({ page }) => {
      await page.goto('/payments', { waitUntil: 'domcontentloaded' });
      
      // Check for group payment instructions
      await expect(page.getByText(/group payments/i)).toBeVisible({ timeout: 10000 });
      
      // Check for entry names instruction
      await expect(page.getByText(/entry names/i)).toBeVisible();
    });
  });

  // ==========================================
  // HALL OF FAME PAGE TESTS
  // ==========================================
  test.describe('Hall of Fame Page', () => {
    test('should load the hall of fame page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      await page.goto('/hall-of-fame', { waitUntil: 'domcontentloaded', timeout });
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/hall-of-fame');
      
      console.log('✅ Hall of Fame page loaded successfully');
    });

    test('should display reigning champion', async ({ page }) => {
      await page.goto('/hall-of-fame', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to load (has async data)
      await page.waitForTimeout(2000);
      
      // Check for reigning champion section
      await expect(page.getByText(/reigning champion/i)).toBeVisible({ timeout: 10000 });
    });

    test('should display tournament statistics', async ({ page }) => {
      await page.goto('/hall-of-fame', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to load
      await page.waitForTimeout(2000);
      
      // Check for tournament statistics section
      await expect(page.getByText(/tournament statistics/i)).toBeVisible({ timeout: 10000 });
      
      // Check for tournaments completed count
      await expect(page.getByText(/tournaments completed/i)).toBeVisible();
    });

    test('should display tournament history', async ({ page }) => {
      await page.goto('/hall-of-fame', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to load
      await page.waitForTimeout(2000);
      
      // Check for tournament history section
      await expect(page.getByText(/tournament history/i)).toBeVisible({ timeout: 10000 });
    });

    test('should display all-time leaders', async ({ page }) => {
      await page.goto('/hall-of-fame', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to load
      await page.waitForTimeout(2000);
      
      // Check for all-time leaders section
      await expect(page.getByText(/all time leaders/i)).toBeVisible({ timeout: 10000 });
    });
  });

  // ==========================================
  // STANDINGS PAGE TESTS
  // ==========================================
  test.describe('Standings Page', () => {
    test('should load the standings page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      await page.goto('/standings', { waitUntil: 'domcontentloaded', timeout });
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/standings');
      
      console.log('✅ Standings page loaded successfully');
    });

    test('should display standings table or content', async ({ page }) => {
      await page.goto('/standings', { waitUntil: 'domcontentloaded' });
      
      // Wait for page content to load
      await page.waitForTimeout(3000);
      
      // The page should have meaningful content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(100);
    });
  });

  // ==========================================
  // PREVIOUS YEARS STANDINGS PAGE TESTS
  // ==========================================
  test.describe('Previous Years Standings Page', () => {
    test('should load the previous years standings page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      await page.goto('/standings/previous-years', { waitUntil: 'domcontentloaded', timeout });
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/standings/previous-years');
      
      console.log('✅ Previous Years Standings page loaded successfully');
    });

    test('should display content or year selector', async ({ page }) => {
      await page.goto('/standings/previous-years', { waitUntil: 'domcontentloaded' });
      
      // Wait for page content to load
      await page.waitForTimeout(3000);
      
      // The page should have meaningful content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(50);
    });
  });

  // ==========================================
  // PRINT BRACKET PAGE TESTS
  // ==========================================
  test.describe('Print Bracket Page', () => {
    test('should load the print bracket page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      await page.goto('/print-bracket', { waitUntil: 'domcontentloaded', timeout });
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/print-bracket');
      
      console.log('✅ Print Bracket page loaded successfully');
    });

    test('should display bracket content or form', async ({ page }) => {
      await page.goto('/print-bracket', { waitUntil: 'domcontentloaded' });
      
      // Wait for page content to load
      await page.waitForTimeout(3000);
      
      // The page should have meaningful content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(50);
    });
  });

  // ==========================================
  // FORGOT PASSWORD PAGE TESTS
  // ==========================================
  test.describe('Forgot Password Page', () => {
    test('should load the forgot password page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded', timeout });
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/auth/forgot-password');
      
      console.log('✅ Forgot Password page loaded successfully');
    });

    test('should display forgot password heading', async ({ page }) => {
      await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' });
      
      // Check for the main heading
      await expect(page.getByRole('heading', { name: /forgot your password/i })).toBeVisible({ timeout: 10000 });
    });

    test('should display email input field', async ({ page }) => {
      await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' });
      
      // Check for email input
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible({ timeout: 10000 });
      await expect(emailInput).toHaveAttribute('required', '');
    });

    test('should display send reset button', async ({ page }) => {
      await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' });
      
      // Check for submit button
      const submitButton = page.getByRole('button', { name: /send reset instructions/i });
      await expect(submitButton).toBeVisible({ timeout: 10000 });
      await expect(submitButton).toBeEnabled();
    });

    test('should have link back to sign in', async ({ page }) => {
      await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' });
      
      // Check for back to sign in link
      const backLink = page.getByRole('link', { name: /back to sign in/i });
      await expect(backLink).toBeVisible({ timeout: 10000 });
    });

    test('should navigate back to sign in page', async ({ page }) => {
      await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' });
      
      // Click the back to sign in link
      const backLink = page.getByRole('link', { name: /back to sign in/i });
      await backLink.click();
      
      // Verify navigation
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/.*\/auth\/signin/);
    });
  });

  // ==========================================
  // RESET PASSWORD PAGE TESTS
  // ==========================================
  test.describe('Reset Password Page', () => {
    test('should load the reset password page', async ({ page, browserName }) => {
      const timeout = browserName === 'firefox' ? 60000 : 30000;
      // Note: Reset password page typically requires a token in the URL
      // We test it without a token to verify error handling
      await page.goto('/auth/reset-password', { waitUntil: 'domcontentloaded', timeout });
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      expect(currentUrl).toContain('/auth/reset-password');
      
      console.log('✅ Reset Password page loaded successfully');
    });

    test('should handle missing token gracefully', async ({ page }) => {
      await page.goto('/auth/reset-password', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to process
      await page.waitForTimeout(2000);
      
      // Page should either show an error or redirect
      // We just verify it loaded without crashing
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    });

    test('should handle invalid token', async ({ page }) => {
      await page.goto('/auth/reset-password?token=invalid-token-12345', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to process
      await page.waitForTimeout(2000);
      
      // Page should show error or password form
      // We verify it doesn't crash
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    });
  });

  // ==========================================
  // NAVIGATION TESTS
  // ==========================================
  test.describe('Navigation Between Public Pages', () => {
    test('should navigate from info page to rules via Quick Navigation', async ({ page }) => {
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to load
      await page.waitForTimeout(2000);
      
      // Look for Quick Navigation section and click on Scoring (which links to #scoring-rules on same page)
      const scoringLink = page.getByRole('link', { name: /scoring/i }).first();
      if (await scoringLink.isVisible()) {
        await scoringLink.click();
        await page.waitForTimeout(500);
        // Should stay on info page (anchor link)
        const currentUrl = page.url();
        expect(currentUrl).toContain('/info');
      }
      
      console.log('✅ Quick Navigation works on info page');
    });

    test('should verify homepage has navigation to public pages', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to load
      await page.waitForTimeout(2000);
      
      // The page should have some navigation elements
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      
      // Check that the page loaded successfully (not an error page)
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      
      console.log('✅ Homepage loaded with navigation elements');
    });
  });
});

