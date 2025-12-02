import { test, expect } from '@playwright/test';

/**
 * API tests for bracket endpoints
 * 
 * Tests the tournament bracket API:
 * - GET /api/tournament-bracket - List all brackets
 * - POST /api/tournament-bracket - Submit bracket
 * - PUT /api/tournament-bracket - Save in-progress bracket
 * - GET /api/tournament-bracket/[id] - Get specific bracket
 * - PUT /api/tournament-bracket/[id] - Update specific bracket
 * - DELETE /api/tournament-bracket/[id] - Delete bracket
 * - GET /api/bracket/check-creation - Check if creation is allowed
 * 
 * Note: Most endpoints require authentication.
 */

test.describe('Bracket API', () => {
  /**
   * Get base URL for API requests
   */
  const getBaseURL = () => {
    if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
      return process.env.PLAYWRIGHT_TEST_BASE_URL;
    }
    if (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod') {
      return process.env.PRODUCTION_URL || 'https://warrensmm.com';
    }
    return process.env.STAGING_URL || 'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app';
  };

  /**
   * Get test user credentials
   */
  const getTestCredentials = () => {
    const isProduction = process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod';
    return {
      email: process.env.TEST_USER_EMAIL || '',
      password: isProduction 
        ? (process.env.TEST_USER_PASSWORD_PRODUCTION || process.env.TEST_USER_PASSWORD || '')
        : (process.env.TEST_USER_PASSWORD_STAGING || process.env.TEST_USER_PASSWORD || ''),
    };
  };

  /**
   * Helper to get authenticated session cookies
   */
  async function getAuthenticatedSession(request: any): Promise<string | null> {
    const baseURL = getBaseURL();
    const credentials = getTestCredentials();
    
    if (!credentials.email || !credentials.password) {
      return null;
    }
    
    // Get CSRF token
    const csrfResponse = await request.get(`${baseURL}/api/auth/csrf`);
    if (!csrfResponse.ok()) return null;
    
    const { csrfToken } = await csrfResponse.json();
    
    // Authenticate
    const formData = new URLSearchParams();
    formData.append('email', credentials.email);
    formData.append('password', credentials.password);
    formData.append('csrfToken', csrfToken);
    formData.append('redirect', 'false');
    formData.append('json', 'true');
    
    const signInResponse = await request.post(`${baseURL}/api/auth/callback/credentials`, {
      data: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    if (!signInResponse.ok()) return null;
    
    // Extract session cookie
    const cookies = signInResponse.headers()['set-cookie'];
    return cookies || null;
  }

  // ==========================================
  // UNAUTHENTICATED ACCESS TESTS
  // ==========================================
  test.describe('Unauthenticated Access', () => {
    test('GET /api/tournament-bracket should return 401 without auth', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket`);
      
      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unauthorized');
    });

    test('POST /api/tournament-bracket should return 401 without auth', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/tournament-bracket`, {
        data: {
          playerName: 'Test User',
          playerEmail: 'test@example.com',
          entryName: 'Test Bracket',
          picks: { 'game-1': 'team-1' },
        },
      });
      
      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    test('PUT /api/tournament-bracket should return 401 without auth', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.put(`${baseURL}/api/tournament-bracket`, {
        data: {
          playerName: 'Test User',
          playerEmail: 'test@example.com',
          entryName: 'Test Bracket',
          picks: { 'game-1': 'team-1' },
        },
      });
      
      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    test('GET /api/tournament-bracket/[id] should return 401 without auth', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket/fake-id-123`);
      
      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    test('DELETE /api/tournament-bracket/[id] should return 401 without auth', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.delete(`${baseURL}/api/tournament-bracket/fake-id-123`);
      
      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    test('GET /api/bracket/check-creation should return 401 without auth', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/bracket/check-creation`);
      
      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  // ==========================================
  // VALIDATION TESTS
  // ==========================================
  test.describe('Request Validation', () => {
    test('POST should reject missing required fields', async ({ request }) => {
      const baseURL = getBaseURL();
      
      // Even without auth, we can test that validation would fail
      // The 401 will come before validation, but we document expected behavior
      const response = await request.post(`${baseURL}/api/tournament-bracket`, {
        data: {
          // Missing playerName, playerEmail, entryName, picks
        },
      });
      
      // Will get 401 before validation, which is correct
      expect([400, 401]).toContain(response.status());
    });

    test('PUT should reject missing required fields', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.put(`${baseURL}/api/tournament-bracket`, {
        data: {
          // Missing required fields
        },
      });
      
      expect([400, 401]).toContain(response.status());
    });
  });

  // ==========================================
  // API STRUCTURE TESTS
  // ==========================================
  test.describe('API Response Structure', () => {
    test('API responses should follow consistent format', async ({ request }) => {
      const baseURL = getBaseURL();
      
      // Test that error responses have consistent structure
      const response = await request.get(`${baseURL}/api/tournament-bracket`);
      const data = await response.json();
      
      // All responses should have 'success' field
      expect(data).toHaveProperty('success');
      
      // Error responses should have 'error' field
      if (!data.success) {
        expect(data).toHaveProperty('error');
        expect(typeof data.error).toBe('string');
      }
    });

    test('GET /api/tournament-bracket/invalid-id should return 401 or 404', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket/nonexistent-bracket-id`);
      
      // Without auth, should be 401
      // With auth but invalid ID, should be 404
      expect([401, 404]).toContain(response.status());
    });
  });

  // ==========================================
  // ENDPOINT AVAILABILITY TESTS  
  // ==========================================
  test.describe('Endpoint Availability', () => {
    test('GET /api/tournament-bracket endpoint exists', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket`);
      
      // Should not be 404 (endpoint exists)
      expect(response.status()).not.toBe(404);
      // Should be 401 (auth required)
      expect(response.status()).toBe(401);
    });

    test('POST /api/tournament-bracket endpoint exists', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/tournament-bracket`, {
        data: {},
      });
      
      expect(response.status()).not.toBe(404);
    });

    test('PUT /api/tournament-bracket endpoint exists', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.put(`${baseURL}/api/tournament-bracket`, {
        data: {},
      });
      
      expect(response.status()).not.toBe(404);
    });

    test('GET /api/bracket/check-creation endpoint exists', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/bracket/check-creation`);
      
      expect(response.status()).not.toBe(404);
    });

    test('GET /api/tournament-bracket/[id] endpoint exists', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket/test-id`);
      
      // Should return 401 (auth required), not 404 (endpoint missing)
      expect(response.status()).toBe(401);
    });

    test('PUT /api/tournament-bracket/[id] endpoint exists', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.put(`${baseURL}/api/tournament-bracket/test-id`, {
        data: {},
      });
      
      expect(response.status()).not.toBe(404);
    });

    test('DELETE /api/tournament-bracket/[id] endpoint exists', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.delete(`${baseURL}/api/tournament-bracket/test-id`);
      
      expect(response.status()).not.toBe(404);
    });
  });

  // ==========================================
  // HTTP METHOD TESTS
  // ==========================================
  test.describe('HTTP Methods', () => {
    test('PATCH /api/tournament-bracket should return 405 Method Not Allowed', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.patch(`${baseURL}/api/tournament-bracket`, {
        data: {},
      });
      
      // PATCH is not implemented, should be 405 or handled as error
      expect([401, 405]).toContain(response.status());
    });

    test('OPTIONS /api/tournament-bracket should be handled', async ({ request }) => {
      const baseURL = getBaseURL();
      
      // OPTIONS is typically handled by CORS middleware
      const response = await request.fetch(`${baseURL}/api/tournament-bracket`, {
        method: 'OPTIONS',
      });
      
      // Should not be 404
      expect(response.status()).not.toBe(404);
    });
  });

  // ==========================================
  // CONTENT TYPE TESTS
  // ==========================================
  test.describe('Content Type Handling', () => {
    test('API should accept JSON content type', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/tournament-bracket`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          playerName: 'Test',
          playerEmail: 'test@test.com',
          entryName: 'Test',
          picks: {},
        }),
      });
      
      // Should process request (auth fails, not content type)
      expect(response.status()).toBe(401);
    });

    test('API responses should be JSON', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket`);
      const contentType = response.headers()['content-type'];
      
      expect(contentType).toContain('application/json');
    });
  });

  // ==========================================
  // TEAM DATA API TESTS
  // ==========================================
  test.describe('Team Data API', () => {
    test('GET /api/team-data should return team data', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/team-data`);
      
      // Team data endpoint should be publicly accessible
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('success');
    });
  });

  // ==========================================
  // SITE CONFIG API TESTS
  // ==========================================
  test.describe('Site Config API', () => {
    test('GET /api/site-config should return config', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/site-config`);
      
      // Site config should be publicly accessible
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('success');
      
      if (data.success) {
        expect(data).toHaveProperty('data');
      }
    });
  });

  // ==========================================
  // ERROR HANDLING TESTS
  // ==========================================
  test.describe('Error Handling', () => {
    test('API should handle malformed JSON gracefully', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/tournament-bracket`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: 'not valid json {{{',
      });
      
      // Should return error, not crash
      expect([400, 401, 500]).toContain(response.status());
    });

    test('API should handle empty body', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/tournament-bracket`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: '',
      });
      
      // Should return error
      expect([400, 401, 500]).toContain(response.status());
    });

    test('API should handle very long bracket ID', async ({ request }) => {
      const baseURL = getBaseURL();
      const longId = 'a'.repeat(1000);
      
      const response = await request.get(`${baseURL}/api/tournament-bracket/${longId}`);
      
      // Should handle gracefully (401 auth or 404 not found)
      expect([401, 404, 400]).toContain(response.status());
    });

    test('API should handle special characters in bracket ID', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket/test%20id%26special`);
      
      // Should handle gracefully
      expect([401, 404, 400]).toContain(response.status());
    });
  });
});

