import { test, expect } from '@playwright/test';
import { getBaseURL } from '../fixtures/test-helpers';

/**
 * API tests for password reset endpoints
 * 
 * Tests cover:
 * - POST /api/auth/forgot-password - Request password reset
 * - POST /api/auth/reset-password - Reset password with token
 * 
 * Note: In some environments (e.g., Vercel staging protection),
 * these endpoints may require authentication or return redirects.
 */

/**
 * Helper to check if response is JSON
 */
function isJsonResponse(response: any): boolean {
  const contentType = response.headers()['content-type'] || '';
  return contentType.includes('application/json');
}

test.describe('Password Reset API', () => {

  test.describe('Forgot Password Endpoint', () => {
    test('should handle valid email request', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        headers: {
          'X-Suppress-Test-Emails': 'true', // Don't send actual emails during testing
        },
        data: {
          email: 'test@example.com',
        },
      });

      // Should not cause server error
      expect(response.status()).not.toBe(500);
      
      // If successful and returns JSON, verify message
      if (response.ok() && isJsonResponse(response)) {
        const data = await response.json();
        expect(data.message).toBeTruthy();
        expect(data.message.toLowerCase()).toMatch(/sent|reset|email/i);
      }
    });

    test('should handle non-existent email (security)', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        headers: {
          'X-Suppress-Test-Emails': 'true',
        },
        data: {
          email: `nonexistent-${Date.now()}@example.com`,
        },
      });

      // Should not cause server error
      expect(response.status()).not.toBe(500);
      
      // If successful, message should be returned
      if (response.ok() && isJsonResponse(response)) {
        const data = await response.json();
        expect(data.message).toBeTruthy();
      }
    });

    test('should reject request with missing email', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          // No email provided
        },
      });

      // Should return error (not 200 success, not 500 crash)
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('should reject request with empty email', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          email: '',
        },
      });

      // Should return error
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });
  });

  test.describe('Reset Password Endpoint', () => {
    test('should reject request with missing token', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          password: 'newpassword123',
          // No token provided
        },
      });

      // Should return error
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('should reject request with missing password', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: 'some-token',
          // No password provided
        },
      });

      // Should return error
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('should reject password shorter than 6 characters', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: 'some-token',
          password: '12345', // Too short
        },
      });

      // Should return error
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('should reject invalid/expired reset token', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: 'invalid-token-12345',
          password: 'newpassword123',
        },
      });

      // Should return error
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('should reject empty token', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: '',
          password: 'newpassword123',
        },
      });

      // Should return error
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('should reject empty password', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: 'some-token',
          password: '',
        },
      });

      // Should return error
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });
  });

  test.describe('Endpoint Availability', () => {
    test('forgot-password endpoint should exist', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {},
      });

      // Should not be 404 (endpoint exists)
      expect(response.status()).not.toBe(404);
    });

    test('reset-password endpoint should exist', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {},
      });

      // Should not be 404 (endpoint exists)
      expect(response.status()).not.toBe(404);
    });
  });
});
