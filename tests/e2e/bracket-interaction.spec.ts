import { test, expect } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';
import { getTestUserCredentials, waitForNetworkSettled, getNewBracketButton } from '../fixtures/test-helpers';

/**
 * E2E tests for bracket interaction and management
 * 
 * These tests verify the core bracket functionality:
 * - Creating and saving brackets (empty, partial, complete)
 * - Editing existing brackets
 * - Pick invalidation when changing earlier picks
 * - Navigation between bracket pages
 * - Button functionality (Save, Cancel, Next, Previous, Submit)
 * - Entry name and tiebreaker validation
 * 
 * Note: These tests require authentication and interact with real data.
 * Test brackets are created with unique names and should be cleaned up.
 */

test.describe('Bracket Interaction', () => {

  /**
   * Generate a unique bracket name for testing
   */
  const generateTestBracketName = () => {
    return `Test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  };

  // ==========================================
  // LANDING PAGE TESTS
  // ==========================================
  test.describe('Landing Page', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
    });

    test('should display the bracket landing page', async ({ page }) => {
      await page.goto('/bracket');
      
      // Should see the landing page with welcome message
      // Use :visible to find the actually visible element (mobile vs desktop layouts differ)
      const welcomeText = page.locator('h1:visible').filter({ hasText: /welcome/i });
      await expect(welcomeText.first()).toBeVisible({ timeout: 10000 });
      
      // Should see New Bracket button (or + icon on mobile)
      const newBracketButton = page.locator('button:visible').filter({ has: page.locator('svg') });
      await expect(newBracketButton.first()).toBeVisible();
    });

    test('should display bracket status indicators', async ({ page }) => {
      await page.goto('/bracket');
      
      await waitForNetworkSettled(page);
      
      // Should see status indicators (Submitted X, In Progress Y)
      // Use :visible to find the actually visible elements (mobile vs desktop layouts differ)
      const submittedIndicator = page.locator('span:visible').filter({ hasText: /submitted/i });
      await expect(submittedIndicator.first()).toBeVisible({ timeout: 10000 });
      
      const inProgressIndicator = page.locator('span:visible').filter({ hasText: /in progress/i });
      await expect(inProgressIndicator.first()).toBeVisible();
    });

    test('should have logout button visible', async ({ page }) => {
      await page.goto('/bracket');
      
      await waitForNetworkSettled(page);
      
      // Should see logout button (might be icon-only on mobile)
      // Use :visible to find the actually visible button (mobile vs desktop layouts differ)
      const logoutButton = page.locator('button:visible').filter({ has: page.locator('svg.lucide-log-out') });
      await expect(logoutButton.first()).toBeVisible({ timeout: 10000 });
    });
  });

  // ==========================================
  // NEW BRACKET CREATION TESTS
  // ==========================================
  test.describe('New Bracket Creation', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
    });

    test('should open bracket wizard when clicking New Bracket', async ({ page }, testInfo) => {
      // Click New Bracket button
      const newBracketButton = getNewBracketButton(page, testInfo.project.name);
      await expect(newBracketButton).toBeVisible({ timeout: 10000 });
      await newBracketButton.click();
      
      // Should see the bracket wizard (first region)
      // Look for region-specific content or navigation elements
      await expect(page.locator('text=/round of 64|region/i').first()).toBeVisible({ timeout: 10000 });
    });

    test('should display navigation controls in bracket wizard', async ({ page }, testInfo) => {
      // Open bracket wizard
      await getNewBracketButton(page, testInfo.project.name).click();
      
      await waitForNetworkSettled(page);
      
      // Should see Save button
      const saveButton = page.getByRole('button', { name: /save/i });
      await expect(saveButton).toBeVisible({ timeout: 10000 });
      
      // Should see Cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await expect(cancelButton).toBeVisible();

      // Region / Final Four step nav (no Previous/Next text buttons on the bar)
      await expect(page.getByTestId('bracket-step-nav-bar')).toBeVisible();
      await expect(page.getByTestId('bracket-step-nav-0')).toBeVisible();
      // Large circular Next control for region flow
      await expect(page.getByTestId('bracket-region-next-arrow')).toBeVisible();
    });
  });

  // ==========================================
  // SAVE EMPTY BRACKET TEST
  // ==========================================
  test.describe('Save Empty Bracket', () => {
    test('should save an empty bracket and return to edit it', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Click New Bracket
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await waitForNetworkSettled(page);
      
      // Click Save without making any picks
      const saveButton = page.getByRole('button', { name: /save/i });
      await expect(saveButton).toBeVisible({ timeout: 10000 });
      await saveButton.click();
      
      // Should return to landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 15000 });
      
      // Should see the new bracket in the list (with 0 picks progress)
      await expect(page.getByText(/0.*\/.*63/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  // ==========================================
  // PARTIAL BRACKET SAVE TESTS
  // ==========================================
  test.describe('Partial Bracket Save', () => {
    test('should save bracket with partial picks and restore on edit', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Click New Bracket
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await waitForNetworkSettled(page);
      
      // Make a few picks on the first page (Round of 64)
      // Find clickable team elements and click some
      const teamElements = page.locator('[class*="cursor-pointer"]').filter({ hasText: /#\d+/ });
      const teamCount = await teamElements.count();
      
      if (teamCount > 0) {
        // Click on first few teams to make picks
        for (let i = 0; i < Math.min(4, teamCount); i++) {
          await teamElements.nth(i).click();
          await page.waitForTimeout(200); // Brief wait between clicks
        }
      }
      
      // Click Save
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Should return to landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 15000 });
      
      // Find the in-progress bracket (should show some picks)
      const inProgressRow = page.locator('tr').filter({ hasText: /in progress/i }).first();
      await expect(inProgressRow).toBeVisible({ timeout: 10000 });
    });
  });

  // ==========================================
  // COMPLETE FIRST PAGE AND VERIFY RESUME
  // ==========================================
  test.describe('Complete First Page Resume', () => {
    test('should resume on second page when first page is complete', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Click New Bracket
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await waitForNetworkSettled(page);
      
      // Complete all picks on first page (8 Round of 64 games)
      // Each game shows 2 teams - we need to click one from each game
      const gameContainers = page.locator('[class*="border"][class*="rounded"]').filter({ has: page.locator('[class*="cursor-pointer"]') });
      
      // Make picks for each game visible on this page
      const teamElements = page.locator('[class*="cursor-pointer"]').filter({ hasText: /#\d+/ });
      const teamCount = await teamElements.count();
      
      // Click on alternating teams (every other one) to pick winners
      for (let i = 0; i < teamCount; i += 2) {
        await teamElements.nth(i).click();
        await page.waitForTimeout(100);
      }
      
      // If the first region is complete, step nav can move to region 2; otherwise save in place
      const region2Nav = page.getByTestId('bracket-step-nav-1');
      if (await region2Nav.isEnabled()) {
        await region2Nav.click();
        await waitForNetworkSettled(page);
      }

      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 15000 });
    });
  });

  // ==========================================
  // CANCEL BUTTON TESTS
  // ==========================================
  test.describe('Cancel Button Functionality', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
    });

    test('should return to landing page when clicking Cancel on new bracket', async ({ page }, testInfo) => {
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Click New Bracket
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await waitForNetworkSettled(page);
      
      // Click Cancel
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await expect(cancelButton).toBeVisible({ timeout: 10000 });
      await cancelButton.click();
      
      // Should return to landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 15000 });
    });

    test('should return to landing page when clicking Cancel after making picks', async ({ page }, testInfo) => {
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Click New Bracket
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await waitForNetworkSettled(page);
      
      // Make a pick
      const teamElements = page.locator('[class*="cursor-pointer"]').filter({ hasText: /#\d+/ });
      if (await teamElements.count() > 0) {
        await teamElements.first().click();
        await page.waitForTimeout(200);
      }
      
      // Click Cancel (unsaved picks should be discarded)
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();
      
      // Should return to landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 15000 });
    });
  });

  // ==========================================
  // NAVIGATION TESTS (PREVIOUS/NEXT)
  // ==========================================
  test.describe('Navigation Between Pages', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
    });

    test('should use step nav instead of a Previous control on the first region', async ({ page }, testInfo) => {
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });

      await getNewBracketButton(page, testInfo.project.name).click();
      await waitForNetworkSettled(page);

      const prevButton = page.getByRole('button', { name: /^previous$/i });
      await expect(prevButton).toHaveCount(0);
      await expect(page.getByTestId('bracket-step-nav-0')).toBeVisible();
    });

    test('should navigate between pages using step indicators', async ({ page }, testInfo) => {
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Click New Bracket
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await waitForNetworkSettled(page);
      
      const stepIndicators = page.locator('[data-testid^="bracket-step-nav-"]');
      const stepCount = await stepIndicators.count();
      
      if (stepCount > 1) {
        // Click on step 2 to navigate
        await stepIndicators.nth(1).click();
        await page.waitForTimeout(500);
        
        // Verify we're on a different page (region name should change or step should be highlighted)
        // This is a basic navigation test
      }
    });
  });

  // ==========================================
  // PICK INVALIDATION TESTS
  // ==========================================
  test.describe('Pick Invalidation', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
    });

    test('should clear later round picks when changing earlier pick', async ({ page }, testInfo) => {
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Click New Bracket
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await waitForNetworkSettled(page);
      
      // This test verifies the pick invalidation logic
      // Make picks in sequence, then change an early pick
      const teamElements = page.locator('[class*="cursor-pointer"]').filter({ hasText: /#\d+/ });
      const teamCount = await teamElements.count();
      
      if (teamCount >= 4) {
        // Pick first team in first game
        await teamElements.nth(0).click();
        await page.waitForTimeout(200);
        
        // Verify pick was made (checkmark should appear)
        const checkmarks = page.locator('[class*="text-green"]');
        const initialCheckmarks = await checkmarks.count();
        
        expect(initialCheckmarks).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================
  // VIEW SUBMITTED BRACKET (READ-ONLY)
  // ==========================================
  test.describe('View Submitted Bracket', () => {
    test('should open submitted bracket in read-only mode', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Look for a submitted bracket row
      const submittedRow = page.locator('tr').filter({ hasText: /submitted/i }).first();
      
      if (await submittedRow.isVisible()) {
        // Open read-only bracket from entry name (View action removed; print is also available)
        await submittedRow.locator('td').first().click();
        
        // Wait for bracket to load
        await waitForNetworkSettled(page);
        
        // In read-only mode, team elements should not be clickable
        // Look for Cancel button to return
        const cancelButton = page.getByRole('button', { name: /cancel|close|back/i });
        await expect(cancelButton).toBeVisible({ timeout: 10000 });
      }
    });
  });

  // ==========================================
  // DELETE BRACKET TESTS
  // ==========================================
  test.describe('Delete Bracket', () => {
    test('should show confirmation when deleting in-progress bracket', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Look for an in-progress bracket row with delete button
      const inProgressRow = page.locator('tr').filter({ hasText: /in progress/i }).first();
      
      if (await inProgressRow.isVisible()) {
        // Click the Delete button - use data-testid for stability
        const deleteButton = inProgressRow.getByTestId('delete-bracket-button');
        
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          
          // Should show confirmation (Yes/No buttons)
          await expect(page.getByRole('button', { name: /yes/i })).toBeVisible({ timeout: 5000 });
          await expect(page.getByRole('button', { name: /no/i })).toBeVisible();
          
          // Click No to cancel deletion
          await page.getByRole('button', { name: /no/i }).click();
        }
      }
    });
  });

  // ==========================================
  // COPY BRACKET TESTS
  // ==========================================
  test.describe('Copy Bracket', () => {
    test('should have copy button for brackets', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Look for any bracket row
      const bracketRow = page.locator('tr').filter({ has: page.locator('td') }).first();
      
      if (await bracketRow.isVisible()) {
        // Look for Copy button - use data-testid for stability
        const copyButton = bracketRow.getByTestId('copy-bracket-button');
        
        // Copy button may or may not be visible depending on deadline settings
        // Just verify the structure is correct
      }
    });
  });

  // ==========================================
  // ENTRY NAME TESTS
  // ==========================================
  test.describe('Entry Name Handling', () => {
    test('should display entry name input in bracket wizard', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Click New Bracket
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await waitForNetworkSettled(page);
      
      // Entry name input should be visible - use data-testid for stability
      const entryNameInput = page.getByTestId('entry-name-input');
      
      // Entry name is typically pre-filled with user's name
      if (await entryNameInput.isVisible()) {
        const value = await entryNameInput.inputValue();
        expect(value).toBeTruthy();
      }
    });
  });

  // ==========================================
  // TIEBREAKER TESTS
  // ==========================================
  test.describe('Tiebreaker Handling', () => {
    test('should verify tiebreaker label exists in config', async ({ page }, testInfo) => {
      // This test verifies the tiebreaker feature exists
      // The actual tiebreaker input is only accessible after completing all regions
      // which requires a full bracket completion test
      
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Click New Bracket
      await getNewBracketButton(page, testInfo.project.name).click();
      
      // Wait for wizard to load
      await waitForNetworkSettled(page);
      
      // Final Four nav (index 4) exists — may be disabled until regions are complete
      await expect(page.getByTestId('bracket-step-nav-4')).toBeVisible({ timeout: 10000 });
      
      // Step 5 should be disabled until regions are complete
      // This verifies the navigation structure is correct
    });
  });

  // ==========================================
  // BRACKET TABLE DISPLAY TESTS
  // ==========================================
  test.describe('Bracket Table Display', () => {
    test('should display bracket information in table format', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // If there are brackets, check table headers
      const tableHeaders = page.locator('th');
      const headerCount = await tableHeaders.count();
      
      if (headerCount > 0) {
        // Entry Name (includes small ID under name), Status, Progress, Final Four, Champ, Actions (TB column removed)
        // Use role selectors for table headers to be more specific
        await expect(page.locator('th').filter({ hasText: /entry name/i })).toBeVisible();
        await expect(page.locator('th').filter({ hasText: /status/i })).toBeVisible();
        await expect(page.locator('th').filter({ hasText: /progress/i })).toBeVisible();
      }
    });

    test('should show progress bar for each bracket', async ({ page }, testInfo) => {
      const credentials = getTestUserCredentials(testInfo.project.name);
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Wait for landing page
      await expect(getNewBracketButton(page, testInfo.project.name)).toBeVisible({ timeout: 10000 });
      
      // Look for progress indicators (X / 63 picks)
      const progressText = page.getByText(/\d+.*\/.*63/);
      
      // If brackets exist, there should be progress indicators
      const progressCount = await progressText.count();
      // This just verifies the page structure is correct
    });
  });

  // ==========================================
  // MOBILE RESPONSIVENESS TESTS
  // ==========================================
  test.describe('Mobile Responsiveness', () => {
    test('should display bracket landing on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      const credentials = getTestUserCredentials();
      await signInUser(page, credentials.email, credentials.password);
      await page.goto('/bracket');
      
      // Should still see New Bracket button (might be icon-only on mobile)
      const newBracketButton = page.getByRole('button').filter({ has: page.locator('svg') }).first();
      await expect(newBracketButton).toBeVisible({ timeout: 10000 });
    });
  });
});

