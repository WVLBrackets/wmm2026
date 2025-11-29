/**
 * Authentication helper functions for Playwright tests
 * 
 * These helpers provide reusable functions for signing in users,
 * creating test users, and managing authentication state in tests.
 */

import { Page, APIRequestContext, expect } from '@playwright/test';

/**
 * Sign in a user via API (more reliable than UI)
 * 
 * This authenticates via NextAuth API and sets the session cookie,
 * then navigates to bracket page to verify authentication worked.
 * 
 * After authentication, the browser context has the session cookie,
 * so you can use the browser normally for UI interactions (like filling brackets).
 * 
 * @param page - Playwright page object
 * @param email - User email address
 * @param password - User password
 * @throws Error if sign-in fails
 */
export async function signInUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const baseURL = getBaseURL();
  
  // Step 1: Get CSRF token from NextAuth
  const csrfResponse = await page.request.get(`${baseURL}/api/auth/csrf`);
  if (!csrfResponse.ok()) {
    throw new Error('Failed to get CSRF token');
  }
  const { csrfToken } = await csrfResponse.json();
  
  if (!csrfToken) {
    throw new Error('CSRF token not found in response');
  }
  
  // Step 2: Authenticate via NextAuth credentials callback
  // NextAuth expects form-encoded data
  const formData = new URLSearchParams();
  formData.append('email', email);
  formData.append('password', password);
  formData.append('csrfToken', csrfToken);
  formData.append('redirect', 'false');
  formData.append('json', 'true');
  
  const signInResponse = await page.request.post(`${baseURL}/api/auth/callback/credentials`, {
    data: formData.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  // Step 3: Check if authentication succeeded
  if (!signInResponse.ok()) {
    const errorText = await signInResponse.text().catch(() => '');
    throw new Error(`Sign-in failed: ${errorText || signInResponse.statusText()}`);
  }
  
  // Step 4: Extract and manually set cookies for WebKit/Safari compatibility
  // WebKit doesn't always properly transfer cookies from page.request to the browser context
  const cookies = signInResponse.headers()['set-cookie'];
  if (cookies) {
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    const parsedCookies = cookieArray.map(cookie => {
      const [nameValue, ...attributes] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      const cookieObj: any = {
        name: name.trim(),
        value: value?.trim() || '',
        domain: new URL(baseURL).hostname,
        path: '/',
      };
      
      // Parse attributes
      for (const attr of attributes) {
        const [key, val] = attr.trim().split('=');
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'max-age') {
          cookieObj.maxAge = parseInt(val || '0', 10);
        } else if (lowerKey === 'expires') {
          cookieObj.expires = new Date(val || Date.now()).getTime() / 1000;
        } else if (lowerKey === 'httponly') {
          cookieObj.httpOnly = true;
        } else if (lowerKey === 'secure') {
          cookieObj.secure = true;
        } else if (lowerKey === 'samesite') {
          // Playwright requires capitalized: 'Strict', 'Lax', or 'None'
          const sameSiteValue = val?.toLowerCase() || 'lax';
          if (sameSiteValue === 'strict') {
            cookieObj.sameSite = 'Strict';
          } else if (sameSiteValue === 'none') {
            cookieObj.sameSite = 'None';
          } else {
            cookieObj.sameSite = 'Lax'; // Default
          }
        }
      }
      
      return cookieObj;
    }).filter(c => c.name && c.value);
    
    // Add cookies to browser context (especially important for WebKit)
    if (parsedCookies.length > 0) {
      await page.context().addCookies(parsedCookies);
    }
  }
  
  // Step 5: Wait for cookies to be set (WebKit/Safari needs this)
  await page.waitForTimeout(1000); // Increased wait for WebKit
  
  // Step 5: Verify authentication by checking session
  // Navigate to bracket page to verify we're authenticated
  // Use waitForURL to handle redirects properly, especially for WebKit
  try {
    await page.goto('/bracket', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (error) {
    // If navigation was interrupted (redirect), wait for the final URL
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  }
  
  // Step 6: Wait a moment for any redirects to complete (WebKit can be slow)
  await page.waitForTimeout(500);
  
  // Step 7: Verify we're not redirected to sign-in (means we're authenticated)
  const currentUrl = page.url();
  if (currentUrl.includes('/auth/signin')) {
    // Give WebKit one more chance - sometimes it needs a retry
    await page.waitForTimeout(1000);
    const retryUrl = page.url();
    if (retryUrl.includes('/auth/signin')) {
      throw new Error('Sign-in failed - still redirected to sign-in page (authentication did not work)');
    }
  }
  
  // Step 8: Verify we're on the bracket page
  const finalUrl = page.url();
  if (!finalUrl.includes('/bracket')) {
    throw new Error(`Sign-in failed - redirected to unexpected page: ${finalUrl}`);
  }
  
  // Success! The browser context now has the session cookie and can be used normally
}

/**
 * Sign in a user via the UI (legacy method - less reliable)
 * 
 * @deprecated Use signInUser() which uses API authentication
 * @param page - Playwright page object
 * @param email - User email address
 * @param password - User password
 * @throws Error if sign-in fails
 */
export async function signInUserViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/auth/signin');
  
  // Wait for sign-in form to be visible
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
  
  // Clear and fill in email (clear first to ensure clean state)
  const emailInput = page.locator('input[type="email"]');
  await emailInput.clear();
  await emailInput.fill(email);
  
  // Clear and fill in password (clear first to ensure clean state)
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.clear();
  await passwordInput.fill(password);
  
  // Wait a moment for form to register the values
  await page.waitForTimeout(200);
  
  // Wait for button to be enabled before clicking
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled();
  
  // Set up navigation listener BEFORE clicking
  const navigationPromise = page.waitForURL(/\/bracket/, { timeout: 20000 }).catch(() => null);
  
  // Click sign-in button
  await submitButton.click();
  
  // Wait for either navigation or error
  await page.waitForTimeout(1000); // Give it a moment to process
  
  // Check current URL to see where we are
  const currentUrl = page.url();
  
  // Success case: we're on the bracket page
  if (currentUrl.includes('/bracket') && !currentUrl.includes('/auth/signin')) {
    // Successfully navigated - wait for page to load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    return; // Success!
  }
  
  // If not on bracket page yet, wait for navigation
  const navigated = await navigationPromise;
  if (navigated || page.url().includes('/bracket')) {
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    return; // Success!
  }
  
  // If we didn't navigate, check for error message
  // Check if we're still on sign-in page
  if (currentUrl.includes('/auth/signin')) {
    // Wait a moment for any error message to appear
    await page.waitForTimeout(2000);
    
    // Check for error message
    const errorSelector = '.bg-red-50, .text-red-600, [role="alert"], p.text-red-600';
    const errorVisible = await page.locator(errorSelector).first().isVisible().catch(() => false);
    
    if (errorVisible) {
      // Get the error text
      const errorText = await page.locator(errorSelector).first().textContent().catch(() => '') || '';
      
      // Check specifically for email confirmation errors (not just any mention of "email")
      if (errorText.toLowerCase().includes('confirm')) {
        throw new Error(`Sign-in failed - email not confirmed. Error: ${errorText}`);
      } else {
        throw new Error(`Sign-in failed - invalid credentials. Error: ${errorText}`);
      }
    }
    
    // Check if button is still in loading state
    const isLoading = await page.locator('button[type="submit"]').getByText(/signing in/i).isVisible().catch(() => false);
    
    if (isLoading) {
      // Still loading, wait a bit more
      const secondAttempt = await page.waitForURL(/\/bracket/, { timeout: 15000 }).catch(() => null);
      if (secondAttempt) {
        return; // Success on second attempt
      }
      throw new Error('Sign-in failed - timeout waiting for redirect (button still loading)');
    }
    
    // No error, no loading, but still on sign-in page - something went wrong
    throw new Error('Sign-in failed - timeout waiting for redirect or error message');
  }
  
  // If we're not on signin page but also not on bracket, something unexpected happened
  throw new Error(`Sign-in failed - unexpected state. Current URL: ${currentUrl}`);
}

/**
 * Create a test user via the registration API
 * 
 * @param request - Playwright API request context
 * @param name - User name
 * @param email - User email address
 * @param password - User password
 * @returns User creation response
 */
/**
 * Get the base URL for API requests
 * Matches the pattern used in other test files
 */
function getBaseURL(): string {
  if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
    return process.env.PLAYWRIGHT_TEST_BASE_URL;
  }
  if (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod') {
    return process.env.PRODUCTION_URL || 'https://warrensmm.com';
  }
  return process.env.STAGING_URL || 'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app';
}

