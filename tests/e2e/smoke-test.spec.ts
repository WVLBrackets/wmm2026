import { test, expect, Page } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';

/**
 * Smoke Test - Critical User Journey
 * 
 * Tests: Site up → Sign in → Create bracket → Complete all picks → Submit
 * 
 * This uses the EXACT same code as Group 5's submission test.
 * Run time: ~3-5 minutes
 */

test.setTimeout(300000); // 5 minutes

const getTestUserCredentials = () => {
  const isProduction = process.env.TEST_ENV === 'production' || 
                       process.env.TEST_ENV === 'prod' ||
                       (process.env.PLAYWRIGHT_TEST_BASE_URL && 
                        process.env.PLAYWRIGHT_TEST_BASE_URL.includes('warrensmm.com'));
  
  const password = isProduction 
    ? (process.env.TEST_USER_PASSWORD_PRODUCTION || process.env.TEST_USER_PASSWORD)
    : (process.env.TEST_USER_PASSWORD_STAGING || process.env.TEST_USER_PASSWORD);
  
  if (!process.env.TEST_USER_EMAIL || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD required');
  }
  
  return { email: process.env.TEST_USER_EMAIL, password };
};

/**
 * Helper to make picks - EXACT copy from Group 5
 */
async function completeRegionPicks(page: Page): Promise<number> {
  let picksMade = 0;
  const teamElements = page.locator('[class*="cursor-pointer"]:not([class*="opacity-50"])').filter({ hasText: /#\d+/ });
  const teamCount = await teamElements.count();
  
  for (let i = 0; i < teamCount; i += 2) {
    const team = teamElements.nth(i);
    if (await team.isVisible() && await team.isEnabled()) {
      await team.click();
      await page.waitForTimeout(100);
      picksMade++;
    }
  }
  return picksMade;
}

test.describe('Smoke Test', () => {
  test('Critical Path - Site, Auth, Create, Submit', async ({ page }) => {
    const credentials = getTestUserCredentials();
    
    console.log('🔥 SMOKE TEST');
    
    // ========================================
    // STEP 1: Site is up
    // ========================================
    console.log('📍 Step 1: Site check...');
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/info');
    await expect(page.locator('body')).toBeVisible();
    console.log('✅ Site is up');
    
    // ========================================
    // STEP 2: Sign in
    // ========================================
    console.log('📍 Step 2: Sign in...');
    await signInUser(page, credentials.email, credentials.password);
    console.log('✅ Signed in');
    
    // ========================================
    // STEP 3: Bracket page
    // ========================================
    console.log('📍 Step 3: Bracket page...');
    await page.goto('/bracket');
    await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
    
    // Count initial submitted
    const initialSubmittedCount = await page.locator('tr').filter({ hasText: /submitted/i }).count();
    console.log(`  Initial submitted: ${initialSubmittedCount}`);
    console.log('✅ Bracket page loaded');
    
    // ========================================
    // STEP 4: Create and complete bracket (EXACT Group 5 code)
    // ========================================
    console.log('📍 Step 4: Create and complete bracket...');
    
    await page.getByRole('button', { name: /new bracket/i }).first().click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    
    // Set UNIQUE entry name (required for submission - must not match existing entries)
    const uniqueEntryName = `Smoke-${Date.now()}`;
    const entryNameInput = page.locator('input[type="text"]').first();
    if (await entryNameInput.isVisible()) {
      await entryNameInput.clear();
      await entryNameInput.fill(uniqueEntryName);
      console.log(`  Entry name: ${uniqueEntryName}`);
    }
    
    // Complete all 4 regions (steps 1-4)
    let totalPicks = 0;
    for (let step = 1; step <= 4; step++) {
      let regionPicks = 0;
      // Make picks on current region - complete all rounds
      for (let round = 0; round < 4; round++) {
        const picksMade = await completeRegionPicks(page);
        regionPicks += picksMade;
        console.log(`    Region ${step}, Round ${round + 1}: ${picksMade} picks`);
        if (picksMade === 0) break;
        await page.waitForTimeout(500);
      }
      totalPicks += regionPicks;
      console.log(`  Region ${step}: ${regionPicks} total picks`);
      
      // Navigate to next step
      const nextButton = page.getByRole('button', { name: /next/i });
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Now on step 5 (Final Four) - complete Final Four picks
    let finalFourPicks = 0;
    for (let round = 0; round < 3; round++) {
      const picksMade = await completeRegionPicks(page);
      finalFourPicks += picksMade;
      console.log(`    Final Four Round ${round + 1}: ${picksMade} picks`);
      if (picksMade === 0) break;
      await page.waitForTimeout(500);
    }
    totalPicks += finalFourPicks;
    console.log(`  Final Four: ${finalFourPicks} total picks`);
    console.log(`  TOTAL PICKS: ${totalPicks}`);
    
    // Fill in tiebreaker
    const tiebreakerInput = page.locator('input[type="number"]');
    if (await tiebreakerInput.isVisible()) {
      await tiebreakerInput.fill('150');
      console.log('  Tiebreaker set');
    }
    console.log('✅ All picks complete');
    
    // ========================================
    // STEP 5: Submit (EXACT Group 5 code)
    // ========================================
    console.log('📍 Step 5: Submit...');
    
    const submitButton = page.getByRole('button', { name: /submit/i });
    if (await submitButton.isVisible() && await submitButton.isEnabled()) {
      await submitButton.click();
      console.log('  Submit clicked');
      
      await page.waitForTimeout(2000);
      
      // Handle confirmation if present
      const confirmButton = page.getByRole('button', { name: /confirm|yes|ok/i });
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
      
      // Should return to landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Verify more submitted brackets
      const finalSubmittedCount = await page.locator('tr').filter({ hasText: /submitted/i }).count();
      console.log(`  Submitted: ${initialSubmittedCount} → ${finalSubmittedCount}`);
      expect(finalSubmittedCount).toBeGreaterThan(initialSubmittedCount);
      console.log('✅ Submitted');
    } else {
      // Fallback: save if submit not available
      console.log('  ⚠️ Submit not available, saving instead');
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // This should fail the test - we expected to submit
      throw new Error('Submit button was not available - bracket may not be complete');
    }
    
    // ========================================
    // COMPLETE
    // ========================================
    console.log('');
    console.log('🎉 SMOKE TEST PASSED');
  });
});
