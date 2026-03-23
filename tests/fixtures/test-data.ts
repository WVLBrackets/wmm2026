/**
 * Test data fixtures for use in tests
 * 
 * Provides helper functions to generate unique test data
 * and manage test user accounts.
 */

import { trackTestData, getTestDataPrefix } from './test-helpers';

/**
 * Generate a unique email address for testing.
 * Emails follow pattern: {prefix}-{timestamp}-{random}@example.com
 * 
 * @param prefix - Optional prefix for the email (default: 'test')
 * @param track - Whether to track this email for cleanup reporting (default: false)
 */
export function generateUniqueEmail(prefix = 'test', track = false): string {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@example.com`;
  
  if (track) {
    trackTestData('user', email);
  }
  
  return email;
}

/**
 * Generate a complete test user object with unique email.
 * 
 * @param options - Optional overrides for user properties
 * @param track - Whether to track this user for cleanup reporting
 */
export function generateTestUser(
  options: Partial<TestUser> = {},
  track = false
): TestUser {
  const email = options.email || generateUniqueEmail(getTestDataPrefix(), track);
  
  return {
    name: options.name || 'Test User',
    email,
    password: options.password || 'testpassword123',
  };
}

/**
 * Generate a unique bracket entry name.
 * 
 * @param prefix - Optional prefix (default: 'Test')
 */
export function generateBracketName(prefix = 'Test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Test user interface
 */
export interface TestUser {
  name: string;
  email: string;
  password: string;
}

/**
 * Test bracket data interface
 */
export interface TestBracket {
  entryName: string;
  picks: Record<string, string>;
  tiebreaker?: number;
}

/**
 * Generate minimal test bracket data.
 * 
 * @param options - Optional overrides
 */
export function generateTestBracket(options: Partial<TestBracket> = {}): TestBracket {
  return {
    entryName: options.entryName || generateBracketName(),
    picks: options.picks || {},
    tiebreaker: options.tiebreaker,
  };
}

