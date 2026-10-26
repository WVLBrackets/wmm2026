/**
 * CMS copy for the vintage My Picks landing page.
 *
 * Shared fields cover the timer and prior-year switch.
 * `flavors.current` / `flavors.historic` hold editorial copy that differs
 * when viewing the active year vs an archived year (header note, pool
 * section banners, empty states).
 *
 * Legacy published JSON may still use `poolFlavors`; normalize maps that
 * key to `flavors` and drops the old empty `note` field.
 */

import { resolveVintageYearTokens } from "./yearTokens";

/** Which Message Box state is shown on My Picks. */
export type VintageMessageBoxStateKey =
  | "preBracket"
  | "preTipoff"
  | "live"
  | "priorYear";

/**
 * One Message Box state: title + message + colors.
 * Layout/font sizes are shared in CSS; only copy and colors vary.
 */
export interface VintageMessageBoxState {
  /** Eyebrow / title line. Tokens: `{year}`, `{activeYear}`. */
  title: string;
  /**
   * Primary message line. Tokens: `{year}`, `{activeYear}`, `{days}`, `{countdown}`.
   * `{countdown}` is the live clock or days-away phrase for pre-bracket / pre-tipoff.
   */
  message: string;
  borderColor: string;
  backgroundColor: string;
  titleColor: string;
  messageColor: string;
}

/** Adminable Message Box for all four season states. */
export interface VintageMessageBox {
  /** Current year, tournament not started, bracket not published. */
  preBracket: VintageMessageBoxState;
  /** Current year, tournament not started, bracket published. */
  preTipoff: VintageMessageBoxState;
  /** Current year, tipoff has passed (tourney live). */
  live: VintageMessageBoxState;
  /** Viewing a prior year. */
  priorYear: VintageMessageBoxState;
}

/** One year-view flavor: header, pool banners, empty-state, and cost/status copy. */
export interface VintagePicksFlavor {
  /** Supporting line under Welcome. Supports `{year}`. */
  headerNote: string;
  /** Empty-list title. Supports `{year}`, `{activeYear}`. */
  emptyTitle: string;
  /** Empty-list body. Supports `{year}`, `{activeYear}`. */
  emptyBody: string;
  /** "In the pool" section header. */
  inPoolHeader: string;
  /**
   * "In the pool" detail. May include `{X}` for submitted-count phrasing
   * (same expansion as the legacy sheet message).
   */
  inPoolDetail: string;
  /** "Not in the pool" section header. */
  outPoolHeader: string;
  /** "Not in the pool" detail. */
  outPoolDetail: string;
  /**
   * Status line when the user has no submitted and no in-progress brackets.
   * Tokens: `{year}`, `{cost}`, `{Submitted}`, `{In Progress}`. Use `||` for breaks.
   */
  costNoBrackets: string;
  /** Status line when there are submitted brackets but no in-progress. */
  costNoInProgress: string;
  /** Status line when there are in-progress brackets but none submitted. */
  costNoSubmitted: string;
  /** Status line when both submitted and in-progress brackets exist. */
  costBoth: string;
}

/**
 * One payment-status badge (Paid / Pending / Unpaid) — caption + icon + colors.
 * Empty `icon` hides the circle glyph.
 */
export interface VintagePaymentBadgeStyle {
  /** Visible label, e.g. "Paid". */
  caption: string;
  /** Glyph inside the icon circle (e.g. "$"); blank = no icon. */
  icon: string;
  /** Icon circle fill (“badge color”). */
  iconBackground: string;
  /** Icon glyph color. */
  iconColor: string;
  /** Pill fill (shading). */
  background: string;
  /** Caption font color. */
  color: string;
  /** Pill border color. */
  borderColor: string;
}

/** Copy for one My Picks action confirmation popup. */
export interface VintagePicksConfirmCopy {
  /** Dialog title. */
  title: string;
  /** Body. Tokens: `{entry}`. Use `||` for a line break. */
  message: string;
  /** Primary / confirm button label (e.g. "Yes"). */
  confirmLabel: string;
  /** Dismiss button label (e.g. "No"). */
  cancelLabel: string;
}

export interface VintagePicksContent {
  /**
   * Season Message Box (year select + title + message) for four states.
   * Prefer this over the deprecated countdown label fields below.
   */
  messageBox: VintageMessageBox;
  /**
   * @deprecated Prefer `messageBox.preBracket.title`. Kept for older drafts.
   */
  countdownToBracketLabel: string;
  /**
   * @deprecated Prefer `messageBox.preTipoff.title`. Kept for older drafts.
   */
  countdownToTipoffLabel: string;
  /**
   * Long-horizon countdown phrase when exactly one day remains (`{days}`).
   * Used to build the `{countdown}` token in Message Box messages.
   */
  countdownDayAwayMessage: string;
  /**
   * Long-horizon countdown phrase when 2+ days remain (`{days}`).
   * Used to build the `{countdown}` token in Message Box messages.
   */
  countdownDaysAwayMessage: string;
  /**
   * @deprecated Prefer `messageBox.priorYear`. Kept for older drafts.
   */
  viewingPriorYearLabel: string;
  /**
   * @deprecated Runtime source of truth is homepage Key Data (`keyData.bracketsPublished`).
   * Kept on the picks sidecar for older drafts; overlaid at read time.
   */
  bracketsPublished: boolean;
  /**
   * Empty-state copy when brackets are not published.
   * Tokens: `{year}`, `{date}` (homepage tipoff). Use `||` for a line break.
   */
  bracketsNotPublishedMessage: string;
  /**
   * Active-year empty state when picks are unlocked and the user has no brackets.
   * Desktop/mobile can share one string (layout already differs).
   */
  emptyCtaBody: string;
  /**
   * @deprecated Runtime SOT is homepage Key Data (`keyData.entryCost`).
   */
  entryCost: number;
  /**
   * @deprecated Runtime SOT is homepage Key Data (`keyData.masterLockUnlocked`).
   */
  masterLockUnlocked: boolean;
  /** @deprecated Runtime SOT is homepage Key Data (`keyData.masterLockMessage`). */
  masterLockMessage: string;
  /**
   * Shown when tipoff has passed (tourney active). Replaces Config Sheet
   * stop_submit / final_message_submit_off for vintage. Supports `{year}`.
   */
  tourneyActiveMessage: string;
  /**
   * Prior-year Changing lock / banner. Tokens: `{year}` (viewing), `{activeYear}`,
   * plus legacy `<Active Year>` / `<tournament_year>`.
   */
  priorYearWarningMessage: string;
  /**
   * Error when brackets are published but tournament JSON is missing.
   * Supports `{year}` / `<year>`.
   */
  bracketsMissingErrorMessage: string;
  /**
   * Vertical padding around Final Four / Champ logos in a desktop row (px).
   * Default 5 — keeps rows tight.
   */
  rowLogoGapPx: number;
  /**
   * Payment status badges on submitted rows (Paid / Pending / Unpaid).
   * Desktop: beside the entry name. Mobile: under the entry name.
   */
  payment: {
    paid: VintagePaymentBadgeStyle;
    pending: VintagePaymentBadgeStyle;
    unpaid: VintagePaymentBadgeStyle;
  };
  /**
   * Popup confirmations for row actions (delete / permanent delete / return).
   * Message supports `||` line breaks and `{entry}` for the entry name.
   */
  confirms: {
    delete: VintagePicksConfirmCopy;
    permanentDelete: VintagePicksConfirmCopy;
    return: VintagePicksConfirmCopy;
  };
  /**
   * Row action button colors (active + disabled). Icons stay Lucide per action.
   */
  actions: VintagePicksActionButtons;
  /** Editorial copy that differs for active vs archived year views. */
  flavors: {
    current: VintagePicksFlavor;
    historic: VintagePicksFlavor;
  };
  /**
   * Sign In / Create Account labels (no on-page gear — edited from My Picks admin).
   * Site Config still owns email-failure / registration-success CMS strings.
   */
  auth: VintagePicksAuthCopy;
}

