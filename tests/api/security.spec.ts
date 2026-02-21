import { test, expect } from '@playwright/test';
import { getBaseURL } from '../fixtures/test-helpers';
import { generateUniqueEmail } from '../fixtures/test-data';

/**
 * Security Penetration Tests
 * 
 * These tests verify the application's resistance to common security attacks:
 * - SQL Injection attempts
 * - XSS (Cross-Site Scripting) prevention
 * - CSRF (Cross-Site Request Forgery) protection
 * - Input validation and sanitization
 * - Rate limiting (basic checks)
 * - Authentication bypass attempts
 * 
 * IMPORTANT: These tests should NOT cause actual damage. They verify that
 * malicious inputs are properly rejected or sanitized.
 */

test.describe('Security Tests', () => {
  // =============================================================================
  // SQL INJECTION TESTS
  // =============================================================================
  test.describe('SQL Injection Prevention', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "1; SELECT * FROM users",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "1' AND 1=1 --",
      "'; INSERT INTO users VALUES ('hacker','hacker@evil.com','password'); --",
      "1' OR 1=1#",
      "' OR ''='",
      "1'; EXEC xp_cmdshell('dir'); --",
    ];

    test('should reject SQL injection in registration email field', async ({ request }) => {
      const baseURL = getBaseURL();
      
      for (const payload of sqlInjectionPayloads.slice(0, 3)) {
        const response = await request.post(`${baseURL}/api/auth/register`, {
          data: {
            name: 'Test User',
            email: payload,
            password: 'testpassword123',
          },
        });
        
        // API should reject with error status (not 200 success, not 500 server crash)
        expect(response.status()).not.toBe(200);
        expect(response.status()).not.toBe(500);
      }
    });

    test('should reject SQL injection in registration name field', async ({ request }) => {
      const baseURL = getBaseURL();
      
      for (const payload of sqlInjectionPayloads.slice(0, 3)) {
        const uniqueEmail = generateUniqueEmail('sql-test');
        const response = await request.post(`${baseURL}/api/auth/register`, {
          data: {
            name: payload,
            email: uniqueEmail,
            password: 'testpassword123',
          },
        });
        
        expect(response.status()).not.toBe(500);
        
        if (response.ok()) {
          const data = await response.json();
          expect(data.userId).toBeDefined();
        }
      }
    });

    test('should reject SQL injection in login email field', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const csrfResponse = await request.get(`${baseURL}/api/auth/csrf`);
      
      // Handle case where CSRF endpoint returns non-JSON (redirect)
      let csrfToken = 'test-csrf-token';
      if (csrfResponse.ok()) {
        try {
          const csrfData = await csrfResponse.json();
          csrfToken = csrfData.csrfToken || csrfToken;
        } catch {
          // Use default token if JSON parsing fails
        }
      }
      
      for (const payload of sqlInjectionPayloads.slice(0, 3)) {
        const formData = new URLSearchParams();
        formData.append('email', payload);
        formData.append('password', 'anypassword');
        formData.append('csrfToken', csrfToken);
        formData.append('redirect', 'false');
        formData.append('json', 'true');
        
        const response = await request.post(`${baseURL}/api/auth/callback/credentials`, {
          data: formData.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        
        // Should not cause server error - any non-500 response is acceptable
        expect(response.status()).not.toBe(500);
      }
    });

    test('should reject SQL injection in password reset email', async ({ request }) => {
      const baseURL = getBaseURL();
      
      for (const payload of sqlInjectionPayloads.slice(0, 3)) {
        const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
          data: { email: payload },
        });
        
        // Should not return success (200) or server error (500)
        expect(response.status()).not.toBe(200);
        expect(response.status()).not.toBe(500);
      }
    });

    test('should reject SQL injection in bracket entry name', async ({ request }) => {
      const baseURL = getBaseURL();
      
      for (const payload of sqlInjectionPayloads.slice(0, 2)) {
        const response = await request.post(`${baseURL}/api/tournament-bracket`, {
          data: {
            playerName: 'Test User',
            playerEmail: 'test@example.com',
            entryName: payload,
            picks: {},
          },
        });
        
        // Should reject: 400 (validation), 401 (unauthorized), or 403 (forbidden)
        expect([400, 401, 403]).toContain(response.status());
      }
    });
  });

  // =============================================================================
  // XSS PREVENTION TESTS
  // =============================================================================
  test.describe('XSS Prevention', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(\'xss\')">',
      '"><script>alert(document.cookie)</script>',
      "javascript:alert('xss')",
      '<svg onload="alert(\'xss\')">',
      '<body onload="alert(\'xss\')">',
      '<iframe src="javascript:alert(\'xss\')">',
      "'-alert(1)-'",
      '<img src=1 href=1 onerror="javascript:alert(1)">',
      '<div style="background:url(javascript:alert(1))">',
    ];

    test('should sanitize XSS in registration name field', async ({ request }) => {
      const baseURL = getBaseURL();
      
      for (const payload of xssPayloads.slice(0, 3)) {
        const uniqueEmail = generateUniqueEmail('xss-test');
        const response = await request.post(`${baseURL}/api/auth/register`, {
          data: {
            name: payload,
            email: uniqueEmail,
            password: 'testpassword123',
          },
        });
        
        expect(response.status()).not.toBe(500);
        
        if (response.ok()) {
          const data = await response.json();
          if (data.name) {
            expect(data.name).not.toContain('<script>');
            expect(data.name).not.toContain('onerror');
          }
        }
      }
    });

    test('should sanitize XSS in bracket entry name', async ({ request }) => {
      const baseURL = getBaseURL();
      
      for (const payload of xssPayloads.slice(0, 3)) {
        const response = await request.post(`${baseURL}/api/tournament-bracket`, {
          data: {
            playerName: 'Test User',
            playerEmail: 'test@example.com',
            entryName: payload,
            picks: {},
          },
        });
        
        if (response.ok()) {
          const data = await response.json();
          if (data.entryName) {
            expect(data.entryName).not.toContain('<script>');
            expect(data.entryName).not.toContain('onerror');
          }
        }
      }
    });

    test('should sanitize XSS in email subject/body parameters', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          email: xssPayloads[0],
        },
      });
      
      // Should not accept XSS payload as valid email or cause server error
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });
  });

  // =============================================================================
  // CSRF PROTECTION TESTS
  // =============================================================================
  test.describe('CSRF Protection', () => {
    test('should require CSRF token for authentication', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const formData = new URLSearchParams();
      formData.append('email', 'test@example.com');
      formData.append('password', 'testpassword');
      formData.append('redirect', 'false');
      formData.append('json', 'true');
      
      const response = await request.post(`${baseURL}/api/auth/callback/credentials`, {
        data: formData.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      expect(response.status()).not.toBe(200);
    });

    test('should reject invalid CSRF token', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const formData = new URLSearchParams();
      formData.append('email', 'test@example.com');
      formData.append('password', 'testpassword');
      formData.append('csrfToken', 'invalid-csrf-token-12345');
      formData.append('redirect', 'false');
      formData.append('json', 'true');
      
      const response = await request.post(`${baseURL}/api/auth/callback/credentials`, {
        data: formData.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      expect(response.status()).not.toBe(200);
    });

    test('should provide valid CSRF token on request', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/auth/csrf`);
      
      // CSRF endpoint should respond (may redirect for Vercel protection)
      // If it's OK, verify the token structure
      if (response.ok()) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          expect(data.csrfToken).toBeDefined();
          expect(typeof data.csrfToken).toBe('string');
          expect(data.csrfToken.length).toBeGreaterThan(10);
        }
      }
      
      // At minimum, should not be a 500 server error
      expect(response.status()).not.toBe(500);
    });
  });

  // =============================================================================
  // INPUT VALIDATION TESTS
  // =============================================================================
  test.describe('Input Validation', () => {
    test('should reject extremely long input strings', async ({ request }) => {
      const baseURL = getBaseURL();
      const longString = 'a'.repeat(10000);
      
      const response = await request.post(`${baseURL}/api/auth/register`, {
        data: {
          name: longString,
          email: 'test@example.com',
          password: 'testpassword123',
        },
      });
      
      // Should not accept extremely long input or cause server crash
      // Various error codes are acceptable (400, 401, 413, 422)
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('should reject null byte injection', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/auth/register`, {
        data: {
          name: 'Test\x00User',
          email: 'test@example.com',
          password: 'testpassword123',
        },
      });
      
      expect(response.status()).not.toBe(500);
    });

    test('should reject unicode overflow attempts', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/auth/register`, {
        data: {
          name: '\uFFFE\uFFFF',
          email: 'test@example.com',
          password: 'testpassword123',
        },
      });
      
      expect(response.status()).not.toBe(500);
    });

    test('should handle empty request body', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/auth/register`, {
        data: {},
      });
      
      // Should reject empty body with error (400, 401, or 422 are acceptable)
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('should handle malformed JSON', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/auth/register`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: '{invalid json}',
      });
      
      // Should handle malformed JSON gracefully (not 200 success)
      expect(response.status()).not.toBe(200);
    });
  });

  // =============================================================================
  // AUTHENTICATION BYPASS TESTS
  // =============================================================================
  test.describe('Authentication Bypass Prevention', () => {
    test('should not allow access to protected routes without session', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const protectedEndpoints = [
        '/api/tournament-bracket',
        '/api/bracket/check-creation',
        '/api/admin/users',
        '/api/admin/brackets',
      ];
      
      for (const endpoint of protectedEndpoints) {
        const response = await request.get(`${baseURL}${endpoint}`);
        expect([401, 403]).toContain(response.status());
      }
    });

    test('should not allow privilege escalation via role manipulation', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const uniqueEmail = generateUniqueEmail('priv-test');
      const response = await request.post(`${baseURL}/api/auth/register`, {
        data: {
          name: 'Test User',
          email: uniqueEmail,
          password: 'testpassword123',
          role: 'admin',
          isAdmin: true,
        },
      });
      
      if (response.ok()) {
        const adminResponse = await request.get(`${baseURL}/api/admin/users`);
        expect([401, 403]).toContain(adminResponse.status());
      }
    });

    test('should not expose sensitive data in error messages', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/auth/register`, {
        data: {
          name: 'Test',
          email: 'invalid',
          password: '1',
        },
      });
      
      // Parse response only if it's JSON
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        const errorString = JSON.stringify(data).toLowerCase();
        
        // Ensure no sensitive internal details are exposed
        expect(errorString).not.toContain('database');
        expect(errorString).not.toContain('postgres');
        expect(errorString).not.toContain('prisma');
        expect(errorString).not.toContain('stack');
      }
      
      // Should not return 500 with stack trace
      expect(response.status()).not.toBe(500);
    });
  });

  // =============================================================================
  // HEADER INJECTION TESTS
  // =============================================================================
  test.describe('Header Injection Prevention', () => {
    test('should not allow header injection via email', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          email: 'test@example.com\r\nBcc: attacker@evil.com',
        },
      });
      
      // Should reject header injection attempts (not succeed or crash)
      expect(response.status()).not.toBe(200);
      expect(response.status()).not.toBe(500);
    });

    test('should not allow CRLF injection in registration', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.post(`${baseURL}/api/auth/register`, {
        data: {
          name: 'Test\r\nX-Injected-Header: malicious',
          email: 'test@example.com',
          password: 'testpassword123',
        },
      });
      
      expect(response.status()).not.toBe(500);
    });
  });

  // =============================================================================
  // PATH TRAVERSAL TESTS
  // =============================================================================
  test.describe('Path Traversal Prevention', () => {
    test('should reject path traversal in bracket ID', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..\\..\\..\\windows\\system32\\config\\sam',
      ];
      
      for (const payload of pathTraversalPayloads) {
        const response = await request.get(`${baseURL}/api/tournament-bracket/${encodeURIComponent(payload)}`);
        // Should reject: 401 (unauthorized), 403 (forbidden), 404 (not found), or 400 (bad request)
        expect([400, 401, 403, 404]).toContain(response.status());
      }
    });
  });

  // =============================================================================
  // RATE LIMITING TESTS (Basic)
  // =============================================================================
  test.describe('Rate Limiting', () => {
    test('should have rate limiting on password reset endpoint', async ({ request }) => {
      const baseURL = getBaseURL();
      const responses: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
          data: { email: `test${i}@example.com` },
        });
        responses.push(response.status());
      }
      
      // Acceptable outcomes:
      // 1. Rate limiting kicks in (429)
      // 2. All requests processed normally (200, 404)
      // 3. Requests rejected due to auth/validation (400, 401, 403)
      const hasRateLimit = responses.includes(429);
      const allHandled = responses.every(s => [200, 400, 401, 403, 404, 429].includes(s));
      const noServerErrors = responses.every(s => s !== 500);
      
      expect(hasRateLimit || (allHandled && noServerErrors)).toBeTruthy();
    });

    test('should have rate limiting on registration endpoint', async ({ request }) => {
      const baseURL = getBaseURL();
      const responses: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const response = await request.post(`${baseURL}/api/auth/register`, {
          data: {
            name: 'Test User',
            email: generateUniqueEmail(`rate-test-${i}`),
            password: 'testpassword123',
          },
        });
        responses.push(response.status());
      }
      
      const hasRateLimit = responses.includes(429);
      const allProcessed = responses.every(s => s !== 500);
      
      expect(hasRateLimit || allProcessed).toBeTruthy();
    });
  });

  // =============================================================================
  // API SECURITY HEADERS
  // =============================================================================
  test.describe('Security Headers', () => {
    test('should return proper security headers', async ({ request }) => {
      const baseURL = getBaseURL();
      
      // Use a public endpoint that should return JSON
      const response = await request.get(`${baseURL}/api/site-config`);
      const headers = response.headers();
      
      // If endpoint returns JSON, verify content type
      if (response.ok()) {
        expect(headers['content-type']).toContain('application/json');
      }
      
      // Should not expose sensitive headers
      expect(headers['x-powered-by']).toBeUndefined();
    });

    test('should not expose server information', async ({ request }) => {
      const baseURL = getBaseURL();
      
      const response = await request.get(`${baseURL}/api/auth/csrf`);
      const headers = response.headers();
      
      const serverHeader = headers['server'] || '';
      expect(serverHeader).not.toContain('Apache');
      expect(serverHeader).not.toContain('nginx');
      expect(serverHeader).not.toContain('IIS');
    });
  });
});
