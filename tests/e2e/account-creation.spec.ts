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
    await page.goto('/auth/signup');
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

  test('should successfully create account with valid data', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const password = 'testpassword123';

    await page.getByTestId('signup-name-input').fill('Test User');
    await page.getByTestId('signup-email-input').fill(uniqueEmail);
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

    // Find and click the password visibility toggle button (next to password input)
    const passwordContainer = passwordInput.locator('..');
    const toggleButton = passwordContainer.locator('button[type="button"]').first();
    await toggleButton.click();

    // Password should now be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('should navigate to sign in page from signup page', async ({ page }) => {
    await page.getByRole('link', { name: /sign in to your existing account/i }).click();
    
    // Should be on sign in page
    await expect(page).toHaveURL(/.*\/auth\/signin/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

