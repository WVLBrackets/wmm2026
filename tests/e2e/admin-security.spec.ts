import { test, expect } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';
import { getBaseURL, getTestUserCredentials } from '../fixtures/test-helpers';

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
    test('should block non-admin user from /admin', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      
      // Try to access admin page
      await page.goto('/admin');
      
      // Should either redirect away or show unauthorized message
      const url = page.url();
      const isRedirected = !url.includes('/admin') || url.includes('/auth/signin') || url.includes('/bracket');
      const hasUnauthorized = await page.getByText(/unauthorized|access denied|not authorized|forbidden/i).isVisible().catch(() => false);
      
      expect(isRedirected || hasUnauthorized).toBeTruthy();
    });

    test('should block non-admin user from /admin/users-across-environments', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      
      // Try to access admin page
      await page.goto('/admin/users-across-environments');
      
      // Should either redirect away or show unauthorized message
      const url = page.url();
      const isRedirected = !url.includes('/admin') || url.includes('/auth/signin') || url.includes('/bracket');
      const hasUnauthorized = await page.getByText(/unauthorized|access denied|not authorized|forbidden/i).isVisible().catch(() => false);
      
      expect(isRedirected || hasUnauthorized).toBeTruthy();
    });

    test('should block non-admin user from /admin/reset-password', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      
      // Try to access admin page
      await page.goto('/admin/reset-password');
      
      // Should either redirect away or show unauthorized message
      const url = page.url();
      const isRedirected = !url.includes('/admin') || url.includes('/auth/signin') || url.includes('/bracket');
      const hasUnauthorized = await page.getByText(/unauthorized|access denied|not authorized|forbidden/i).isVisible().catch(() => false);
      
      expect(isRedirected || hasUnauthorized).toBeTruthy();
    });

    test('should block non-admin user from /admin/tournament-builder', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
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
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/users`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('should return 401/403 for unauthenticated admin brackets API', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/brackets`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('should return 401/403 for unauthenticated admin reset-password API', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/reset-password`, {
        data: { email: 'test@example.com', newPassword: 'test123' }
      });
      
      expect([401, 403]).toContain(response.status());
    });
  });
});

