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
 * Output: JSON array of project names (handles spaces in project names correctly)
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
  webkit: 'Mobile Safari', // Maps to Mobile Safari (iPhone 13)
};

// Mobile Safari (Pro) is only included when 'all' is selected
const mobileSafariPro = 'Mobile Safari (Pro)'; // iPhone 13 Pro

// Check for invalid combinations
if (mode === 'mobile' && browser === 'firefox') {
  console.error('Error: Mobile + Firefox is not a valid combination.');
  console.error('Mobile Firefox is not supported. Please select Chrome or WebKit for mobile testing.');
  process.exit(1);
}

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
    // When 'all' is selected, include all mobile projects: Chrome, Safari, and Safari Pro
    projects.push(...Object.values(mobileProjects));
    projects.push(mobileSafariPro);
  } else if (mobileProjects[browser]) {
    projects.push(mobileProjects[browser]);
  }
}

if (projects.length === 0) {
  console.error(`Error: No projects found for mode="${mode}" and browser="${browser}"`);
  process.exit(1);
}

// Output as JSON array to handle project names with spaces correctly
console.log(JSON.stringify(projects));

