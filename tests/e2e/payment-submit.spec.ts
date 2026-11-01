import { test, expect } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';
import { getBaseURL, getTestUserCredentials } from '../fixtures/test-helpers';

/**
 * Payment submit boundaries: unauthenticated API is rejected.
 * Does not send a real Venmo or Zelle payment.
 */
test.describe('Payment submit', () => {
  test.describe('Unauthenticated API', () => {
    test('GET /api/bracket/payment without session is rejected', async ({ request }) => {
      const response = await request.get(`${getBaseURL()}/api/bracket/payment`);
      expect(response.status()).not.toBe(200);
      expect([401, 403, 405]).toContain(response.status());
    });

    test('POST /api/bracket/payment without session is 401 or 403', async ({ request }) => {
      const response = await request.post(`${getBaseURL()}/api/bracket/payment`, {
        data: {
          bracketIds: [],
          additionalDollars: 1,
          additionalNote: 'e2e-unauth',
          paymentMethod: 'venmo',
        },
      });
      expect(response.status()).not.toBe(200);
      expect([401, 403]).toContain(response.status());
    });
  });

  test('optional UI: pay controls expose data-testid when TEST_USER can open the modal', async ({
    page,
  }, testInfo) => {
    let credentials: ReturnType<typeof getTestUserCredentials>;
    try {
      credentials = getTestUserCredentials(testInfo.project.name);
    } catch {
      test.skip(true, 'TEST_USER credentials are not configured');
      return;
    }

    await signInUser(page, credentials.email, credentials.password);
    await page.goto('/bracket', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('vintage-picks-page')).toBeVisible({ timeout: 20000 });

    const payButton = page
      .getByTestId('pay-button-desktop')
      .or(page.getByTestId('pay-button-mobile'));

    if ((await payButton.count()) === 0 || !(await payButton.first().isVisible())) {
      test.info().annotations.push({
        type: 'note',
        description: 'Pay button not visible; skipped opening PaymentModal (lock, year, or payments off).',
      });
      return;
    }

    await payButton.first().click();
    await expect(page.getByTestId('payment-modal')).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByTestId('payment-venmo-button').or(page.getByTestId('payment-zelle-button')),
    ).toBeVisible();
    await expect(page.getByTestId('payment-cancel').or(page.getByTestId('payment-modal-close'))).toBeVisible();
    await page.getByTestId('payment-modal-close').or(page.getByTestId('payment-cancel')).first().click();
    await expect(page.getByTestId('payment-modal')).toHaveCount(0);
  });
});
