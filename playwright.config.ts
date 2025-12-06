import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.test file if it exists (for local testing with Vercel credentials)
config({ path: resolve(__dirname, '.env.test') });

/**
 * Playwright configuration for WMM2026 testing
 * 
 * This configuration is designed to test against staging and production environments.
 * 
 * Usage:
 *   - Staging: npm run test:staging
 *   - Production: npm run test:prod
 *   - Custom URL: PLAYWRIGHT_TEST_BASE_URL=https://your-url.com npm test
 */

// Determine the base URL from environment
const getBaseURL = () => {
  // Explicit URL override (highest priority)
  if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
    return process.env.PLAYWRIGHT_TEST_BASE_URL;
  }
  
  // Environment-specific defaults
  if (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod') {
    // TODO: Replace with your actual production URL
    return process.env.PRODUCTION_URL || 'https://warrensmm.com';
  }
  
  // Default to staging
  // TODO: Replace with your actual staging URL
  return process.env.STAGING_URL || 'https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app';
};

export default defineConfig({
  testDir: './tests',
  
  /* Global test timeout - increase for WebKit which can be slower */
  timeout: 90000, // 90 seconds (default is 30s) - allows for 60s API waits
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'], // Console output with clear test counts
    ['html', { open: 'never' }], // HTML report (don't auto-open)
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: getBaseURL(),
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Set headers to suppress test emails when SUPPRESS_TEST_EMAILS is enabled */
    extraHTTPHeaders: process.env.SUPPRESS_TEST_EMAILS === 'true' 
      ? { 
          'X-Suppress-Test-Emails': 'true',
          'X-Test-User-Email': process.env.TEST_USER_EMAIL || '',
        }
      : {},
    
    /* Handle Vercel authentication if needed */
    /* If your staging requires Vercel login, you can set these headers */
    // extraHTTPHeaders: {
    //   'Authorization': 'Bearer YOUR_TOKEN', // If using token auth
    // },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        // Firefox-specific settings for CI stability
        // Increase timeouts to handle network interruptions
        navigationTimeout: 60000, // 60 seconds (default is 30s)
        actionTimeout: 30000, // 30 seconds for actions
        // Retry navigation on network errors
        launchOptions: {
          // Firefox in CI may need additional stability settings
          args: ['--no-sandbox'], // Sometimes helps in CI environments
        },
      },
    },

    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        // WebKit (Safari engine) - works on Linux runners in CI
        // Note: This is WebKit, not native Safari, but uses the same engine
        // and provides excellent Safari compatibility testing
        // Increase timeouts for WebKit which can be slower
        navigationTimeout: 60000, // 60 seconds (default is 30s)
        actionTimeout: 30000, // 30 seconds for actions
        expect: {
          timeout: 10000, // 10 seconds for assertions (default is 5s)
        },
        // Increase test timeout to allow waitForResponse with 60s timeout
        testTimeout: 90000, // 90 seconds (default is 30s) - allows for 60s API waits
      },
    },

    /* Mobile device emulation - tests responsive design and touch interactions */
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Google Pixel 5 - Android device with Chrome
        // Viewport: 393x851, touch enabled, mobile user agent
      },
    },

    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 13'],
        // iPhone 13 - iOS device with Safari
        // Viewport: 390x844, touch enabled, iOS user agent
        // Increase timeouts for Mobile Safari which can be slower
        navigationTimeout: 60000, // 60 seconds
        actionTimeout: 30000, // 30 seconds
        expect: {
          timeout: 10000, // 10 seconds for assertions
        },
        // Increase test timeout to allow waitForResponse with 60s timeout
        testTimeout: 90000, // 90 seconds - allows for 60s API waits
      },
    },

    {
      name: 'Mobile Safari (Pro)',
      use: { 
        ...devices['iPhone 13 Pro'],
        // iPhone 13 Pro - Larger iOS device
        // Viewport: 390x844, touch enabled, iOS user agent
        // Increase timeouts for Mobile Safari which can be slower
        navigationTimeout: 60000, // 60 seconds
        actionTimeout: 30000, // 30 seconds
        expect: {
          timeout: 10000, // 10 seconds for assertions
        },
        // Increase test timeout to allow waitForResponse with 60s timeout
        testTimeout: 90000, // 90 seconds - allows for 60s API waits
      },
    },
  ],

  /* No local server - tests run against staging/production */
});
