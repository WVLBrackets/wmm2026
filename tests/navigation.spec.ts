import { test, expect } from '@playwright/test';

// Basic nav flow across main links present in the top nav
const navLinks = [
  { name: 'Standings', href: '/standings' },
  { name: 'Prizes', href: '/prizes' },
  { name: 'Payments', href: '/payments' },
  { name: 'Rules', href: '/rules' },
  { name: 'Hall of Fame', href: '/hall-of-fame' },
];

test('top navigation links work', async ({ page }) => {
  await page.goto('/');

  for (const link of navLinks) {
    let anchor = page.getByRole('link', { name: link.name }).first();
    if ((await anchor.count()) === 0) {
      anchor = page.locator(`a[href='${link.href}']`).first();
    }
    await expect(anchor).toBeVisible();
    await anchor.click();
    const re = new RegExp(`${link.href.replace(/\//g, '\\/')}(?:\\/)?$`);
    await expect(page).toHaveURL(re);
  }
});

test('previous years link from standings works', async ({ page }) => {
  await page.goto('/standings');
  const link = page.getByRole('link', { name: /Previous Years/i }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/standings\/previous-years\/?$/);
});
