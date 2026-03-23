/**
 * Test helper functions for Playwright tests
 * 
 * This module provides centralized configuration and helper functions used across
 * all test files. Import from here instead of duplicating these functions.
 * 
 * NOTE: We do not use API endpoints for test operations to avoid security risks.
 * Test data cleanup is handled via the local script: npm run cleanup:test-data
 */

import { Page, Locator, expect, APIRequestContext } from '@playwright/test';

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

/**
 * Get the base URL for API requests and navigation.
 * Centralized to avoid duplication across test files.
 * 
 * Priority:
 * 1. PLAYWRIGHT_TEST_BASE_URL (explicit override)
 * 2. Production URL if TEST_ENV is production/prod
 * 3. Staging URL (default - safest for testing)
 */
export function getBaseURL(): string {
  if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
    return process.env.PLAYWRIGHT_TEST_BASE_URL;
  }
  
  if (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod') {
    return process.env.PRODUCTION_URL || 'https://warrensmm.com';
  }
  
  return process.env.STAGING_URL || 'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app';
}

/**
 * Determine if we're testing against production environment
 */
export function isProductionEnvironment(): boolean {
  return process.env.TEST_ENV === 'production' || 
         process.env.TEST_ENV === 'prod' ||
         (process.env.PLAYWRIGHT_TEST_BASE_URL?.includes('warrensmm.com') ?? false);
}

/**
 * Map of Playwright project names to their test user email environment variables.
 * Each browser project uses a dedicated test user to avoid rate limiting during parallel execution.
 */
const PROJECT_USER_MAP: Record<string, string> = {
  'chromium': 'TEST_USER_EMAIL',           // Primary user (real email for monitoring)
  'firefox': 'TEST_USER_EMAIL_FIREFOX',
  'webkit': 'TEST_USER_EMAIL_WEBKIT',
  'Mobile Chrome': 'TEST_USER_EMAIL_MOBILE_CHROME',
  'Mobile Safari': 'TEST_USER_EMAIL_MOBILE_SAFARI',
  'Mobile Safari (Pro)': 'TEST_USER_EMAIL_MOBILE_SAFARI_PRO',
};

/**
 * Get test user credentials from environment variables.
 * Centralized to ensure consistent credential handling across all tests.
 * 
 * @param projectName - Optional Playwright project name (e.g., 'chromium', 'firefox', 'Mobile Chrome')
 *                      When provided, returns credentials for the project-specific test user.
 *                      This prevents rate limiting when running tests in parallel across browsers.
 * @throws Error if required environment variables are missing
 */
export function getTestUserCredentials(projectName?: string): { email: string; password: string; name: string } {
  const isProduction = isProductionEnvironment();
  
  // Determine which email to use based on project
  let email: string | undefined;
  let password: string | undefined;
  
  if (projectName && PROJECT_USER_MAP[projectName]) {
    // Use project-specific test user
    const emailEnvVar = PROJECT_USER_MAP[projectName];
    email = process.env[emailEnvVar];
    
    // Primary user (chromium) uses environment-specific password
    // Secondary users all share TEST_USER_PASSWORD_SECONDARY
    if (emailEnvVar === 'TEST_USER_EMAIL') {
      password = isProduction 
        ? (process.env.TEST_USER_PASSWORD_PRODUCTION || process.env.TEST_USER_PASSWORD)
        : (process.env.TEST_USER_PASSWORD_STAGING || process.env.TEST_USER_PASSWORD);
    } else {
      password = process.env.TEST_USER_PASSWORD_SECONDARY || process.env.TEST_USER_PASSWORD_STAGING;
    }
  } else {
    // Fallback to primary test user (backward compatibility)
    email = process.env.TEST_USER_EMAIL;
    password = isProduction 
      ? (process.env.TEST_USER_PASSWORD_PRODUCTION || process.env.TEST_USER_PASSWORD)
      : (process.env.TEST_USER_PASSWORD_STAGING || process.env.TEST_USER_PASSWORD);
  }
  
  if (!email) {
    const envVar = projectName && PROJECT_USER_MAP[projectName] 
      ? PROJECT_USER_MAP[projectName] 
      : 'TEST_USER_EMAIL';
    throw new Error(
      `${envVar} environment variable is required. ` +
      'See tests/AUTHENTICATION_TEST_SETUP.md for setup instructions.'
    );
  }
  
  if (!password) {
    const envVar = isProduction ? 'TEST_USER_PASSWORD_PRODUCTION' : 'TEST_USER_PASSWORD_STAGING';
    throw new Error(
      `${envVar} or TEST_USER_PASSWORD environment variable is required. ` +
      'See tests/AUTHENTICATION_TEST_SETUP.md for setup instructions.'
    );
  }
  
  return {
    email,
    password,
    name: process.env.TEST_USER_NAME || 'Test User',
  };
}