/** Sign In tab labels and placeholders. */
export interface VintagePicksAuthSignIn {
  tabLabel: string;
  heading: string;
  lede: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submitLabel: string;
  submitPendingLabel: string;
  forgotPasswordLink: string;
  /** e.g. "New here?" */
  footerPrompt: string;
  /** e.g. "Create an account." */
  footerLink: string;
}

/** Create Account tab labels, placeholders, and client validation messages. */
export interface VintagePicksAuthCreateAccount {
  tabLabel: string;
  heading: string;
  lede: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  submitLabel: string;
  submitPendingLabel: string;
  /** e.g. "Already have an account?" */
  footerPrompt: string;
  /** e.g. "Sign in." */
  footerLink: string;
  passwordsMismatch: string;
  passwordTooShort: string;
}

/** Bundled auth-page copy owned by the My Picks CMS sidecar. */
export interface VintagePicksAuthCopy {
  signIn: VintagePicksAuthSignIn;
  createAccount: VintagePicksAuthCreateAccount;
}

/** One row-action control: fill + ink for enabled and disabled states. */
export interface VintagePicksActionStyle {
  background: string;
  color: string;
  disabledBackground: string;
  disabledColor: string;
}

/** Keys match `data-vp-action` on landing row buttons. */
export interface VintagePicksActionButtons {
  view: VintagePicksActionStyle;
  edit: VintagePicksActionStyle;
  submit: VintagePicksActionStyle;
  copy: VintagePicksActionStyle;
  delete: VintagePicksActionStyle;
  restore: VintagePicksActionStyle;
  return: VintagePicksActionStyle;
  email: VintagePicksActionStyle;
  permanentDelete: VintagePicksActionStyle;
}

const DEFAULT_ACTION_DISABLED = {
  disabledBackground: "#d1d5db",
  disabledColor: "#6b7280",
};

/** Design-system utility action: navy fill, paper icon (`docs/DESIGN_SYSTEM.md` §4.6). */
const ACTION_UTILITY = {
  background: "#152c3a",
  color: "#f2ead8",
  ...DEFAULT_ACTION_DISABLED,
};

/** Design-system primary Submit: newspaper red, paper icon. */
const ACTION_SUBMIT = {
  background: "#b52c26",
  color: "#f2ead8",
  ...DEFAULT_ACTION_DISABLED,
};

/**
 * Design-system Delete / permanent delete: paper fill, red ink
 * (border applied in CSS; do not use a solid red fill).
 */
const ACTION_DELETE = {
  background: "#f2ead8",
  color: "#b52c26",
  ...DEFAULT_ACTION_DISABLED,
};

/**
 * Default My Picks row-action colors — navy / red / paper per design system.
 * Loud legacy blues/greens/ambers are not used.
 */
function defaultActionButtons(): VintagePicksActionButtons {
  return {
    view: { ...ACTION_UTILITY },
    edit: { ...ACTION_UTILITY },
    submit: { ...ACTION_SUBMIT },
    copy: { ...ACTION_UTILITY },
    delete: { ...ACTION_DELETE },
    restore: { ...ACTION_UTILITY },
    return: { ...ACTION_UTILITY },
    email: { ...ACTION_UTILITY },
    permanentDelete: { ...ACTION_DELETE },
  };
}

/**
 * Default current-year flavor (matches prior hardcodes / sheet fallbacks).
 */
/** Shared default cost/status lines (sheet `welcome_*` equivalents). */
function defaultCostMessages(): Pick<
  VintagePicksFlavor,
  "costNoBrackets" | "costNoInProgress" | "costNoSubmitted" | "costBoth"
> {
  return {
    costNoBrackets: "Click New Bracket to start your first entry",
    costNoInProgress:
      "Submitted entry total: ${cost}. In-progress entries count only after submission.",
    costNoSubmitted:
      "You have not submitted any brackets yet. In-progress entries count only after submission.",
    costBoth:
      "Submitted entry total: ${cost}. In-progress entries count only after submission.",
  };
}

