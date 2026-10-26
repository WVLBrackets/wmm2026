"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Save,
  Upload,
} from "lucide-react";
import {
  DEFAULT_VINTAGE_PICKS_CONTENT,
  normalizeVintagePicksContent,
  validateVintagePicksContent,
  type VintagePicksActionButtons,
  type VintagePicksActionStyle,
  type VintagePicksAuthCreateAccount,
  type VintagePicksAuthSignIn,
  type VintagePaymentBadgeStyle,
  type VintagePicksConfirmCopy,
  type VintagePicksContent,
  type VintagePicksFlavor,
} from "@/lib/vintage/picksContent";
import type { VintagePicksState } from "@/lib/vintage/picksStore";
import AdminColorField from "../AdminColorField";
import VintageAdminNav from "../VintageAdminNav";
import "../editor.css";
import {
  SectionPanel,
  SectionRail,
  sectionDomId,
  useSectionNav,
} from "../sectionNav";

const TABS = [
  "Timer & year",
  "Message box",
  "Header",
  "Pool sections",
  "Empty states",
  "Cost & status",
  "Row chrome",
  "Confirmations",
  "Sign in & account",
] as const;

const CONFIRM_KEYS: {
  key: keyof VintagePicksContent["confirms"];
  label: string;
  help: string;
}[] = [
  {
    key: "delete",
    label: "Delete (move to Deleted)",
    help: "Shown when deleting an In Progress entry.",
  },
  {
    key: "permanentDelete",
    label: "Permanent delete",
    help: "Shown when permanently removing a Deleted entry.",
  },
  {
    key: "return",
    label: "Return to In Progress",
    help: "Shown when returning a Submitted entry to In Progress.",
  },
];

const MESSAGE_BOX_STATES: {
  key: keyof VintagePicksContent["messageBox"];
  label: string;
  help: string;
}[] = [
  {
    key: "preBracket",
    label: "1 · Current year — bracket not defined",
    help: "Tournament not started; brackets not published yet.",
  },
  {
    key: "preTipoff",
    label: "2 · Current year — bracket defined",
    help: "Tournament not started; brackets are published (countdown to tipoff).",
  },
  {
    key: "live",
    label: "3 · Current year — tournament started",
    help: "Tipoff has passed; tourney is live.",
  },
  {
    key: "priorYear",
    label: "4 · Previous year",
    help: "Archive year: title + “Viewing {year}”. A separate Back to {activeYear} link returns to the current year (not the whole panel).",
  },
];

const MESSAGE_BOX_COLOR_FIELDS: {
  key: keyof VintagePicksContent["messageBox"]["preBracket"];
  label: string;
}[] = [
  { key: "borderColor", label: "Border (also eyebrow)" },
  { key: "backgroundColor", label: "Background" },
  { key: "titleColor", label: "Title color" },
  { key: "messageColor", label: "Message color" },
];

const ACTION_KEYS: { key: keyof VintagePicksActionButtons; label: string }[] = [
  { key: "view", label: "View" },
  { key: "edit", label: "Edit" },
  { key: "submit", label: "Submit" },
  { key: "copy", label: "Copy" },
  { key: "delete", label: "Delete" },
  { key: "restore", label: "Restore" },
  { key: "return", label: "Return" },
  { key: "email", label: "Email" },
  { key: "permanentDelete", label: "Permanent delete" },
];

/**
 * Stable DOM id of a stacked section from its tab label
 * (e.g. "Timer & year" → `ve-section-timer-and-year`).
 */
function sectionIdFor(label: string): string {
  return sectionDomId(label);
}

/** Ordered sections for the sticky left rail. */
const SECTIONS = TABS.map((label) => ({ label, id: sectionIdFor(label) }));
const SECTION_IDS = SECTIONS.map((section) => section.id);

type SharedStringKey = keyof Pick<
  VintagePicksContent,
  | "countdownDayAwayMessage"
  | "countdownDaysAwayMessage"
  | "bracketsNotPublishedMessage"
  | "emptyCtaBody"
  | "masterLockMessage"
  | "tourneyActiveMessage"
  | "priorYearWarningMessage"
  | "bracketsMissingErrorMessage"
>;

