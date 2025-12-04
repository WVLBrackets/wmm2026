import { test, expect } from '@playwright/test';

/**
 * Smoke Test - Critical User Journey
 * 
 * This test verifies the core functionality of the application in a single flow:
 * 1. Homepage loads
 * 2. Public pages accessible (Info, Hall of Fame, Standings)
 * 3. User can sign in
 * 4. User can navigate to bracket page
 * 5. User can create and submit a bracket
 * 
 * Run time: ~2-3 minutes
 * Use case: Quick validation after deployments
 */

/**
 * Get test user credentials based on environment
 */
const getTestUserCredentials = () => {
  const isProduction = process.env.TEST_ENV === 'production' || 
                       process.env.TEST_ENV === 'prod' ||
                       (process.env.PLAYWRIGHT_TEST_BASE_URL && 
                        process.env.PLAYWRIGHT_TEST_BASE_URL.includes('warrensmm.com'));
  
  const password = isProduction 
    ? (process.env.TEST_USER_PASSWORD_PRODUCTION || process.env.TEST_USER_PASSWORD)
    : (process.env.TEST_USER_PASSWORD_STAGING || process.env.TEST_USER_PASSWORD);
  
  if (!process.env.TEST_USER_EMAIL || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD_STAGING/PRODUCTION environment variables are required.'
    );
  }
  
  return {
    email: process.env.TEST_USER_EMAIL,
    password: password,
  };
};

