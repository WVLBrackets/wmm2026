import { test, expect } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';
import { getTestUserCredentials, waitForNavigationComplete } from '../fixtures/test-helpers';

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

  test.beforeEach(async ({ page }) => {
    // Navigate to home page before each test
    await page.goto('/');
  });

  test('should sign in with valid credentials', async ({ page }, testInfo) => {
    const credentials = getTestUserCredentials(testInfo.project.name);
    
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

  test('should show error with invalid password', async ({ page }, testInfo) => {
    const credentials = getTestUserCredentials(testInfo.project.name);
    
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

  test('should maintain session after page refresh', async ({ page, browserName }, testInfo) => {
    const credentials = getTestUserCredentials(testInfo.project.name);
    
    // Sign in with the confirmed test user
    await signInUser(page, credentials.email, credentials.password);
    
    // Verify we're signed in - wait for navigation to complete
    await page.goto('/bracket', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500); // Give WebKit time for any redirects
    expect(page.url()).not.toContain('/auth/signin');
    
    // For WebKit, verify cookies are present before reload
    if (browserName === 'webkit') {
      const cookiesBeforeReload = await page.context().cookies();
      const hasSessionCookie = cookiesBeforeReload.some(c => 
        c.name.includes('next-auth') || c.name.includes('session')
      );
      if (!hasSessionCookie) {
        throw new Error('Session cookie not found before reload - authentication may have failed');
      }
    }
    
    // Refresh the page - wait for it to complete
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // For WebKit, wait longer and verify cookies are still present after reload
    if (browserName === 'webkit') {
      await page.waitForTimeout(1500); // Give WebKit more time after reload
      
      // Check if cookies are still present
      const cookiesAfterReload = await page.context().cookies();
      const hasSessionCookieAfter = cookiesAfterReload.some(c => 
        c.name.includes('next-auth') || c.name.includes('session')
      );
      
      if (!hasSessionCookieAfter) {
        console.warn('Session cookie lost after reload in WebKit. Cookies:', cookiesAfterReload.map(c => c.name));
        // Try to re-authenticate by navigating to a protected route
        // This will trigger NextAuth to check the session
        await page.goto('/bracket', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);
      }
    } else {
      await page.waitForTimeout(500);
    }
    
    // Verify we're still signed in (not redirected to sign-in)
    // Increase timeout for WebKit which can be slower
    await expect(page).not.toHaveURL(/.*\/auth\/signin/, { timeout: 10000 });
    
    // Verify we can still access protected routes
    await page.goto('/bracket', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500); // Give WebKit time for any redirects
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

