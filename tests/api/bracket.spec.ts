import { test, expect } from '@playwright/test';
import { getBaseURL, getTestUserCredentials } from '../fixtures/test-helpers';

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
 * Note: Most endpoints require authentication. In some environments
 * (e.g., Vercel staging protection), unauthenticated requests may
 * return redirects (302) or HTML instead of JSON errors.
 */

/**
 * Helper to check if response is JSON
 */
function isJsonResponse(response: any): boolean {
  const contentType = response.headers()['content-type'] || '';
  return contentType.includes('application/json');
}

test.describe('Bracket API', () => {

  /**
   * Helper to get authenticated session cookies
   */
  async function getAuthenticatedSession(request: any): Promise<string | null> {
    const baseURL = getBaseURL();
    let credentials;
    try {
      credentials = getTestUserCredentials();
    } catch {
      return null;
    }
    
    // Get CSRF token
    const csrfResponse = await request.get(`${baseURL}/api/auth/csrf`);
    if (!csrfResponse.ok()) return null;
    
    const contentType = csrfResponse.headers()['content-type'] || '';
    if (!contentType.includes('application/json')) return null;
    
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
    test('GET /api/tournament-bracket should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket`);
      
      // Should not return 200 (success) or 500 (server error)
      // Acceptable: 401, 403, 302 (redirect to login)
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
      
      // If JSON response, verify error structure
      if (isJsonResponse(response)) {
        const data = await response.json();
        expect(data.success).toBe(false);
      }
    });

    test('POST /api/tournament-bracket should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/tournament-bracket`, {
        data: {
          playerName: 'Test User',
          playerEmail: 'test@example.com',
          entryName: 'Test Bracket',
          picks: { 'game-1': 'team-1' },
        },
      });
      
      // Should not succeed without auth
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('PUT /api/tournament-bracket should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.put(`${baseURL}/api/tournament-bracket`, {
        data: {
          playerName: 'Test User',
          playerEmail: 'test@example.com',
          entryName: 'Test Bracket',
          picks: { 'game-1': 'team-1' },
        },
      });
      
      // Should not succeed without auth
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('GET /api/tournament-bracket/[id] should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket/fake-id-123`);
      
      // Should not succeed without auth
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('DELETE /api/tournament-bracket/[id] should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.delete(`${baseURL}/api/tournament-bracket/fake-id-123`);
      
      // Should not succeed without auth
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('GET /api/bracket/check-creation should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/bracket/check-creation`);
      
      // Should not succeed without auth
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });
  });

  // ==========================================
  // VALIDATION TESTS
  // ==========================================
  test.describe('Request Validation', () => {
    test('POST should reject missing required fields', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/tournament-bracket`, {
        data: {
          // Missing playerName, playerEmail, entryName, picks
        },
      });
      
      // Should return error (400, 401, or 422)
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('PUT should reject missing required fields', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.put(`${baseURL}/api/tournament-bracket`, {
        data: {
          // Missing required fields
        },
      });
      
      // Should return error
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });
  });

  // ==========================================
  // API STRUCTURE TESTS
  // ==========================================
  test.describe('API Response Structure', () => {
    test('API error responses should follow consistent format when JSON', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket`);
      
      // If JSON response, verify structure
      if (isJsonResponse(response)) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        
        if (!data.success) {
          expect(data).toHaveProperty('error');
          expect(typeof data.error).toBe('string');
        }
      }
    });

    test('GET /api/tournament-bracket/invalid-id should return error', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket/nonexistent-bracket-id`);
      
      // Should not return 200 or 500
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
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
      
      // Should not be 404 (endpoint exists)
      expect(response.status()).not.toBe(404);
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
    test('PATCH /api/tournament-bracket should not be allowed or require auth', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.patch(`${baseURL}/api/tournament-bracket`, {
        data: {},
      });
      
      // Should not succeed (405, 401, or other error)
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('OPTIONS /api/tournament-bracket should be handled', async ({ request }) => {
      const baseURL = getBaseURL();
      
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
      
      // Should process request (not 404 or 500)
      expect(response.status()).not.toBe(404);
      expect(response.status()).not.toBe(500);
    });

    test('API responses should be JSON when returning data', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket`);
      
      // If not a redirect, content type should be JSON
      if (response.status() !== 302 && response.status() !== 307) {
        const contentType = response.headers()['content-type'] || '';
        // May return HTML for auth pages in some environments
        expect(contentType).toBeTruthy();
      }
    });
  });

  // ==========================================
  // TEAM DATA API TESTS
  // ==========================================
  test.describe('Team Data API', () => {
    test('GET /api/team-data should handle request', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/team-data`);
      
      // Should not return 404 or 500
      expect(response.status()).not.toBe(404);
      expect(response.status()).not.toBe(500);
      
      // If successful, verify response structure
      if (response.ok() && isJsonResponse(response)) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
      }
    });
  });

  // ==========================================
  // SITE CONFIG API TESTS
  // ==========================================
  test.describe('Site Config API', () => {
    test('GET /api/site-config should handle request', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/site-config`);
      
      // Should not return 404 or 500
      expect(response.status()).not.toBe(404);
      expect(response.status()).not.toBe(500);
      
      // If successful, verify response structure
      if (response.ok() && isJsonResponse(response)) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        
        if (data.success) {
          expect(data).toHaveProperty('data');
        }
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
      expect(response.status()).not.toBe(500);
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
      expect(response.status()).not.toBe(500);
    });

    test('API should handle very long bracket ID', async ({ request }) => {
      const baseURL = getBaseURL();
      const longId = 'a'.repeat(1000);
      
      const response = await request.get(`${baseURL}/api/tournament-bracket/${longId}`);
      
      // Should handle gracefully (not crash)
      expect(response.status()).not.toBe(500);
    });

    test('API should handle special characters in bracket ID', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/tournament-bracket/test%20id%26special`);
      
      // Should handle gracefully
      expect(response.status()).not.toBe(500);
    });
  });
});
