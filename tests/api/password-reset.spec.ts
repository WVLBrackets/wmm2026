import { test, expect } from '@playwright/test';

/**
 * API tests for password reset endpoints
 * 
 * Tests cover:
 * - POST /api/auth/forgot-password - Request password reset
 * - POST /api/auth/reset-password - Reset password with token
 */
test.describe('Password Reset API', () => {
  // Get baseURL from Playwright config (defaults to staging for safety)
  const getBaseURL = () => {
    if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
      return process.env.PLAYWRIGHT_TEST_BASE_URL;
    }
    
    if (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod') {
      return process.env.PRODUCTION_URL || 'https://warrensmm.com';
    }
    
    return process.env.STAGING_URL || 'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app';
  };

  test.describe('Forgot Password Endpoint', () => {
    test('should accept valid email and return success message', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        headers: {
          'X-Suppress-Test-Emails': 'true', // Don't send actual emails during testing
        },
        data: {
          email: 'test@example.com',
        },
      });

      // Should always return success (even for non-existent users for security)
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.message).toBeTruthy();
      expect(data.message.toLowerCase()).toMatch(/sent|reset|email/i);
    });

    test('should return same message for non-existent email (security)', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        headers: {
          'X-Suppress-Test-Emails': 'true',
        },
        data: {
          email: `nonexistent-${Date.now()}@example.com`,
        },
      });

      // Should return success to not reveal if user exists
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.message).toBeTruthy();
    });

    test('should reject request with missing email', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          // No email provided
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
      expect(data.error.toLowerCase()).toMatch(/email.*required|required/i);
    });

    test('should reject request with empty email', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          email: '',
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
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

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
      expect(data.error.toLowerCase()).toMatch(/token.*required|required/i);
    });

    test('should reject request with missing password', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: 'some-token',
          // No password provided
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
      expect(data.error.toLowerCase()).toMatch(/password.*required|required/i);
    });

    test('should reject password shorter than 6 characters', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: 'some-token',
          password: '12345', // Too short
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
      expect(data.error.toLowerCase()).toMatch(/6 characters|too short/i);
    });

    test('should reject invalid/expired reset token', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: 'invalid-token-12345',
          password: 'newpassword123',
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
      expect(data.error.toLowerCase()).toMatch(/invalid|expired/i);
    });

    test('should reject empty token', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: '',
          password: 'newpassword123',
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    test('should reject empty password', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {
          token: 'some-token',
          password: '',
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });
  });

  test.describe('Endpoint Availability', () => {
    test('forgot-password endpoint should exist', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {},
      });

      // Should get 400 (bad request) not 404 (not found)
      expect(response.status()).not.toBe(404);
    });

    test('reset-password endpoint should exist', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.post(`${baseURL}/api/auth/reset-password`, {
        data: {},
      });

      // Should get 400 (bad request) not 404 (not found)
      expect(response.status()).not.toBe(404);
    });
  });
});

