#!/usr/bin/env node

/**
 * Wrapper script to run tests with specific Playwright projects
 * 
 * Usage:
 *   node scripts/run-tests-with-projects.js <test-id> <mode> <browser>
 * 
 * Example:
 *   node scripts/run-tests-with-projects.js 1 desktop chrome
 *   node scripts/run-tests-with-projects.js 2 both all
 */

const { execFileSync, spawnSync } = require('child_process');

const testId = process.argv[2];
const mode = process.argv[3];
const browser = process.argv[4];

// SECURITY: Allowlists for input validation to prevent command injection
const VALID_TEST_IDS = ['1', '2', '3', '4', '5', '7', '8', 'smoke', 'api', 'e2e', 'all'];
const VALID_MODES = ['desktop', 'mobile', 'both'];
const VALID_BROWSERS = ['chrome', 'firefox', 'webkit', 'all'];
const VALID_ENVS = ['staging', 'production', 'development'];

if (!testId || !mode || !browser) {
  console.error('Usage: node scripts/run-tests-with-projects.js <test-id> <mode> <browser>');
  console.error('  test-id: Test group number (1-5, 7, 8) or abbreviation');
  console.error('  mode: desktop, mobile, or both');
  console.error('  browser: chrome, firefox, webkit, or all');
  process.exit(1);
}

// SECURITY: Validate all inputs against allowlists
if (!VALID_TEST_IDS.includes(testId)) {
  console.error(`Invalid test-id: ${testId}. Must be one of: ${VALID_TEST_IDS.join(', ')}`);
  process.exit(1);
}

if (!VALID_MODES.includes(mode)) {
  console.error(`Invalid mode: ${mode}. Must be one of: ${VALID_MODES.join(', ')}`);
  process.exit(1);
}

if (!VALID_BROWSERS.includes(browser)) {
  console.error(`Invalid browser: ${browser}. Must be one of: ${VALID_BROWSERS.join(', ')}`);
  process.exit(1);
}

const env = process.env.TEST_ENV || 'staging';
if (!VALID_ENVS.includes(env)) {
  console.error(`Invalid TEST_ENV: ${env}. Must be one of: ${VALID_ENVS.join(', ')}`);
  process.exit(1);
}

// Get projects from helper script using execFileSync (no shell, prevents injection)
let projects;
try {
  const projectsOutput = execFileSync('node', ['scripts/get-playwright-projects.js', mode, browser], { encoding: 'utf-8' });
  projects = JSON.parse(projectsOutput.trim());
} catch (error) {
  console.error(`Error determining projects: ${error.message}`);
  process.exit(1);
}

if (projects.length === 0) {
  console.error(`No projects found for mode="${mode}" and browser="${browser}"`);
  process.exit(1);
}

// Build --project flags array (no string interpolation)
const projectArgs = projects.flatMap(p => ['--project', p]);

console.log(`\n📋 Running tests with projects: ${projects.join(', ')}`);
console.log(`   Mode: ${mode}, Browser: ${browser}`);
console.log('');

// Run the test using spawnSync with argument arrays (no shell, prevents injection)
// Set TEST_ENV via environment instead of command string
const result = spawnSync('node', ['scripts/run-test-by-id.js', testId, '--', ...projectArgs], {
  stdio: 'inherit',
  env: { ...process.env, TEST_ENV: env }
});

process.exit(result.status || 0);

