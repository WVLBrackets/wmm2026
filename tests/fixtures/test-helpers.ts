/**
 * Test helper functions for Playwright tests
 * 
 * NOTE: We do not use API endpoints for test operations to avoid security risks.
 * Test data cleanup is handled via the local script: npm run cleanup:test-data
 */

import { Page, Locator } from '@playwright/test';

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

