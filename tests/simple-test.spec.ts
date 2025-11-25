import { test, expect } from '@playwright/test';

/**
 * Simple tests to verify basic functionality
 * 
 * These are minimal tests to check that:
 * 1. Playwright is installed correctly
 * 2. Tests can run
 * 3. We can navigate to the target environment (staging/prod)
 */
test.describe('Basic Page Loads', () => {
  test('should load the homepage', async ({ page, baseURL, browserName }) => {
    // Firefox needs longer timeout in CI
    const timeout = browserName === 'firefox' ? 60000 : 30000;
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout });
    
    // Wait for page to have content (more reliable than networkidle)
    await page.waitForLoadState('domcontentloaded');
    
    // Check that we're NOT on a Vercel login page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('vercel.com/login');
    
    // Check that the page has a meaningful title (not just empty)
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
    
    // Check that we're on the actual site (not an error page)
    // Look for common elements that should exist on the homepage
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    
    // Log which environment we're testing
    console.log(`Testing against: ${baseURL}`);
    console.log(`Page URL: ${currentUrl}`);
    console.log(`Page title: ${title}`);
  });

  test('should load the signup page', async ({ page, browserName }) => {
    // Navigate to signup page
    // Firefox needs longer timeout in CI
    const timeout = browserName === 'firefox' ? 60000 : 30000;
    await page.goto('/auth/signup', { waitUntil: 'domcontentloaded', timeout });
    
    // Wait for page to load (use domcontentloaded instead of networkidle for reliability)
    await page.waitForLoadState('domcontentloaded');
    
    // Debug: Log the page title and URL
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log('Page URL:', currentUrl);
    console.log('Page title:', pageTitle);
    
    // CRITICAL: Check that we're NOT on Vercel login page
    // This is the most important check - if we're redirected, the test should FAIL
    expect(currentUrl).not.toContain('vercel.com/login');
    expect(currentUrl).toContain('/auth/signup'); // Should be on signup page
    
    // Verify we're on the actual signup page by checking for the heading
    const heading = page.getByRole('heading', { name: /create.*account/i });
    await expect(heading).toBeVisible();
    
    // Verify the form fields are present and visible
    const nameField = page.getByTestId('signup-name-input');
    await expect(nameField).toBeVisible();
    
    const emailField = page.getByTestId('signup-email-input');
    await expect(emailField).toBeVisible();
    
    const passwordField = page.getByTestId('signup-password-input');
    await expect(passwordField).toBeVisible();
    
    // Verify the submit button exists
    const submitButton = page.getByTestId('signup-submit-button');
    await expect(submitButton).toBeVisible();
    
    console.log('✅ Signup page loaded successfully with all required elements');
  });

  test('should load the signin page', async ({ page, browserName }) => {
    // Navigate to signin page
    // Firefox needs longer timeout in CI
    const timeout = browserName === 'firefox' ? 60000 : 30000;
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded', timeout });
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Check that we're NOT on Vercel login page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('vercel.com/login');
    expect(currentUrl).toContain('/auth/signin');
    
    // Verify we're on the actual signin page by checking for the heading
    const heading = page.getByRole('heading', { name: /sign in/i });
    await expect(heading).toBeVisible();
    
    // Verify the form fields are present
    const emailField = page.getByLabel('Email address');
    await expect(emailField).toBeVisible();
    
    const passwordField = page.getByLabel('Password');
    await expect(passwordField).toBeVisible();
    
    // Verify the sign in button exists (using LoggedButton, so check for text)
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeVisible();
    
    console.log('✅ Signin page loaded successfully with all required elements');
  });

  test('should navigate from signup to signin page', async ({ page, browserName }) => {
    // Start on signup page
    // Firefox needs longer timeout in CI
    const timeout = browserName === 'firefox' ? 60000 : 30000;
    await page.goto('/auth/signup', { waitUntil: 'domcontentloaded', timeout });
    
    // Find and click the "sign in to your existing account" link
    const signInLink = page.getByRole('link', { name: /sign in to your existing account/i });
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    
    // Wait for navigation
    await page.waitForLoadState('domcontentloaded');
    
    // Verify we're now on the signin page
    await expect(page).toHaveURL(/.*\/auth\/signin/);
    
    // Verify signin page content is visible
    const heading = page.getByRole('heading', { name: /sign in/i });
    await expect(heading).toBeVisible();
    
    console.log('✅ Navigation from signup to signin works correctly');
  });

  test('should navigate from signin to signup page', async ({ page, browserName }) => {
    // Start on signin page
    // Firefox needs longer timeout in CI
    const timeout = browserName === 'firefox' ? 60000 : 30000;
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded', timeout });
    
    // Find and click the "create a new account" link
    const signUpLink = page.getByRole('link', { name: /create a new account/i });
    await expect(signUpLink).toBeVisible();
    await signUpLink.click();
    
    // Wait for navigation
    await page.waitForLoadState('domcontentloaded');
    
    // Verify we're now on the signup page
    await expect(page).toHaveURL(/.*\/auth\/signup/);
    
    // Verify signup page content is visible
    const heading = page.getByRole('heading', { name: /create.*account/i });
    await expect(heading).toBeVisible();
    
    console.log('✅ Navigation from signin to signup works correctly');
  });
});