function defaultCurrentFlavor(): VintagePicksFlavor {
  return {
    headerNote: "Create and manage your {year} brackets.",
    emptyTitle: "No brackets yet",
    emptyBody: "Use the \"New Bracket\" button to create your first bracket.",
    inPoolHeader: "In the pool",
    inPoolDetail: "Submitted entries count toward the contest.",
    outPoolHeader: "Not in the pool",
    outPoolDetail:
      "In progress and deleted entries are not included until you submit.",
    ...defaultCostMessages(),
  };
}

/**
 * Default historic-year flavor (read-only archive messaging).
 */
function defaultHistoricFlavor(): VintagePicksFlavor {
  return {
    headerNote: "Review your {year} brackets. Editing is closed.",
    emptyTitle: "No entries for {year}",
    emptyBody:
      "You have no brackets for {year}. Switch to {activeYear} to create new picks.",
    inPoolHeader: "In the pool",
    inPoolDetail: "Submitted entries from {year}.",
    outPoolHeader: "Not in the pool",
    outPoolDetail: "In-progress and deleted entries from {year}.",
    costNoBrackets: "No brackets on file for {year}.",
    costNoInProgress:
      "Submitted entry total: ${cost}. Historical entries are read-only.",
    costNoSubmitted:
      "No submitted entries for {year}. Historical entries are read-only.",
    costBoth:
      "Submitted entry total: ${cost}. Historical entries are read-only.",
  };
}

/**
 * Default Sign In / Create Account UI copy (matches the vintage auth mockups).
 */
export function defaultVintagePicksAuthCopy(): VintagePicksAuthCopy {
  return {
    signIn: {
      tabLabel: "Sign In",
      heading: "Welcome Back",
      lede: "Your next run starts here.",
      emailLabel: "Email address",
      emailPlaceholder: "Enter your email address.",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter your password.",
      submitLabel: "Sign In",
      submitPendingLabel: "Signing in...",
      forgotPasswordLink: "Forgot your password?",
      footerPrompt: "New here?",
      footerLink: "Create an account.",
    },
    createAccount: {
      tabLabel: "Create Account",
      heading: "Join the Madness",
      lede: "Create an account to make and manage your picks.",
      nameLabel: "Full Name",
      namePlaceholder: "Enter your full name.",
      emailLabel: "Email address",
      emailPlaceholder: "Enter your email address.",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter your password",
      confirmPasswordLabel: "Confirm Password",
      confirmPasswordPlaceholder: "Confirm your password",
      submitLabel: "Create Account",
      submitPendingLabel: "Creating account...",
      footerPrompt: "Already have an account?",
      footerLink: "Sign in.",
      passwordsMismatch: "Passwords do not match",
      passwordTooShort: "Password must be at least 6 characters",
    },
  };
}

/**
 * Default Message Box colors (approved two-state season panel).
 * Current year: solid navy. Prior year: paper fill, navy border / left accent.
 * Return-to-current link is rendered in the UI (red), not as the whole panel.
 */
function defaultMessageBox(): VintageMessageBox {
  const activeColors = {
    borderColor: "#152c3a",
    backgroundColor: "#152c3a",
    titleColor: "#f2ead8",
    messageColor: "#f2ead8",
  };
  const priorColors = {
    borderColor: "#152c3a",
    backgroundColor: "#f2ead8",
    titleColor: "#152c3a",
    messageColor: "#152c3a",
  };
  return {
    preBracket: {
      title: "Tipoff countdown",
      message: "{countdown}",
      ...activeColors,
    },
    preTipoff: {
      title: "Tipoff countdown",
      message: "{countdown}",
      ...activeColors,
    },
    live: {
      title: "Live",
      message: "{year} Tourney Active!",
      ...activeColors,
    },
    priorYear: {
      title: "Past season",
      message: "Viewing {year}",
      ...priorColors,
    },
  };
}

export const DEFAULT_VINTAGE_PICKS_CONTENT: VintagePicksContent = {
  messageBox: defaultMessageBox(),
  countdownToBracketLabel: "Countdown to {year} bracket",
  countdownToTipoffLabel: "Countdown to {year} tipoff",
  countdownDayAwayMessage: "{days} day to go",
  countdownDaysAwayMessage: "{days} days to go",
  viewingPriorYearLabel:
    "Viewing {year}. Click here to switch back to {activeYear}",
  bracketsPublished: false,
  bracketsNotPublishedMessage:
    "{year} bracket data is not published yet.||Check back on {date}",
  emptyCtaBody: "Use the \"New Bracket\" button to create your first bracket.",
  entryCost: 5,
  masterLockUnlocked: true,
  masterLockMessage:
    "Bracket actions are temporarily locked by the administrator.",
  tourneyActiveMessage:
    "{year} tipoff has passed. Bracket changes are closed.",
  priorYearWarningMessage:
    "You are viewing {year} (read-only). Switch back to {activeYear} to create or edit picks.",
  bracketsMissingErrorMessage:
    "Bracket field data is missing for {year}. Please contact the administrator.",
  rowLogoGapPx: 5,
  payment: {
    paid: {
      caption: "Paid",
      icon: "$",
      iconBackground: "#166534",
      iconColor: "#ffffff",
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#86efac",
    },
    pending: {
      caption: "Pending",
      icon: "$",
      iconBackground: "#d1d5db",
      iconColor: "#374151",
      background: "#f9fafb",
      color: "#4b5563",
      borderColor: "#d1d5db",
    },
    unpaid: {
      caption: "Unpaid",
      icon: "",
      iconBackground: "#9ca3af",
      iconColor: "#ffffff",
      background: "#e5e7eb",
      color: "#374151",
      borderColor: "#9ca3af",
    },
  },
  confirms: {
    delete: {
      title: "Delete entry?",
      message:
        "This will move “{entry}” to Deleted. You can restore it later.||Are you sure?",
      confirmLabel: "Yes",
      cancelLabel: "No",
    },
    permanentDelete: {
      title: "Permanently delete?",
      message:
        "Permanently delete “{entry}”? This cannot be undone.||Are you sure you want to continue?",
      confirmLabel: "Yes",
      cancelLabel: "No",
    },
    return: {
      title: "Return to In Progress?",
      message:
        "This will move “{entry}” out of the contest pool until you submit again.||Are you sure?",
      confirmLabel: "Yes",
      cancelLabel: "No",
    },
  },
  actions: defaultActionButtons(),
  flavors: {
    current: defaultCurrentFlavor(),
    historic: defaultHistoricFlavor(),
  },
  auth: defaultVintagePicksAuthCopy(),
};

