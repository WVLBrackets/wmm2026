#!/usr/bin/env node

/**
 * Helper script to determine which Playwright projects to run
 * based on mode (desktop/mobile/both) and browser (chrome/firefox/webkit/all)
 * 
 * Usage:
 *   node scripts/get-playwright-projects.js desktop chrome
 *   node scripts/get-playwright-projects.js mobile all
 *   node scripts/get-playwright-projects.js both firefox
 * 
 * Output: Space-separated list of project names for --project flags
 */

const mode = process.argv[2]; // 'desktop', 'mobile', or 'both'
const browser = process.argv[3]; // 'chrome', 'firefox', 'webkit', or 'all'

if (!mode || !browser) {
  console.error('Usage: node scripts/get-playwright-projects.js <mode> <browser>');
  console.error('  mode: desktop, mobile, or both');
  console.error('  browser: chrome, firefox, webkit, or all');
  process.exit(1);
}

// Map friendly browser names to Playwright project names
const desktopProjects = {
  chrome: 'chromium',
  firefox: 'firefox',
  webkit: 'webkit',
};

const mobileProjects = {
  chrome: 'Mobile Chrome',
  firefox: 'Mobile Safari', // Note: Currently maps to Mobile Safari (no mobile Firefox project yet)
  webkit: 'Mobile Safari (Pro)', // Note: Maps to Mobile Safari (Pro) for webkit
};

let projects = [];

if (mode === 'desktop' || mode === 'both') {
  if (browser === 'all') {
    projects.push(...Object.values(desktopProjects));
  } else if (desktopProjects[browser]) {
    projects.push(desktopProjects[browser]);
  }
}

if (mode === 'mobile' || mode === 'both') {
  if (browser === 'all') {
    projects.push(...Object.values(mobileProjects));
  } else if (mobileProjects[browser]) {
    projects.push(mobileProjects[browser]);
  }
}

if (projects.length === 0) {
  console.error(`Error: No projects found for mode="${mode}" and browser="${browser}"`);
  process.exit(1);
}

// Output space-separated project names (for use in bash loops)
// Note: Project names with spaces will need to be quoted when used
console.log(projects.join(' '));

