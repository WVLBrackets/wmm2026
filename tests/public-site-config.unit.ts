import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SiteConfigData } from '../src/lib/siteConfig';
import {
  isForbiddenPublicSiteConfigKey,
  PUBLIC_SITE_CONFIG_KEYS,
  toPublicSiteConfig,
} from '../src/lib/publicSiteConfig';

/** Minimal valid public config for serializer tests. */
function sampleConfig(overrides: Partial<SiteConfigData> = {}): SiteConfigData {
  return {
    tournamentYear: '2027',
    siteName: 'WMM',
    siteDescription: '',
    standingsYear: '2027',
    entryCost: 20,
    masterLockMessage: '',
    contactEmail: 'commish@example.org',
    footerText: '',
    lastYearWinner: '',
    lastYearChampionship: 0,
    tournamentStartDate: '',
    bracketsAvailable: 'NO',
    bracketsAvailableDateTime: '',
    venmoUser: '',
    enablePayCapability: 'YES',
    enableVenmo: 'YES',
    enableZelle: 'YES',
    zelleDisplayName: '',
    zelleEmail: '',
    zellePhone: '',
    zelleQrEnabled: 'NO',
    zelleQrImageSrc: '',
    ...overrides,
  };
}

describe('public site-config allowlist', () => {
  it('forbids happy_path / email_test style keys', () => {
    assert.equal(isForbiddenPublicSiteConfigKey('happy_path_email_test_chrome'), true);
    assert.equal(isForbiddenPublicSiteConfigKey('happy_path_email_test_firefox'), true);
    assert.equal(isForbiddenPublicSiteConfigKey('HAPPY_PATH_EMAIL_TEST_WEBKIT'), true);
    assert.equal(isForbiddenPublicSiteConfigKey('some_email_test_mobile'), true);
  });

  it('allows every SiteConfigData public field', () => {
    for (const key of PUBLIC_SITE_CONFIG_KEYS) {
      assert.equal(
        isForbiddenPublicSiteConfigKey(key),
        false,
        `expected public key ${key} to be allowed`,
      );
    }
  });

  it('toPublicSiteConfig drops injected non-public fields', () => {
    const dirty = {
      ...sampleConfig(),
      happy_path_email_test_chrome: 'chrome@test.example',
      HAPPY_PATH_EMAIL_TEST_FIREFOX: 'ff@test.example',
    } as SiteConfigData & Record<string, string>;

    const publicConfig = toPublicSiteConfig(dirty);
    const keys = Object.keys(publicConfig);
    assert.ok(keys.every((k) => !/happy_path|email_test/i.test(k)));
    assert.equal(
      (publicConfig as Record<string, unknown>).happy_path_email_test_chrome,
      undefined,
    );
    assert.equal(publicConfig.tournamentYear, '2027');
    assert.equal(publicConfig.siteName, 'WMM');
  });
});
