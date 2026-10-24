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
   * Paid / unpaid chip colors on submitted rows (words optional on mobile).
   */
  payment: {
    paidBackground: string;
    paidColor: string;
    unpaidBackground: string;
    unpaidColor: string;
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

/**
 * Default filled action colors (aligned with the legacy Tailwind button hues).
 */
function defaultActionButtons(): VintagePicksActionButtons {
  return {
    view: { background: "#1e3a5f", color: "#ffffff", ...DEFAULT_ACTION_DISABLED },
    edit: { background: "#2563eb", color: "#ffffff", ...DEFAULT_ACTION_DISABLED },
    submit: { background: "#4f46e5", color: "#ffffff", ...DEFAULT_ACTION_DISABLED },
    copy: { background: "#16a34a", color: "#ffffff", ...DEFAULT_ACTION_DISABLED },
    delete: { background: "#dc2626", color: "#ffffff", ...DEFAULT_ACTION_DISABLED },
    restore: { background: "#d97706", color: "#ffffff", ...DEFAULT_ACTION_DISABLED },
    return: { background: "#d97706", color: "#ffffff", ...DEFAULT_ACTION_DISABLED },
    email: { background: "#4f46e5", color: "#ffffff", ...DEFAULT_ACTION_DISABLED },
    permanentDelete: {
      background: "#7f1d1d",
      color: "#ffffff",
      ...DEFAULT_ACTION_DISABLED,
    },
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
      "Your total cost so far is ${cost}.||You can create a new entry and save it for later without submitting it now.",
    costNoSubmitted:
      "You have not submitted any brackets yet.||Please complete and submit your bracket(s) to be included in the contest.",
    costBoth:
      "Your total cost so far is ${cost}.||In Progress brackets are not included in the contest until submitted.",
  };
}

function defaultCurrentFlavor(): VintagePicksFlavor {
  return {
    headerNote:
      "Create and submit your picks here once the bracket is available",
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
    headerNote: "Browsing {year} brackets (read-only).",
    emptyTitle: "No entries for {year}",
    emptyBody:
      "You have no brackets for {year}. Switch to {activeYear} to create new picks.",
    inPoolHeader: "In the pool",
    inPoolDetail: "Submitted entries from {year}.",
    outPoolHeader: "Not in the pool",
    outPoolDetail: "In-progress and deleted entries from {year}.",
    ...defaultCostMessages(),
    costNoBrackets: "No brackets on file for {year}.",
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

/** Default Message Box colors: active year = blue/cream; prior = cream/blue/red. */
function defaultMessageBox(): VintageMessageBox {
  const activeColors = {
    borderColor: "#f2ead8",
    backgroundColor: "#152c3a",
    titleColor: "#f2ead8",
    messageColor: "#f2ead8",
  };
  const priorColors = {
    borderColor: "#152c3a",
    backgroundColor: "#f2ead8",
    titleColor: "#b52c26",
    messageColor: "#b52c26",
  };
  return {
    preBracket: {
      title: "Countdown to {year} bracket",
      message: "{countdown}",
      ...activeColors,
    },
    preTipoff: {
      title: "Countdown to {year} tipoff",
      message: "{countdown}",
      ...activeColors,
    },
    live: {
      title: "Live",
      message: "{year} Tourney Active!",
      ...activeColors,
    },
    priorYear: {
      title: "Viewing {year}",
      message: "Click here to switch back to {activeYear}",
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
    paidBackground: "#dcfce7",
    paidColor: "#166534",
    unpaidBackground: "#fee2e2",
    unpaidColor: "#991b1b",
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
 * Normalize paid / unpaid chip colors.
 */
function normalizePayment(
  value: unknown,
  defaults: VintagePicksContent["payment"],
): VintagePicksContent["payment"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }
  const input = value as Partial<VintagePicksContent["payment"]>;
  return {
    paidBackground: normalizeCssColor(input.paidBackground, defaults.paidBackground),
    paidColor: normalizeCssColor(input.paidColor, defaults.paidColor),
    unpaidBackground: normalizeCssColor(
      input.unpaidBackground,
      defaults.unpaidBackground,
    ),
    unpaidColor: normalizeCssColor(input.unpaidColor, defaults.unpaidColor),
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
 * Normalize Message Box; seed titles from deprecated countdown labels when absent.
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
    priorYear: {
      ...defaults.priorYear,
      message:
        legacy.viewingPriorYearLabel
          .replace(/^Viewing\s*\{year\}\.\s*/i, "")
          .trim() || defaults.priorYear.message,
    },
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return seeded;
  }
  const input = value as Partial<Record<VintageMessageBoxStateKey, unknown>>;
  return {
    preBracket: normalizeMessageBoxState(input.preBracket, seeded.preBracket),
    preTipoff: normalizeMessageBoxState(input.preTipoff, seeded.preTipoff),
    live: normalizeMessageBoxState(input.live, seeded.live),
    priorYear: normalizeMessageBoxState(input.priorYear, seeded.priorYear),
  };
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
    "--vp-pay-paid-bg": content.payment.paidBackground,
    "--vp-pay-paid-fg": content.payment.paidColor,
    "--vp-pay-unpaid-bg": content.payment.unpaidBackground,
    "--vp-pay-unpaid-fg": content.payment.unpaidColor,
  };
  const keys = Object.keys(content.actions) as (keyof VintagePicksActionButtons)[];
  for (const key of keys) {
    const style = content.actions[key];
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
