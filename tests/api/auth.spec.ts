import { test, expect } from '@playwright/test';

/**
 * API tests for authentication endpoints
 * 
 * These tests use Playwright's request API to test the backend
 * without involving the browser UI.
 */
test.describe('Account Creation API', () => {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

  test('should create a new user account successfully', async ({ request }) => {
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
    const response = await request.post(`${baseURL}/api/auth/register`, {
      data: {
        name: 'Test User',
        email: 'not-an-email',
        password: 'testpassword123',
      },
    });

    // The API might validate this, or the database might reject it
    // Adjust expectation based on actual behavior
    expect([400, 500]).toContain(response.status());
  });
});

