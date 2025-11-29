/**
 * Test helper functions for Playwright tests
 * 
 * NOTE: We do not use API endpoints for test operations to avoid security risks.
 * Test data cleanup is handled via the local script: npm run cleanup:test-data
 */

import { Page } from '@playwright/test';

/**
 * Submits the signup form in a way that works reliably across all browsers,
 * especially WebKit which may not trigger onSubmit when clicking the submit button.
 * 
 * @param page - Playwright page object
 */
export async function submitSignupForm(page: Page): Promise<void> {
  const form = page.locator('form');
  
  // Use requestSubmit() which properly triggers onSubmit event in all browsers
  // This is especially important for WebKit/Safari
  try {
    await form.evaluate((form) => {
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      }
    });
  } catch {
    // Fallback to button click if requestSubmit fails
    await page.getByTestId('signup-submit-button').click();
  }
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