/**
 * Create a test user via the registration API
 * 
 * @param request - Playwright API request context
 * @param name - User name
 * @param email - User email address
 * @param password - User password
 * @returns User creation response
 */
export async function createTestUser(
  request: APIRequestContext,
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const baseURL = getBaseURL();
  
  const response = await request.post(`${baseURL}/api/auth/register`, {
    data: {
      name,
      email,
      password,
    },
  });
  
  const data = await response.json();
  
  return {
    success: response.ok(),
    error: data.error,
  };
}

/**
 * Create a test user and confirm their email (if needed)
 * 
 * Note: Email confirmation may require manual intervention or
 * a test-specific confirmation endpoint
 * 
 * @param request - Playwright API request context
 * @param name - User name
 * @param email - User email address
 * @param password - User password
 * @returns User creation response
 */
export async function createAndConfirmTestUser(
  request: APIRequestContext,
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  // Create the user
  const createResult = await createTestUser(request, name, email, password);
  
  if (!createResult.success) {
    return createResult;
  }
  
  // Note: Email confirmation would need to be handled separately
  // This is a placeholder for future implementation
  // In practice, you might need to:
  // 1. Check email confirmation endpoint
  // 2. Use a test-specific confirmation token
  // 3. Or skip confirmation for test users
  
  return createResult;
}