/**
 * Format homepage tipoff ISO as Eastern medium datetime with an EST suffix
 * (e.g. "Mar 14, 2027, 8:00 PM EST"). Empty tipoff → "a later date".
 */
export function formatVintageTipoffDate(tipoffAt: string | undefined): string {
  const raw = tipoffAt?.trim() ?? "";
  if (!raw) return "a later date";
  try {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return /\bEST\b/i.test(raw) ? raw : `${raw} EST`;
    }
    return (
      parsed.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/New_York",
      }) + " EST"
    );
  } catch {
    return /\bEST\b/i.test(raw) ? raw : `${raw} EST`;
  }
}

/**
 * Fill `{year}` / `{date}` (and `||` line breaks) for the not-published empty state.
 * `{date}` comes from homepage Brackets Ready (`tournament.bracketsReadyAt`),
 * with tipoff as fallback when Ready is unset.
 */
export function formatVintageBracketsNotPublishedMessage(
  template: string,
  vars: { year: number | string; tipoffAt?: string },
): string {
  const fallback =
    DEFAULT_VINTAGE_PICKS_CONTENT.bracketsNotPublishedMessage;
  const date = formatVintageTipoffDate(vars.tipoffAt);
  const year = String(vars.year);
  return resolveVintageYearTokens(template || fallback, year)
    .trim()
    .replace(/\{date\}/g, date)
    .replace(/\{tipoff\}/g, date)
    .replace(/<date time>/gi, date);
}

/**
 * Normalize one flavor bucket from stored JSON (or legacy `poolFlavors` entry).
 */
function normalizeFlavor(
  value: unknown,
  defaults: VintagePicksFlavor,
): VintagePicksFlavor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }
  const input = value as Partial<VintagePicksFlavor> & { note?: unknown };
  return {
    headerNote:
      typeof input.headerNote === "string" ? input.headerNote : defaults.headerNote,
    emptyTitle:
      typeof input.emptyTitle === "string" ? input.emptyTitle : defaults.emptyTitle,
    emptyBody:
      typeof input.emptyBody === "string" ? input.emptyBody : defaults.emptyBody,
    inPoolHeader:
      typeof input.inPoolHeader === "string"
        ? input.inPoolHeader
        : defaults.inPoolHeader,
    inPoolDetail:
      typeof input.inPoolDetail === "string"
        ? input.inPoolDetail
        : defaults.inPoolDetail,
    outPoolHeader:
      typeof input.outPoolHeader === "string"
        ? input.outPoolHeader
        : defaults.outPoolHeader,
    outPoolDetail:
      typeof input.outPoolDetail === "string"
        ? input.outPoolDetail
        : defaults.outPoolDetail,
    costNoBrackets:
      typeof input.costNoBrackets === "string"
        ? input.costNoBrackets
        : defaults.costNoBrackets,
    costNoInProgress:
      typeof input.costNoInProgress === "string"
        ? input.costNoInProgress
        : defaults.costNoInProgress,
    costNoSubmitted:
      typeof input.costNoSubmitted === "string"
        ? input.costNoSubmitted
        : defaults.costNoSubmitted,
    costBoth:
      typeof input.costBoth === "string" ? input.costBoth : defaults.costBoth,
  };
}

/**
 * Resolve flavor input from either `flavors` or legacy `poolFlavors`.
 */
function resolveFlavorSource(
  input: Record<string, unknown>,
): { current?: unknown; historic?: unknown } {
  const flavors = input.flavors;
  if (flavors && typeof flavors === "object" && !Array.isArray(flavors)) {
    const bag = flavors as { current?: unknown; historic?: unknown };
    return { current: bag.current, historic: bag.historic };
  }
  const legacy = input.poolFlavors;
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    const bag = legacy as { current?: unknown; historic?: unknown };
    return { current: bag.current, historic: bag.historic };
  }
  return {};
}

/**
 * Fill missing My Picks CMS fields from defaults.
 */
