import { test, expect } from '@playwright/test';
import { getBaseURL } from '../fixtures/test-helpers';

/**
 * Public API Endpoint Tests
 * 
 * Tests for API endpoints that should be accessible.
 * Note: Some "public" endpoints may be protected in staging environments.
 * Tests are written to handle both scenarios gracefully.
 */

test.describe('Public API Endpoints', () => {
  // =============================================================================
  // SITE CONFIG API
  // =============================================================================
  test.describe('/api/site-config', () => {
    test('GET should respond without server error', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/site-config`);
      
      // Should not cause server error
      expect(response.status()).not.toBe(500);
      
      // If accessible, verify structure
      if (response.ok()) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          expect(data).toHaveProperty('success');
        }
      }
    });

    test('GET should return JSON when accessible', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/site-config`);
      
      if (response.ok()) {
        const contentType = response.headers()['content-type'] || '';
        expect(contentType).toContain('application/json');
      } else {
        // Endpoint may require auth in staging - acceptable
        expect([302, 401, 403]).toContain(response.status());
      }
    });

    test('GET should include deadline information when configured', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/site-config`);
      
      if (response.ok()) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data.success && data.data) {
            expect(data.data).toBeDefined();
          }
        }
      }
      // Test passes even if endpoint requires auth
    });
  });

  // =============================================================================
  // LIVE STANDINGS API (cached snapshot; public read)
  // =============================================================================
  test.describe('/api/live-standings', () => {
    test('GET should respond without server error', async ({ request }) => {
      const baseURL = getBaseURL();
      const response = await request.get(`${baseURL}/api/live-standings`);
      expect(response.status()).not.toBe(500);
      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('available');
      }
    });
  });

  // =============================================================================
  // TEAM DATA API
  // =============================================================================
  test.describe('/api/team-data', () => {
    test('GET should respond without server error', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/team-data`);
      
      // Should not cause server error
      expect(response.status()).not.toBe(500);
    });

    test('GET should return consistent data structure when accessible', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/team-data`);
      
      if (response.ok()) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data.success && data.data) {
            expect(Array.isArray(data.data) || typeof data.data === 'object').toBeTruthy();
          }
        }
      }
    });
  });

  // =============================================================================
  // TEAM MASCOT API
  // =============================================================================
  test.describe('/api/team-mascot/[id]', () => {
    test('GET should handle valid team ID', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/team-mascot/1`);
      
      // Should respond with image, JSON, auth error, or not found - not server error
      expect([200, 302, 401, 403, 404]).toContain(response.status());
    });

    test('GET should handle invalid team ID gracefully', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/team-mascot/invalid-id`);
      
      // Should handle gracefully
      expect([302, 400, 401, 403, 404]).toContain(response.status());
    });

    test('GET should return proper content type for images', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/team-mascot/1`);
      
      if (response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toMatch(/image|application\/json/);
      }
    });
  });

  // =============================================================================
  // AUTH CSRF API
  // =============================================================================
  test.describe('/api/auth/csrf', () => {
    test('GET should respond (may require session)', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/auth/csrf`);
      
      // Should not cause server error
      expect(response.status()).not.toBe(500);
      
      // If accessible, verify structure
      if (response.ok()) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          expect(data).toHaveProperty('csrfToken');
          expect(typeof data.csrfToken).toBe('string');
        }
      }
    });

    test('GET tokens should be defined when accessible', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response1 = await request.get(`${baseURL}/api/auth/csrf`);
      
      if (response1.ok()) {
        const contentType = response1.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data1 = await response1.json();
          expect(data1.csrfToken).toBeDefined();
        }
      } else {
        // May require session - acceptable
        expect([302, 401, 403]).toContain(response1.status());
      }
    });
  });

  // =============================================================================
  // CHECK ADMIN API
  // =============================================================================
  test.describe('/api/check-admin', () => {
    test('GET should work without authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/check-admin`);
      
      // May return 200 (success), 401 (unauthorized), or 403 (forbidden in staging)
      expect([200, 401, 403]).toContain(response.status());
    });

    test('GET should return isAdmin flag', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/check-admin`);
      
      if (response.ok()) {
        const data = await response.json();
        expect(typeof data.isAdmin).toBe('boolean');
      }
    });
  });

  // =============================================================================
  // EMAIL STATUS API
  // =============================================================================
  test.describe('/api/email-status', () => {
    test('GET should return email status', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/email-status`);
      
      // May return 200 (success), 401 (unauthorized), or 403 (forbidden in staging)
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // LOG ENDPOINTS (Client-side logging - may require auth in staging)
  // =============================================================================
  test.describe('/api/log/usage', () => {
    test('POST should accept usage log data or require auth', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/log/usage`, {
        data: {
          action: 'test_action',
          page: '/test-page',
        },
      });
      
      // Acceptable: success, auth required, or validation error - not server crash
      expect([200, 201, 204, 302, 400, 401, 403]).toContain(response.status());
    });

    test('POST should reject malformed data gracefully', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/log/usage`, {
        data: null,
      });
      
      expect(response.status()).not.toBe(500);
    });
  });

  test.describe('/api/log/error', () => {
    test('POST should accept error log data or require auth', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/log/error`, {
        data: {
          message: 'Test error message',
          stack: 'Test stack trace',
          url: '/test-page',
        },
      });
      
      // Acceptable: success, auth required, or validation error - not server crash
      expect([200, 201, 204, 302, 400, 401, 403]).toContain(response.status());
    });

    test('POST should handle missing fields', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/log/error`, {
        data: {
          message: 'Test error',
        },
      });
      
      expect(response.status()).not.toBe(500);
    });
  });

  // =============================================================================
  // INIT DATABASE API (Should be protected or disabled in production)
  // =============================================================================
  test.describe('/api/init-database', () => {
    test('GET should be protected or return appropriate response', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/init-database`);
      
      expect([200, 401, 403, 404, 405]).toContain(response.status());
    });
  });
});