/**
 * Create a test user and sign them in
 * 
 * This is a convenience function that combines user creation and sign-in
 * 
 * @param page - Playwright page object
 * @param request - Playwright API request context
 * @param name - User name
 * @param email - User email address (should be unique, e.g., using timestamp)
 * @param password - User password
 * @returns Created user info
 */
export async function createAndSignInUser(
  page: Page,
  request: APIRequestContext,
  name: string,
  email: string,
  password: string
): Promise<{ email: string; name: string }> {
  // Create the user
  const createResult = await createTestUser(request, name, email, password);
  
  if (!createResult.success) {
    throw new Error(`Failed to create test user: ${createResult.error}`);
  }
  
  // Sign in the user
  await signInUser(page, email, password);
  
  return { email, name };
}

/**
 * Sign out the current user
 * 
 * @param page - Playwright page object
 */
export async function signOutUser(page: Page): Promise<void> {
  // Look for logout button/link - this may vary based on your UI
  // Common patterns:
  // - Button with text "Sign out" or "Logout"
  // - Link in navigation menu
  // - Dropdown menu with logout option
  
  // Try to find and click logout button
  const logoutButton = page.getByRole('button', { name: /sign out|logout/i })
    .or(page.getByRole('link', { name: /sign out|logout/i }));
  
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
    // Wait for redirect to sign-in or home page
    await page.waitForURL(/^(?!.*\/bracket)/, { timeout: 5000 });
  }
}

/**
 * Check if a user is currently signed in
 * 
 * @param page - Playwright page object
 * @returns True if user appears to be signed in
 */
export async function isUserSignedIn(page: Page): Promise<boolean> {
  // Navigate to a protected page and check if we're redirected
  await page.goto('/bracket');
  
  // If we're redirected to sign-in, user is not signed in
  const currentUrl = page.url();
  return !currentUrl.includes('/auth/signin');
}

