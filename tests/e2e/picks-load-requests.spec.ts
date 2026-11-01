import { test, expect, type Request } from '@playwright/test';
import { signInUser } from '../fixtures/auth-helpers';
import { getBaseURL, getTestUserCredentials } from '../fixtures/test-helpers';

const DOCUMENT_TYPES = new Set(['document', 'xhr', 'fetch']);
const MAX_OWN_ORIGIN_DOCUMENT_REQUESTS = 40;

/**
 * Whether a Playwright request is a document, XHR, or fetch to our origin.
 *
 * @param request - Captured page request
 * @param origin - App origin (scheme + host)
 * @returns True when the request should count toward the load budget
 */
function isOwnOriginDataRequest(request: Request, origin: string): boolean {
  if (!DOCUMENT_TYPES.has(request.resourceType())) {
    return false;
  }
  try {
    return new URL(request.url()).origin === origin;
  } catch {
    return false;
  }
}

test.describe('Picks page load requests', () => {
  test('authenticated /bracket reaches vintage picks with a bounded request count', async ({
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

    const origin = new URL(getBaseURL()).origin;
    const requests: string[] = [];
    page.on('request', (request) => {
      if (isOwnOriginDataRequest(request, origin)) {
        requests.push(`${request.resourceType()} ${request.method()} ${request.url()}`);
      }
    });

    await page.goto('/bracket', { waitUntil: 'domcontentloaded' });

    const vintagePicks = page.getByTestId('vintage-picks-page');
    const loading = page.getByTestId('vintage-picks-loading');
    await expect(vintagePicks.or(loading).first()).toBeVisible({ timeout: 20000 });
    await expect(vintagePicks).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('picks-page-title')).toBeVisible();

    await page.waitForLoadState('load').catch(() => {});

    expect
      .soft(
        requests.length,
        `own-origin document/xhr/fetch after /bracket load (${requests.length}): ${requests.slice(0, 12).join('; ')}`,
      )
      .toBeLessThan(MAX_OWN_ORIGIN_DOCUMENT_REQUESTS);
  });
});
