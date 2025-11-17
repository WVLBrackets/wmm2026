/**
 * Test data fixtures for use in tests
 * 
 * Provides helper functions to generate unique test data
 * and manage test user accounts.
 */

export function generateUniqueEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

export function generateTestUser() {
  return {
    name: 'Test User',
    email: generateUniqueEmail(),
    password: 'testpassword123',
  };
}

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