type FlavorKey = keyof VintagePicksFlavor;
type FlavorName = "current" | "historic";
type AuthSignInKey = keyof VintagePicksAuthSignIn;
type AuthCreateKey = keyof VintagePicksAuthCreateAccount;

/**
 * Set a top-level shared string field on the My Picks draft.
 */
function setSharedField(
  source: VintagePicksContent,
  key: SharedStringKey,
  value: string,
): VintagePicksContent {
  return { ...source, [key]: value };
}

/**
 * Set one field inside a current/historic flavor bucket.
 */
function setFlavorField(
  source: VintagePicksContent,
  flavor: FlavorName,
  key: FlavorKey,
  value: string,
): VintagePicksContent {
  return {
    ...source,
    flavors: {
      ...source.flavors,
      [flavor]: {
        ...source.flavors[flavor],
        [key]: value,
      },
    },
  };
}

/**
 * Set one Sign In auth CMS string.
 */
function setAuthSignInField(
  source: VintagePicksContent,
  key: AuthSignInKey,
  value: string,
): VintagePicksContent {
  return {
    ...source,
    auth: {
      ...source.auth,
      signIn: { ...source.auth.signIn, [key]: value },
    },
  };
}

/**
 * Set one Create Account auth CMS string.
 */
function setAuthCreateField(
  source: VintagePicksContent,
  key: AuthCreateKey,
  value: string,
): VintagePicksContent {
  return {
    ...source,
    auth: {
      ...source.auth,
      createAccount: { ...source.auth.createAccount, [key]: value },
    },
  };
}

/**
 * Admin editor for My Picks landing copy — sectioned like the homepage editor,
 * with current vs historic flavor fieldsets for year-dependent messages.
 */
