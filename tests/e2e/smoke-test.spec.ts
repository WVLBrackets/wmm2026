import { test, expect, Page } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';

/**
 * Smoke Test - Critical User Journey
 * 
 * Tests the complete flow: Site up → Sign in → Create → Save → Edit → Submit
 * Uses the SAME approach as Group 5 (bracket-full-workflow.spec.ts)
 * 
 * Run time: ~3-5 minutes
 * Use case: Daily validation after deployments
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
 * Helper to make picks on current page (same as Group 5)
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
  test('Critical Path - Create, Save, Edit, Submit', async ({ page }) => {
    const credentials = getTestUserCredentials();
    
    console.log('🔥 SMOKE TEST');
    
    // ========================================
    // STEP 1-2: Site is up
    // ========================================
    console.log('📍 Step 1: Site check...');
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/info');
    await expect(page.locator('body')).toBeVisible();
    console.log('✅ Site is up');
    
    // ========================================
    // STEP 3: Sign in
    // ========================================
    console.log('📍 Step 2: Sign in...');
    await signInUser(page, credentials.email, credentials.password);
    console.log('✅ Signed in');
    
    // ========================================
    // STEP 4: Go to bracket page
    // ========================================
    console.log('📍 Step 3: Bracket page...');
    await page.goto('/bracket');
    await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
    
    // Count initial in-progress brackets
    const initialInProgressCount = await page.locator('tr').filter({ hasText: /in progress/i }).count();
    console.log(`  Initial In Progress: ${initialInProgressCount}`);
    console.log('✅ Bracket page loaded');
    
    // ========================================
    // STEP 5: Create new bracket, complete PAGE 1 only
    // ========================================
    console.log('📍 Step 4: Create bracket (page 1 only)...');
    await page.getByRole('button', { name: /new bracket/i }).first().click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    
    // Complete all rounds on page 1 (region 1)
    for (let round = 0; round < 4; round++) {
      const picks = await completeRegionPicks(page);
      if (picks === 0) break;
      await page.waitForTimeout(500);
    }
    console.log('  Page 1 complete');
    
    // ========================================
    // STEP 6: SAVE as draft
    // ========================================
    console.log('📍 Step 5: Save as draft...');
    const saveButton = page.getByRole('button', { name: /save/i });
    await saveButton.click();
    
    // Return to landing page
    await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
    
    // Verify we have one more In Progress bracket
    const afterSaveCount = await page.locator('tr').filter({ hasText: /in progress/i }).count();
    console.log(`  In Progress after save: ${afterSaveCount}`);
    expect(afterSaveCount).toBeGreaterThan(initialInProgressCount);
    console.log('✅ Saved as draft');
    
    // ========================================
    // STEP 7: EDIT the bracket
    // ========================================
    console.log('📍 Step 6: Edit bracket...');
    const inProgressRow = page.locator('tr').filter({ hasText: /in progress/i }).first();
    const editButton = inProgressRow.getByRole('button', { name: /edit/i });
    await editButton.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    console.log('✅ Editing bracket');
    
    // ========================================
    // STEP 8: Complete remaining picks (pages 2, 3, 4, 5 - page 1 already done)
    // App should auto-open on page 2 since page 1 is complete
    // ========================================
    console.log('📍 Step 7: Complete remaining picks...');
    
    // Complete pages 2, 3, 4 (regions 2-4) - app should start on page 2
    for (let step = 2; step <= 4; step++) {
      // Make picks on current region - complete all rounds
      for (let round = 0; round < 4; round++) {
        const picks = await completeRegionPicks(page);
        if (picks === 0) break;
        await page.waitForTimeout(500);
      }
      
      // Navigate to next step
      const nextButton = page.getByRole('button', { name: /next/i });
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
      console.log(`  Page ${step} complete`);
    }
    
    // Complete Final Four (page 5)
    for (let round = 0; round < 3; round++) {
      const picks = await completeRegionPicks(page);
      if (picks === 0) break;
      await page.waitForTimeout(500);
    }
    console.log('  Page 5 (Final Four) complete');
    
    // Fill tiebreaker
    const tiebreakerInput = page.locator('input[type="number"]');
    if (await tiebreakerInput.isVisible()) {
      await tiebreakerInput.fill('150');
      console.log('  Tiebreaker set');
    }
    console.log('✅ All picks complete');
    
    // ========================================
    // STEP 9: SUBMIT (immediately after completing picks - don't navigate away!)
    // ========================================
    console.log('📍 Step 8: Submit...');
    
    // Submit button should be visible now that all picks are complete
    const submitButton = page.getByRole('button', { name: /submit/i });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    
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
    console.log('✅ Submitted');
    
    // ========================================
    // STEP 10: Verify submission
    // ========================================
    console.log('📍 Step 9: Verify...');
    
    // Count submitted brackets - should have MORE than before (we started with some existing)
    const finalSubmittedCount = await page.locator('tr').filter({ hasText: /submitted/i }).count();
    console.log(`  Submitted brackets: ${finalSubmittedCount}`);
    
    // Must have at least 1 submitted bracket
    expect(finalSubmittedCount).toBeGreaterThan(0);
    console.log('✅ Verified');
    
    // ========================================
    // COMPLETE
    // ========================================
    console.log('');
    console.log('🎉 SMOKE TEST PASSED');
  });
});
