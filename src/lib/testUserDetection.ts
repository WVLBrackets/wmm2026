import type { SiteConfigData } from './siteConfig';

/**
 * Determines if an email address belongs to a test user
 * 
 * @param email - The email address to check
 * @param siteConfig - Site configuration containing test email addresses
 * @returns true if the email is a test user, false otherwise
 */
export function isTestUserEmail(email: string, siteConfig: SiteConfigData | null): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check against TEST_USER_EMAIL environment variable (set by Playwright tests via header)
  const testUserEmailEnv = process.env.TEST_USER_EMAIL;
  if (testUserEmailEnv && normalizedEmail === testUserEmailEnv.toLowerCase().trim()) {
    return true;
  }

  // Check against test email config values
  if (siteConfig) {
    const testEmails = [
      siteConfig.happy_path_email_test_chrome,
      siteConfig.happy_path_email_test_firefox,
      siteConfig.happy_path_email_test_webkit,
      siteConfig.happy_path_email_test_mobile_chrome,
      siteConfig.happy_path_email_test_mobile_webkit,
      siteConfig.happy_path_email_test_mobile_webkit_pro,
    ].filter((email): email is string => !!email && typeof email === 'string');

    for (const testEmail of testEmails) {
      if (normalizedEmail === testEmail.toLowerCase().trim()) {
        return true;
      }
    }
  }

  // Check against test email patterns
  // Common test domains
  const testDomains = ['@example.com', '@test.com', '@example.org'];
  for (const domain of testDomains) {
    if (normalizedEmail.endsWith(domain)) {
      return true;
    }
  }

  // Check for test email patterns (e.g., test-*@*, *test*@example.com)
  const testPatterns = [
    /^test-.*@/i,           // test-*@*
    /.*test.*@example\./i,  // *test*@example.*
    /^testuser.*@/i,        // testuser*@*
  ];

  for (const pattern of testPatterns) {
    if (pattern.test(normalizedEmail)) {
      return true;
    }
  }

  return false;
}

/**
 * Gets a detailed reason why an email was identified as a test user (for logging)
 * 
 * @param email - The email address to check
 * @param siteConfig - Site configuration containing test email addresses
 * @returns A string describing why it's a test user, or null if it's not
 */
export function getTestUserReason(email: string, siteConfig: SiteConfigData | null): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check against TEST_USER_EMAIL environment variable (set by Playwright tests via header)
  const testUserEmailEnv = process.env.TEST_USER_EMAIL;
  if (testUserEmailEnv && normalizedEmail === testUserEmailEnv.toLowerCase().trim()) {
    return 'matches TEST_USER_EMAIL from Playwright test header';
  }

  // Check against test email config values
  if (siteConfig) {
    const testEmailConfigs = [
      { key: 'happy_path_email_test_chrome', value: siteConfig.happy_path_email_test_chrome },
      { key: 'happy_path_email_test_firefox', value: siteConfig.happy_path_email_test_firefox },
      { key: 'happy_path_email_test_webkit', value: siteConfig.happy_path_email_test_webkit },
      { key: 'happy_path_email_test_mobile_chrome', value: siteConfig.happy_path_email_test_mobile_chrome },
      { key: 'happy_path_email_test_mobile_webkit', value: siteConfig.happy_path_email_test_mobile_webkit },
      { key: 'happy_path_email_test_mobile_webkit_pro', value: siteConfig.happy_path_email_test_mobile_webkit_pro },
    ];

    for (const config of testEmailConfigs) {
      if (config.value && normalizedEmail === config.value.toLowerCase().trim()) {
        return `matches config value: ${config.key}`;
      }
    }
  }

  // Check against test email patterns
  const testDomains = ['@example.com', '@test.com', '@example.org'];
  for (const domain of testDomains) {
    if (normalizedEmail.endsWith(domain)) {
      return `matches test domain pattern: ${domain}`;
    }
  }

  // Check for test email patterns
  if (/^test-.*@/i.test(normalizedEmail)) {
    return 'matches pattern: test-*@*';
  }
  if (/.*test.*@example\./i.test(normalizedEmail)) {
    return 'matches pattern: *test*@example.*';
  }
  if (/^testuser.*@/i.test(normalizedEmail)) {
    return 'matches pattern: testuser*@*';
  }

  return null;
}

