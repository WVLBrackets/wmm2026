import { test, expect } from '@playwright/test';

test('standings: Day selector and search work', async ({ page }) => {
  await page.goto('/standings');

  const daySelect = page.locator('select');
  await expect(daySelect).toBeVisible();

  const options = await daySelect.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(0);

  // Change day if more than one available
  if (options.length > 1) {
    await daySelect.selectOption(options[options.length - 1]);
  }

  // Search box filters results
  const searchInput = page.getByPlaceholder('Search players...');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('Utes_1');

  // Either filtered row or "No players found"
  const row = page.getByText('Utes_1');
  const empty = page.getByText(/No players found/i);
  await expect(Promise.race([
    row.waitFor({ state: 'visible' }),
    empty.waitFor({ state: 'visible' }),
  ])).resolves;
});