// =============================================================================
// RELIABLE WAIT UTILITIES (Replacing waitForTimeout anti-pattern)
// =============================================================================

/**
 * Wait for network to be idle with a fallback timeout.
 * Prefer this over waitForTimeout for page loads.
 */
export async function waitForNetworkSettled(page: Page, timeout = 10000): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  }
}

/**
 * Wait for an element to be stable (no layout shifts).
 * Use after interactions that trigger animations or layout changes.
 */
export async function waitForElementStable(locator: Locator, timeout = 5000): Promise<void> {
  await expect(locator).toBeVisible({ timeout });
  const box1 = await locator.boundingBox();
  await locator.page().waitForTimeout(100);
  const box2 = await locator.boundingBox();
  
  if (box1 && box2 && (box1.x !== box2.x || box1.y !== box2.y)) {
    await locator.page().waitForTimeout(200);
  }
}

/**
 * Wait for navigation to complete, handling redirects gracefully.
 * Use instead of waitForTimeout after navigation actions.
 */
export async function waitForNavigationComplete(page: Page, expectedUrlPattern?: RegExp): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    if (expectedUrlPattern) {
      await expect(page).toHaveURL(expectedUrlPattern, { timeout: 10000 });
    }
  } catch {
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
  }
}

/**
 * Retry an action with exponential backoff.
 * Use for operations that may be flaky due to timing.
 */
export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 500
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// =============================================================================
// FORM INTERACTION HELPERS
// =============================================================================

/**
 * Fills an input field reliably in WebKit, which has issues with React controlled inputs.
 * Uses a slower typing approach that works better with React's state updates.
 * 
 * @param locator - The input field locator
 * @param value - The value to fill
 */
