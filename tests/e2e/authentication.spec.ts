import { test, expect } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';

/**
 * E2E tests for authentication flow
 * 
 * These tests verify:
 * - Sign in with valid credentials
 * - Sign in with invalid credentials
 * - Sign out functionality
 * - Session persistence
 * - Protected route access
 */

test.describe('Authentication', () => {
  /**
   * Get test user credentials from environment variables
   * 
   * REQUIRED environment variables:
   * - TEST_USER_EMAIL: The email address of the confirmed test user
   * - TEST_USER_PASSWORD_STAGING: Password for staging environment
   * - TEST_USER_PASSWORD_PRODUCTION: Password for production environment
   * 
   * Optional:
   * - TEST_USER_NAME: Display name (defaults to "Test User")
   */
  const getTestUserCredentials = () => {
    // Determine which environment we're testing against
    const isProduction = process.env.TEST_ENV === 'production' || 
                         process.env.TEST_ENV === 'prod' ||
                         (process.env.PLAYWRIGHT_TEST_BASE_URL && 
                          process.env.PLAYWRIGHT_TEST_BASE_URL.includes('warrensmm.com'));
    
    // Get password based on environment
    const password = isProduction 
      ? (process.env.TEST_USER_PASSWORD_PRODUCTION || process.env.TEST_USER_PASSWORD)
      : (process.env.TEST_USER_PASSWORD_STAGING || process.env.TEST_USER_PASSWORD);
    
    // Validate required environment variables
    if (!process.env.TEST_USER_EMAIL) {
      throw new Error(
        'TEST_USER_EMAIL environment variable is required. ' +
        'Please set it before running authentication tests. ' +
        'See tests/AUTHENTICATION_TEST_SETUP.md for setup instructions.'
      );
    }
    
    if (!password) {
      const envVar = isProduction ? 'TEST_USER_PASSWORD_PRODUCTION' : 'TEST_USER_PASSWORD_STAGING';
      throw new Error(
        `${envVar} or TEST_USER_PASSWORD environment variable is required. ` +
        `Please set it before running authentication tests. ` +
        'See tests/AUTHENTICATION_TEST_SETUP.md for setup instructions.'
      );
    }
    
    return {
      email: process.env.TEST_USER_EMAIL,
      password: password,
      name: process.env.TEST_USER_NAME || 'Test User',
      useExisting: true, // Always use existing user (no dynamic creation)
    };
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to home page before each test
    await page.goto('/');
  });

  test('should sign in with valid credentials', async ({ page }) => {
    const credentials = getTestUserCredentials();
    
    // Sign in with the confirmed test user
    await signInUser(page, credentials.email, credentials.password);
    
    // Verify we're signed in by checking we're not on the sign-in page
    // and we can access a protected route
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/auth/signin');
    
    // Try to access bracket page (protected route) - wait for navigation
    await page.goto('/bracket', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500); // Give WebKit time for any redirects
    await expect(page).not.toHaveURL(/.*\/auth\/signin/, { timeout: 10000 });
  });

  test('should show error with invalid email', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Wait for sign-in form
    await page.waitForSelector('input[type="email"]', { state: 'visible' });
    
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Click sign-in button
    await page.click('button[type="submit"]');
    
    // Wait for error message to appear
    // The error message should be visible (either in a div or as text)
    await expect(
      page.locator('text=/invalid|incorrect|wrong|error/i').or(
        page.locator('.bg-red-50, .text-red-600, [role="alert"]')
      )
    ).toBeVisible({ timeout: 10000 });
    
    // Verify we're still on the sign-in page
    expect(page.url()).toContain('/auth/signin');
  });

  test('should show error with invalid password', async ({ page }) => {
    const credentials = getTestUserCredentials();
    
    await page.goto('/auth/signin');
    
    // Wait for sign-in form
    await page.waitForSelector('input[type="email"]', { state: 'visible' });
    
    // Fill in correct email but wrong password
    await page.fill('input[type="email"]', credentials.email);
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Click sign-in button
    await page.click('button[type="submit"]');
    
    // Wait for error message to appear
    await expect(
      page.locator('text=/invalid|incorrect|wrong|error/i').or(
        page.locator('.bg-red-50, .text-red-600, [role="alert"]')
      )
    ).toBeVisible({ timeout: 10000 });
    
    // Verify we're still on the sign-in page
    expect(page.url()).toContain('/auth/signin');
  });

  test('should maintain session after page refresh', async ({ page }) => {
    const credentials = getTestUserCredentials();
    
    // Sign in with the confirmed test user
    await signInUser(page, credentials.email, credentials.password);
    
    // Verify we're signed in
    await page.goto('/bracket');
    expect(page.url()).not.toContain('/auth/signin');
    
    // Refresh the page
    await page.reload();
    
    // Verify we're still signed in (not redirected to sign-in)
    await expect(page).not.toHaveURL(/.*\/auth\/signin/);
    
    // Verify we can still access protected routes
    await page.goto('/bracket');
    expect(page.url()).not.toContain('/auth/signin');
  });

  test('should redirect to sign-in when accessing protected route without authentication', async ({ page }) => {
    // Try to access bracket page without being signed in
    await page.goto('/bracket');
    
    // Should be redirected to sign-in page
    // Note: This assumes your app redirects unauthenticated users
    // If your app shows the bracket page but with a "sign in" prompt,
    // you may need to adjust this test
    await expect(page).toHaveURL(/.*\/auth\/signin/, { timeout: 10000 });
  });

  test('should navigate to signup page from signin page', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Find and click the "create a new account" link
    const signupLink = page.getByRole('link', { name: /create.*account|sign.*up/i });
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    
    // Verify we're on the signup page
    await expect(page).toHaveURL(/.*\/auth\/signup/);
    
    // Verify signup form is visible
    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible();
  });

  test('should navigate to signin page from signup page', async ({ page }) => {
    await page.goto('/auth/signup');
    
    // Find and click the "sign in" link
    const signinLink = page.getByRole('link', { name: /sign.*in|existing.*account/i });
    await expect(signinLink).toBeVisible();
    await signinLink.click();
    
    // Verify we're on the signin page
    await expect(page).toHaveURL(/.*\/auth\/signin/);
    
    // Verify signin form is visible
    await expect(page.getByRole('heading', { name: /sign.*in/i })).toBeVisible();
  });
});

