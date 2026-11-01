const HAPPY_PATH_ENV_KEYS = [
  'HAPPY_PATH_EMAIL_TEST_CHROME',
  'HAPPY_PATH_EMAIL_TEST_FIREFOX',
  'HAPPY_PATH_EMAIL_TEST_WEBKIT',
  'HAPPY_PATH_EMAIL_TEST_MOBILE_CHROME',
  'HAPPY_PATH_EMAIL_TEST_MOBILE_WEBKIT',
  'HAPPY_PATH_EMAIL_TEST_MOBILE_WEBKIT_PRO',
] as const;

const TEST_DOMAINS = ['@example.com', '@test.com', '@example.org'];

const TEST_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /^test-.*@/i, label: 'test-*@*' },
  { re: /.*test.*@example\./i, label: '*test*@example.*' },
  { re: /^testuser.*@/i, label: 'testuser*@*' },
];

/**
 * Explains why an email is treated as a Playwright/test account, or `null`
 * for real users. Happy-path addresses come from `HAPPY_PATH_EMAIL_TEST_*` env.
 *
 * @param email - Recipient address
 */
export function getTestUserReason(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.toLowerCase().trim();

  const headerEmail = process.env.TEST_USER_EMAIL?.toLowerCase().trim();
  if (headerEmail && normalized === headerEmail) {
    return 'matches TEST_USER_EMAIL from Playwright test header';
  }
  for (const key of HAPPY_PATH_ENV_KEYS) {
    const value = process.env[key]?.toLowerCase().trim();
    if (value && normalized === value) return `matches env ${key}`;
  }
  for (const domain of TEST_DOMAINS) {
    if (normalized.endsWith(domain)) return `matches test domain pattern: ${domain}`;
  }
  for (const { re, label } of TEST_PATTERNS) {
    if (re.test(normalized)) return `matches pattern: ${label}`;
  }
  return null;
}

/**
 * True when `email` belongs to a test account.
 *
 * @param email - Recipient address
 */
export function isTestUserEmail(email: string): boolean {
  return getTestUserReason(email) !== null;
}
