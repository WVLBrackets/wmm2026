import { test, expect } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';

/**
 * Smoke Test - Quick Critical Path Verification
 * 
 * This is a SIMPLE test that verifies:
 * 1. Site is up (homepage, public pages)
 * 2. User can sign in
 * 3. User can access bracket page
 * 4. Bracket wizard loads and teams are clickable
 * 
 * Run time: ~1-2 minutes
 * Use case: Quick validation after deployments
 * 
 * NOTE: For full bracket submission testing, use Group 5 (bracket-full-workflow)
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
  
  return { email: process.env.TEST_USER_EMAIL, password };
};

test.describe('Smoke Test', () => {
  test('Quick Critical Path - Site Up, Auth Works, Bracket Accessible', async ({ page }) => {
    const credentials = getTestUserCredentials();
    
    console.log('🔥 Starting Smoke Test...');
    
    // ========================================
    // STEP 1: Homepage loads
    // ========================================
    console.log('📍 Step 1: Homepage...');
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    console.log('✅ Homepage loaded');
    
    // ========================================
    // STEP 2: Public pages accessible
    // ========================================
    console.log('📍 Step 2: Public pages...');
    
    await page.goto('/info');
    await expect(page.locator('body')).toBeVisible();
    console.log('  ✓ Info');
    
    await page.goto('/hall-of-fame');
    await expect(page.locator('body')).toBeVisible();
    console.log('  ✓ Hall of Fame');
    
    await page.goto('/standings');
    await expect(page.locator('body')).toBeVisible();
    console.log('  ✓ Standings');
    console.log('✅ Public pages accessible');
    
    // ========================================
    // STEP 3: Sign in
    // ========================================
    console.log('📍 Step 3: Sign in...');
    await signInUser(page, credentials.email, credentials.password);
    console.log('✅ Signed in');
    
    // ========================================
    // STEP 4: Bracket page loads
    // ========================================
    console.log('📍 Step 4: Bracket page...');
    await page.goto('/bracket');
    await expect(page.getByRole('button', { name: /new bracket/i })).toBeVisible({ timeout: 10000 });
    console.log('✅ Bracket landing page loaded');
    
    // ========================================
    // STEP 5: Bracket wizard opens and teams load
    // ========================================
    console.log('📍 Step 5: Bracket wizard...');
    await page.getByRole('button', { name: /new bracket/i }).click();
    
    // Wait for team data to load (seed numbers like #1, #16)
    await page.getByText(/#\d+/).first().waitFor({ state: 'visible', timeout: 15000 });
    
    // Verify clickable teams exist
    const teamElements = page.locator('[class*="cursor-pointer"]:not([class*="opacity-50"])').filter({
      hasText: /#\d+/
    });
    const teamCount = await teamElements.count();
    console.log(`  ✓ Found ${teamCount} team elements`);
    expect(teamCount).toBeGreaterThan(0);
    
    // Click one team to verify interactivity
    await teamElements.first().click();
    console.log('  ✓ Team click works');
    console.log('✅ Bracket wizard functional');
    
    // ========================================
    // STEP 6: Cancel and return to landing
    // ========================================
    console.log('📍 Step 6: Cancel and verify...');
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      // Handle confirmation if present
      const confirmCancel = page.getByRole('button', { name: /yes|confirm|ok/i });
      if (await confirmCancel.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmCancel.click();
      }
    }
    
    // Should be back on landing page
    await page.goto('/bracket');
    await expect(page.getByRole('button', { name: /new bracket/i })).toBeVisible({ timeout: 10000 });
    console.log('✅ Back to landing page');
    
    // ========================================
    // COMPLETE
    // ========================================
    console.log('');
    console.log('🎉 SMOKE TEST PASSED');
    console.log('   ✓ Site is up');
    console.log('   ✓ Auth works');
    console.log('   ✓ Bracket wizard functional');
  });
});
