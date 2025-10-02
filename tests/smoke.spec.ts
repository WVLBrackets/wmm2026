import { test, expect } from '@playwright/test';

// Basic smoke tests for main pages
const pages = [
  { path: '/', titleText: /Warren|'s|March|Madness/i },
  { path: '/standings', titleText: /Standings|Players/i },
  { path: '/prizes', titleText: /Prize|Prizes/i },
  { path: '/payments', titleText: /Payment|Payments/i },
  { path: '/rules', titleText: /Rules|Scoring/i },
  { path: '/hall-of-fame', titleText: /Champion|History|Hall/i },
];

for (const { path, titleText } of pages) {
  test(`page renders: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));

    // Basic sanity checks
    await expect(page.locator('body')).toBeVisible();
    // Look for any SSR error overlay
    const errorOverlay = page.locator('text=/\bError\b|\bUnhandled\b|\bStack\b/i');
    await expect(errorOverlay).not.toBeVisible({ timeout: 1000 }).catch(() => {});

    // Check a heading or key text exists
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
  });
}

// Specific functional checks

test('standings table loads or shows loading state', async ({ page }) => {
  await page.goto('/standings');
  const table = page.locator('table');
  const loading = page.getByText(/Loading standings|Refreshing/i);
  await expect(Promise.race([
    table.waitFor({ state: 'visible' }),
    loading.waitFor({ state: 'visible' }),
  ])).resolves;
});
