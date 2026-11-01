import { test, expect } from '@playwright/test';

/**
 * CMS / route-error panel: vintage UI when the published CMS fails,
 * and a healthy homepage that does not show `route-error`.
 */
test.describe('CMS error panel', () => {
  test('homepage does not show route-error when CMS is up', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('vintage-homepage')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('vintage-toolbar')).toBeVisible();
    await expect(page.getByTestId('route-error')).toHaveCount(0);
    await expect(page.getByTestId('site-error-panel')).toHaveCount(0);
  });

  test('if a public page shows SiteErrorPanel, it is the vintage error UI', async ({ page }) => {
    await page.goto('/info', { waitUntil: 'domcontentloaded' });

    const routeError = page.getByTestId('route-error');
    const siteError = page.getByTestId('site-error-panel');
    const vintageInfo = page.getByTestId('vintage-info-page');

    await expect(vintageInfo.or(routeError).or(siteError).first()).toBeVisible({
      timeout: 15000,
    });

    if (await vintageInfo.isVisible().catch(() => false)) {
      await expect(page.getByTestId('vintage-toolbar')).toBeVisible();
      await expect(routeError).toHaveCount(0);
      return;
    }

    await expect(siteError).toBeVisible();
    await expect(siteError).toHaveClass(/v-site-error/);
    if ((await routeError.count()) > 0) {
      await expect(routeError).toHaveClass(/v-site-error/);
      await expect(page.getByTestId('route-error-retry')).toBeVisible();
    }
  });
});
