import { test, expect } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';

/**
 * Admin Security Tests
 * 
 * These tests verify that non-admin users are properly blocked from accessing
 * admin pages. This is a security test - we don't need admin credentials,
 * we just verify that regular users CANNOT access admin functionality.
 * 
 * Admin pages tested:
 * - /admin (main admin dashboard)
 * - /admin/users-across-environments
 * - /admin/reset-password
 * - /admin/tournament-builder
 */

test.describe('Admin Security - Access Control', () => {
  /**
   * Get test user credentials (regular user, NOT admin)
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
        'TEST_USER_EMAIL and TEST_USER_PASSWORD_STAGING/PRODUCTION environment variables are required.'
      );
    }
    
    return {
      email: process.env.TEST_USER_EMAIL,
      password: password,
    };
  };

  test.describe('Unauthenticated Access', () => {
    test('should redirect unauthenticated user from /admin to sign-in', async ({ page }) => {
      await page.goto('/admin');
      
      // Should be redirected to sign-in page
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10000 });
    });

    test('should redirect unauthenticated user from /admin/users-across-environments', async ({ page }) => {
      await page.goto('/admin/users-across-environments');
      
      // Should be redirected to sign-in page
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10000 });
    });

    test('should redirect unauthenticated user from /admin/reset-password', async ({ page }) => {
      await page.goto('/admin/reset-password');
      
      // Should be redirected to sign-in page
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10000 });
    });

    test('should redirect unauthenticated user from /admin/tournament-builder', async ({ page }) => {
      await page.goto('/admin/tournament-builder');
      
      // Should be redirected to sign-in page
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10000 });
    });
  });

  test.describe('Non-Admin Authenticated Access', () => {
    // Helper to check if running on production
    const isProduction = () => {
      return process.env.TEST_ENV === 'production' || 
             process.env.TEST_ENV === 'prod' ||
             (process.env.PLAYWRIGHT_TEST_BASE_URL && 
              process.env.PLAYWRIGHT_TEST_BASE_URL.includes('warrensmm.com'));
    };

    test('should block non-admin user from /admin', async ({ page }) => {
      // Skip on production - no test user available
      test.skip(isProduction(), 'Skipping authenticated test on production - no test user');
      
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      // Try to access admin page
      await page.goto('/admin');
      
      // Should either redirect away or show unauthorized message
      const url = page.url();
      const isRedirected = !url.includes('/admin') || url.includes('/auth/signin') || url.includes('/bracket');
      const hasUnauthorized = await page.getByText(/unauthorized|access denied|not authorized|forbidden/i).isVisible().catch(() => false);
      
      expect(isRedirected || hasUnauthorized).toBeTruthy();
    });

    test('should block non-admin user from /admin/users-across-environments', async ({ page }) => {
      test.skip(isProduction(), 'Skipping authenticated test on production - no test user');
      
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      // Try to access admin page
      await page.goto('/admin/users-across-environments');
      
      // Should either redirect away or show unauthorized message
      const url = page.url();
      const isRedirected = !url.includes('/admin') || url.includes('/auth/signin') || url.includes('/bracket');
      const hasUnauthorized = await page.getByText(/unauthorized|access denied|not authorized|forbidden/i).isVisible().catch(() => false);
      
      expect(isRedirected || hasUnauthorized).toBeTruthy();
    });

    test('should block non-admin user from /admin/reset-password', async ({ page }) => {
      test.skip(isProduction(), 'Skipping authenticated test on production - no test user');
      
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      // Try to access admin page
      await page.goto('/admin/reset-password');
      
      // Should either redirect away or show unauthorized message
      const url = page.url();
      const isRedirected = !url.includes('/admin') || url.includes('/auth/signin') || url.includes('/bracket');
      const hasUnauthorized = await page.getByText(/unauthorized|access denied|not authorized|forbidden/i).isVisible().catch(() => false);
      
      expect(isRedirected || hasUnauthorized).toBeTruthy();
    });

    test('should block non-admin user from /admin/tournament-builder', async ({ page }) => {
      test.skip(isProduction(), 'Skipping authenticated test on production - no test user');
      
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      
      // Try to access admin page
      await page.goto('/admin/tournament-builder');
      
      // Should either redirect away or show unauthorized message
      const url = page.url();
      const isRedirected = !url.includes('/admin') || url.includes('/auth/signin') || url.includes('/bracket');
      const hasUnauthorized = await page.getByText(/unauthorized|access denied|not authorized|forbidden/i).isVisible().catch(() => false);
      
      expect(isRedirected || hasUnauthorized).toBeTruthy();
    });
  });

  test.describe('Admin API Security', () => {
    test('should return 401/403 for unauthenticated admin API request', async ({ request }) => {
      // Get baseURL
      const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 
                      process.env.STAGING_URL || 
                      'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app';
      
      // Try to access admin users API without authentication
      const response = await request.get(`${baseURL}/api/admin/users`);
      
      // Should be 401 (unauthorized) or 403 (forbidden)
      expect([401, 403]).toContain(response.status());
    });

    test('should return 401/403 for unauthenticated admin brackets API', async ({ request }) => {
      const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 
                      process.env.STAGING_URL || 
                      'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app';
      
      const response = await request.get(`${baseURL}/api/admin/brackets`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('should return 401/403 for unauthenticated admin reset-password API', async ({ request }) => {
      const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 
                      process.env.STAGING_URL || 
                      'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app';
      
      const response = await request.post(`${baseURL}/api/admin/reset-password`, {
        data: { email: 'test@example.com', newPassword: 'test123' }
      });
      
      expect([401, 403]).toContain(response.status());
    });
  });
});