export default function VintagePicksEditor() {
  const router = useRouter();
  const [state, setState] = useState<VintagePicksState | null>(null);
  const [content, setContent] = useState<VintagePicksContent>(
    structuredClone(DEFAULT_VINTAGE_PICKS_CONTENT),
  );
  const { activeId, jumpTo } = useSectionNav(SECTION_IDS, Boolean(state));
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/admin/vintage-picks", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load.");
        if (!active) return;
        setState(data.state);
        setContent(normalizeVintagePicksContent(data.state.draft));
        setReady(Boolean(data.storageReady));
        setDirty(false);
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : "Unable to load.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /**
   * Update one shared CMS string and mark the draft dirty.
   */
  function updateShared(key: SharedStringKey, value: string) {
    setContent((previous) => setSharedField(previous, key, value));
    setDirty(true);
  }

  /**
   * Update one flavor field and mark the draft dirty.
   */
  function updateFlavor(flavor: FlavorName, key: FlavorKey, value: string) {
    setContent((previous) => setFlavorField(previous, flavor, key, value));
    setDirty(true);
  }

  /**
   * Update one Sign In auth field and mark the draft dirty.
   */
  function updateAuthSignIn(key: AuthSignInKey, value: string) {
    setContent((previous) => setAuthSignInField(previous, key, value));
    setDirty(true);
  }

  /**
   * Update one Create Account auth field and mark the draft dirty.
   */
  function updateAuthCreate(key: AuthCreateKey, value: string) {
    setContent((previous) => setAuthCreateField(previous, key, value));
    setDirty(true);
  }

  /**
   * Render a shared top-level text field (multiline for longer templates).
   */
  function sharedField(
    key: SharedStringKey,
    label: string,
    help?: string,
    multiline = false,
  ) {
    const id = `vintage-picks-${key}`;
    return (
      <label className="ve-field" key={key} htmlFor={id}>
        <span>{label}</span>
        {help ? <span className="ve-help">{help}</span> : null}
        {multiline ? (
          <textarea
            id={id}
            data-testid={id}
            value={content[key]}
            onChange={(e) => updateShared(key, e.target.value)}
            rows={3}
            maxLength={6000}
          />
        ) : (
          <input
            id={id}
            data-testid={id}
            value={content[key]}
            onChange={(e) => updateShared(key, e.target.value)}
            maxLength={6000}
          />
        )}
      </label>
    );
  }

  /**
   * Render a flavor-scoped text field (optionally multiline for longer copy).
   */
  function flavorField(
    flavor: FlavorName,
    key: FlavorKey,
    label: string,
    help?: string,
    multiline = false,
  ) {
    const id = `vintage-picks-${flavor}-${key}`;
    const value = content.flavors[flavor][key];
    return (
      <label className="ve-field" key={id} htmlFor={id}>
        <span>{label}</span>
        {help ? <span className="ve-help">{help}</span> : null}
        {multiline ? (
          <textarea
            id={id}
            data-testid={id}
            value={value}
            onChange={(e) => updateFlavor(flavor, key, e.target.value)}
            rows={3}
            maxLength={6000}
          />
        ) : (
          <input
            id={id}
            data-testid={id}
            value={value}
            onChange={(e) => updateFlavor(flavor, key, e.target.value)}
            maxLength={6000}
          />
        )}
      </label>
    );
  }

  /**
   * Current + historic fieldsets for a pair of flavor fields.
   */
  function flavorPair(
    key: FlavorKey,
    label: string,
    help?: string,
    multiline = false,
  ) {
    return (
      <div className="ve-grid" key={key}>
        <fieldset className="ve-panel" aria-label={`Current year — ${label}`}>
          <p className="ve-eyebrow">CURRENT YEAR</p>
          <h3>{label}</h3>
          {flavorField("current", key, label, help, multiline)}
        </fieldset>
        <fieldset className="ve-panel" aria-label={`Historic year — ${label}`}>
          <p className="ve-eyebrow">HISTORIC YEAR</p>
          <h3>{label}</h3>
          {flavorField("historic", key, label, help, multiline)}
        </fieldset>
      </div>
    );
  }

  /**
   * Render a Sign In auth CMS text field.
   */
  function authSignInField(
    key: AuthSignInKey,
    label: string,
    help?: string,
    multiline = false,
  ) {
    const id = `vintage-picks-auth-signin-${key}`;
    return (
      <label className="ve-field" key={id} htmlFor={id}>
        <span>{label}</span>
        {help ? <span className="ve-help">{help}</span> : null}
        {multiline ? (
          <textarea
            id={id}
            data-testid={id}
            value={content.auth.signIn[key]}
            onChange={(e) => updateAuthSignIn(key, e.target.value)}
            rows={2}
            maxLength={2000}
          />
        ) : (
          <input
            id={id}
            data-testid={id}
            value={content.auth.signIn[key]}
            onChange={(e) => updateAuthSignIn(key, e.target.value)}
            maxLength={500}
          />
        )}
      </label>
    );
  }

  /**
   * Render a Create Account auth CMS text field.
   */
  function authCreateField(
    key: AuthCreateKey,
    label: string,
    help?: string,
    multiline = false,
  ) {
    const id = `vintage-picks-auth-create-${key}`;
    return (
      <label className="ve-field" key={id} htmlFor={id}>
        <span>{label}</span>
        {help ? <span className="ve-help">{help}</span> : null}
        {multiline ? (
          <textarea
            id={id}
            data-testid={id}
            value={content.auth.createAccount[key]}
            onChange={(e) => updateAuthCreate(key, e.target.value)}
            rows={2}
            maxLength={2000}
          />
        ) : (
          <input
            id={id}
            data-testid={id}
            value={content.auth.createAccount[key]}
            onChange={(e) => updateAuthCreate(key, e.target.value)}
            maxLength={500}
          />
        )}
      </label>
    );
  }

  async function csrfToken(): Promise<string> {
    const response = await fetch("/api/csrf-token", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not verify your session.");
    const data = await response.json();
    return data.csrfToken;
  }

  async function save(action: "save" | "publish") {
    if (!state) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const payload = normalizeVintagePicksContent(content);
      validateVintagePicksContent(payload);
      const token = await csrfToken();
      const response = await fetch("/api/admin/vintage-picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          action,
          content: payload,
          version: state.version,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data.state);
      setContent(normalizeVintagePicksContent(data.state.draft));
      setDirty(false);
      if (action === "publish") {
        router.push("/bracket");
        router.refresh();
        return;
      }
      setMessage("Draft saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <main className="vintage-editor" aria-busy={!error}>
        {error ? (
          <p className="ve-error" role="alert">
            <AlertCircle size={16} /> {error}
          </p>
        ) : (
          <p>Loading My Picks editor…</p>
        )}
      </main>
    );
  }

  return (
    <main className="vintage-editor" data-testid="vintage-picks-editor">
      <VintageAdminNav current="picks" />
      <header className="ve-header">
        <div>
          <Link href="/bracket" className="ve-back">
            <ArrowLeft size={16} /> My Picks
          </Link>
          <h1>My Picks copy</h1>
          <p className="ve-help">
            Sectioned like the homepage editor. Timer labels and the
            brackets-published gate are shared; header, pool, and empty-state
            copy have <strong>current</strong> and <strong>historic</strong>{" "}
            flavors. Sign In / Create Account labels live here (no gear on those
            pages — signing in leaves them). Tokens: <code>{"{year}"}</code>,{" "}
            <code>{"{activeYear}"}</code>, <code>{"{date}"}</code> (homepage
            tipoff). In-pool detail may use <code>{"{X}"}</code>. No Config
            Sheet for the not-published message.
          </p>
        </div>
        <div className="ve-actions">
          <button
            type="button"
            className="ve-button"
            disabled={busy || !ready}
            onClick={() => void save("save")}
            data-testid="vintage-picks-save"
          >
            <Save size={16} /> Save draft
          </button>
          <button
            type="button"
            className="ve-button ve-primary"
            disabled={busy || !ready}
            onClick={() => void save("publish")}
            data-testid="vintage-picks-publish"
          >
            <Upload size={16} /> Publish
          </button>
        </div>
      </header>

      {!ready ? (
        <div className="ve-notice" role="status">
          Dedicated vintage storage is not configured.
        </div>
      ) : null}
      {message ? (
        <p className="ve-success" role="status">
          <CheckCircle2 size={16} /> {message}
        </p>
      ) : null}
      {error ? (
        <p className="ve-error" role="alert">
          <AlertCircle size={16} /> {error}
        </p>
      ) : null}
      {dirty ? <p className="ve-help">Unsaved changes</p> : null}

      <div className="ve-workspace">
        <SectionRail
          sections={SECTIONS}
          activeId={activeId}
          onJump={jumpTo}
          ariaLabel="Editor sections"
          testIdPrefix="vintage-picks-tab"
        />

        <div className="ve-sections">
          <SectionPanel id={sectionIdFor("Timer & year")} title="Timer & year" disabled={busy}>
            <>
              <p className="ve-help" data-testid="vintage-picks-key-data-note">
                Application Master Lock, Brackets published, Entry cost, Tourney
                Year, and Tip Off are administered under homepage{" "}
                <a href="/vintage/admin?focus=keyData">Key Data</a>. Edit the
                messages and countdown labels here.
              </p>
              {sharedField(
                "tourneyActiveMessage",
                "Message when tipoff has passed",
                "Tourney-active lock (homepage tipoff). Tokens: {year} or <year>.",
                true,
              )}
              {sharedField(
                "priorYearWarningMessage",
                "Prior-year warning",
                "When viewing a non-active year. Tokens: {year}, {activeYear}.",
                true,
              )}
              {sharedField(
                "bracketsMissingErrorMessage",
                "Missing field JSON error",
                "When published but tournament JSON is missing. Tokens: {year}.",
                true,
              )}

              <h3>Brackets empty-state</h3>
              <div className="ve-grid">
                {sharedField(
                  "bracketsNotPublishedMessage",
                  "Not-published message",
                  "Tokens: {year}, {date} (from homepage tipoff). Use || for a line break.",
                  true,
                )}
              </div>
              <p className="ve-help">
                Season Message Box title, message, and colors are under{" "}
                <strong>Message box</strong>.
              </p>
            </>
          </SectionPanel>

          <SectionPanel id={sectionIdFor("Message box")} title="Message box" disabled={busy}>
            <>
              <p className="ve-help" data-testid="vintage-picks-message-box-help">
                Four states share one season-panel footprint (Year label + dropdown,
                vertical rule, title + message). Only copy and colors change; the
                prior-year return link is fixed in the UI. Tokens:{" "}
                <code>{"{year}"}</code>, <code>{"{activeYear}"}</code>,{" "}
                <code>{"{days}"}</code>, <code>{"{countdown}"}</code> (clock or
                days-away phrase).
              </p>
              <h3>Days-away phrasing</h3>
              <p className="ve-help">
                Builds the <code>{"{countdown}"}</code> token when more than 100
                hours remain before tipoff / bracket release.
              </p>
              <div className="ve-grid">
                {sharedField(
                  "countdownDayAwayMessage",
                  "Singular (1 day)",
                  "Token: {days}",
                )}
                {sharedField(
                  "countdownDaysAwayMessage",
                  "Plural (2+ days)",
                  "Token: {days}",
                )}
              </div>
              {MESSAGE_BOX_STATES.map(({ key, label, help }) => {
                const state = content.messageBox[key];
                const patchState = (
                  patch: Partial<VintagePicksContent["messageBox"]["preBracket"]>,
                ) => {
                  setContent((previous) => ({
                    ...previous,
                    messageBox: {
                      ...previous.messageBox,
                      [key]: { ...previous.messageBox[key], ...patch },
                    },
                  }));
                  setDirty(true);
                };
                return (
                  <div
                    key={key}
                    className="ve-message-box-state"
                    data-testid={`vintage-picks-message-box-${key}`}
                  >
                    <h3>{label}</h3>
                    <p className="ve-help">{help}</p>
                    <div className="ve-grid">
                      <label
                        className="ve-field"
                        htmlFor={`vintage-picks-mb-${key}-title`}
                      >
                        <span>Title</span>
                        <input
                          id={`vintage-picks-mb-${key}-title`}
                          data-testid={`vintage-picks-mb-${key}-title`}
                          type="text"
                          value={state.title}
                          onChange={(e) => patchState({ title: e.target.value })}
                        />
                      </label>
                      <label
                        className="ve-field"
                        htmlFor={`vintage-picks-mb-${key}-message`}
                      >
                        <span>Message</span>
                        <input
                          id={`vintage-picks-mb-${key}-message`}
                          data-testid={`vintage-picks-mb-${key}-message`}
                          type="text"
                          value={state.message}
                          onChange={(e) =>
                            patchState({ message: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <div className="ve-grid">
                      {MESSAGE_BOX_COLOR_FIELDS.map(({ key: colorKey, label: colorLabel }) => {
                        const testId = `vintage-picks-mb-${key}-${colorKey}`;
                        return (
                          <AdminColorField
                            key={colorKey}
                            id={testId}
                            testId={testId}
                            label={colorLabel}
                            value={state[colorKey]}
                            onChange={(next) =>
                              patchState({ [colorKey]: next })
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          </SectionPanel>

          <SectionPanel id={sectionIdFor("Header")} title="Header" disabled={busy}>
            <>
              <p className="ve-help">
                Supporting line under Welcome. Leave blank to hide. Token:{" "}
                <code>{"{year}"}</code>.
              </p>
              {flavorPair(
                "headerNote",
                "Header note",
                "Shown under the welcome line when mutations are allowed (current) or as archive context (historic).",
              )}
            </>
          </SectionPanel>

          <SectionPanel id={sectionIdFor("Pool sections")} title="Pool sections" disabled={busy}>
            <>
              <p className="ve-help">
                Section banners above in-pool and out-of-pool entries. In-pool
                detail may include <code>{"{X}"}</code> for submitted count.
              </p>
              {flavorPair("inPoolHeader", "In the pool — header")}
              {flavorPair(
                "inPoolDetail",
                "In the pool — detail",
                "Optional. Token {X} → “N submitted entr(y|ies)”.",
                true,
              )}
              {flavorPair("outPoolHeader", "Not in the pool — header")}
              {flavorPair(
                "outPoolDetail",
                "Not in the pool — detail",
                "Optional.",
                true,
              )}
            </>
          </SectionPanel>

          <SectionPanel id={sectionIdFor("Empty states")} title="Empty states" disabled={busy}>
            <>
              <p className="ve-help">
                Shown when the viewer has no brackets for the selected year
                (and the field is published). Not-published copy lives under
                Timer &amp; year.
              </p>
              {flavorPair(
                "emptyTitle",
                "Empty title",
                "Tokens: {year}, {activeYear}",
              )}
              {flavorPair(
                "emptyBody",
                "Empty body",
                "Tokens: {year}, {activeYear}",
                true,
              )}
              <div className="ve-grid">
                {sharedField(
                  "emptyCtaBody",
                  "Active-year CTA body",
                  "Used when the active year is unlocked and the user has zero brackets (instead of the current empty body).",
                )}
              </div>
            </>
          </SectionPanel>

          <SectionPanel id={sectionIdFor("Cost & status")} title="Cost & status" disabled={busy}>
            <>
              <p className="ve-help">
                Dynamic line under the status chips. Entry cost ($) is set in
                homepage{" "}
                <a href="/vintage/admin?focus=keyData">Key Data</a>. Tokens:{" "}
                <code>{"{cost}"}</code>, <code>{"{Submitted}"}</code>,{" "}
                <code>{"{In Progress}"}</code>, <code>{"{year}"}</code>. Use{" "}
                <code>||</code> for a line break. Write <code>{"${cost}"}</code>{" "}
                when you want a dollar sign before the amount.
              </p>
              {flavorPair(
                "costNoBrackets",
                "No brackets yet",
                "Zero submitted and zero in-progress.",
                true,
              )}
              {flavorPair(
                "costNoInProgress",
                "Submitted only",
                "Has submitted; no in-progress.",
                true,
              )}
              {flavorPair(
                "costNoSubmitted",
                "In progress only",
                "Has in-progress; none submitted.",
                true,
              )}
              {flavorPair(
                "costBoth",
                "Submitted + in progress",
                "Both statuses present (typical cost line).",
                true,
              )}
            </>
          </SectionPanel>

          <SectionPanel id={sectionIdFor("Row chrome")} title="Row chrome" disabled={busy}>
            <>
              <p className="ve-help">
                Desktop row density, payment badges, and action button colors.
                Action icons stay fixed (View, Edit, Submit, …); colors apply to
                active and disabled states.
              </p>
              <div className="ve-grid">
                <label className="ve-field" htmlFor="vintage-picks-rowLogoGapPx">
                  <span>Logo vertical gap (px)</span>
                  <span className="ve-help">
                    Padding above/below Final Four and Champ logos on desktop
                    rows (default 5).
                  </span>
                  <input
                    id="vintage-picks-rowLogoGapPx"
                    data-testid="vintage-picks-rowLogoGapPx"
                    type="number"
                    min={0}
                    max={24}
                    step={1}
                    value={content.rowLogoGapPx}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setContent((previous) => ({
                        ...previous,
                        rowLogoGapPx: Number.isFinite(next)
                          ? Math.min(24, Math.max(0, Math.round(next)))
                          : previous.rowLogoGapPx,
                      }));
                      setDirty(true);
                    }}
                  />
                </label>
              </div>

              <h3>Payment badges</h3>
              <p className="ve-help">
                Shown on submitted entries beside the name (desktop) or under
                it (mobile). Status stays Submitted / In Progress / Deleted.
                Leave Icon blank to hide the circle glyph (Unpaid default).
              </p>
              {(
                [
                  { key: "paid", label: "Paid" },
                  { key: "pending", label: "Pending" },
                  { key: "unpaid", label: "Unpaid" },
                ] as const
              ).map(({ key, label }) => {
                const badge = content.payment[key];
                const setBadge = (patch: Partial<VintagePaymentBadgeStyle>) => {
                  setContent((previous) => ({
                    ...previous,
                    payment: {
                      ...previous.payment,
                      [key]: { ...previous.payment[key], ...patch },
                    },
                  }));
                  setDirty(true);
                };
                return (
                  <div
                    key={key}
                    className="ve-grid"
                    data-testid={`vintage-picks-payment-${key}`}
                  >
                    <p className="ve-help" style={{ gridColumn: "1 / -1" }}>
                      <strong>{label}</strong>
                    </p>
                    <label
                      className="ve-field"
                      htmlFor={`vintage-picks-payment-${key}-caption`}
                    >
                      <span>Caption</span>
                      <input
                        id={`vintage-picks-payment-${key}-caption`}
                        data-testid={`vintage-picks-payment-${key}-caption`}
                        type="text"
                        value={badge.caption}
                        onChange={(e) => setBadge({ caption: e.target.value })}
                      />
                    </label>
                    <label
                      className="ve-field"
                      htmlFor={`vintage-picks-payment-${key}-icon`}
                    >
                      <span>Icon</span>
                      <input
                        id={`vintage-picks-payment-${key}-icon`}
                        data-testid={`vintage-picks-payment-${key}-icon`}
                        type="text"
                        maxLength={4}
                        placeholder="$ or blank"
                        value={badge.icon}
                        onChange={(e) => setBadge({ icon: e.target.value })}
                      />
                    </label>
                    {(
                      [
                        ["iconBackground", "Badge / icon fill"],
                        ["iconColor", "Icon glyph"],
                        ["background", "Shading"],
                        ["color", "Font color"],
                        ["borderColor", "Border"],
                      ] as const
                    ).map(([field, fieldLabel]) => {
                      const testId = `vintage-picks-payment-${key}-${field}`;
                      return (
                        <AdminColorField
                          key={field}
                          id={testId}
                          testId={testId}
                          label={fieldLabel}
                          value={badge[field]}
                          onChange={(next) => setBadge({ [field]: next })}
                        />
                      );
                    })}
                  </div>
                );
              })}

              <h3>Action buttons</h3>
              <p className="ve-help">
                Row-action colors are design-locked (navy utility, red Submit,
                paper+red Delete). The swatches below are retained for draft
                inspection but do not override the live My Picks chrome.
              </p>
              {ACTION_KEYS.map(({ key, label }) => {
                const style = content.actions[key];
                const setStyle = (patch: Partial<VintagePicksActionStyle>) => {
                  setContent((previous) => ({
                    ...previous,
                    actions: {
                      ...previous.actions,
                      [key]: { ...previous.actions[key], ...patch },
                    },
                  }));
                  setDirty(true);
                };
                return (
                  <div key={key} className="ve-grid" data-testid={`vintage-picks-action-${key}`}>
                    <p className="ve-help" style={{ gridColumn: "1 / -1" }}>
                      <strong>{label}</strong>
                    </p>
                    {(
                      [
                        ["background", "Active fill"],
                        ["color", "Active icon"],
                        ["disabledBackground", "Disabled fill"],
                        ["disabledColor", "Disabled icon"],
                      ] as const
                    ).map(([field, fieldLabel]) => {
                      const testId = `vintage-picks-action-${key}-${field}`;
                      return (
                        <AdminColorField
                          key={field}
                          id={testId}
                          testId={testId}
                          label={fieldLabel}
                          value={style[field]}
                          onChange={(next) => setStyle({ [field]: next })}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </>
          </SectionPanel>

          <SectionPanel id={sectionIdFor("Confirmations")} title="Confirmations" disabled={busy}>
            <>
              <p className="ve-help">
                Popup copy for Delete, Permanent delete, and Return. Use{" "}
                <code>{"{entry}"}</code> for the entry name. Use <code>||</code>{" "}
                for a line break in the message body.
              </p>
              {CONFIRM_KEYS.map(({ key, label, help }) => {
                const bag = content.confirms[key];
                const setConfirm = (patch: Partial<VintagePicksConfirmCopy>) => {
                  setContent((previous) => ({
                    ...previous,
                    confirms: {
                      ...previous.confirms,
                      [key]: { ...previous.confirms[key], ...patch },
                    },
                  }));
                  setDirty(true);
                };
                return (
                  <div
                    key={key}
                    className="ve-grid"
                    data-testid={`vintage-picks-confirm-${key}`}
                  >
                    <p className="ve-help" style={{ gridColumn: "1 / -1" }}>
                      <strong>{label}</strong>
                      <br />
                      {help}
                    </p>
                    {(
                      [
                        ["title", "Title", false],
                        ["message", "Message", true],
                        ["confirmLabel", "Confirm button", false],
                        ["cancelLabel", "Cancel button", false],
                      ] as const
                    ).map(([field, fieldLabel, multiline]) => (
                      <label
                        key={field}
                        className="ve-field"
                        htmlFor={`vintage-picks-confirm-${key}-${field}`}
                        style={multiline ? { gridColumn: "1 / -1" } : undefined}
                      >
                        <span>{fieldLabel}</span>
                        {multiline ? (
                          <textarea
                            id={`vintage-picks-confirm-${key}-${field}`}
                            data-testid={`vintage-picks-confirm-${key}-${field}`}
                            rows={3}
                            value={bag[field]}
                            onChange={(e) =>
                              setConfirm({ [field]: e.target.value })
                            }
                          />
                        ) : (
                          <input
                            id={`vintage-picks-confirm-${key}-${field}`}
                            data-testid={`vintage-picks-confirm-${key}-${field}`}
                            type="text"
                            value={bag[field]}
                            onChange={(e) =>
                              setConfirm({ [field]: e.target.value })
                            }
                          />
                        )}
                      </label>
                    ))}
                  </div>
                );
              })}
            </>
          </SectionPanel>

          <SectionPanel id={sectionIdFor("Sign in & account")} title="Sign in & account" disabled={busy}>
            <>
              <p className="ve-help">
                Labels for <code>/auth/signin</code> (Sign In + Create Account
                tabs). Publish to update the live pages. Email failure and
                registration-success messages stay on the Config Sheet / Site
                Config.
              </p>
              <div className="ve-grid">
                <fieldset
                  className="ve-panel"
                  aria-label="Sign In tab copy"
                >
                  <p className="ve-eyebrow">SIGN IN</p>
                  <h3>Sign In tab</h3>
                  {authSignInField("tabLabel", "Tab label")}
                  {authSignInField("heading", "Heading")}
                  {authSignInField("lede", "Supporting sentence", undefined, true)}
                  {authSignInField("emailLabel", "Email label")}
                  {authSignInField("emailPlaceholder", "Email placeholder")}
                  {authSignInField("passwordLabel", "Password label")}
                  {authSignInField(
                    "passwordPlaceholder",
                    "Password placeholder",
                  )}
                  {authSignInField("submitLabel", "Submit button")}
                  {authSignInField(
                    "submitPendingLabel",
                    "Submit button (pending)",
                  )}
                  {authSignInField(
                    "forgotPasswordLink",
                    "Forgot password link",
                  )}
                  {authSignInField(
                    "footerPrompt",
                    "Footer prompt",
                    'Text before the create-account link (e.g. "New here?").',
                  )}
                  {authSignInField(
                    "footerLink",
                    "Footer link",
                    'Switch-to-signup link (e.g. "Create an account.").',
                  )}
                </fieldset>
                <fieldset
                  className="ve-panel"
                  aria-label="Create Account tab copy"
                >
                  <p className="ve-eyebrow">CREATE ACCOUNT</p>
                  <h3>Create Account tab</h3>
                  {authCreateField("tabLabel", "Tab label")}
                  {authCreateField("heading", "Heading")}
                  {authCreateField(
                    "lede",
                    "Supporting sentence",
                    undefined,
                    true,
                  )}
                  {authCreateField("nameLabel", "Full name label")}
                  {authCreateField("namePlaceholder", "Full name placeholder")}
                  {authCreateField("emailLabel", "Email label")}
                  {authCreateField("emailPlaceholder", "Email placeholder")}
                  {authCreateField("passwordLabel", "Password label")}
                  {authCreateField(
                    "passwordPlaceholder",
                    "Password placeholder",
                  )}
                  {authCreateField(
                    "confirmPasswordLabel",
                    "Confirm password label",
                  )}
                  {authCreateField(
                    "confirmPasswordPlaceholder",
                    "Confirm password placeholder",
                  )}
                  {authCreateField("submitLabel", "Submit button")}
                  {authCreateField(
                    "submitPendingLabel",
                    "Submit button (pending)",
                  )}
                  {authCreateField(
                    "footerPrompt",
                    "Footer prompt",
                    'Text before the sign-in link (e.g. "Already have an account?").',
                  )}
                  {authCreateField(
                    "footerLink",
                    "Footer link",
                    'Switch-to-signin link (e.g. "Sign in.").',
                  )}
                  {authCreateField(
                    "passwordsMismatch",
                    "Passwords mismatch error",
                  )}
                  {authCreateField(
                    "passwordTooShort",
                    "Password too short error",
                    "Shown when password length is under 6 (existing rule).",
                  )}
                </fieldset>
              </div>
            </>
          </SectionPanel>
        </div>
      </div>
    </main>
  );
}
