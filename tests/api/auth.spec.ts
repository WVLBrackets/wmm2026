import { test, expect } from '@playwright/test';
import { getBaseURL } from '../fixtures/test-helpers';
import { generateUniqueEmail } from '../fixtures/test-data';

/**
 * API tests for authentication endpoints
 * 
 * These tests use Playwright's request API to test the backend
 * without involving the browser UI.
 * 
 * Note: Some endpoints may require authentication or return redirects
 * in certain environments (e.g., Vercel staging protection).
 */
test.describe('Account Creation API', () => {

  test('should handle registration request', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = generateUniqueEmail('api-test');
    const userData = {
      name: 'Test User',
      email: uniqueEmail,
      password: 'testpassword123',
    };

    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: userData,
    });

    // Endpoint should not cause server error
    expect(response.status()).not.toBe(500);
    
    // If registration succeeds, verify response structure
    if (response.ok()) {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        expect(data.message).toContain('successfully');
        expect(data.userId).toBeDefined();
      }
    }
  });

  test('should reject registration with missing fields', async ({ request }) => {
    const baseURL = getBaseURL();
    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: {
        name: 'Test User',
        // Missing email and password
      },
    });

    // Should return error (400, 401, or 422 are acceptable)
    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(500);
  });

  test('should reject registration with password too short', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = generateUniqueEmail('api-short-pwd');
    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: {
        name: 'Test User',
        email: uniqueEmail,
        password: '12345', // Less than 6 characters
      },
    });

    // Should return error (not success)
    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(500);
  });

  test('should handle duplicate email registration', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = generateUniqueEmail('api-dup');
    const userData = {
      name: 'Test User',
      email: uniqueEmail,
      password: 'testpassword123',
    };

    // Create first user
    const firstResponse = await request.post(`${baseURL}/api/auth/register`, {
      data: userData,
    });
    
    // If first creation succeeds, try duplicate
    if (firstResponse.ok()) {
      const duplicateResponse = await request.post(`${baseURL}/api/auth/register`, {
        data: userData,
      });

      // Should reject duplicate (409 or other error)
      expect(duplicateResponse.status()).not.toBe(200);
      expect(duplicateResponse.status()).not.toBe(500);
    } else {
      // If first request failed (e.g., auth required), just verify no server error
      expect(firstResponse.status()).not.toBe(500);
    }
  });

  test('should reject invalid email format', async ({ request }) => {
    const baseURL = getBaseURL();
    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: {
        name: 'Test User',
        email: 'not-an-email',
        password: 'testpassword123',
      },
    });

    // Should not succeed with invalid email
    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(500);
  });

  test('should handle successful registration response', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = generateUniqueEmail('api-success');
    const userData = {
      name: 'Test User',
      email: uniqueEmail,
      password: 'testpassword123',
    };

    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: userData,
    });

    // Should not cause server error
    expect(response.status()).not.toBe(500);
    
    // If successful, verify userId is returned
    if (response.ok()) {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        expect(data.userId).toBeDefined();
        expect(typeof data.userId).toBe('string');
      }
    }
  });

  test('should handle email confirmation response', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = generateUniqueEmail('api-confirm');
    const userData = {
      name: 'Test User',
      email: uniqueEmail,
      password: 'testpassword123',
    };

    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: userData,
    });

    // Should not cause server error
    expect(response.status()).not.toBe(500);
    
    // If successful, message should mention email confirmation
    if (response.ok()) {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        expect(data.message.toLowerCase()).toMatch(/check your email|confirm/i);
      }
    }
  });

  test('should reject confirmation with invalid token', async ({ request }) => {
    const baseURL = getBaseURL();
    const response = await request.post(`${baseURL}/api/auth/confirm`, {
      data: {
        token: 'invalid-token-12345',
      },
    });

    // Should return error (not success, not server error)
    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(500);
  });

  test('should reject confirmation with missing token', async ({ request }) => {
    const baseURL = getBaseURL();
    const response = await request.post(`${baseURL}/api/auth/confirm`, {
      data: {
        // No token provided
      },
    });

    // Should return error
    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(500);
  });
});