export async function fillInputReliably(locator: Locator, value: string): Promise<void> {
  // For WebKit, we need to be more careful with React controlled inputs
  // 1. Clear the field first
  await locator.clear();
  
  // 2. Focus the field
  await locator.focus();
  
  // 3. Wait a moment for focus to settle
  await locator.page().waitForTimeout(100);
  
  // 4. Type the value character by character (slower but more reliable in WebKit)
  // This gives React time to process each character
  await locator.type(value, { delay: 50 });
  
  // 5. Verify the value was actually set
  const actualValue = await locator.inputValue();
  if (actualValue !== value) {
    // If value doesn't match, try one more time with a different approach
    await locator.clear();
    await locator.focus();
    await locator.evaluate((el: HTMLInputElement, val: string) => {
      el.value = val;
      // Trigger input event for React
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
  
  // 6. Wait a moment for React to process
  await locator.page().waitForTimeout(200);
}

/**
 * Submits the signup form in a way that works reliably across all browsers,
 * especially WebKit which may not trigger onSubmit when clicking the submit button.
 * 
 * @param page - Playwright page object
 */
export async function submitSignupForm(page: Page): Promise<void> {
  // WebKit has issues with form submission. The form now has method="post" and action=""
  // to prevent GET submissions. Click the submit button - for WebKit, keyboard Enter is more reliable.
  const submitButton = page.getByTestId('signup-submit-button');
  
  // For WebKit, try clicking normally first, then fallback to keyboard Enter
  try {
    await submitButton.click({ timeout: 5000 });
  } catch {
    // Fallback: Focus and press Enter (more reliable in WebKit)
    await submitButton.focus();
    await page.keyboard.press('Enter');
  }
  
  // Give React time to process the event
  await page.waitForTimeout(300);
}

/**
 * Get the confirmation token for a user by email
 * 
 * SECURITY NOTE: This function is not implemented because creating an API endpoint
 * to retrieve tokens would be a security risk. Instead, the confirmation flow test
 * is skipped or uses alternative methods that don't require token retrieval.
 * 
 * @deprecated - Not used. Confirmation flow testing is handled differently.
 */
export async function getConfirmationTokenForUser(
  baseURL: string,
  userEmail: string
): Promise<string | null> {
  // Intentionally not implemented - security risk
  console.warn('getConfirmationTokenForUser is not available - security restriction');
  return null;
}

/**
 * Confirm a user's email using their confirmation token
 */
export async function confirmUserEmail(
  baseURL: string,
  token: string
): Promise<{ success: boolean; userEmail?: string; signInToken?: string }> {
  try {
    const response = await fetch(`${baseURL}/api/auth/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    return {
      success: true,
      userEmail: data.userEmail,
      signInToken: data.signInToken,
    };
  } catch (error) {
    console.error('Error confirming user email:', error);
    return { success: false };
  }
}

/**
 * Clean up test data (delete test users)
 * 
 * SECURITY NOTE: We do not use API endpoints for cleanup to avoid security risks.
 * Use the local cleanup script instead: npm run cleanup:test-data
 * 
 * @deprecated - Use local cleanup script instead
 */
export async function cleanupTestData(baseURL: string): Promise<{ success: boolean; deletedCount?: number }> {
  // Intentionally not implemented - use local script instead
  console.warn('cleanupTestData API endpoint removed for security. Use: npm run cleanup:test-data');
  return { success: false };
}

/**
 * Preview test data that would be deleted
 * 
 * SECURITY NOTE: We do not use API endpoints for this to avoid security risks.
 * Use the local cleanup script instead: npm run cleanup:test-data
 * 
 * @deprecated - Use local cleanup script instead
 */
export async function previewTestData(baseURL: string): Promise<{ count: number; users: any[] }> {
  // Intentionally not implemented - use local script instead
  console.warn('previewTestData API endpoint removed for security. Use: npm run cleanup:test-data');
  return { count: 0, users: [] };
}

// =============================================================================
// TEST DATA TRACKING (for cleanup reporting)
// =============================================================================

/**
 * Interface for tracking test-created data
 */
interface TestDataRecord {
  type: 'user' | 'bracket';
  identifier: string;
  createdAt: Date;
  testFile?: string;
}

/**
 * In-memory storage for test data tracking.
 * This is used to track what test data was created during a test run.
 */
const testDataRegistry: TestDataRecord[] = [];

/**
 * Track test data creation for cleanup reporting.
 * Call this after creating test users or brackets.
 * 
 * @param type - The type of data created
 * @param identifier - Email for users, ID for brackets
 * @param testFile - Optional test file name for context
 */
export function trackTestData(type: 'user' | 'bracket', identifier: string, testFile?: string): void {
  testDataRegistry.push({
    type,
    identifier,
    createdAt: new Date(),
    testFile,
  });
}

/**
 * Get all tracked test data for cleanup reporting.
 */
export function getTrackedTestData(): TestDataRecord[] {
  return [...testDataRegistry];
}

/**
 * Clear the test data registry.
 * Call this at the start of a test suite if you want isolated tracking.
 */
export function clearTestDataRegistry(): void {
  testDataRegistry.length = 0;
}

/**
 * Generate a cleanup report for test data.
 * Use this in afterAll hooks to report what needs cleaning up.
 */
export function generateCleanupReport(): string {
  if (testDataRegistry.length === 0) {
    return 'No test data to clean up.';
  }
  
  const users = testDataRegistry.filter(r => r.type === 'user');
  const brackets = testDataRegistry.filter(r => r.type === 'bracket');
  
  let report = '=== Test Data Cleanup Report ===\n\n';
  
  if (users.length > 0) {
    report += `Users created (${users.length}):\n`;
    users.forEach(u => {
      report += `  - ${u.identifier} (${u.createdAt.toISOString()})\n`;
    });
    report += '\n';
  }
  
  if (brackets.length > 0) {
    report += `Brackets created (${brackets.length}):\n`;
    brackets.forEach(b => {
      report += `  - ${b.identifier} (${b.createdAt.toISOString()})\n`;
    });
    report += '\n';
  }
  
  report += 'To clean up test data, run: npm run cleanup:test-data\n';
  
  return report;
}

// =============================================================================
// TEST ISOLATION UTILITIES
// =============================================================================

/**
 * Generate a unique test run ID for this test session.
 * Use this to tag test data for easier cleanup.
 */
export function getTestRunId(): string {
  if (!process.env.TEST_RUN_ID) {
    process.env.TEST_RUN_ID = `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
  return process.env.TEST_RUN_ID;
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return process.env.CI === 'true' || !!process.env.GITHUB_ACTIONS;
}

/**
 * Get a unique prefix for test data created in this run.
 * Includes timestamp and random component for uniqueness.
 */
export function getTestDataPrefix(): string {
  const runId = getTestRunId();
  return `test-${runId.substring(5, 13)}`;
}

// =============================================================================
// RESPONSIVE LOCATOR HELPERS
// =============================================================================

/**
 * Mobile project names in Playwright configuration.
 * These projects use mobile viewports where responsive components may have
 * different visibility states than desktop.
 */
const MOBILE_PROJECTS = ['Mobile Chrome', 'Mobile Safari', 'Mobile Safari (Pro)'];

/**
 * Determines if the given project name represents a mobile viewport.
 * Use this to conditionally select responsive elements.
 * 
 * @param projectName - The Playwright project name from testInfo.project.name
 * @returns true if the project is a mobile viewport
 */
export function isMobileProject(projectName?: string): boolean {
  return projectName ? MOBILE_PROJECTS.includes(projectName) : false;
}

/**
 * Returns a locator for the "New Bracket" button appropriate for the current viewport.
 * Uses the viewport-specific test IDs: new-bracket-button-desktop / new-bracket-button-mobile
 * 
 * @param page - Playwright page object
 * @param projectName - The Playwright project name from testInfo.project.name
 * @returns Locator for the viewport-appropriate New Bracket button
 */
export function getNewBracketButton(page: Page, projectName?: string): Locator {
  const testId = isMobileProject(projectName) 
    ? 'new-bracket-button-mobile' 
    : 'new-bracket-button-desktop';
  return page.getByTestId(testId);
}

/**
 * Returns a locator for the "Logout" button appropriate for the current viewport.
 * Uses the viewport-specific test IDs: logout-button-desktop / logout-button-mobile
 * 
 * @param page - Playwright page object
 * @param projectName - The Playwright project name from testInfo.project.name
 * @returns Locator for the viewport-appropriate Logout button
 */
export function getLogoutButton(page: Page, projectName?: string): Locator {
  const testId = isMobileProject(projectName) 
    ? 'logout-button-mobile' 
    : 'logout-button-desktop';
  return page.getByTestId(testId);
}

// =============================================================================
// CSRF TOKEN HELPERS
// =============================================================================

/**
 * Fetch a CSRF token from the application for API testing.
 * This is separate from NextAuth's CSRF token and is used for
 * state-changing API calls to bracket endpoints.
 * 
 * @param request - Playwright API request context
 * @returns CSRF token string or null if unavailable
 */
export async function getAppCSRFToken(request: APIRequestContext): Promise<string | null> {
  const baseURL = getBaseURL();
  
  try {
    const response = await request.get(`${baseURL}/api/csrf-token`);
    
    if (!response.ok()) {
      console.warn('Failed to fetch CSRF token:', response.status());
      return null;
    }
    
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('application/json')) {
      console.warn('CSRF endpoint returned non-JSON response');
      return null;
    }
    
    const data = await response.json();
    return data.csrfToken || null;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    return null;
  }
}

/**
 * Get headers for making authenticated state-changing API calls.
 * Includes both Content-Type and CSRF token.
 * 
 * @param request - Playwright API request context
 * @returns Headers object with Content-Type and CSRF token
 */
export async function getAuthenticatedAPIHeaders(
  request: APIRequestContext
): Promise<Record<string, string>> {
  const csrfToken = await getAppCSRFToken(request);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }
  
  return headers;
}

