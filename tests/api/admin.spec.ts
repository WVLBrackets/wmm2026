import { test, expect } from '@playwright/test';
import { getBaseURL, getTestUserCredentials } from '../fixtures/test-helpers';

/**
 * Admin API Tests
 * 
 * Tests for admin-specific API endpoints. These tests verify:
 * - Admin endpoint authentication requirements
 * - Admin endpoint response formats
 * - Admin-specific functionality security
 * 
 * Note: These tests verify security and response formats without
 * requiring actual admin credentials. Admin functionality tests
 * require a separate admin test user.
 */

test.describe('Admin API', () => {
  // =============================================================================
  // ADMIN USERS API
  // =============================================================================
  test.describe('/api/admin/users', () => {
    test('GET should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/users`);
      
      // Should deny access (401/403) or redirect (302)
      expect([302, 401, 403]).toContain(response.status());
    });

    test('GET should return proper error format', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/users`);
      const contentType = response.headers()['content-type'] || '';
      
      // If JSON response, verify error format
      if (contentType.includes('application/json')) {
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(typeof data.error).toBe('string');
      } else {
        // Otherwise, just verify we got an error status
        expect([302, 401, 403]).toContain(response.status());
      }
    });

    test('POST should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/users`, {
        data: {
          name: 'New User',
          email: 'newuser@example.com',
          password: 'password123',
        },
      });
      
      expect([401, 403, 405]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN USERS BY ID API
  // =============================================================================
  test.describe('/api/admin/users/[id]', () => {
    test('GET should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/users/test-user-id`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('PUT should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.put(`${baseURL}/api/admin/users/test-user-id`, {
        data: {
          name: 'Updated Name',
        },
      });
      
      expect([401, 403]).toContain(response.status());
    });

    test('DELETE should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.delete(`${baseURL}/api/admin/users/test-user-id`);
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN BULK DELETE API
  // =============================================================================
  test.describe('/api/admin/users/bulk-delete', () => {
    test('POST should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/users/bulk-delete`, {
        data: {
          userIds: ['id1', 'id2'],
        },
      });
      
      expect([401, 403]).toContain(response.status());
    });

    test('POST should not accept empty array', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/users/bulk-delete`, {
        data: {
          userIds: [],
        },
      });
      
      expect([400, 401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN BRACKETS API
  // =============================================================================
  test.describe('/api/admin/brackets', () => {
    test('GET should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/brackets`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('GET /export should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/brackets/export`);
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN BRACKETS BY ID API
  // =============================================================================
  test.describe('/api/admin/brackets/[id]', () => {
    test('GET should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/brackets/test-bracket-id`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('DELETE should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.delete(`${baseURL}/api/admin/brackets/test-bracket-id`);
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN RESET PASSWORD API
  // =============================================================================
  test.describe('/api/admin/reset-password', () => {
    test('POST should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/reset-password`, {
        data: {
          email: 'user@example.com',
          newPassword: 'newpassword123',
        },
      });
      
      expect([401, 403]).toContain(response.status());
    });

    test('POST should reject missing email', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/reset-password`, {
        data: {
          newPassword: 'newpassword123',
        },
      });
      
      expect([400, 401, 403]).toContain(response.status());
    });

    test('POST should reject missing password', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/reset-password`, {
        data: {
          email: 'user@example.com',
        },
      });
      
      expect([400, 401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN TOURNAMENT BUILDER API
  // =============================================================================
  test.describe('/api/admin/tournament-builder', () => {
    test('GET should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/tournament-builder`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('POST should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/tournament-builder`, {
        data: {
          tournamentData: {},
        },
      });
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN TEAM DATA API
  // =============================================================================
  test.describe('/api/admin/team-data', () => {
    test('GET should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/team-data`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('POST should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/team-data`, {
        data: {
          teams: [],
        },
      });
      
      expect([401, 403]).toContain(response.status());
    });

    test('GET /export should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/team-data/export`);
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN LOGS API
  // =============================================================================
  test.describe('/api/admin/logs', () => {
    test('GET /usage should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/logs/usage`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('GET /usage/summary should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/logs/usage/summary`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('DELETE /usage/delete should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.delete(`${baseURL}/api/admin/logs/usage/delete`);
      
      expect([401, 403, 405]).toContain(response.status());
    });

    test('GET /error should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/logs/error`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('DELETE /error/delete should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.delete(`${baseURL}/api/admin/logs/error/delete`);
      
      expect([401, 403, 405]).toContain(response.status());
    });

    test('GET /email should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/logs/email`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('GET /email/summary should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/logs/email/summary`);
      
      expect([401, 403]).toContain(response.status());
    });

    test('POST /cleanup should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/logs/cleanup`, {
        data: {},
      });
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN REVALIDATE API
  // =============================================================================
  test.describe('/api/admin/revalidate', () => {
    test('POST should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/revalidate`, {
        data: {
          path: '/',
        },
      });
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN SYNC TEAM FROM ESPN API
  // =============================================================================
  test.describe('/api/admin/sync-team-from-espn', () => {
    test('POST should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/sync-team-from-espn`, {
        data: {
          teamId: '123',
        },
      });
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN TOURNAMENT FILES API
  // =============================================================================
  test.describe('/api/admin/tournament-files', () => {
    test('GET should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/tournament-files`);
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN USAGE MONITORING API
  // =============================================================================
  test.describe('/api/admin/usage-monitoring', () => {
    test('GET should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/admin/usage-monitoring`);
      
      expect([401, 403]).toContain(response.status());
    });
  });

  // =============================================================================
  // ADMIN USER ACTIONS API
  // =============================================================================
  test.describe('/api/admin/users/[id]/confirm', () => {
    test('POST should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/users/test-id/confirm`, {
        data: {},
      });
      
      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('/api/admin/users/[id]/change-password', () => {
    test('POST should require authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/admin/users/test-id/change-password`, {
        data: {
          newPassword: 'newpassword123',
        },
      });
      
      expect([401, 403]).toContain(response.status());
    });
  });
});
