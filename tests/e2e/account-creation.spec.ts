import { test, expect } from '@playwright/test';

/**
 * E2E tests for account creation flow
 * 
 * These tests interact with the UI to test the complete user journey
 * for creating a new account.
 */
test.describe('Account Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to signup page before each test
    await page.goto('/auth/signup', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
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

    await page.getByTestId('signup-submit-button').click();

    // Wait for error message
    await expect(page.getByTestId('signup-error-message')).toBeVisible();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should show error when password is too short', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.getByTestId('signup-name-input').fill('Test User');
    await page.getByTestId('signup-email-input').fill(uniqueEmail);
    await page.getByTestId('signup-password-input').fill('12345');
    await page.getByTestId('signup-confirm-password-input').fill('12345');

    await page.getByTestId('signup-submit-button').click();

    // Wait for error message
    await expect(page.getByTestId('signup-error-message')).toBeVisible();
    await expect(page.getByText(/password must be at least 6 characters/i)).toBeVisible();
  });

  test('should successfully create account with valid data', async ({ page, request }) => {
    // Get site config to retrieve the happy_path_email_test
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 
                    (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod'
                      ? (process.env.PRODUCTION_URL || 'https://warrensmm.com')
                      : (process.env.STAGING_URL || 'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app'));
    
    let testEmail: string;
    try {
      // Fetch site config from API with debug mode
      const configResponse = await request.get(`${baseURL}/api/site-config?debug=true`);
      if (configResponse.ok()) {
        const configData = await configResponse.json();
        const siteConfig = configData.data || configData;
        
        // Debug: Log the debug info
        if (configData.debug) {
          console.log('Debug info:', configData.debug);
        }
        
        // Debug: Log the config to see what we're getting
        console.log('All config keys (first 20):', Object.keys(siteConfig).slice(0, 20));
        console.log('Config keys with "happy" or "test":', Object.keys(siteConfig).filter(k => k.toLowerCase().includes('happy') || k.toLowerCase().includes('test')));
        console.log('happy_path_email_test value:', siteConfig.happy_path_email_test);
        
        testEmail = siteConfig.happy_path_email_test;
        
        // Fallback to generated email if config doesn't have the parameter
        if (!testEmail || testEmail.trim() === '') {
          testEmail = `test-${Date.now()}@example.com`;
          console.log('⚠️ happy_path_email_test not found or empty in config, using generated email');
        } else {
          console.log(`✅ Using email from config: ${testEmail}`);
        }
      } else {
        testEmail = `test-${Date.now()}@example.com`;
        console.log('⚠️ Failed to fetch site config (non-200 response), using generated email');
      }
    } catch (error) {
      // Fallback to generated email if config fetch fails
      testEmail = `test-${Date.now()}@example.com`;
      console.log('⚠️ Failed to fetch site config, using generated email:', error);
    }

    const password = 'testpassword123';

    await page.getByTestId('signup-name-input').fill('Test User');
    await page.getByTestId('signup-email-input').fill(testEmail);
    await page.getByTestId('signup-password-input').fill(password);
    await page.getByTestId('signup-confirm-password-input').fill(password);

    await page.getByTestId('signup-submit-button').click();

    // Wait for success message
    await expect(page.getByTestId('signup-success-header')).toBeVisible();
  });

  test('should show error for duplicate email', async ({ page, request }) => {
    // Create a user first via API
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
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

    await page.getByTestId('signup-submit-button').click();

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

    // Find the password visibility toggle button using a more reliable approach
    // The button contains an SVG icon (Eye or EyeOff), so we can find it by role or by the icon
    // First, find the input's parent container with class "relative"
    const passwordField = page.locator('div:has(input[data-testid="signup-password-input"])').filter({ hasText: '' });
    
    // Find the button within that container - it's the button with type="button" that's positioned absolutely
    // We'll use a more specific selector: button inside the relative container
    const toggleButton = page.locator('input[data-testid="signup-password-input"]')
      .locator('xpath=ancestor::div[contains(@class, "relative")]')
      .locator('button[type="button"]')
      .first();
    
    // Wait for button to be visible
    await expect(toggleButton).toBeVisible({ timeout: 5000 });
    
    // Click using JavaScript to ensure it works even if the button is overlapped
    await toggleButton.evaluate((button: HTMLButtonElement) => button.click());

    // Wait for the input type to change to 'text'
    await expect(passwordInput).toHaveAttribute('type', 'text', { timeout: 3000 });
  });

  test('should navigate to sign in page from signup page', async ({ page }) => {
    await page.getByRole('link', { name: /sign in to your existing account/i }).click();
    
    // Should be on sign in page
    await expect(page).toHaveURL(/.*\/auth\/signin/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

