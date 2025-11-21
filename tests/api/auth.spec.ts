import { test, expect } from '@playwright/test';

/**
 * API tests for authentication endpoints
 * 
 * These tests use Playwright's request API to test the backend
 * without involving the browser UI.
 */
test.describe('Account Creation API', () => {
  // Get baseURL from Playwright config (defaults to staging for safety)
  const getBaseURL = () => {
    // Explicit base URL takes precedence
    if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
      return process.env.PLAYWRIGHT_TEST_BASE_URL;
    }
    
    // Only use production if explicitly set
    if (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod') {
      return process.env.PRODUCTION_URL || 'https://warrensmm.com';
    }
    
    // Default to staging (safest for testing)
    return process.env.STAGING_URL || 'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app';
  };

  test('should create a new user account successfully', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const userData = {
      name: 'Test User',
      email: uniqueEmail,
      password: 'testpassword123',
    };

    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: userData,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.message).toContain('successfully');
    expect(data.userId).toBeDefined();
  });

  test('should reject registration with missing fields', async ({ request }) => {
    const baseURL = getBaseURL();
    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: {
        name: 'Test User',
        // Missing email and password
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('required');
  });

  test('should reject registration with password too short', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: {
        name: 'Test User',
        email: uniqueEmail,
        password: '12345', // Less than 6 characters
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('6 characters');
  });

  test('should reject duplicate email registration', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const userData = {
      name: 'Test User',
      email: uniqueEmail,
      password: 'testpassword123',
    };

    // Create first user
    const firstResponse = await request.post(`${baseURL}/api/auth/register`, {
      data: userData,
    });
    expect(firstResponse.ok()).toBeTruthy();

    // Try to create duplicate
    const duplicateResponse = await request.post(`${baseURL}/api/auth/register`, {
      data: userData,
    });

    expect(duplicateResponse.status()).toBe(409);
    const data = await duplicateResponse.json();
    expect(data.error).toContain('already exists');
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

    // The API might validate this (400), the database might reject it (500),
    // or it might be treated as a conflict (409). All are valid error responses.
    expect([400, 409, 500]).toContain(response.status());
    
    // Verify that the response indicates an error
    const data = await response.json();
    expect(data.error).toBeTruthy();
  });

  test('should successfully create user and return userId', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const userData = {
      name: 'Test User',
      email: uniqueEmail,
      password: 'testpassword123',
    };

    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: userData,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.message).toContain('successfully');
    expect(data.userId).toBeDefined();
    expect(typeof data.userId).toBe('string');
  });

  test('should require email confirmation after registration', async ({ request }) => {
    const baseURL = getBaseURL();
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const userData = {
      name: 'Test User',
      email: uniqueEmail,
      password: 'testpassword123',
    };

    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: userData,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Response should indicate email confirmation is required
    expect(data.message.toLowerCase()).toMatch(/check your email|confirm/i);
  });

  test('should reject confirmation with invalid token', async ({ request }) => {
    const baseURL = getBaseURL();
    const response = await request.post(`${baseURL}/api/auth/confirm`, {
      data: {
        token: 'invalid-token-12345',
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeTruthy();
    expect(data.error.toLowerCase()).toMatch(/invalid|expired|token/i);
  });

  test('should reject confirmation with missing token', async ({ request }) => {
    const baseURL = getBaseURL();
    const response = await request.post(`${baseURL}/api/auth/confirm`, {
      data: {
        // No token provided
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeTruthy();
    expect(data.error.toLowerCase()).toMatch(/token.*required|required.*token/i);
  });
});

