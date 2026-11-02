/**
 * Shared payment-provider availability for My Picks Pay (Venmo + Zelle).
 * CMS Key Data is the source of truth — no Config Sheet dependency.
 */

export type PaymentMethod = 'venmo' | 'zelle';

/** Snapshot of Key Data payment fields used for availability checks. */
export interface PaymentProviderConfig {
  /** Master switch (`enablePayCapability`). Off → non-admins cannot pay. */
  enablePayments: boolean;
  enableVenmo: boolean;
  enableZelle: boolean;
  venmoUser: string;
  zelleDisplayName: string;
  zelleEmail: string;
  zellePhone: string;
  zelleQrEnabled: boolean;
  zelleQrImageSrc: string;
}

export interface ZelleRecipient {
  displayName: string;
  /** Preferred contact line for copy/display (email preferred, else phone). */
  contact: string;
  email: string;
  phone: string;
}

/**
 * Normalize a Key Data / site-config payment payload into {@link PaymentProviderConfig}.
 *
 * @param input - Partial CMS or API config
 */
export function normalizePaymentProviderConfig(
  input: Partial<{
    enablePayCapability: boolean | string;
    enablePayments: boolean | string;
    enableVenmo: boolean | string;
    enableZelle: boolean | string;
    venmoUser: string;
    zelleDisplayName: string;
    zelleEmail: string;
    zellePhone: string;
    zelleQrEnabled: boolean | string;
    zelleQrImageSrc: string;
  }> | null | undefined,
): PaymentProviderConfig {
  const src = input ?? {};
  const asBool = (value: boolean | string | undefined, fallback: boolean): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const u = value.trim().toUpperCase();
      if (u === 'YES' || u === 'TRUE' || u === '1') return true;
      if (u === 'NO' || u === 'FALSE' || u === '0') return false;
    }
    return fallback;
  };

  return {
    enablePayments: asBool(
      src.enablePayments !== undefined ? src.enablePayments : src.enablePayCapability,
      false,
    ),
    enableVenmo: asBool(src.enableVenmo, true),
    enableZelle: asBool(src.enableZelle, true),
    venmoUser: typeof src.venmoUser === 'string' ? src.venmoUser.replace(/^@+/, '').trim() : '',
    zelleDisplayName:
      typeof src.zelleDisplayName === 'string' ? src.zelleDisplayName.trim() : '',
    zelleEmail: typeof src.zelleEmail === 'string' ? src.zelleEmail.trim() : '',
    zellePhone: typeof src.zellePhone === 'string' ? src.zellePhone.trim() : '',
    zelleQrEnabled: asBool(src.zelleQrEnabled, true),
    zelleQrImageSrc:
      typeof src.zelleQrImageSrc === 'string' && src.zelleQrImageSrc.trim()
        ? src.zelleQrImageSrc.trim()
        : '/images/vintage/zelle-qr-fpo.svg',
  };
}

/**
 * Resolve Zelle recipient details when configured.
 *
 * @param config - Normalized payment config
 * @returns Recipient or null when name or contact is missing
 */
export function getZelleRecipient(config: PaymentProviderConfig): ZelleRecipient | null {
  const displayName = config.zelleDisplayName.trim();
  const email = config.zelleEmail.trim();
  const phone = config.zellePhone.trim();
  const contact = email || phone;
  if (!displayName || !contact) return null;
  return { displayName, contact, email, phone };
}

/**
 * Whether Venmo can be offered (provider on + username configured).
 * Does not apply the master switch — callers combine with {@link isPaymentMasterAllowed}.
 *
 * @param config - Normalized payment config
 */
export function isVenmoProviderReady(config: PaymentProviderConfig): boolean {
  return config.enableVenmo && Boolean(config.venmoUser.trim());
}

/**
 * Whether Zelle can be offered (provider on + display name + email or phone).
 *
 * @param config - Normalized payment config
 */
export function isZelleProviderReady(config: PaymentProviderConfig): boolean {
  return config.enableZelle && getZelleRecipient(config) !== null;
}

/**
 * Master switch: non-admins need enablePayments; admins always pass.
 *
 * @param config - Normalized payment config
 * @param isAdminUser - Current user is ops admin
 */
export function isPaymentMasterAllowed(
  config: PaymentProviderConfig,
  isAdminUser: boolean,
): boolean {
  return config.enablePayments || isAdminUser;
}

/**
 * Providers available for selection after master + recipient checks.
 *
 * @param config - Normalized payment config
 * @param isAdminUser - Current user is ops admin
 */
export function getAvailablePaymentMethods(
  config: PaymentProviderConfig,
  isAdminUser: boolean,
): PaymentMethod[] {
  if (!isPaymentMasterAllowed(config, isAdminUser)) return [];
  const methods: PaymentMethod[] = [];
  if (isVenmoProviderReady(config)) methods.push('venmo');
  if (isZelleProviderReady(config)) methods.push('zelle');
  return methods;
}

/**
 * Whether the public Pay entry point should open (master + ≥1 ready provider).
 * Additional-only payments are allowed even with zero unpaid brackets.
 *
 * @param config - Normalized payment config
 * @param isAdminUser - Current user is ops admin
 */
export function canOpenPayEntry(
  config: PaymentProviderConfig,
  isAdminUser: boolean,
): boolean {
  return getAvailablePaymentMethods(config, isAdminUser).length > 0;
}

/**
 * Build the payment note shown in Venmo / Zelle copy and stored on the payment row.
 *
 * @param options - Selected entry names and optional additional dollars
 */
export function buildPaymentNote(options: {
  entryNames: string[];
  additionalDollars: number;
  additionalNote: string;
}): string {
  const { entryNames, additionalDollars, additionalNote } = options;
  const count = entryNames.length;
  const trimmedNote = additionalNote.trim();
  let note =
    count > 0
      ? `WMM – ${count} bracket${count !== 1 ? 's' : ''} (${entryNames.join(', ')})`
      : 'WMM – additional payment';
  if (additionalDollars > 0) {
    note += ` + $${additionalDollars} additional (${trimmedNote})`;
  } else if (trimmedNote) {
    note += ` (${trimmedNote})`;
  }
  return note;
}

/**
 * Snapshot recipient label stored with the payment for admin reconciliation.
 *
 * @param method - Selected provider
 * @param config - Normalized payment config
 */
export function buildRecipientSnapshot(
  method: PaymentMethod,
  config: PaymentProviderConfig,
): string {
  if (method === 'venmo') {
    return `@${config.venmoUser.replace(/^@+/, '')}`;
  }
  const zelle = getZelleRecipient(config);
  if (!zelle) return 'Zelle';
  return `${zelle.displayName} · ${zelle.contact}`;
}
