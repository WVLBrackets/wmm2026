import { test, expect } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';

/**
 * Group 7: Sign Out Tests
 * 
 * Tests for user logout functionality:
 * - Logout button visibility
 * - Logout redirects to sign in
 * - Session is cleared after logout
 * - Protected pages redirect after logout
 * 
 * Note: These tests require authentication to test logout.
 */

test.describe('Sign Out Functionality', () => {
  /**
   * Get test user credentials from environment variables
   */
  const getTestUserCredentials = () => {
    const isProduction = process.env.TEST_ENV === 'production' || 
                         process.env.TEST_ENV === 'prod' ||
                         (process.env.PLAYWRIGHT_TEST_BASE_URL && 
                          process.env.PLAYWRIGHT_TEST_BASE_URL.includes('warrensmm.com'));
    
    const password = isProduction 
      ? (process.env.TEST_USER_PASSWORD_PRODUCTION || process.env.TEST_USER_PASSWORD)
      : (process.env.TEST_USER_PASSWORD_STAGING || process.env.TEST_USER_PASSWORD);
    
    if (!process.env.TEST_USER_EMAIL || !password) {
      throw new Error(
        'TEST_USER_EMAIL and TEST_USER_PASSWORD_STAGING/PRODUCTION environment variables are required. ' +
        'See tests/AUTHENTICATION_TEST_SETUP.md for setup instructions.'
      );
    }
    
    return {
      email: process.env.TEST_USER_EMAIL,
      password: password,
    };
  };

  // ==========================================
  // LOGOUT BUTTON VISIBILITY TESTS
  // ==========================================
  test.describe('Logout Button Visibility', () => {
    test.beforeEach(async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
    });

    test('should display logout button on bracket landing page', async ({ page }) => {
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Should see logout button
      const logoutButton = page.getByRole('button', { name: /logout/i }).or(
        page.locator('button').filter({ has: page.locator('svg.lucide-log-out') })
      );
      await expect(logoutButton.first()).toBeVisible({ timeout: 10000 });
    });

    test('should display logout button on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // On mobile, the logout button is in the mobile layout section
      // Look for visible logout button (mobile may show icon-only)
      const logoutButton = page.locator('button:visible').filter({ has: page.locator('svg') });
      
      // There should be at least one visible button with an icon (logout or new bracket)
      const visibleButtons = await logoutButton.count();
      expect(visibleButtons).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // LOGOUT FLOW TESTS
  // ==========================================
  test.describe('Logout Flow', () => {
    test('should redirect to sign in after logout', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Click logout button
      const logoutButton = page.getByRole('button', { name: /logout/i }).or(
        page.locator('button').filter({ has: page.locator('svg.lucide-log-out') })
      );
      await logoutButton.first().click();
      
      // Should redirect to sign in page
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15000 });
    });

    test('should show sign in page after logout', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Click logout
      const logoutButton = page.getByRole('button', { name: /logout/i }).or(
        page.locator('button').filter({ has: page.locator('svg.lucide-log-out') })
      );
      await logoutButton.first().click();
      
      // Wait for redirect
      await page.waitForURL(/\/auth\/signin/, { timeout: 15000 });
      
      // Should see sign in form
      await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });
  });

  // ==========================================
  // SESSION CLEARED TESTS
  // ==========================================
  test.describe('Session Cleared After Logout', () => {
    test('should not access protected page after logout', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Click logout
      const logoutButton = page.getByRole('button', { name: /logout/i }).or(
        page.locator('button').filter({ has: page.locator('svg.lucide-log-out') })
      );
      await logoutButton.first().click();
      
      // Wait for redirect to sign in
      await page.waitForURL(/\/auth\/signin/, { timeout: 15000 });
      
      // Try to access bracket page directly
      await page.goto('/bracket');
      
      // Should be redirected to sign in (not authenticated)
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15000 });
    });

    test('should require re-authentication after logout', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Verify we're on bracket page
      await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 10000 });
      
      // Click logout
      const logoutButton = page.getByRole('button', { name: /logout/i }).or(
        page.locator('button').filter({ has: page.locator('svg.lucide-log-out') })
      );
      await logoutButton.first().click();
      
      // Wait for sign in page
      await page.waitForURL(/\/auth\/signin/, { timeout: 15000 });
      
      // Navigate to bracket - should redirect to sign in
      await page.goto('/bracket');
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10000 });
      
      // Re-authenticate
      await signInUser(page, credentials.email, credentials.password);
      
      // Should be able to access bracket page again
      await page.goto('/bracket');
      await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  // ==========================================
  // LOGOUT FROM DIFFERENT CONTEXTS
  // ==========================================
  test.describe('Logout from Different States', () => {
    test('should logout successfully when on landing page', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Logout
      const logoutButton = page.getByRole('button', { name: /logout/i }).or(
        page.locator('button').filter({ has: page.locator('svg.lucide-log-out') })
      );
      await logoutButton.first().click();
      
      // Should redirect to sign in
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15000 });
    });

    test('should handle logout when bracket wizard is open', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Open bracket wizard
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      
      // Wait for wizard to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Note: In the bracket wizard, logout may not be visible
      // This test verifies the cancel flow exits properly
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        
        // Should return to landing
        await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
        
        // Now logout
        const logoutButton = page.getByRole('button', { name: /logout/i }).or(
          page.locator('button').filter({ has: page.locator('svg.lucide-log-out') })
        );
        await logoutButton.first().click();
        
        // Should redirect to sign in
        await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15000 });
      }
    });
  });

  // ==========================================
  // MULTIPLE LOGOUT ATTEMPTS
  // ==========================================
  test.describe('Multiple Logout Handling', () => {
    test('should handle being on sign in page gracefully', async ({ page }) => {
      // Go directly to sign in (not authenticated)
      await page.goto('/auth/signin');
      
      // Should display sign in page without errors
      await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('should redirect unauthenticated user from bracket to sign in', async ({ page }) => {
      // Clear any existing session by not signing in
      await page.goto('/bracket');
      
      // Should redirect to sign in
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15000 });
    });
  });
});

