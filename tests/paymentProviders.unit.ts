/** Payment provider availability (Venmo / Zelle) from CMS Key Data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaymentNote,
  canOpenPayEntry,
  getAvailablePaymentMethods,
  getZelleRecipient,
  isVenmoProviderReady,
  isZelleProviderReady,
  normalizePaymentProviderConfig,
} from '../src/lib/payments/paymentProviders';

const readyBoth = normalizePaymentProviderConfig({
  enablePayCapability: true,
  enableVenmo: true,
  enableZelle: true,
  venmoUser: 'wmm_pay',
  zelleDisplayName: 'Warren VL',
  zelleEmail: 'pay@example.com',
  zellePhone: '',
  zelleQrEnabled: true,
});

test('normalizes CMS payment fields with FPO QR default', () => {
  const cfg = normalizePaymentProviderConfig({});
  assert.equal(cfg.enablePayments, false);
  assert.equal(cfg.enableVenmo, true);
  assert.equal(cfg.enableZelle, true);
  assert.equal(cfg.zelleQrEnabled, true);
  assert.equal(cfg.zelleQrImageSrc, '/images/vintage/zelle-qr-fpo.svg');
});

test('requires Zelle display name plus email or phone', () => {
  assert.equal(getZelleRecipient(readyBoth)?.contact, 'pay@example.com');
  assert.equal(
    isZelleProviderReady(
      normalizePaymentProviderConfig({
        ...readyBoth,
        zelleDisplayName: '',
      }),
    ),
    false,
  );
  assert.equal(
    isZelleProviderReady(
      normalizePaymentProviderConfig({
        ...readyBoth,
        zelleEmail: '',
        zellePhone: '555-0100',
      }),
    ),
    true,
  );
});

test('master off hides providers for non-admins but not admins', () => {
  const off = normalizePaymentProviderConfig({
    enablePayCapability: false,
    enableVenmo: true,
    enableZelle: true,
    venmoUser: 'wmm_pay',
    zelleDisplayName: 'Warren VL',
    zelleEmail: 'pay@example.com',
  });
  assert.deepEqual(getAvailablePaymentMethods(off, false), []);
  assert.deepEqual(getAvailablePaymentMethods(off, true), ['venmo', 'zelle']);
  assert.equal(canOpenPayEntry(off, false), false);
  assert.equal(canOpenPayEntry(off, true), true);
});

test('omits a provider when switch off or recipient missing', () => {
  assert.deepEqual(
    getAvailablePaymentMethods(
      normalizePaymentProviderConfig({
        enablePayCapability: true,
        enableVenmo: false,
        enableZelle: true,
        venmoUser: 'wmm_pay',
        zelleDisplayName: 'Warren VL',
        zelleEmail: 'pay@example.com',
      }),
      false,
    ),
    ['zelle'],
  );
  assert.deepEqual(
    getAvailablePaymentMethods(
      normalizePaymentProviderConfig({
        enablePayCapability: true,
        enableVenmo: true,
        enableZelle: false,
        venmoUser: 'wmm_pay',
        zelleDisplayName: 'Warren VL',
        zelleEmail: 'pay@example.com',
      }),
      false,
    ),
    ['venmo'],
  );
  assert.equal(
    isVenmoProviderReady(
      normalizePaymentProviderConfig({
        enablePayCapability: true,
        enableVenmo: true,
        venmoUser: '',
      }),
    ),
    false,
  );
});

test('builds additional-only payment notes', () => {
  assert.equal(
    buildPaymentNote({
      entryNames: [],
      additionalDollars: 10,
      additionalNote: 'Tip',
    }),
    'WMM – additional payment + $10 additional (Tip)',
  );
  assert.equal(
    buildPaymentNote({
      entryNames: ['Alpha'],
      additionalDollars: 0,
      additionalNote: '',
    }),
    'WMM – 1 bracket (Alpha)',
  );
  assert.equal(
    buildPaymentNote({
      entryNames: ['Alpha'],
      additionalDollars: 0,
      additionalNote: 'Family entry',
    }),
    'WMM – 1 bracket (Alpha) (Family entry)',
  );
});
