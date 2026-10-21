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
 * - /info - Tournament information (entry, payment, scoring, prizes)
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
      
      await expect(page.getByTestId('vintage-info-page')).toBeVisible({
        timeout: 10000,
      });
      
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      
      console.log('✅ Info page loaded successfully');
    });

    test('should display entry and payment section', async ({ page }) => {
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      
      await expect(page.getByTestId('vintage-info-entry')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByTestId('vintage-info-facts')).toContainText(/\$5/i);
      await expect(page.getByText(/payment/i).first()).toBeVisible();
    });

    test('should display scoring section', async ({ page }) => {
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      
      const scoring = page.getByTestId('vintage-info-scoring');
      await expect(scoring).toBeVisible({ timeout: 10000 });
      await expect(scoring).toContainText(/scoring|points add up/i);
      await expect(scoring).toContainText(/First Round/i);
    });

    test('should display prizes section', async ({ page }) => {
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      
      const prizes = page.getByTestId('vintage-info-prizes');
      await expect(prizes).toBeVisible({ timeout: 10000 });
      await expect(prizes).toContainText(/prize|playing for/i);
      await expect(prizes).toContainText(/1st place/i);
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
      
      await expect(page.getByTestId('vintage-hof')).toBeVisible({
        timeout: 10000,
      });
      
      console.log('✅ Hall of Fame page loaded successfully');
    });

    test('should display reigning champion', async ({ page }) => {
      await page.goto('/hall-of-fame', { waitUntil: 'domcontentloaded' });
      
      await expect(page.getByTestId('vintage-hof-reigning')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(/reigning champion/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test('should display lifetime / tournament statistics', async ({ page }) => {
      await page.goto('/hall-of-fame', { waitUntil: 'domcontentloaded' });

      await expect(page.getByText(/tournaments completed/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test('should display year archive and all-time leaders', async ({ page }) => {
      await page.goto('/hall-of-fame', { waitUntil: 'domcontentloaded' });

      await expect(page.getByText(/champions by year/i).first()).toBeVisible({
        timeout: 10000,
      });

      await expect(
        page.getByText(/all[- ]?time leaders/i).first(),
      ).toBeVisible({ timeout: 10000 });
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
      
      await expect(page.getByTestId('vintage-standings-page')).toBeVisible({
        timeout: 15000,
      });
      
      console.log('✅ Standings page loaded successfully');
    });

    test('should display standings table or content', async ({ page }) => {
      await page.goto('/standings', { waitUntil: 'domcontentloaded' });
      
      await expect(page.getByTestId('vintage-standings-page')).toBeVisible({
        timeout: 15000,
      });
      
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
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
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
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
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
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Page should either show an error or redirect
      // We just verify it loaded without crashing
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    });

    test('should handle invalid token', async ({ page }) => {
      await page.goto('/auth/reset-password?token=invalid-token-12345', { waitUntil: 'domcontentloaded' });
      
      // Wait for page to process
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
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
    test('should navigate from info handbook to scoring via guide chips', async ({ page }) => {
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      
      await expect(page.getByTestId('vintage-info-toc')).toBeVisible({
        timeout: 10000,
      });
      const scoringLink = page.getByTestId('vintage-info-toc-chip-scoring');
      await expect(scoringLink).toBeVisible({ timeout: 10000 });
      
      await scoringLink.click();
      
      await expect(page).toHaveURL(/\/info#scoring/);
      await expect(page.getByTestId('vintage-info-scoring')).toBeVisible();
      
      console.log('✅ Vintage guide navigation works on info page');
    });

    test('should verify homepage has vintage navigation to public pages', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      
      await expect(page.getByTestId('vintage-homepage')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByTestId('vintage-toolbar')).toBeVisible();
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('vercel.com/login');
      
      console.log('✅ Homepage loaded with vintage navigation');
    });
  });
});