export function normalizeVintagePicksContent(
  value: unknown,
): VintagePicksContent {
  const defaults = structuredClone(DEFAULT_VINTAGE_PICKS_CONTENT);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  const input = value as Record<string, unknown>;
  const flavorSource = resolveFlavorSource(input);
  return {
    countdownToBracketLabel:
      typeof input.countdownToBracketLabel === "string"
        ? input.countdownToBracketLabel
        : defaults.countdownToBracketLabel,
    countdownToTipoffLabel:
      typeof input.countdownToTipoffLabel === "string"
        ? input.countdownToTipoffLabel
        : defaults.countdownToTipoffLabel,
    countdownDayAwayMessage:
      typeof input.countdownDayAwayMessage === "string"
        ? input.countdownDayAwayMessage
        : defaults.countdownDayAwayMessage,
    countdownDaysAwayMessage:
      typeof input.countdownDaysAwayMessage === "string"
        ? input.countdownDaysAwayMessage
        : defaults.countdownDaysAwayMessage,
    viewingPriorYearLabel:
      typeof input.viewingPriorYearLabel === "string"
        ? input.viewingPriorYearLabel
        : defaults.viewingPriorYearLabel,
    messageBox: normalizeMessageBox(input.messageBox, defaults.messageBox, {
      countdownToBracketLabel:
        typeof input.countdownToBracketLabel === "string"
          ? input.countdownToBracketLabel
          : defaults.countdownToBracketLabel,
      countdownToTipoffLabel:
        typeof input.countdownToTipoffLabel === "string"
          ? input.countdownToTipoffLabel
          : defaults.countdownToTipoffLabel,
      viewingPriorYearLabel:
        typeof input.viewingPriorYearLabel === "string"
          ? input.viewingPriorYearLabel
          : defaults.viewingPriorYearLabel,
    }),
    bracketsPublished:
      typeof input.bracketsPublished === "boolean"
        ? input.bracketsPublished
        : defaults.bracketsPublished,
    bracketsNotPublishedMessage:
      typeof input.bracketsNotPublishedMessage === "string"
        ? input.bracketsNotPublishedMessage
        : defaults.bracketsNotPublishedMessage,
    emptyCtaBody:
      typeof input.emptyCtaBody === "string"
        ? input.emptyCtaBody
        : defaults.emptyCtaBody,
    entryCost: normalizeEntryCost(input.entryCost, defaults.entryCost),
    masterLockUnlocked:
      typeof input.masterLockUnlocked === "boolean"
        ? input.masterLockUnlocked
        : defaults.masterLockUnlocked,
    masterLockMessage:
      typeof input.masterLockMessage === "string"
        ? input.masterLockMessage
        : defaults.masterLockMessage,
    tourneyActiveMessage:
      typeof input.tourneyActiveMessage === "string"
        ? input.tourneyActiveMessage
        : defaults.tourneyActiveMessage,
    priorYearWarningMessage:
      typeof input.priorYearWarningMessage === "string"
        ? input.priorYearWarningMessage
        : defaults.priorYearWarningMessage,
    bracketsMissingErrorMessage:
      typeof input.bracketsMissingErrorMessage === "string"
        ? input.bracketsMissingErrorMessage
        : defaults.bracketsMissingErrorMessage,
    rowLogoGapPx: normalizeRowLogoGapPx(input.rowLogoGapPx, defaults.rowLogoGapPx),
    payment: normalizePayment(input.payment, defaults.payment),
    confirms: normalizeConfirms(input.confirms, defaults.confirms),
    actions: normalizeActionButtons(input.actions, defaults.actions),
    flavors: {
      current: normalizeFlavor(flavorSource.current, defaults.flavors.current),
      historic: normalizeFlavor(
        flavorSource.historic,
        defaults.flavors.historic,
      ),
    },
    auth: normalizeAuthCopy(input.auth, defaults.auth),
  };
}

/**
 * Coerce one string field; non-strings fall back to the default.
 */
function normalizeAuthString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Normalize Sign In tab fields from stored JSON.
 */
function normalizeAuthSignIn(
  value: unknown,
  defaults: VintagePicksAuthSignIn,
): VintagePicksAuthSignIn {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }
  const input = value as Partial<VintagePicksAuthSignIn>;
  return {
    tabLabel: normalizeAuthString(input.tabLabel, defaults.tabLabel),
    heading: normalizeAuthString(input.heading, defaults.heading),
    lede: normalizeAuthString(input.lede, defaults.lede),
    emailLabel: normalizeAuthString(input.emailLabel, defaults.emailLabel),
    emailPlaceholder: normalizeAuthString(
      input.emailPlaceholder,
      defaults.emailPlaceholder,
    ),
    passwordLabel: normalizeAuthString(
      input.passwordLabel,
      defaults.passwordLabel,
    ),
    passwordPlaceholder: normalizeAuthString(
      input.passwordPlaceholder,
      defaults.passwordPlaceholder,
    ),
    submitLabel: normalizeAuthString(input.submitLabel, defaults.submitLabel),
    submitPendingLabel: normalizeAuthString(
      input.submitPendingLabel,
      defaults.submitPendingLabel,
    ),
    forgotPasswordLink: normalizeAuthString(
      input.forgotPasswordLink,
      defaults.forgotPasswordLink,
    ),
    footerPrompt: normalizeAuthString(input.footerPrompt, defaults.footerPrompt),
    footerLink: normalizeAuthString(input.footerLink, defaults.footerLink),
  };
}

/**
 * Normalize Create Account tab fields from stored JSON.
 */
function normalizeAuthCreateAccount(
  value: unknown,
  defaults: VintagePicksAuthCreateAccount,
): VintagePicksAuthCreateAccount {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }
  const input = value as Partial<VintagePicksAuthCreateAccount>;
  return {
    tabLabel: normalizeAuthString(input.tabLabel, defaults.tabLabel),
    heading: normalizeAuthString(input.heading, defaults.heading),
    lede: normalizeAuthString(input.lede, defaults.lede),
    nameLabel: normalizeAuthString(input.nameLabel, defaults.nameLabel),
    namePlaceholder: normalizeAuthString(
      input.namePlaceholder,
      defaults.namePlaceholder,
    ),
    emailLabel: normalizeAuthString(input.emailLabel, defaults.emailLabel),
    emailPlaceholder: normalizeAuthString(
      input.emailPlaceholder,
      defaults.emailPlaceholder,
    ),
    passwordLabel: normalizeAuthString(
      input.passwordLabel,
      defaults.passwordLabel,
    ),
    passwordPlaceholder: normalizeAuthString(
      input.passwordPlaceholder,
      defaults.passwordPlaceholder,
    ),
    confirmPasswordLabel: normalizeAuthString(
      input.confirmPasswordLabel,
      defaults.confirmPasswordLabel,
    ),
    confirmPasswordPlaceholder: normalizeAuthString(
      input.confirmPasswordPlaceholder,
      defaults.confirmPasswordPlaceholder,
    ),
    submitLabel: normalizeAuthString(input.submitLabel, defaults.submitLabel),
    submitPendingLabel: normalizeAuthString(
      input.submitPendingLabel,
      defaults.submitPendingLabel,
    ),
    footerPrompt: normalizeAuthString(input.footerPrompt, defaults.footerPrompt),
    footerLink: normalizeAuthString(input.footerLink, defaults.footerLink),
    passwordsMismatch: normalizeAuthString(
      input.passwordsMismatch,
      defaults.passwordsMismatch,
    ),
    passwordTooShort: normalizeAuthString(
      input.passwordTooShort,
      defaults.passwordTooShort,
    ),
  };
}

/**
 * Normalize the auth copy bag (Sign In + Create Account).
 */
