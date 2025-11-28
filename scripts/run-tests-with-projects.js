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

const { execSync } = require('child_process');

const testId = process.argv[2];
const mode = process.argv[3];
const browser = process.argv[4];

if (!testId || !mode || !browser) {
  console.error('Usage: node scripts/run-tests-with-projects.js <test-id> <mode> <browser>');
  console.error('  test-id: Test group number (1-5) or abbreviation');
  console.error('  mode: desktop, mobile, or both');
  console.error('  browser: chrome, firefox, webkit, or all');
  process.exit(1);
}

// Get projects from helper script
let projects;
try {
  const projectsOutput = execSync(`node scripts/get-playwright-projects.js ${mode} ${browser}`, { encoding: 'utf-8' });
  projects = projectsOutput.trim().split(' ');
} catch (error) {
  console.error(`Error determining projects: ${error.message}`);
  process.exit(1);
}

if (projects.length === 0) {
  console.error(`No projects found for mode="${mode}" and browser="${browser}"`);
  process.exit(1);
}

// Build --project flags (handle spaces in project names)
const projectFlags = projects.map(p => `--project="${p}"`).join(' ');

// Run the test with the project flags
const env = process.env.TEST_ENV || 'staging';

console.log(`\n📋 Running tests with projects: ${projects.join(', ')}`);
console.log(`   Mode: ${mode}, Browser: ${browser}`);
console.log('');

// Use run-test-by-id.js which will handle the project flags
// Pass the project flags as additional arguments
try {
  execSync(
    `npx cross-env TEST_ENV=${env} node scripts/run-test-by-id.js ${testId} -- ${projectFlags}`,
    { stdio: 'inherit', shell: true }
  );
  process.exit(0);
} catch (error) {
  const exitCode = error.status || 1;
  process.exit(exitCode);
}

