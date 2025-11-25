#!/usr/bin/env node

/**
 * Helper script to run Playwright tests by number or abbreviation
 * 
 * Usage:
 *   node scripts/run-test-by-id.js 1.1
 *   node scripts/run-test-by-id.js homepage
 *   node scripts/run-test-by-id.js 1
 *   node scripts/run-test-by-id.js connect
 */

const { execSync } = require('child_process');

// Test mapping: number/abbreviation -> Playwright test name pattern
const testMapping = {
  // Group 1: Basic Connectivity
  '1.1': 'should load the homepage',
  'homepage': 'should load the homepage',
  '1.2': 'should load the signup page',
  'signup-page': 'should load the signup page',
  '1.3': 'should load the signin page',
  'signin-page': 'should load the signin page',
  '1.4': 'should navigate from signup to signin page',
  'nav-up-in': 'should navigate from signup to signin page',
  '1.5': 'should navigate from signin to signup page',
  'nav-in-up': 'should navigate from signin to signup page',
  
  // Group 2: Account Creation
  '2.1': 'should display signup form with all required fields',
  'form-fields': 'should display signup form with all required fields',
  '2.2': 'should require all fields to be filled',
  'req-fields': 'should require all fields to be filled',
  '2.3': 'should validate email format',
  'email-format': 'should validate email format',
  '2.4': 'should validate password minimum length',
  'pwd-length': 'should validate password minimum length',
  '2.5': 'should accept password with exactly 6 characters',
  'pwd-min-ok': 'should accept password with exactly 6 characters',
  '2.6': 'should validate password confirmation match',
  'pwd-match': 'should validate password confirmation match',
  '2.7': 'should prevent submission when password is too short',
  'pwd-short': 'should prevent submission when password is too short',
  '2.8': 'should prevent submission when passwords do not match',
  'pwd-mismatch': 'should prevent submission when passwords do not match',
  '2.9': 'should handle special characters in name',
  'name-special': 'should handle special characters in name',
  '2.10': 'should handle long email addresses',
  'email-long': 'should handle long email addresses',
  '2.11': 'should disable submit button while loading',
  'submit-load': 'should disable submit button while loading',
  '2.12': 'should toggle password visibility',
  'pwd-toggle': 'should toggle password visibility',
  '2.13': 'should successfully create account with valid data',
  'create-ok': 'should successfully create account with valid data',
  '2.14': 'should prevent submission for duplicate email',
  'dup-email-ui': 'should prevent submission for duplicate email',
  '2.15': 'should navigate to sign in page from signup page',
  'nav-up-in2': 'should navigate to sign in page from signup page',
  '2.16': 'should successfully create a new user account',
  'create-msg': 'should successfully create a new user account',
  '2.17': 'should prevent submission for duplicate email during signup',
  'dup-signup': 'should prevent submission for duplicate email during signup',
  '2.18': 'should display confirmation page with invalid token',
  'token-inv-page': 'should display confirmation page with invalid token',
  '2.19': 'should display confirmation page with missing token',
  'token-miss-page': 'should display confirmation page with missing token',
  '2.20': 'should navigate from signup success to signin page',
  'nav-success': 'should navigate from signup success to signin page',
  
  // Group 3: Authentication
  '3.1': 'should sign in with valid credentials',
  'signin-ok': 'should sign in with valid credentials',
  '3.2': 'should show error with invalid email',
  'signin-bad-email': 'should show error with invalid email',
  '3.3': 'should show error with invalid password',
  'signin-bad-pwd': 'should show error with invalid password',
  '3.4': 'should maintain session after page refresh',
  'session-refresh': 'should maintain session after page refresh',
  '3.5': 'should redirect to sign-in when accessing protected route without authentication',
  'protect-route': 'should redirect to sign-in when accessing protected route without authentication',
  '3.6': 'should navigate to signup page from signin page',
  'nav-in-up2': 'should navigate to signup page from signin page',
  '3.7': 'should navigate to signin page from signup page',
  'nav-up-in3': 'should navigate to signin page from signup page',
  
  // Group 4: Bracket
  '4.1': 'should navigate to bracket landing page',
  'bracket-land': 'should navigate to bracket landing page',
  '4.2': 'should create a new bracket',
  'bracket-new': 'should create a new bracket',
  '4.3': 'should allow saving bracket (validation handled by server)',
  'bracket-save': 'should allow saving bracket (validation handled by server)',
  
  // Group 5: API
  '5.1': 'should create a new user account successfully',
  'api-create': 'should create a new user account successfully',
  '5.2': 'should reject registration with missing fields',
  'api-missing': 'should reject registration with missing fields',
  '5.3': 'should reject registration with password too short',
  'api-pwd-short': 'should reject registration with password too short',
  '5.4': 'should reject duplicate email registration',
  'api-dup-email': 'should reject duplicate email registration',
  '5.5': 'should reject invalid email format',
  'api-inv-email': 'should reject invalid email format',
  '5.6': 'should successfully create user and return userId',
  'api-userid': 'should successfully create user and return userId',
  '5.7': 'should require email confirmation after registration',
  'api-confirm-req': 'should require email confirmation after registration',
  '5.8': 'should reject confirmation with invalid token',
  'api-token-inv': 'should reject confirmation with invalid token',
  '5.9': 'should reject confirmation with missing token',
  'api-token-miss': 'should reject confirmation with missing token',
};