function normalizeAuthCopy(
  value: unknown,
  defaults: VintagePicksAuthCopy,
): VintagePicksAuthCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(defaults);
  }
  const input = value as Partial<VintagePicksAuthCopy>;
  return {
    signIn: normalizeAuthSignIn(input.signIn, defaults.signIn),
    createAccount: normalizeAuthCreateAccount(
      input.createAccount,
      defaults.createAccount,
    ),
  };
}

/**
 * Coerce logo gap to a non-negative integer pixel value (0–24).
 */
function normalizeRowLogoGapPx(value: unknown, fallback: number): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(24, Math.round(n));
}

/**
 * Normalize a CSS color string; empty / non-string → fallback.
 */
function normalizeCssColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

/**
 * Normalize one action button color set.
 */
function normalizeActionStyle(
  value: unknown,
  defaults: VintagePicksActionStyle,
): VintagePicksActionStyle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }
  const input = value as Partial<VintagePicksActionStyle>;
  return {
    background: normalizeCssColor(input.background, defaults.background),
    color: normalizeCssColor(input.color, defaults.color),
    disabledBackground: normalizeCssColor(
      input.disabledBackground,
      defaults.disabledBackground,
    ),
    disabledColor: normalizeCssColor(input.disabledColor, defaults.disabledColor),
  };
}

/**
 * Normalize all row-action button colors.
 */
function normalizeActionButtons(
  value: unknown,
  defaults: VintagePicksActionButtons,
): VintagePicksActionButtons {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(defaults);
  }
  const input = value as Partial<Record<keyof VintagePicksActionButtons, unknown>>;
  return {
    view: normalizeActionStyle(input.view, defaults.view),
    edit: normalizeActionStyle(input.edit, defaults.edit),
    submit: normalizeActionStyle(input.submit, defaults.submit),
    copy: normalizeActionStyle(input.copy, defaults.copy),
    delete: normalizeActionStyle(input.delete, defaults.delete),
    restore: normalizeActionStyle(input.restore, defaults.restore),
    return: normalizeActionStyle(input.return, defaults.return),
    email: normalizeActionStyle(input.email, defaults.email),
    permanentDelete: normalizeActionStyle(
      input.permanentDelete,
      defaults.permanentDelete,
    ),
  };
}

/**
 * Normalize one payment badge (caption, icon, colors).
 */
function normalizePaymentBadge(
  value: unknown,
  defaults: VintagePaymentBadgeStyle,
): VintagePaymentBadgeStyle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }
  const input = value as Partial<VintagePaymentBadgeStyle>;
  return {
    caption:
      typeof input.caption === "string" && input.caption.trim()
        ? input.caption.trim().slice(0, 24)
        : defaults.caption,
    icon:
      typeof input.icon === "string" ? input.icon.trim().slice(0, 4) : defaults.icon,
    iconBackground: normalizeCssColor(input.iconBackground, defaults.iconBackground),
    iconColor: normalizeCssColor(input.iconColor, defaults.iconColor),
    background: normalizeCssColor(input.background, defaults.background),
    color: normalizeCssColor(input.color, defaults.color),
    borderColor: normalizeCssColor(input.borderColor, defaults.borderColor),
  };
}

/**
 * Normalize Paid / Pending / Unpaid badges. Migrates legacy flat
 * `paidBackground` / `paidColor` / `unpaidBackground` / `unpaidColor` keys.
 */
function normalizePayment(
  value: unknown,
  defaults: VintagePicksContent["payment"],
): VintagePicksContent["payment"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      paid: { ...defaults.paid },
      pending: { ...defaults.pending },
      unpaid: { ...defaults.unpaid },
    };
  }
  const input = value as Record<string, unknown>;
  const legacyPaidBg =
    typeof input.paidBackground === "string" ? input.paidBackground : undefined;
  const legacyPaidFg =
    typeof input.paidColor === "string" ? input.paidColor : undefined;
  const legacyUnpaidBg =
    typeof input.unpaidBackground === "string" ? input.unpaidBackground : undefined;
  const legacyUnpaidFg =
    typeof input.unpaidColor === "string" ? input.unpaidColor : undefined;

  const paidSeed: VintagePaymentBadgeStyle = {
    ...defaults.paid,
    ...(legacyPaidBg ? { background: legacyPaidBg } : {}),
    ...(legacyPaidFg ? { color: legacyPaidFg, iconBackground: legacyPaidFg } : {}),
  };
  const unpaidSeed: VintagePaymentBadgeStyle = {
    ...defaults.unpaid,
    ...(legacyUnpaidBg ? { background: legacyUnpaidBg } : {}),
    ...(legacyUnpaidFg ? { color: legacyUnpaidFg } : {}),
  };

  return {
    paid: normalizePaymentBadge(input.paid, paidSeed),
    pending: normalizePaymentBadge(input.pending, defaults.pending),
    unpaid: normalizePaymentBadge(input.unpaid, unpaidSeed),
  };
}

/**
 * Normalize one Message Box state (copy + colors).
 */
function normalizeMessageBoxState(
  value: unknown,
  defaults: VintageMessageBoxState,
): VintageMessageBoxState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }
  const input = value as Partial<VintageMessageBoxState>;
  return {
    title:
      typeof input.title === "string" && input.title.trim()
        ? input.title
        : defaults.title,
    message:
      typeof input.message === "string" && input.message.trim()
        ? input.message
        : defaults.message,
    borderColor: normalizeCssColor(input.borderColor, defaults.borderColor),
    backgroundColor: normalizeCssColor(
      input.backgroundColor,
      defaults.backgroundColor,
    ),
    titleColor: normalizeCssColor(input.titleColor, defaults.titleColor),
    messageColor: normalizeCssColor(input.messageColor, defaults.messageColor),
  };
}

/**
 * True when prior-year Message Box copy is the legacy full-panel switch CTA.
 */
function isLegacyPriorYearSwitchCopy(text: string): boolean {
  return /click here|switch back/i.test(text);
}

/**
 * True when a color is paper/cream (blends into the page behind a navy panel).
 */
function isPaperLikeColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "#f2ead8" ||
    normalized === "#f2ead8ff" ||
    normalized === "rgb(242, 234, 216)" ||
    normalized === "var(--v-paper)" ||
    normalized === "var(--vp-paper)"
  );
}

