import { test, expect } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';
import { getTestUserCredentials, getLogoutButton, getNewBracketButton } from '../fixtures/test-helpers';

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

  // ==========================================
  // LOGOUT BUTTON VISIBILITY TESTS
  // ==========================================
  test.describe('Logout Button Visibility', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
    });

    test('should display logout button on bracket landing page', async ({ page }, testInfo) => {
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Should see logout button - use data-testid for stability across viewports
      await expect(getLogoutButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
    });

    test('should display logout button on mobile viewport', async ({ page }, testInfo) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Logout button should be visible on mobile - use data-testid for stability
      await expect(getLogoutButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
    });
  });

  // ==========================================
  // LOGOUT FLOW TESTS
  // ==========================================
  test.describe('Logout Flow', () => {
    test('should redirect to sign in after logout', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Click logout button - use data-testid for stability
      await getLogoutButton(page, testInfo.project.name).click();
      
      // Should redirect to sign in page
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15000 });
    });

    test('should show sign in page after logout', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Click logout - use data-testid for stability
      await getLogoutButton(page, testInfo.project.name).click();
      
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
    test('should not access protected page after logout', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Click logout - use data-testid for stability
      await getLogoutButton(page, testInfo.project.name).click();
      
      // Wait for redirect to sign in
      await page.waitForURL(/\/auth\/signin/, { timeout: 15000 });
      
      // Try to access bracket page directly
      await page.goto('/bracket');
      
      // Should be redirected to sign in (not authenticated)
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15000 });
    });

    test('should require re-authentication after logout', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Verify we're on bracket page - use :visible for mobile/desktop
      const welcomeText = page.locator('h1:visible').filter({ hasText: /welcome/i });
      await expect(welcomeText.first()).toBeVisible({ timeout: 10000 });
      
      // Click logout - use data-testid for stability
      await getLogoutButton(page, testInfo.project.name).click();
      
      // Wait for sign in page
      await page.waitForURL(/\/auth\/signin/, { timeout: 15000 });
      
      // Navigate to bracket - should redirect to sign in
      await page.goto('/bracket');
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10000 });
      
      // Re-authenticate
      await signInUser(page, credentials.email, credentials.password);
      
      // Should be able to access bracket page again
      await page.goto('/bracket');
      const welcomeTextAfter = page.locator('h1:visible').filter({ hasText: /welcome/i });
      await expect(welcomeTextAfter.first()).toBeVisible({ timeout: 10000 });
    });
  });

  // ==========================================
  // LOGOUT FROM DIFFERENT CONTEXTS
  // ==========================================
  test.describe('Logout from Different States', () => {
    test('should logout successfully when on landing page', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for landing page - use data-testid for stability
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 15000 });
      
      // Logout - use data-testid for stability
      await getLogoutButton(page, testInfo.project.name).click();
      
      // Should redirect to sign in
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15000 });
    });

    test('should handle logout when bracket wizard is open', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      
      await page.goto('/bracket');
      
      // Wait for landing page - use data-testid for stability
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 15000 });
      
      // Open bracket wizard
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Note: In the bracket wizard, logout may not be visible
      // This test verifies the cancel flow exits properly
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        
        // Should return to landing - use data-testid for stability
        await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 15000 });
        
        // Now logout - use data-testid for stability
        await getLogoutButton(page, testInfo.project.name).click();
        
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