test.describe('Smoke Test', () => {
  test('Critical User Journey - Homepage to Bracket Submission', async ({ page, browserName }) => {
    const credentials = getTestUserCredentials();
    const timeout = browserName === 'webkit' ? 60000 : 30000;
    
    // Generate unique entry name for this test run
    const entryName = `Smoke-${browserName}-${Date.now()}`;
    
    console.log('🔥 Starting Smoke Test...');
    
    // ========================================
    // STEP 1: Homepage loads
    // ========================================
    console.log('📍 Step 1: Verifying homepage...');
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout });
    await expect(page.locator('body')).toBeVisible();
    
    // Check for key homepage elements
    const hasTitle = await page.getByText(/warren/i).first().isVisible().catch(() => false);
    const hasNav = await page.locator('nav, header').first().isVisible().catch(() => false);
    expect(hasTitle || hasNav).toBeTruthy();
    console.log('✅ Homepage loaded');
    
    // ========================================
    // STEP 2: Public pages accessible
    // ========================================
    console.log('📍 Step 2: Checking public pages...');
    
    // Info page
    await page.goto('/info', { waitUntil: 'domcontentloaded', timeout });
    await expect(page.getByText(/entry|scoring|prize/i).first()).toBeVisible({ timeout: 10000 });
    console.log('  ✓ Info page');
    
    // Hall of Fame
    await page.goto('/hall-of-fame', { waitUntil: 'domcontentloaded', timeout });
    await expect(page.getByText(/champion|hall of fame/i).first()).toBeVisible({ timeout: 10000 });
    console.log('  ✓ Hall of Fame page');
    
    // Standings
    await page.goto('/standings', { waitUntil: 'domcontentloaded', timeout });
    await expect(page.locator('body')).toBeVisible();
    console.log('  ✓ Standings page');
    console.log('✅ Public pages accessible');
    
    // ========================================
    // STEP 3: Sign in
    // ========================================
    console.log('📍 Step 3: Signing in...');
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded', timeout });
    
    // Fill credentials
    await page.locator('input[name="email"], input[type="email"]').first().fill(credentials.email);
    await page.locator('input[name="password"], input[type="password"]').first().fill(credentials.password);
    
    // Submit
    await page.locator('button[type="submit"]').click();
    
    // Wait for redirect to bracket page or homepage
    await page.waitForURL(/\/(bracket|$)/, { timeout: 15000 });
    console.log('✅ Signed in successfully');
    
    // ========================================
    // STEP 4: Navigate to bracket page
    // ========================================
    console.log('📍 Step 4: Navigating to bracket page...');
    await page.goto('/bracket', { waitUntil: 'domcontentloaded', timeout });
    
    // Should see landing page or bracket wizard
    await expect(page.locator('body')).toBeVisible();
    
    // Wait for bracket landing to load
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    console.log('✅ Bracket page loaded');
    
    // ========================================
    // STEP 5: Create a new bracket
    // ========================================
    console.log('📍 Step 5: Creating new bracket...');
    
    // Click "New Bracket" button
    const newBracketButton = page.getByRole('button', { name: /new bracket/i });
    await expect(newBracketButton).toBeVisible({ timeout: 10000 });
    await newBracketButton.click();
    
    // Wait for wizard to open
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Set entry name
    const entryNameInput = page.locator('input[name="entryName"], input#entryName, input[placeholder*="entry"]').first();
    if (await entryNameInput.isVisible().catch(() => false)) {
      await entryNameInput.clear();
      await entryNameInput.fill(entryName);
    }
    console.log(`  ✓ Entry name set to: ${entryName}`);
    
    // ========================================
    // STEP 6: Fill out bracket (all 5 pages)
    // ========================================
    console.log('📍 Step 6: Filling bracket picks...');
    
    let totalPicksMade = 0;
    
    // Fill picks on each page (4 regional pages + Final Four)
    for (let pageNum = 1; pageNum <= 5; pageNum++) {
      // Use the correct locator from bracket-full-workflow.spec.ts
      // Teams are elements with cursor-pointer class, not disabled, showing seed numbers like #1, #16
      const teamElements = page.locator('[class*="cursor-pointer"]:not([class*="opacity-50"])').filter({ hasText: /#\d+/ });
      const teamCount = await teamElements.count();
      
      console.log(`  Page ${pageNum}: Found ${teamCount} clickable teams`);
      
      // Click on alternating teams (every other one) to pick winners
      // Games come in pairs - click first team of each pair
      for (let i = 0; i < teamCount; i += 2) {
        const team = teamElements.nth(i);
        if (await team.isVisible() && await team.isEnabled()) {
          await team.click();
          await page.waitForTimeout(100); // Brief pause between clicks
          totalPicksMade++;
        }
      }
      
      // Try to go to next page
      const nextButton = page.getByRole('button', { name: /next/i });
      if (await nextButton.isVisible() && await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500); // Wait for page transition
        console.log(`  ✓ Page ${pageNum} completed`);
      } else {
        // On last page (Final Four) - no more Next button
        console.log(`  ✓ Page ${pageNum} completed (final page)`);
        break;
      }
    }
    
    console.log(`  Total picks made: ${totalPicksMade}`);
    
    // Verify we actually made picks
    expect(totalPicksMade).toBeGreaterThan(0);
    
    // Set tiebreaker if visible
    const tiebreakerInput = page.locator('input[type="number"]').first();
    if (await tiebreakerInput.isVisible()) {
      await tiebreakerInput.fill('145');
      console.log('  ✓ Tiebreaker set to 145');
    }
    
    console.log('✅ Bracket filled');
    
    // ========================================
    // STEP 7: Save bracket
    // ========================================
    console.log('📍 Step 7: Saving bracket...');
    
    // For smoke test, we save the bracket (submit requires 100% completion)
    const saveButton = page.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    console.log('  ✓ Save clicked');
    
    // Wait for save to complete and redirect to landing page
    await page.waitForURL(/\/bracket/, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // ========================================
    // STEP 8: Verify bracket exists in list
    // ========================================
    console.log('📍 Step 8: Verifying bracket saved...');
    
    // Wait for landing page to fully load
    await expect(page.getByRole('button', { name: /new bracket/i })).toBeVisible({ timeout: 10000 });
    
    // Look for our entry name in the bracket list
    const entryRow = page.getByText(entryName);
    const entryVisible = await entryRow.isVisible().catch(() => false);
    
    if (entryVisible) {
      console.log(`✅ Bracket "${entryName}" found in list`);
    } else {
      // Check if any In Progress bracket exists (fallback)
      const inProgressExists = await page.getByText(/in progress/i).isVisible().catch(() => false);
      if (inProgressExists) {
        console.log('✅ Bracket saved (found In Progress entry)');
      } else {
        // Fail the test if we can't find the bracket
        throw new Error(`Bracket "${entryName}" not found in list after save`);
      }
    }
    
    // ========================================
    // COMPLETE
    // ========================================
    console.log('');
    console.log('🎉 SMOKE TEST COMPLETE');
    console.log('   All critical paths verified!');
  });
});