/**
 * Current-year panels use a navy border so the outer edge stays visible on paper.
 * Legacy cream borders made the navy fill look smaller than the prior-year panel.
 *
 * @param state - Normalized Message Box state
 * @param defaults - Active-year defaults (navy border / fill)
 */
function repairActiveSeasonBorder(
  state: VintageMessageBoxState,
  defaults: VintageMessageBoxState,
): VintageMessageBoxState {
  if (!isPaperLikeColor(state.borderColor)) return state;
  return {
    ...state,
    borderColor: defaults.borderColor,
  };
}

/**
 * Normalize Message Box; seed titles from deprecated countdown labels when absent.
 * Prior-year “click here to switch…” paragraphs are replaced with compact “Viewing {year}”.
 */
function normalizeMessageBox(
  value: unknown,
  defaults: VintageMessageBox,
  legacy: {
    countdownToBracketLabel: string;
    countdownToTipoffLabel: string;
    viewingPriorYearLabel: string;
  },
): VintageMessageBox {
  const seeded: VintageMessageBox = {
    preBracket: {
      ...defaults.preBracket,
      title: legacy.countdownToBracketLabel || defaults.preBracket.title,
    },
    preTipoff: {
      ...defaults.preTipoff,
      title: legacy.countdownToTipoffLabel || defaults.preTipoff.title,
    },
    live: { ...defaults.live },
    priorYear: { ...defaults.priorYear },
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      preBracket: repairActiveSeasonBorder(seeded.preBracket, defaults.preBracket),
      preTipoff: repairActiveSeasonBorder(seeded.preTipoff, defaults.preTipoff),
      live: repairActiveSeasonBorder(seeded.live, defaults.live),
      priorYear: seeded.priorYear,
    };
  }
  const input = value as Partial<Record<VintageMessageBoxStateKey, unknown>>;
  const priorYear = normalizeMessageBoxState(input.priorYear, seeded.priorYear);
  if (
    isLegacyPriorYearSwitchCopy(priorYear.title) ||
    isLegacyPriorYearSwitchCopy(priorYear.message)
  ) {
    priorYear.title = defaults.priorYear.title;
    priorYear.message = defaults.priorYear.message;
    priorYear.titleColor = defaults.priorYear.titleColor;
    priorYear.messageColor = defaults.priorYear.messageColor;
    priorYear.borderColor = defaults.priorYear.borderColor;
    priorYear.backgroundColor = defaults.priorYear.backgroundColor;
  }
  return {
    preBracket: repairActiveSeasonBorder(
      normalizeMessageBoxState(input.preBracket, seeded.preBracket),
      defaults.preBracket,
    ),
    preTipoff: repairActiveSeasonBorder(
      normalizeMessageBoxState(input.preTipoff, seeded.preTipoff),
      defaults.preTipoff,
    ),
    live: repairActiveSeasonBorder(
      normalizeMessageBoxState(input.live, seeded.live),
      defaults.live,
    ),
    priorYear,
  };
}

/**
 * Normalize one confirmation popup copy bag.
 */
function normalizeConfirmCopy(
  value: unknown,
  defaults: VintagePicksConfirmCopy,
): VintagePicksConfirmCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }
  const input = value as Partial<VintagePicksConfirmCopy>;
  return {
    title: normalizeAuthString(input.title, defaults.title),
    message: normalizeAuthString(input.message, defaults.message),
    confirmLabel: normalizeAuthString(input.confirmLabel, defaults.confirmLabel),
    cancelLabel: normalizeAuthString(input.cancelLabel, defaults.cancelLabel),
  };
}

/**
 * Normalize delete / permanent-delete / return confirmation copy.
 */
function normalizeConfirms(
  value: unknown,
  defaults: VintagePicksContent["confirms"],
): VintagePicksContent["confirms"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(defaults);
  }
  const input = value as Partial<VintagePicksContent["confirms"]>;
  return {
    delete: normalizeConfirmCopy(input.delete, defaults.delete),
    permanentDelete: normalizeConfirmCopy(
      input.permanentDelete,
      defaults.permanentDelete,
    ),
    return: normalizeConfirmCopy(input.return, defaults.return),
  };
}

/**
 * Fill `{entry}` in a confirmation title or message.
 *
 * @param template - CMS string
 * @param entryName - Bracket entry name (falls back to "this entry")
 */
export function formatPicksConfirmText(
  template: string,
  entryName: string,
): string {
  const entry = entryName.trim() || "this entry";
  return template.replace(/\{entry\}/g, entry);
}

/**
 * CSS custom properties for row chrome (logo gap, actions, payment chips).
 * Apply on the `.v-picks` root so descendants inherit.
 */
export function vintagePicksChromeCssVars(
  content: VintagePicksContent,
): Record<string, string> {
  const vars: Record<string, string> = {
    "--vp-row-logo-gap": `${content.rowLogoGapPx}px`,
  };
  const payStates = ["paid", "pending", "unpaid"] as const;
  for (const state of payStates) {
    const badge = content.payment[state];
    vars[`--vp-pay-${state}-bg`] = badge.background;
    vars[`--vp-pay-${state}-fg`] = badge.color;
    vars[`--vp-pay-${state}-border`] = badge.borderColor;
    vars[`--vp-pay-${state}-icon-bg`] = badge.iconBackground;
    vars[`--vp-pay-${state}-icon-fg`] = badge.iconColor;
  }
  // Row-action chrome is design-locked (navy / red / paper). Always emit the
  // approved treatments so older CMS drafts with loud blues/greens cannot regress.
  const locked = defaultActionButtons();
  const keys = Object.keys(locked) as (keyof VintagePicksActionButtons)[];
  for (const key of keys) {
    const style = locked[key];
    const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    vars[`--vp-action-${cssKey}-bg`] = style.background;
    vars[`--vp-action-${cssKey}-fg`] = style.color;
    vars[`--vp-action-${cssKey}-disabled-bg`] = style.disabledBackground;
    vars[`--vp-action-${cssKey}-disabled-fg`] = style.disabledColor;
  }
  return vars;
}

