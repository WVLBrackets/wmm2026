import { test, expect } from '@playwright/test';

/**
 * E2E tests for account creation flow
 * 
 * These tests interact with the UI to test the complete user journey
 * for creating a new account.
 */
test.describe('Account Creation', () => {
  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let hasLoggedStart = false;

  test.beforeAll(() => {
    // Log start (may appear multiple times due to parallel workers)
    if (!hasLoggedStart) {
      console.log('\n📋 Account Creation - Starting...');
      hasLoggedStart = true;
    }
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to signup page before each test
    await page.goto('/auth/signup', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
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
    console.log(`✅ Account Creation - Complete: ${status}\n`);
  });

  test('should display signup form with all required fields', async ({ page }) => {
    // Check that form fields are visible using stable test IDs
    await expect(page.getByTestId('signup-name-input')).toBeVisible();
    await expect(page.getByTestId('signup-email-input')).toBeVisible();
    await expect(page.getByTestId('signup-password-input')).toBeVisible();
    await expect(page.getByTestId('signup-confirm-password-input')).toBeVisible();
    await expect(page.getByTestId('signup-submit-button')).toBeVisible();
  });

  test('should show error when passwords do not match', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.getByTestId('signup-name-input').fill('Test User');
    await page.getByTestId('signup-email-input').fill(uniqueEmail);
    await page.getByTestId('signup-password-input').fill('password123');
    await page.getByTestId('signup-confirm-password-input').fill('differentpassword');

    const submitButton = page.getByTestId('signup-submit-button');
    await submitButton.click();

    // Client-side validation - wait for button to be enabled again (handler completed)
    await expect(submitButton).toBeEnabled({ timeout: 3000 });

    // Wait for error message (React needs a moment to re-render after state update)
    // Firefox may need more time for React state updates
    await expect(page.getByTestId('signup-error-message')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should show error when password is too short', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.getByTestId('signup-name-input').fill('Test User');
    await page.getByTestId('signup-email-input').fill(uniqueEmail);
    await page.getByTestId('signup-password-input').fill('12345');
    await page.getByTestId('signup-confirm-password-input').fill('12345');

    const submitButton = page.getByTestId('signup-submit-button');
    await submitButton.click();

    // Client-side validation sets isLoading to false, so button should be enabled again
    // Wait for button to be enabled (indicates handler completed) - Firefox needs this
    await expect(submitButton).toBeEnabled({ timeout: 3000 });

    // Wait for error message (React needs a moment to re-render after state update)
    // Firefox may need more time for React state updates
    await expect(page.getByTestId('signup-error-message')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/password must be at least 6 characters/i)).toBeVisible();
  });

  test('should successfully create account with valid data', async ({ page, request }, testInfo) => {
    // Get site config to retrieve the browser-specific happy_path_email_test
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 
                    (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod'
                      ? (process.env.PRODUCTION_URL || 'https://warrensmm.com')
                      : (process.env.STAGING_URL || 'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app'));
    
    // Determine which browser is running the test
    const browserName = testInfo.project.name; // 'chromium' or 'firefox'
    const emailConfigKey = browserName === 'chromium' 
      ? 'happy_path_email_test_chrome' 
      : browserName === 'firefox'
      ? 'happy_path_email_test_firefox'
      : 'happy_path_email_test'; // Fallback to original
    
    let testEmail: string;
    try {
      // Fetch site config from API with cache-busting timestamp
      // Add timestamp to ensure we get fresh config (bypasses unstable_cache)
      const configResponse = await request.get(`${baseURL}/api/site-config?_t=${Date.now()}`);
      if (configResponse.ok()) {
        const configData = await configResponse.json();
        const siteConfig = configData.data || configData;
        
        // Use browser-specific email, fallback to generic, then generated
        testEmail = siteConfig[emailConfigKey] || siteConfig.happy_path_email_test;
        
        // Fallback to generated email if config doesn't have the parameter
        if (!testEmail || testEmail.trim() === '') {
          testEmail = `test-${Date.now()}@example.com`;
        }
      } else {
        testEmail = `test-${Date.now()}@example.com`;
      }
    } catch (error) {
      // Fallback to generated email if config fetch fails
      testEmail = `test-${Date.now()}@example.com`;
    }

    const password = 'testpassword123';

    await page.getByTestId('signup-name-input').fill('Test User');
    await page.getByTestId('signup-email-input').fill(testEmail);
    await page.getByTestId('signup-password-input').fill(password);
    await page.getByTestId('signup-confirm-password-input').fill(password);

    // Set up response listener BEFORE clicking (more reliable)
    const responsePromise = page.waitForResponse(
      response => 
        response.url().includes('/api/auth/register') && response.status() === 200,
      { timeout: 30000 }
    );

    // Click submit button
    await page.getByTestId('signup-submit-button').click();

    // Wait for API response
    await responsePromise;

    // Wait for success message
    await expect(page.getByTestId('signup-success-header')).toBeVisible({ timeout: 15000 });
  });

  test('should show error for duplicate email', async ({ page, request }) => {
    // Create a user first via API
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 
                    (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod'
                      ? (process.env.PRODUCTION_URL || 'https://warrensmm.com')
                      : (process.env.STAGING_URL || 'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app'));
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const password = 'testpassword123';

    // Create user via API
    await request.post(`${baseURL}/api/auth/register`, {
      data: {
        name: 'Test User',
        email: uniqueEmail,
        password: password,
      },
    });

    // Now try to create duplicate via UI
    await page.getByTestId('signup-name-input').fill('Test User 2');
    await page.getByTestId('signup-email-input').fill(uniqueEmail);
    await page.getByTestId('signup-password-input').fill(password);
    await page.getByTestId('signup-confirm-password-input').fill(password);

    // Set up response listener BEFORE clicking (more reliable)
    const responsePromise = page.waitForResponse(
      response => 
        response.url().includes('/api/auth/register') && response.status() === 409,
      { timeout: 30000 }
    );

    // Click submit button
    await page.getByTestId('signup-submit-button').click();

    // Wait for API response
    await responsePromise;

    // Wait for error message
    await expect(page.getByTestId('signup-error-message')).toBeVisible();
    await expect(page.getByText(/already exists|failed to create/i)).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    const password = 'testpassword123';

    await page.getByTestId('signup-password-input').fill(password);
    
    // Password should be hidden by default
    const passwordInput = page.getByTestId('signup-password-input');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Find the password visibility toggle button - use a more reliable selector
    // The button is in the same container as the input
    const inputContainer = page.locator('input[data-testid="signup-password-input"]').locator('xpath=ancestor::div[contains(@class, "relative")]');
    const toggleButton = inputContainer.locator('button[type="button"]').first();
    
    // Wait for button to be visible and actionable
    await expect(toggleButton).toBeVisible({ timeout: 5000 });
    await expect(toggleButton).toBeEnabled({ timeout: 2000 });
    
    // For Firefox, use evaluate to directly call the click handler
    // This bypasses any event propagation issues
    await toggleButton.evaluate((button: HTMLButtonElement) => {
      // Trigger both click and mousedown/mouseup events for maximum compatibility
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    
    // Give Firefox more time to process the state change
    await page.waitForTimeout(1000);

    // Wait for the input type to change to 'text'
    await expect(passwordInput).toHaveAttribute('type', 'text', { timeout: 8000 });
  });

  test('should navigate to sign in page from signup page', async ({ page }) => {
    await page.getByRole('link', { name: /sign in to your existing account/i }).click();
    
    // Should be on sign in page
    await expect(page).toHaveURL(/.*\/auth\/signin/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

