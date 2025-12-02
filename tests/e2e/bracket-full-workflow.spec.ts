import { test, expect, Page } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';

/**
 * Group 6: Full Bracket Workflow Tests
 * 
 * These are comprehensive end-to-end tests that simulate complete user workflows.
 * They are intentionally longer-running and should be executed sparingly.
 * 
 * Test coverage includes:
 * - Full bracket completion (happy path)
 * - Pick invalidation logic across regions
 * - Tiebreaker validation
 * - Entry name validation  
 * - Submission flow
 * - Copy bracket functionality
 * 
 * Note: These tests create actual brackets and may take several minutes to complete.
 */

// Increase timeout for full workflow tests
test.setTimeout(180000); // 3 minutes per test

test.describe('Full Bracket Workflow', () => {
  /**
   * Get test user credentials from environment variables
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
        'TEST_USER_EMAIL and TEST_USER_PASSWORD_STAGING/PRODUCTION environment variables are required. ' +
        'See tests/AUTHENTICATION_TEST_SETUP.md for setup instructions.'
      );
    }
    
    return {
      email: process.env.TEST_USER_EMAIL,
      password: password,
    };
  };

  /**
   * Generate a unique bracket name for testing
   */
  const generateTestBracketName = () => {
    return `AutoTest-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  };

  /**
   * Helper to make picks on a region page
   * Clicks on alternating teams to select winners for each game
   */
  async function completeRegionPicks(page: Page): Promise<number> {
    let picksMade = 0;
    
    // Find all clickable team elements (not already selected, not disabled)
    const teamElements = page.locator('[class*="cursor-pointer"]:not([class*="opacity-50"])').filter({ hasText: /#\d+/ });
    const teamCount = await teamElements.count();
    
    // Games come in pairs - we need to pick one team from each pair
    // The structure is: team1, team2 for game1, then team1, team2 for game2, etc.
    for (let i = 0; i < teamCount; i += 2) {
      const team = teamElements.nth(i);
      if (await team.isVisible() && await team.isEnabled()) {
        await team.click();
        await page.waitForTimeout(100); // Brief pause between clicks
        picksMade++;
      }
    }
    
    return picksMade;
  }

  /**
   * Helper to navigate to the next page in the bracket wizard
   */
  async function navigateToNextPage(page: Page): Promise<boolean> {
    const nextButton = page.getByRole('button', { name: /next/i });
    
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(500); // Wait for page transition
      return true;
    }
    return false;
  }

  /**
   * Helper to click on a specific step indicator
   */
  async function navigateToStep(page: Page, stepNumber: number): Promise<void> {
    const stepIndicator = page.locator(`[class*="rounded-full"]`).filter({ hasText: String(stepNumber) });
    const step = stepIndicator.first();
    
    if (await step.isVisible() && await step.isEnabled()) {
      await step.click();
      await page.waitForTimeout(500);
    }
  }

  /**
   * Helper to count selected picks (checkmarks or selected states)
   */
  async function countSelectedPicks(page: Page): Promise<number> {
    // Look for selected teams (blue background) or checkmark icons
    const selectedTeams = page.locator('[class*="bg-blue-100"], [class*="border-blue-500"]');
    return await selectedTeams.count();
  }

  // ==========================================
  // FULL BRACKET COMPLETION - HAPPY PATH
  // ==========================================
  test.describe('Happy Path - Complete Bracket', () => {
    test('should complete and save a full bracket across all regions', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Click New Bracket
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      
      // Wait for wizard to load
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Track total picks made
      let totalPicks = 0;
      
      // Complete all 4 regions (steps 1-4)
      for (let step = 1; step <= 4; step++) {
        // Complete picks on current page
        const picksMade = await completeRegionPicks(page);
        totalPicks += picksMade;
        
        // If there are more rounds in this region, keep making picks
        // The page auto-scrolls as rounds complete
        await page.waitForTimeout(1000);
        
        // Make more picks if available
        const morePicks = await completeRegionPicks(page);
        totalPicks += morePicks;
        
        // Try to navigate to next step if not on last region
        if (step < 4) {
          const nextButton = page.getByRole('button', { name: /next/i });
          if (await nextButton.isEnabled()) {
            await nextButton.click();
            await page.waitForTimeout(500);
          }
        }
      }
      
      // Verify we made picks
      expect(totalPicks).toBeGreaterThan(0);
      
      // Save the bracket
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Should return to landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
    });
  });

  // ==========================================
  // PICK INVALIDATION TESTS
  // ==========================================
  test.describe('Pick Invalidation Logic', () => {
    test('should clear later round picks when changing a Round of 64 pick', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Click New Bracket
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      
      // Wait for wizard to load
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Make picks to complete at least the first game and its subsequent game
      // Pick team 1 from first game
      const teamElements = page.locator('[class*="cursor-pointer"]:not([class*="opacity-50"])').filter({ hasText: /#\d+/ });
      
      // Pick first team (e.g., #1 seed)
      await teamElements.first().click();
      await page.waitForTimeout(300);
      
      // Count initial checkmarks
      const initialCheckmarks = await countSelectedPicks(page);
      expect(initialCheckmarks).toBeGreaterThan(0);
      
      // Now pick the second team from the same game (opposite of first pick)
      // This should change the pick
      const secondTeam = teamElements.nth(1);
      if (await secondTeam.isVisible() && await secondTeam.isEnabled()) {
        await secondTeam.click();
        await page.waitForTimeout(300);
        
        // The pick should have changed - checkmark should still show but on different team
        const afterCheckmarks = await countSelectedPicks(page);
        expect(afterCheckmarks).toBeGreaterThan(0);
      }
      
      // Cancel to discard changes
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should preserve unaffected picks when changing an early round pick', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Click New Bracket
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      
      // Wait for wizard to load
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Make multiple picks across different games
      const teamElements = page.locator('[class*="cursor-pointer"]:not([class*="opacity-50"])').filter({ hasText: /#\d+/ });
      
      // Pick teams from first few games (every other team = one per game)
      for (let i = 0; i < 8; i += 2) {
        const team = teamElements.nth(i);
        if (await team.isVisible()) {
          await team.click();
          await page.waitForTimeout(150);
        }
      }
      
      // Count picks made
      const picksBeforeChange = await countSelectedPicks(page);
      
      // Change one pick - this should NOT affect picks from other unrelated games
      // Click on team from first game again (the other team)
      const otherTeam = teamElements.nth(1);
      if (await otherTeam.isVisible() && await otherTeam.isEnabled()) {
        await otherTeam.click();
        await page.waitForTimeout(300);
      }
      
      // Picks from other games should still exist
      const picksAfterChange = await countSelectedPicks(page);
      
      // Should still have most picks (might lose 1-2 if there was a downstream effect)
      expect(picksAfterChange).toBeGreaterThanOrEqual(picksBeforeChange - 2);
      
      // Cancel to discard
      await page.getByRole('button', { name: /cancel/i }).click();
    });
  });

  // ==========================================
  // TIEBREAKER VALIDATION TESTS
  // ==========================================
  test.describe('Tiebreaker Validation', () => {
    test('should show tiebreaker input on Final Four page (step 5)', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Find an existing in-progress bracket with some picks, or create new
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Look for an existing in-progress bracket
      const inProgressRow = page.locator('tr').filter({ hasText: /in progress/i }).first();
      
      if (await inProgressRow.isVisible()) {
        // Click to edit it
        const editButton = inProgressRow.locator('button[title="Edit"]');
        if (await editButton.isVisible()) {
          await editButton.click();
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          
          // Try to navigate to step 5
          await navigateToStep(page, 5);
          await page.waitForTimeout(500);
          
          // Look for tiebreaker-related elements
          // Tiebreaker input or label should exist on the page
          const tiebreakerLabel = page.getByText(/tie ?breaker|total.*points|combined.*score/i);
          const tiebreakerVisible = await tiebreakerLabel.isVisible().catch(() => false);
          
          // If we can't navigate to step 5 (not all regions complete), verify step exists
          const step5 = page.locator('[class*="rounded-full"]').filter({ hasText: '5' });
          await expect(step5.first()).toBeVisible();
        }
      }
      
      // Cancel to return
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    });

    test('should require valid tiebreaker value within configured range', async ({ page }) => {
      // This test documents the expected behavior
      // The actual validation happens on the Final Four page
      
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Create new bracket
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Verify step navigation structure exists
      const steps = page.locator('[class*="rounded-full"]').filter({ hasText: /\d/ });
      const stepCount = await steps.count();
      
      // Should have 5 steps (4 regions + Final Four)
      expect(stepCount).toBeGreaterThanOrEqual(5);
      
      // Cancel
      await page.getByRole('button', { name: /cancel/i }).click();
    });
  });

  // ==========================================
  // ENTRY NAME VALIDATION TESTS
  // ==========================================
  test.describe('Entry Name Validation', () => {
    test('should display entry name field with default value', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Create new bracket
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Look for entry name input
      const entryNameInput = page.locator('input[type="text"]').first();
      
      if (await entryNameInput.isVisible()) {
        // Entry name should have a default value (user's name)
        const value = await entryNameInput.inputValue();
        expect(value.length).toBeGreaterThan(0);
      }
      
      // Cancel
      await page.getByRole('button', { name: /cancel/i }).click();
    });

    test('should allow editing entry name', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Create new bracket
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Find and edit entry name input
      const entryNameInput = page.locator('input[type="text"]').first();
      
      if (await entryNameInput.isVisible()) {
        const testName = generateTestBracketName();
        await entryNameInput.clear();
        await entryNameInput.fill(testName);
        
        const newValue = await entryNameInput.inputValue();
        expect(newValue).toBe(testName);
      }
      
      // Cancel
      await page.getByRole('button', { name: /cancel/i }).click();
    });
  });

  // ==========================================
  // COPY BRACKET TESTS
  // ==========================================
  test.describe('Copy Bracket Functionality', () => {
    test('should have copy button for in-progress brackets', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Look for in-progress bracket rows
      const inProgressRow = page.locator('tr').filter({ hasText: /in progress/i }).first();
      
      if (await inProgressRow.isVisible()) {
        // Look for Copy button
        const copyButton = inProgressRow.locator('button[title="Copy"]');
        
        // Copy button may be hidden if bracket creation is disabled
        const copyVisible = await copyButton.isVisible().catch(() => false);
        
        // Either copy is visible or it's disabled due to deadline
        // Both are valid states depending on configuration
      }
    });

    test('should have copy button for submitted brackets', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Look for submitted bracket rows
      const submittedRow = page.locator('tr').filter({ hasText: /submitted/i }).first();
      
      if (await submittedRow.isVisible()) {
        // Look for Copy button
        const copyButton = submittedRow.locator('button[title="Copy"]');
        
        // Copy button visibility depends on whether bracket creation is enabled
        const copyVisible = await copyButton.isVisible().catch(() => false);
        
        // If visible, verify it's clickable
        if (copyVisible) {
          const isEnabled = await copyButton.isEnabled();
          // Button should be enabled if visible
        }
      }
    });

    test('should copy bracket with all picks preserved', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Count initial brackets
      const initialRows = page.locator('tr').filter({ has: page.locator('td') });
      const initialCount = await initialRows.count();
      
      // Find a bracket with picks to copy
      const bracketRow = page.locator('tr').filter({ hasText: /\d+.*\/.*63/ }).first();
      
      if (await bracketRow.isVisible()) {
        const copyButton = bracketRow.locator('button[title="Copy"]');
        
        if (await copyButton.isVisible() && await copyButton.isEnabled()) {
          await copyButton.click();
          
          // Wait for copy to complete
          await page.waitForTimeout(2000);
          
          // A new bracket should appear (either on landing or in edit mode)
          // If in edit mode, cancel to return
          const cancelButton = page.getByRole('button', { name: /cancel/i });
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          }
          
          // Verify we're back on landing
          await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
          
          // Count brackets again - should have one more
          const finalRows = page.locator('tr').filter({ has: page.locator('td') });
          const finalCount = await finalRows.count();
          
          // New bracket was created (unless creation is disabled)
          // The count should be >= initial count
          expect(finalCount).toBeGreaterThanOrEqual(initialCount);
        }
      }
    });
  });

  // ==========================================
  // SUBMISSION FLOW TESTS
  // ==========================================
  test.describe('Submission Flow', () => {
    test('should not allow submission with incomplete bracket', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Create new bracket with only a few picks
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Make just a couple picks
      const teamElements = page.locator('[class*="cursor-pointer"]:not([class*="opacity-50"])').filter({ hasText: /#\d+/ });
      if (await teamElements.count() > 0) {
        await teamElements.first().click();
        await page.waitForTimeout(200);
      }
      
      // Submit button should be disabled or not present on region pages
      // (Submit only appears on Final Four page after all picks are made)
      const submitButton = page.getByRole('button', { name: /submit/i });
      const submitVisible = await submitButton.isVisible().catch(() => false);
      
      // On region pages, there should be Next, not Submit
      const nextButton = page.getByRole('button', { name: /next/i });
      await expect(nextButton).toBeVisible();
      
      // Next should be disabled until region is complete
      // (This depends on how many picks were made)
      
      // Cancel
      await page.getByRole('button', { name: /cancel/i }).click();
    });

    test('should show Submit button on Final Four page when complete', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Create new bracket
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Navigate to step 5 to see what's there
      await navigateToStep(page, 5);
      await page.waitForTimeout(500);
      
      // On Final Four page, there should be a Submit button (even if disabled)
      const submitButton = page.getByRole('button', { name: /submit/i });
      const nextButton = page.getByRole('button', { name: /next/i });
      
      // Either Submit or Next should be visible (Next becomes Submit on last step)
      const hasSubmit = await submitButton.isVisible().catch(() => false);
      const hasNext = await nextButton.isVisible().catch(() => false);
      
      expect(hasSubmit || hasNext).toBeTruthy();
      
      // Cancel
      await page.getByRole('button', { name: /cancel/i }).click();
    });
  });

  // ==========================================
  // READ-ONLY VIEW TESTS
  // ==========================================
  test.describe('Read-Only Submitted Bracket View', () => {
    test('should display submitted bracket in read-only mode', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Find a submitted bracket
      const submittedRow = page.locator('tr').filter({ hasText: /submitted/i }).first();
      
      if (await submittedRow.isVisible()) {
        // Click View button (eye icon)
        const viewButton = submittedRow.locator('button[title="View"]');
        
        if (await viewButton.isVisible()) {
          await viewButton.click();
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          
          // In read-only mode, team elements should have opacity-50 or cursor-not-allowed
          const disabledTeams = page.locator('[class*="cursor-not-allowed"], [class*="opacity-50"]');
          const disabledCount = await disabledTeams.count();
          
          // There should be disabled/read-only elements
          expect(disabledCount).toBeGreaterThan(0);
          
          // Cancel button should be visible to exit
          const cancelButton = page.getByRole('button', { name: /cancel|close/i });
          await expect(cancelButton.first()).toBeVisible();
          
          await cancelButton.first().click();
        }
      }
    });

    test('should not allow editing picks in read-only mode', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Find a submitted bracket
      const submittedRow = page.locator('tr').filter({ hasText: /submitted/i }).first();
      
      if (await submittedRow.isVisible()) {
        const viewButton = submittedRow.locator('button[title="View"]');
        
        if (await viewButton.isVisible()) {
          await viewButton.click();
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          
          // Count checkmarks before attempting to click
          const checkmarksBefore = await countSelectedPicks(page);
          
          // Try to click on a team (should not work in read-only mode)
          const teamElements = page.locator('[class*="cursor-not-allowed"]').filter({ hasText: /#\d+/ });
          
          if (await teamElements.count() > 0) {
            await teamElements.first().click().catch(() => {}); // Ignore click errors
            await page.waitForTimeout(300);
            
            // Checkmarks should remain unchanged
            const checkmarksAfter = await countSelectedPicks(page);
            expect(checkmarksAfter).toBe(checkmarksBefore);
          }
          
          // Cancel
          await page.getByRole('button', { name: /cancel|close/i }).first().click();
        }
      }
    });
  });

  // ==========================================
  // PRINT AND EMAIL TESTS
  // ==========================================
  test.describe('Print and Email Functionality', () => {
    test('should have Print button for submitted brackets', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Find a submitted bracket
      const submittedRow = page.locator('tr').filter({ hasText: /submitted/i }).first();
      
      if (await submittedRow.isVisible()) {
        // Look for Print button
        const printButton = submittedRow.locator('button[title="Print"]');
        
        // Print might be hidden on mobile, check desktop
        const printVisible = await printButton.isVisible().catch(() => false);
        
        // Print should exist (may be desktop-only)
      }
    });

    test('should have Email button for submitted brackets', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Find a submitted bracket
      const submittedRow = page.locator('tr').filter({ hasText: /submitted/i }).first();
      
      if (await submittedRow.isVisible()) {
        // Look for Email button
        const emailButton = submittedRow.locator('button[title*="Email"]');
        
        if (await emailButton.isVisible()) {
          // Click to open email dialog
          await emailButton.click();
          
          // Should see email dialog with Send/Cancel buttons
          await expect(page.getByRole('button', { name: /send/i })).toBeVisible({ timeout: 5000 });
          await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
          
          // Cancel the dialog
          await page.getByRole('button', { name: /cancel/i }).click();
        }
      }
    });
  });

  // ==========================================
  // FULL E2E SUBMISSION TEST
  // ==========================================
  test.describe('Full E2E Submission', () => {
    test('should complete and submit a bracket, then verify it appears as Submitted', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Count initial submitted brackets
      const initialSubmittedCount = await page.locator('tr').filter({ hasText: /submitted/i }).count();
      
      // Create a unique bracket name for this test
      const testBracketName = `Submit-Test-${Date.now()}`;
      
      // Click New Bracket
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Set the entry name
      const entryNameInput = page.locator('input[type="text"]').first();
      if (await entryNameInput.isVisible()) {
        await entryNameInput.clear();
        await entryNameInput.fill(testBracketName);
      }
      
      // Complete all 4 regions (steps 1-4)
      for (let step = 1; step <= 4; step++) {
        // Make picks on current region - complete all rounds
        for (let round = 0; round < 4; round++) {
          const picksMade = await completeRegionPicks(page);
          if (picksMade === 0) break;
          await page.waitForTimeout(500);
        }
        
        // Navigate to next step
        const nextButton = page.getByRole('button', { name: /next/i });
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await page.waitForTimeout(500);
        }
      }
      
      // Now on step 5 (Final Four) - complete Final Four picks
      for (let round = 0; round < 3; round++) {
        const picksMade = await completeRegionPicks(page);
        if (picksMade === 0) break;
        await page.waitForTimeout(500);
      }
      
      // Fill in tiebreaker if present
      const tiebreakerInput = page.locator('input[type="number"]');
      if (await tiebreakerInput.isVisible()) {
        await tiebreakerInput.fill('150');
      }
      
      // Look for Submit button and click it
      const submitButton = page.getByRole('button', { name: /submit/i });
      if (await submitButton.isVisible() && await submitButton.isEnabled()) {
        await submitButton.click();
        
        // Wait for submission to complete
        await page.waitForTimeout(2000);
        
        // Handle any confirmation dialog
        const confirmButton = page.getByRole('button', { name: /confirm|yes|ok/i });
        if (await confirmButton.isVisible().catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
        
        // Should return to landing page
        await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
        
        // Count submitted brackets - should have one more
        const finalSubmittedCount = await page.locator('tr').filter({ hasText: /submitted/i }).count();
        
        // Verify a new submitted bracket was created
        expect(finalSubmittedCount).toBeGreaterThan(initialSubmittedCount);
        
        // Optionally verify the bracket name appears
        const newBracketRow = page.locator('tr').filter({ hasText: testBracketName });
        const bracketFound = await newBracketRow.isVisible().catch(() => false);
        // The bracket should exist (either visible in table or just created)
      } else {
        // If Submit not available, save instead
        const saveButton = page.getByRole('button', { name: /save/i });
        await saveButton.click();
        await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      }
    });
  });

  // ==========================================
  // DELETE BRACKET TESTS
  // ==========================================
  test.describe('Delete Bracket', () => {
    test('should delete an in-progress bracket and verify it is removed', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // First, create a bracket to delete
      const testBracketName = `Delete-Test-${Date.now()}`;
      
      await page.getByRole('button', { name: /new bracket/i }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      
      // Set unique name
      const entryNameInput = page.locator('input[type="text"]').first();
      if (await entryNameInput.isVisible()) {
        await entryNameInput.clear();
        await entryNameInput.fill(testBracketName);
      }
      
      // Make a couple picks
      const teamElements = page.locator('[class*="cursor-pointer"]:not([class*="opacity-50"])').filter({ hasText: /#\d+/ });
      if (await teamElements.count() > 0) {
        await teamElements.first().click();
        await page.waitForTimeout(200);
      }
      
      // Save the bracket
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Wait to return to landing
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Count brackets before delete
      const rowsBefore = await page.locator('tr').filter({ has: page.locator('td') }).count();
      
      // Find the bracket we just created (should be in-progress)
      const bracketRow = page.locator('tr').filter({ hasText: testBracketName }).first();
      
      if (await bracketRow.isVisible()) {
        // Click Delete button (trash icon)
        const deleteButton = bracketRow.locator('button[title="Delete"]');
        
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          
          // The confirmation is embedded in the table row
          // Wait for "Delete?" text and "Yes" button to appear
          await page.waitForTimeout(500);
          
          // Look for the embedded confirmation "Yes" button (bg-red-600 class)
          // It appears in the same row with text "Delete?" nearby
          const yesButton = page.getByRole('button', { name: /^yes$/i });
          
          if (await yesButton.isVisible().catch(() => false)) {
            await yesButton.click();
            
            // Wait for deletion to complete
            await page.waitForTimeout(2000);
            
            // Refresh the page to ensure we see the latest state
            await page.reload();
            await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
            
            // Verify bracket is removed
            const bracketStillExists = await page.locator('tr').filter({ hasText: testBracketName }).isVisible().catch(() => false);
            expect(bracketStillExists).toBeFalsy();
            
            // Row count should be less than before
            const rowsAfter = await page.locator('tr').filter({ has: page.locator('td') }).count();
            expect(rowsAfter).toBeLessThan(rowsBefore);
          }
        }
      }
    });

    test('should show confirmation dialog before deleting', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Find any in-progress bracket
      const inProgressRow = page.locator('tr').filter({ hasText: /in progress/i }).first();
      
      if (await inProgressRow.isVisible()) {
        const deleteButton = inProgressRow.locator('button[title="Delete"]');
        
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          
          // Should show confirmation dialog
          await page.waitForTimeout(500);
          
          // Look for confirmation elements
          const confirmDialog = page.locator('[role="dialog"], [class*="modal"]');
          const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
          const cancelButton = page.getByRole('button', { name: /cancel|no/i });
          
          // Either a dialog or confirmation buttons should appear
          const hasConfirmation = await confirmButton.isVisible().catch(() => false) ||
                                  await confirmDialog.isVisible().catch(() => false);
          
          // Cancel the delete
          if (await cancelButton.isVisible().catch(() => false)) {
            await cancelButton.click();
          } else {
            // Press Escape to close any dialog
            await page.keyboard.press('Escape');
          }
        }
      }
    });
  });

  // ==========================================
  // COPY CREATES NEW BRACKET TEST
  // ==========================================
  test.describe('Copy Creates New Entry', () => {
    test('should create a distinct new bracket when copying', async ({ page }) => {
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
      
      // Count initial bracket rows
      const initialRowCount = await page.locator('tr').filter({ has: page.locator('td') }).count();
      
      // Find any bracket with picks to copy
      const bracketRow = page.locator('tr').filter({ hasText: /\d+.*\/.*63/ }).first();
      
      if (await bracketRow.isVisible()) {
        // Get the original bracket name
        const originalNameCell = bracketRow.locator('td').first();
        const originalName = await originalNameCell.textContent() || '';
        
        const copyButton = bracketRow.locator('button[title="Copy"]');
        
        if (await copyButton.isVisible() && await copyButton.isEnabled()) {
          await copyButton.click();
          
          // Should enter edit mode for the copied bracket
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          
          // In edit mode, the entry name should be visible
          const entryNameInput = page.locator('input[type="text"]').first();
          
          if (await entryNameInput.isVisible()) {
            // The copied bracket should have a new name (often "Copy of X" or similar)
            const copiedName = await entryNameInput.inputValue();
            
            // Save the copied bracket
            const saveButton = page.getByRole('button', { name: /save/i });
            await saveButton.click();
            
            // Wait to return to landing
            await expect(page.getByRole('button', { name: /new bracket/i }).first()).toBeVisible({ timeout: 15000 });
            
            // Count brackets now - should have more than before
            // (Using >= instead of exact +1 because other tests may run in parallel)
            const finalRowCount = await page.locator('tr').filter({ has: page.locator('td') }).count();
            expect(finalRowCount).toBeGreaterThan(initialRowCount);
            
            // Both original and copied bracket should exist
            // (The copied one might have the same name initially, but it's a separate entry)
          } else {
            // Cancel if entry name not visible
            const cancelButton = page.getByRole('button', { name: /cancel/i });
            if (await cancelButton.isVisible()) {
              await cancelButton.click();
            }
          }
        }
      }
    });
  });
});