/**
 * Coerce entry cost to a positive integer dollars amount.
 */
function normalizeEntryCost(value: unknown, fallback: number): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

/**
 * Validate My Picks CMS copy before save/publish.
 */
export function validateVintagePicksContent(
  value: unknown,
): asserts value is VintagePicksContent {
  const doc = normalizeVintagePicksContent(value);
  if (!doc.countdownDayAwayMessage.trim()) {
    throw new Error("Countdown day-away message cannot be blank.");
  }
  if (!doc.countdownDaysAwayMessage.trim()) {
    throw new Error("Countdown days-away message cannot be blank.");
  }
  const boxKeys: { key: VintageMessageBoxStateKey; label: string }[] = [
    { key: "preBracket", label: "Pre-bracket Message Box" },
    { key: "preTipoff", label: "Pre-tipoff Message Box" },
    { key: "live", label: "Live Message Box" },
    { key: "priorYear", label: "Prior-year Message Box" },
  ];
  for (const { key, label } of boxKeys) {
    const state = doc.messageBox[key];
    if (!state.title.trim()) {
      throw new Error(`${label} title cannot be blank.`);
    }
    if (!state.message.trim()) {
      throw new Error(`${label} message cannot be blank.`);
    }
  }
  if (!doc.emptyCtaBody.trim()) {
    throw new Error("Empty-state CTA body cannot be blank.");
  }
  if (!doc.bracketsNotPublishedMessage.trim()) {
    throw new Error("Brackets-not-published message cannot be blank.");
  }
  if (!Number.isFinite(doc.entryCost) || doc.entryCost < 0) {
    throw new Error("Entry cost must be a non-negative number.");
  }
  if (!doc.masterLockMessage.trim()) {
    throw new Error("Master lock message cannot be blank.");
  }
  if (!doc.tourneyActiveMessage.trim()) {
    throw new Error("Tourney-active message cannot be blank.");
  }
  if (!doc.priorYearWarningMessage.trim()) {
    throw new Error("Prior-year warning message cannot be blank.");
  }
  if (!doc.bracketsMissingErrorMessage.trim()) {
    throw new Error("Missing-JSON error message cannot be blank.");
  }
  if (!Number.isFinite(doc.rowLogoGapPx) || doc.rowLogoGapPx < 0) {
    throw new Error("Row logo gap must be a non-negative number.");
  }
  for (const [key, label] of [
    ["delete", "Delete confirmation"],
    ["permanentDelete", "Permanent-delete confirmation"],
    ["return", "Return confirmation"],
  ] as const) {
    const bag = doc.confirms[key];
    if (!bag.title.trim()) {
      throw new Error(`${label} title cannot be blank.`);
    }
    if (!bag.message.trim()) {
      throw new Error(`${label} message cannot be blank.`);
    }
    if (!bag.confirmLabel.trim()) {
      throw new Error(`${label} confirm label cannot be blank.`);
    }
    if (!bag.cancelLabel.trim()) {
      throw new Error(`${label} cancel label cannot be blank.`);
    }
  }
  if (!doc.auth.signIn.tabLabel.trim() || !doc.auth.signIn.heading.trim()) {
    throw new Error("Sign In tab label and heading cannot be blank.");
  }
  if (!doc.auth.signIn.submitLabel.trim()) {
    throw new Error("Sign In submit label cannot be blank.");
  }
  if (
    !doc.auth.createAccount.tabLabel.trim() ||
    !doc.auth.createAccount.heading.trim()
  ) {
    throw new Error("Create Account tab label and heading cannot be blank.");
  }
  if (!doc.auth.createAccount.submitLabel.trim()) {
    throw new Error("Create Account submit label cannot be blank.");
  }
  for (const [name, flavor] of [
    ["current", doc.flavors.current],
    ["historic", doc.flavors.historic],
  ] as const) {
    if (!flavor.emptyTitle.trim()) {
      throw new Error(`${name} empty-state title cannot be blank.`);
    }
    if (!flavor.emptyBody.trim()) {
      throw new Error(`${name} empty-state body cannot be blank.`);
    }
    if (!flavor.inPoolHeader.trim()) {
      throw new Error(`${name} in-pool header cannot be blank.`);
    }
    if (!flavor.outPoolHeader.trim()) {
      throw new Error(`${name} out-of-pool header cannot be blank.`);
    }
    if (!flavor.costBoth.trim()) {
      throw new Error(`${name} cost message (both statuses) cannot be blank.`);
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(key in doc)) delete record[key];
    }
    Object.assign(record, doc);
  }
}

/**
 * Replace year tokens in adminable My Picks copy (`{year}`, `<year>`, `{activeYear}`).
 */
export function formatVintagePicksLabel(
  template: string,
  vars: { year: number | string; activeYear?: number | string },
): string {
  const withYear = resolveVintageYearTokens(template, vars.year);
  const active = String(vars.activeYear ?? vars.year);
  return withYear
    .replace(/\{activeYear\}/g, active)
    .replace(/<activeYear>/gi, active);
}

/**
 * Format Message Box title/message with year, days, and countdown tokens.
 *
 * @param template - CMS string
 * @param vars - Token values (`countdown` is the ready-to-display clock/days phrase)
 */
export function formatMessageBoxText(
  template: string,
  vars: {
    year: number | string;
    activeYear?: number | string;
    days?: number | string;
    countdown?: string;
  },
): string {
  let out = formatVintagePicksLabel(template, vars);
  if (vars.days != null) {
    out = out.replace(/\{days\}/g, String(vars.days));
  }
  if (vars.countdown != null) {
    out = out.replace(/\{countdown\}/g, vars.countdown);
  }
  return out;
}

/**
 * CSS custom properties for a Message Box state (apply on `.v-picks__board`).
 */
export function messageBoxCssVars(
  state: VintageMessageBoxState,
): Record<string, string> {
  return {
    "--vp-board-border": state.borderColor,
    "--vp-board-bg": state.backgroundColor,
    "--vp-board-title": state.titleColor,
    "--vp-board-message": state.messageColor,
    "--vp-board-eyebrow": state.borderColor,
  };
}
