import { test, expect } from '@playwright/test';
import { generateUniqueEmail, generateTestUser } from '../fixtures/test-data';
import { submitSignupForm } from '../fixtures/test-helpers';

/**
 * E2E tests for account validation
 * 
 * Tests various validation scenarios for account creation,
 * including field requirements, format validation, and edge cases.
 */
test.describe('Account Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signup');
  });

  test('should require all fields to be filled', async ({ page }) => {
    // Try to submit empty form
    await submitSignupForm(page);

    // HTML5 validation should prevent submission
    // Check that required attributes are present
    const nameInput = page.getByTestId('signup-name-input');
    const emailInput = page.getByTestId('signup-email-input');
    const passwordInput = page.getByTestId('signup-password-input');
    const confirmPasswordInput = page.getByTestId('signup-confirm-password-input');

    await expect(nameInput).toHaveAttribute('required', '');
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
    await expect(confirmPasswordInput).toHaveAttribute('required', '');
  });

  test('should validate email format', async ({ page }) => {
    const testUser = generateTestUser();

    await page.getByTestId('signup-name-input').fill(testUser.name);
    await page.getByTestId('signup-email-input').fill('invalid-email');
    await page.getByTestId('signup-password-input').fill(testUser.password);
    await page.getByTestId('signup-confirm-password-input').fill(testUser.password);

    // HTML5 email validation should prevent invalid email format
    const emailInput = page.getByTestId('signup-email-input');
    await expect(emailInput).toHaveAttribute('type', 'email');
    
    // Try to submit - browser should show validation message
    await submitSignupForm(page);
    
    // The form should not submit with invalid email
    // Check that we're still on the signup page (no success message)
    const successHeader = page.getByTestId('signup-success-header');
    await expect(successHeader).not.toBeVisible({ timeout: 1000 });
  });

  test('should validate password minimum length', async ({ page }) => {
    const testUser = generateTestUser();

    await page.getByTestId('signup-name-input').fill(testUser.name);
    await page.getByTestId('signup-email-input').fill(testUser.email);
    await page.getByTestId('signup-password-input').fill('12345'); // 5 characters
    await page.getByTestId('signup-confirm-password-input').fill('12345');

    await submitSignupForm(page);

    // Should show error message
    await expect(page.getByTestId('signup-error-message')).toBeVisible();
    await expect(page.getByText(/password must be at least 6 characters/i)).toBeVisible();
  });

  test('should accept password with exactly 6 characters', async ({ page }) => {
    const testUser = generateTestUser();
    const shortPassword = '123456'; // Exactly 6 characters

    await page.getByTestId('signup-name-input').fill(testUser.name);
    await page.getByTestId('signup-email-input').fill(testUser.email);
    await page.getByTestId('signup-password-input').fill(shortPassword);
    await page.getByTestId('signup-confirm-password-input').fill(shortPassword);

    await submitSignupForm(page);

    // Should succeed (6 characters is the minimum)
    await expect(page.getByTestId('signup-success-header')).toBeVisible();
  });

  test('should validate password confirmation match', async ({ page }) => {
    const testUser = generateTestUser();

    await page.getByTestId('signup-name-input').fill(testUser.name);
    await page.getByTestId('signup-email-input').fill(testUser.email);
    await page.getByTestId('signup-password-input').fill('password123');
    await page.getByTestId('signup-confirm-password-input').fill('differentpassword');

    await submitSignupForm(page);

    // Should show error message
    await expect(page.getByTestId('signup-error-message')).toBeVisible();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should handle special characters in name', async ({ page }) => {
    const testUser = generateTestUser();
    const nameWithSpecialChars = "O'Brien-Smith";

    await page.getByTestId('signup-name-input').fill(nameWithSpecialChars);
    await page.getByTestId('signup-email-input').fill(testUser.email);
    await page.getByTestId('signup-password-input').fill(testUser.password);
    await page.getByTestId('signup-confirm-password-input').fill(testUser.password);

    await submitSignupForm(page);

    // Should succeed
    await expect(page.getByTestId('signup-success-header')).toBeVisible();
  });

  test('should handle long email addresses', async ({ page }) => {
    const testUser = generateTestUser();
    const longEmail = `verylongemailaddress${'a'.repeat(100)}@example.com`;

    await page.getByTestId('signup-name-input').fill(testUser.name);
    await page.getByTestId('signup-email-input').fill(longEmail);
    await page.getByTestId('signup-password-input').fill(testUser.password);
    await page.getByTestId('signup-confirm-password-input').fill(testUser.password);

    await submitSignupForm(page);

    // Should either succeed or show appropriate error
    // The behavior depends on database constraints
    const successHeader = page.getByTestId('signup-success-header');
    const errorMessage = page.getByTestId('signup-error-message');
    
    // One of these should be visible
    await expect(successHeader.or(errorMessage)).toBeVisible();
  });

  test('should disable submit button while loading', async ({ page }) => {
    const testUser = generateTestUser();

    await page.getByTestId('signup-name-input').fill(testUser.name);
    await page.getByTestId('signup-email-input').fill(testUser.email);
    await page.getByTestId('signup-password-input').fill(testUser.password);
    await page.getByTestId('signup-confirm-password-input').fill(testUser.password);

    const submitButton = page.getByTestId('signup-submit-button');
    await submitButton.click();

    // Button should be disabled and show loading state
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toContainText(/creating account/i);
  });
});