// Group mappings: number/abbreviation -> file pattern(s)
// Note: For glob patterns, list files explicitly for Windows compatibility
const groupMapping = {
  '1': 'tests/simple-test.spec.ts',
  'connect': 'tests/simple-test.spec.ts',
  '2': 'tests/e2e/account-creation.spec.ts tests/e2e/account-validation.spec.ts tests/e2e/user-creation-confirmation.spec.ts',
  'account': 'tests/e2e/account-creation.spec.ts tests/e2e/account-validation.spec.ts tests/e2e/user-creation-confirmation.spec.ts',
  '3': 'tests/e2e/authentication.spec.ts',
  'auth': 'tests/e2e/authentication.spec.ts',
  '4': 'tests/e2e/bracket-creation.spec.ts',
  'bracket': 'tests/e2e/bracket-creation.spec.ts',
  '5': 'tests/api',
  'api': 'tests/api',
};

const testId = process.argv[2];
const env = process.env.TEST_ENV || 'staging';

// Get additional Playwright arguments (everything after testId)
// Handle '--' separator that GitHub Actions might pass
let playwrightArgs = process.argv.slice(3).join(' ');
// Remove leading '--' if present (GitHub Actions passes it as separator)
if (playwrightArgs.startsWith('-- ')) {
  playwrightArgs = playwrightArgs.substring(3);
} else if (playwrightArgs.startsWith('--')) {
  playwrightArgs = playwrightArgs.substring(2).trim();
}

if (!testId) {
  console.error('Usage: node scripts/run-test-by-id.js <test-id> [playwright-args]');
  console.error('  test-id can be a number (e.g., 1.1, 3.1), abbreviation (e.g., homepage, signin-ok), or group (e.g., 1, connect)');
  console.error('  playwright-args: Additional arguments passed to Playwright (e.g., --project=chromium)');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/run-test-by-id.js 1');
  console.error('  node scripts/run-test-by-id.js connect');
  console.error('  node scripts/run-test-by-id.js 1 --project=chromium');
  console.error('  node scripts/run-test-by-id.js connect --project=firefox');
  process.exit(1);
}

// Check if it's a group
if (groupMapping[testId]) {
  const filePattern = groupMapping[testId];
  const groupName = testId === '1' ? 'connect' : testId === 'connect' ? '1' : 
                    testId === '2' ? 'account' : testId === 'account' ? '2' :
                    testId === '3' ? 'auth' : testId === 'auth' ? '3' :
                    testId === '4' ? 'bracket' : testId === 'bracket' ? '4' :
                    testId === '5' ? 'api' : testId === 'api' ? '5' : testId;
  
  // Build command - ensure playwrightArgs are properly separated
  let command = `npx cross-env TEST_ENV=${env} npx playwright test ${filePattern}`;
  if (playwrightArgs && playwrightArgs.trim()) {
    command += ` ${playwrightArgs.trim()}`;
  }
  command = command.trim();
  console.log(`\n📋 Running Group ${testId} (${groupName})`);
  console.log(`   Files: ${filePattern}`);
  console.log(`   Environment: ${env}`);
  if (playwrightArgs) {
    console.log(`   Additional args: ${playwrightArgs}`);
  }
  console.log('');
  try {
    execSync(command, { stdio: 'inherit' });
    process.exit(0);
  } catch (error) {
    // Playwright exits with code 1 when tests fail, which is expected
    // Don't throw - just exit with the same code so CI/CD can detect failures
    const exitCode = error.status || 1;
    console.log(`\n⚠️  Tests completed with ${exitCode === 0 ? 'success' : 'some failures'}`);
    process.exit(exitCode);
  }
}

// Check if it's an individual test
if (testMapping[testId]) {
  const testName = testMapping[testId];
  const command = `npx cross-env TEST_ENV=${env} npx playwright test -g "${testName}" ${playwrightArgs}`.trim();
  console.log(`\n📋 Running Test ${testId}`);
  console.log(`   Test: ${testName}`);
  console.log(`   Environment: ${env}`);
  if (playwrightArgs) {
    console.log(`   Additional args: ${playwrightArgs}`);
  }
  console.log('');
  execSync(command, { stdio: 'inherit' });
  process.exit(0);
}

console.error(`Error: Test ID "${testId}" not found.`);
console.error('Valid test IDs:');
console.error('  Groups: 1, 2, 3, 4, 5, connect, account, auth, bracket, api');
console.error('  Individual tests: See tests/TEST_MAPPING.md for full list');
process.exit(1);

