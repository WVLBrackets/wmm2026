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
  type VintagePicksContent,
  type VintagePicksFlavor,
} from "@/lib/vintage/picksContent";
import type { VintagePicksState } from "@/lib/vintage/picksStore";
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
  "Header",
  "Pool sections",
  "Empty states",
  "Cost & status",
  "Row chrome",
  "Sign in & account",
] as const;

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
  | "countdownToBracketLabel"
  | "countdownToTipoffLabel"
  | "viewingPriorYearLabel"
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

  async function save(
    action: "save" | "publish" | "restore",
    revisionId?: string,
  ) {
    if (!state) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const payload =
        action === "restore" ? undefined : normalizeVintagePicksContent(content);
      if (payload) validateVintagePicksContent(payload);
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
          revisionId,
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
      setMessage(
        action === "restore"
          ? "Revision restored as a draft. Publish when ready."
          : "Draft saved.",
      );
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
              <h3>Application Master Lock</h3>
              <p className="ve-help">
                Locked blocks Changing actions (New / Edit / Submit / Return /
                Copy / Delete). Save WIP remains allowed if tipoff or Master
                Lock closes the field mid-session. Unlocked subject to brackets
                published, tipoff, and field JSON. No Config Sheet stop-submit.
              </p>
              <div
                className="ve-lock-toggle"
                role="group"
                aria-label="Application Master Lock"
              >
                <button
                  type="button"
                  className={`ve-lock-btn ve-lock-btn--unlocked${
                    content.masterLockUnlocked ? " is-on" : ""
                  }`}
                  data-testid="vintage-picks-master-lock-unlocked"
                  aria-pressed={content.masterLockUnlocked}
                  onClick={() => {
                    setContent((previous) => ({
                      ...previous,
                      masterLockUnlocked: true,
                    }));
                    setDirty(true);
                  }}
                >
                  Unlocked
                </button>
                <button
                  type="button"
                  className={`ve-lock-btn ve-lock-btn--locked${
                    !content.masterLockUnlocked ? " is-on" : ""
                  }`}
                  data-testid="vintage-picks-master-lock-locked"
                  aria-pressed={!content.masterLockUnlocked}
                  onClick={() => {
                    setContent((previous) => ({
                      ...previous,
                      masterLockUnlocked: false,
                    }));
                    setDirty(true);
                  }}
                >
                  Locked
                </button>
              </div>
              {sharedField(
                "masterLockMessage",
                "Message when Locked",
                "Shown when Master Lock is the winning reason. Tokens: {year} or <year>.",
                true,
              )}
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

              <h3>Brackets & countdown</h3>
              <p className="ve-help">
                Shared controls. The countdown shows on the active year; the
                switch control replaces it when browsing an archive year. The
                published toggle replaces the Config Sheet{" "}
                <code>brackets_available</code> flag for vintage My Picks.
              </p>
              <div className="ve-grid">
                <label className="ve-field" htmlFor="vintage-picks-bracketsPublished">
                  <span>Brackets published</span>
                  <span className="ve-help">
                    Off → show the not-published empty state. On → field is open
                    (subject to JSON / other gates).
                  </span>
                  <input
                    id="vintage-picks-bracketsPublished"
                    data-testid="vintage-picks-bracketsPublished"
                    type="checkbox"
                    checked={content.bracketsPublished}
                    onChange={(e) => {
                      setContent((previous) => ({
                        ...previous,
                        bracketsPublished: e.target.checked,
                      }));
                      setDirty(true);
                    }}
                  />
                </label>
                {sharedField(
                  "bracketsNotPublishedMessage",
                  "Not-published message",
                  "Tokens: {year}, {date} (from homepage tipoff). Use || for a line break.",
                  true,
                )}
                {sharedField(
                  "countdownToBracketLabel",
                  "Countdown — brackets not yet available",
                  "Token: {year}",
                )}
                {sharedField(
                  "countdownToTipoffLabel",
                  "Countdown — tip-off",
                  "Token: {year}",
                )}
                {sharedField(
                  "viewingPriorYearLabel",
                  "Prior-year switch control",
                  "Tokens: {year}, {activeYear}",
                )}
              </div>
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
                Dynamic line under the status chips (replaces Config Sheet{" "}
                <code>welcome_*</code> + <code>entry_cost</code>). Tokens:{" "}
                <code>{"{cost}"}</code>, <code>{"{Submitted}"}</code>,{" "}
                <code>{"{In Progress}"}</code>, <code>{"{year}"}</code>. Use{" "}
                <code>||</code> for a line break. Write <code>{"${cost}"}</code>{" "}
                when you want a dollar sign before the amount.
              </p>
              <div className="ve-grid">
                <label
                  className="ve-field"
                  htmlFor="vintage-picks-entryCost"
                >
                  <span>Entry cost ($ per submitted bracket)</span>
                  <span className="ve-help">
                    Used to compute <code>{"{cost}"}</code> = submitted × this
                    amount.
                  </span>
                  <input
                    id="vintage-picks-entryCost"
                    data-testid="vintage-picks-entryCost"
                    type="number"
                    min={0}
                    step={1}
                    value={content.entryCost}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setContent((previous) => ({
                        ...previous,
                        entryCost: Number.isFinite(next)
                          ? Math.max(0, Math.round(next))
                          : previous.entryCost,
                      }));
                      setDirty(true);
                    }}
                  />
                </label>
              </div>
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
                Desktop row density and action / payment chip colors. Icons stay
                fixed per action (View, Edit, Submit, …); colors apply to active
                and disabled states.
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

              <h3>Payment chips</h3>
              <div className="ve-grid">
                {(
                  [
                    ["paidBackground", "Paid background"],
                    ["paidColor", "Paid text"],
                    ["unpaidBackground", "Unpaid background"],
                    ["unpaidColor", "Unpaid text"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="ve-field"
                    htmlFor={`vintage-picks-payment-${key}`}
                  >
                    <span>{label}</span>
                    <input
                      id={`vintage-picks-payment-${key}`}
                      data-testid={`vintage-picks-payment-${key}`}
                      type="text"
                      value={content.payment[key]}
                      onChange={(e) => {
                        const value = e.target.value;
                        setContent((previous) => ({
                          ...previous,
                          payment: { ...previous.payment, [key]: value },
                        }));
                        setDirty(true);
                      }}
                    />
                  </label>
                ))}
              </div>

              <h3>Action buttons</h3>
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
                    ).map(([field, fieldLabel]) => (
                      <label
                        key={field}
                        className="ve-field"
                        htmlFor={`vintage-picks-action-${key}-${field}`}
                      >
                        <span>{fieldLabel}</span>
                        <input
                          id={`vintage-picks-action-${key}-${field}`}
                          data-testid={`vintage-picks-action-${key}-${field}`}
                          type="text"
                          value={style[field]}
                          onChange={(e) => setStyle({ [field]: e.target.value })}
                        />
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

      {state.revisions.length ? (
        <>
          <h2>Revisions</h2>
          <ul className="ve-revisions">
            {state.revisions.map((revision) => (
              <li key={revision.id}>
                <span>
                  {revision.action} · {revision.author} ·{" "}
                  {new Date(revision.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  className="ve-button"
                  disabled={busy || dirty}
                  onClick={() => void save("restore", revision.id)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
