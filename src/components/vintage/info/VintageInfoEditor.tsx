"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ImagePlus,
  Save,
  Upload,
} from "lucide-react";
import {
  DEFAULT_VINTAGE_INFO_CONTENT,
  formatInfoPrizeDollars,
  INFO_PRIZE_ENTRY_FEE,
  infoPrizePlaceAmount,
  infoPrizePoolTotal,
  normalizeVintageInfoContent,
  validateVintageInfoContent,
  type VintageInfoContent,
} from "@/lib/vintage/infoContent";
import type { VintageInfoState } from "@/lib/vintage/infoStore";
import type { VintageMedia } from "@/lib/vintage/media";
import {
  infoFocusToTab,
  parseVintageInfoAdminFocus,
  VINTAGE_INFO_EDITOR_TAB,
} from "@/lib/vintage/infoAdminFocus";
import {
  customToolbarIconUrl,
  resolveToolbarIcon,
} from "@/lib/vintage/toolbarIcons";
import IconPickerModal from "../IconPickerModal";
import VintageAdminNav from "../VintageAdminNav";
import "../editor.css";

type QuickFactIconKey = "feeIcon" | "deadlineIcon" | "ctaIcon";

const tabs = [
  VINTAGE_INFO_EDITOR_TAB.intro,
  VINTAGE_INFO_EDITOR_TAB.facts,
  VINTAGE_INFO_EDITOR_TAB.entry,
  VINTAGE_INFO_EDITOR_TAB.scoring,
  VINTAGE_INFO_EDITOR_TAB.prizes,
  VINTAGE_INFO_EDITOR_TAB.tracker,
  VINTAGE_INFO_EDITOR_TAB.questions,
  VINTAGE_INFO_EDITOR_TAB.revisions,
] as const;

/**
 * Set a nested string/boolean/number field on the handbook draft by dotted path.
 */
function setPath(
  source: VintageInfoContent,
  path: string,
  value: string | boolean | number,
): VintageInfoContent {
  const next = structuredClone(source);
  const keys = path.split(".");
  let cursor: Record<string, unknown> = next as unknown as Record<
    string,
    unknown
  >;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const child = cursor[key];
    if (!child || typeof child !== "object") return next;
    cursor = child as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
}

/**
 * Companion admin for the Tournament Handbook (/info).
 */
export default function VintageInfoEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusApplied = useRef(false);
  const [state, setState] = useState<VintageInfoState | null>(null);
  const [content, setContent] = useState<VintageInfoContent>(
    structuredClone(DEFAULT_VINTAGE_INFO_CONTENT),
  );
  const [tab, setTab] = useState<(typeof tabs)[number]>(tabs[0]);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [media, setMedia] = useState<VintageMedia[]>([]);
  const [iconPickerKey, setIconPickerKey] = useState<QuickFactIconKey | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/admin/vintage-info", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load.");
        if (!active) return;
        setState(data.state);
        setContent(normalizeVintageInfoContent(data.state.draft));
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
   * Open the handbook editor tab requested by on-page edit gears.
   */
  useEffect(() => {
    if (focusApplied.current || !state) return;
    const focus = parseVintageInfoAdminFocus(searchParams?.get("focus"));
    if (!focus) return;
    focusApplied.current = true;
    setTab(infoFocusToTab(focus));
  }, [state, searchParams]);

  /**
   * Update one CMS field and mark the draft dirty.
   */
  function update(path: string, value: string | boolean | number) {
    setContent((previous) => setPath(previous, path, value));
    setDirty(true);
  }

  /**
   * Render a labeled text field bound to a dotted content path.
   */
  function field(
    path: string,
    label: string,
    options: { multiline?: boolean; hint?: string } = {},
  ) {
    let val: unknown = content;
    for (const key of path.split("."))
      val = (val as Record<string, unknown>)[key];
    const id = `vintage-info-${path.replace(/\./g, "-")}`;
    return (
      <label className="ve-field" key={path} htmlFor={id}>
        <span>{label}</span>
        {options.multiline ? (
          <textarea
            id={id}
            data-testid={id}
            value={String(val ?? "")}
            onChange={(e) => update(path, e.target.value)}
            rows={3}
            maxLength={6000}
          />
        ) : (
          <input
            id={id}
            data-testid={id}
            value={String(val ?? "")}
            onChange={(e) => update(path, e.target.value)}
            maxLength={6000}
          />
        )}
        {options.hint ? <small>{options.hint}</small> : null}
      </label>
    );
  }

  async function csrfToken(): Promise<string> {
    const response = await fetch("/api/csrf-token", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not verify your session.");
    const data = await response.json();
    return data.csrfToken;
  }

  /**
   * Load the shared vintage media library (same pool as homepage toolbar icons).
   */
  async function loadMedia() {
    setError("");
    try {
      const response = await fetch("/api/admin/vintage-homepage/media", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMedia(data.media);
      return data.media as VintageMedia[];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load media.");
      return [] as VintageMedia[];
    }
  }

  /**
   * Upload a custom SVG into the shared vintage media library for fact icons.
   */
  async function uploadFactSvg(file: File, alt: string) {
    const token = await csrfToken();
    const body = new FormData();
    body.append("file", file);
    body.append("alt", alt);
    const response = await fetch("/api/admin/vintage-homepage/media", {
      method: "POST",
      headers: { "x-csrf-token": token },
      body,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "SVG upload failed.");
    setMedia((previous) => [data.media, ...previous]);
    return data.media as VintageMedia;
  }

  /**
   * Icon picker control for one quick-facts column.
   */
  function factIconPicker(key: QuickFactIconKey, label: string) {
    const iconName = content.quickFacts[key];
    const Icon = resolveToolbarIcon(iconName);
    const customSrc = customToolbarIconUrl(iconName);
    return (
      <div className="ve-field" key={key}>
        <span>{label}</span>
        <div className="ve-toolbar-icon-row">
          <button
            type="button"
            className="ve-button ve-icon-pick"
            data-testid={`vintage-info-${key}`}
            onClick={() => {
              setIconPickerKey(key);
              void loadMedia();
            }}
          >
            {Icon ? (
              <Icon size={18} aria-hidden="true" />
            ) : customSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={customSrc} alt="" width={18} height={18} />
            ) : (
              <ImagePlus size={18} aria-hidden="true" />
            )}
            {customSrc ? "Custom SVG" : iconName || "Choose icon"}
          </button>
        </div>
      </div>
    );
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
        action === "restore" ? undefined : normalizeVintageInfoContent(content);
      if (payload) validateVintageInfoContent(payload);
      const token = await csrfToken();
      const response = await fetch("/api/admin/vintage-info", {
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
      setContent(normalizeVintageInfoContent(data.state.draft));
      setDirty(false);
      if (action === "publish") {
        router.push("/info");
        router.refresh();
        return;
      }
      setMessage(
        action === "restore"
          ? "Revision restored as a draft. Preview it before publishing."
          : "Draft saved. It is ready to preview.",
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
        <header className="ve-header">
          <div>
            <p className="ve-eyebrow">WARREN’S MARCH MADNESS · PRIVATE ADMIN</p>
            <h1>Tournament Handbook</h1>
          </div>
        </header>
        {error ? (
          <div className="ve-notice ve-error" role="alert">
            {error}{" "}
            <a href="/vintage/admin/info" data-testid="vintage-info-editor-retry">
              Try again
            </a>
          </div>
        ) : (
          <p className="ve-help" role="status">
            Loading handbook draft…
          </p>
        )}
        <Link href="/info" className="ve-back">
          Back to Info
        </Link>
      </main>
    );
  }

  return (
    <main className="vintage-editor" data-testid="vintage-info-editor">
      <VintageAdminNav current="guidebook" />
      <header className="ve-header">
        <div>
          <Link href="/info" className="ve-back" data-testid="vintage-info-editor-back">
            <ArrowLeft size={14} /> Back to Info
          </Link>
          <p className="ve-eyebrow">WARREN’S MARCH MADNESS · PRIVATE ADMIN</p>
          <h1>Tournament Handbook</h1>
          <p>
            Edit the Info page. Shared masthead and tipoff deadline stay on the
            Home admin.
          </p>
        </div>
        <div className="ve-status">
          <span className={dirty ? "ve-dot dirty" : "ve-dot"} />
          {dirty ? "Unsaved changes" : `Saved · revision ${state.version}`}
        </div>
      </header>
      <div className="ve-toolbar">
        <div>
          <button
            className="ve-button"
            disabled={busy || !ready}
            onClick={() => void save("save")}
            data-testid="vintage-info-save-draft"
          >
            <Save size={16} /> Save draft
          </button>
          <a
            href="/vintage/admin/info/preview"
            target="_blank"
            rel="noopener noreferrer"
            className="ve-button"
            data-testid="vintage-info-preview-draft"
          >
            Preview saved draft <ArrowUpRight size={16} />
          </a>
        </div>
        <button
          className="ve-button ve-primary"
          disabled={busy || !ready}
          onClick={() => void save("publish")}
          data-testid="vintage-info-publish"
        >
          <Upload size={16} /> Publish handbook
        </button>
      </div>
      {error && (
        <div className="ve-notice ve-error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {message && (
        <div className="ve-notice" role="status">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}
      {!ready && (
        <div className="ve-notice ve-warning">
          You can explore the editor. Saving requires dedicated vintage storage.
        </div>
      )}

      <div className="ve-workspace">
        <nav className="ve-tabs" aria-label="Handbook sections">
          {tabs.map((name, index) => (
            <button
              key={name}
              type="button"
              aria-current={tab === name ? "page" : undefined}
              data-testid={`vintage-info-tab-${index}`}
              onClick={() => setTab(name)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {name}
            </button>
          ))}
        </nav>

        <fieldset className="ve-panel" aria-label={tab} disabled={busy}>
          <p className="ve-eyebrow">THE {tab.toUpperCase()}</p>
          <h2>{tab}</h2>

        {tab === "Introduction" && (
          <>
            <div className="ve-grid">
              {field("intro.heading", "Main heading")}
              {field("intro.supporting", "Supporting sentence", {
                multiline: true,
              })}
            </div>
            <h3>In This Guide</h3>
            <p className="ve-help">
              Use || for a two-line chip label on mobile (e.g. Tracker
              &amp;||Results). The desktop sidebar shows one line.
            </p>
            {field("toc.heading", "Contents list heading")}
            {content.toc.items.map((_, index) => (
              <div className="ve-grid" key={content.toc.items[index].id}>
                {field(`toc.items.${index}.label`, `Item ${index + 1} label`)}
                {field(
                  `toc.items.${index}.anchor`,
                  `Item ${index + 1} anchor (no #)`,
                )}
              </div>
            ))}
          </>
        )}

        {tab === "Quick facts" && (
          <>
            <p className="ve-help">
              Entry deadline is taken from the homepage Tourney Tipoff date (Tournament
              &amp; countdown). Edit it there — it is not duplicated here.
            </p>
            <div className="ve-grid">
              {field("quickFacts.feeTitle", "Fee column title")}
              {field("quickFacts.feeValue", "Fee caption (e.g. $5)")}
              {factIconPicker("feeIcon", "Fee icon")}
              {field("quickFacts.deadlineTitle", "Deadline column title")}
              {factIconPicker("deadlineIcon", "Deadline icon")}
              {field("quickFacts.ctaTitle", "CTA column title")}
              {field("quickFacts.ctaLabel", "CTA caption")}
              {factIconPicker("ctaIcon", "CTA icon")}
            </div>
            <IconPickerModal
              open={iconPickerKey !== null}
              current={
                iconPickerKey ? content.quickFacts[iconPickerKey] || "" : ""
              }
              media={media}
              onClose={() => setIconPickerKey(null)}
              onSelect={(iconName) => {
                if (iconPickerKey) {
                  update(`quickFacts.${iconPickerKey}`, iconName);
                }
              }}
              onUploadSvg={uploadFactSvg}
            />
          </>
        )}

        {tab === "Entry & payment" && (
          <>
            {field("entry.heading", "Section heading")}
            <h3>Steps</h3>
            {[0, 1, 2].map((index) => (
              <div className="ve-grid" key={index}>
                {field(`entry.steps.${index}.title`, `Step ${index + 1} title`)}
                {field(
                  `entry.steps.${index}.description`,
                  `Step ${index + 1} description`,
                  { multiline: true },
                )}
              </div>
            ))}
            {field("entry.multiEntryNote", "Multi-entry payment note", {
              multiline: true,
            })}
            <div className="ve-grid">
              {field("entry.electronicHeading", "Electronic payments heading")}
              {field("entry.electronicBody", "Electronic payments copy", {
                multiline: true,
              })}
              {field("entry.cashHeading", "Cash heading")}
              {field("entry.cashBody", "Cash copy", { multiline: true })}
            </div>
          </>
        )}

        {tab === "Scoring" && (
          <>
            <p className="ve-help">
              Display copy only. Changing these values does not alter the live
              scoring engine.
            </p>
            {field("scoring.heading", "Section heading")}
            {field("scoring.tableCaption", "Table caption")}
            <h3>Round / points rows</h3>
            {content.scoring.rows.map((_, index) => (
              <div className="ve-grid" key={index}>
                {field(`scoring.rows.${index}.round`, `Row ${index + 1} round`)}
                {field(
                  `scoring.rows.${index}.points`,
                  `Row ${index + 1} points`,
                )}
              </div>
            ))}
            {field("scoring.underdogHeading", "Underdog heading")}
            {field("scoring.underdogBody", "Underdog explanation", {
              multiline: true,
            })}
            {field("scoring.firstFourNote", "First Four note", {
              multiline: true,
            })}
            {field("scoring.examplesHeading", "Examples heading")}
            {content.scoring.examples.map((_, index) =>
              field(
                `scoring.examples.${index}`,
                `Example ${index + 1}`,
                { multiline: true },
              ),
            )}
          </>
        )}

        {tab === "Prizes" && (
          <>
            <p className="ve-help">
              Prize pool = ${INFO_PRIZE_ENTRY_FEE} × number of entries. Place
              amounts are calculated from each place&apos;s percent. Percents
              must add up to 100. Use {"<entries>"} in either explanation to
              insert the entry count. Projected status adds * to dollar amounts
              and shows the footnote at the bottom of the section.
            </p>
            {field("prizes.heading", "Section heading")}
            <label className="ve-field">
              <span>Pool status</span>
              <select
                data-testid="vintage-info-prizes-status"
                value={content.prizes.status}
                onChange={(e) =>
                  update(
                    "prizes.status",
                    e.target.value === "finalized" ? "finalized" : "projected",
                  )
                }
              >
                <option value="projected">Projected</option>
                <option value="finalized">Finalized</option>
              </select>
            </label>
            <label className="ve-field" htmlFor="vintage-info-prizes-entryCount">
              <span>Number of entries</span>
              <input
                id="vintage-info-prizes-entryCount"
                data-testid="vintage-info-prizes-entryCount"
                type="number"
                min={0}
                step={1}
                value={content.prizes.entryCount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  update(
                    "prizes.entryCount",
                    Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
                  );
                }}
              />
              <small>
                Calculated pool:{" "}
                {formatInfoPrizeDollars(
                  infoPrizePoolTotal(content.prizes.entryCount),
                )}{" "}
                (${INFO_PRIZE_ENTRY_FEE} × {content.prizes.entryCount})
              </small>
            </label>
            <div className="ve-grid">
              {field("prizes.projectedPoolLabel", "Projected pool label")}
              {field("prizes.finalizedPoolLabel", "Finalized pool label")}
              {field(
                "prizes.projectedPoolExplanation",
                "Projected pool explanation",
                { multiline: true },
              )}
              {field(
                "prizes.finalizedPoolExplanation",
                "Finalized pool explanation",
                { multiline: true },
              )}
              {field("prizes.footnote", "Projected footnote", {
                multiline: true,
              })}
            </div>
            <h3>Places</h3>
            {[0, 1, 2].map((index) => {
              const place = content.prizes.places[index];
              const pool = infoPrizePoolTotal(content.prizes.entryCount);
              const amount = infoPrizePlaceAmount(pool, place.percent);
              return (
                <div className="ve-grid" key={index}>
                  {field(
                    `prizes.places.${index}.place`,
                    `Place ${index + 1} name`,
                  )}
                  <label
                    className="ve-field"
                    htmlFor={`vintage-info-prizes-places-${index}-percent`}
                  >
                    <span>Place {index + 1} percent</span>
                    <input
                      id={`vintage-info-prizes-places-${index}-percent`}
                      data-testid={`vintage-info-prizes-places-${index}-percent`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={place.percent}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        update(
                          `prizes.places.${index}.percent`,
                          Number.isFinite(n)
                            ? Math.min(100, Math.max(0, n))
                            : 0,
                        );
                      }}
                    />
                    <small>
                      Calculated: {formatInfoPrizeDollars(amount)} ({place.percent}
                      % of {formatInfoPrizeDollars(pool)})
                    </small>
                  </label>
                </div>
              );
            })}
          </>
        )}

        {tab === "Tracker" && (
          <>
            <p className="ve-help">
              Use || for a line break between notes paragraphs.
            </p>
            {field("tracker.heading", "Heading")}
            {field("tracker.notes", "Notes", { multiline: true })}
          </>
        )}

        {tab === "Questions" && (
          <div className="ve-grid">
            {field("questions.heading", "Heading")}
            {field("questions.body", "Supporting copy", { multiline: true })}
            {field("questions.actionLabel", "Contact link label")}
            {field("questions.contactEmail", "Commissioner email")}
          </div>
        )}

        {tab === "Revisions" && (
          <>
            <p className="ve-help">
              Restoring replaces your draft. It does not change the published
              handbook until you publish again.
            </p>
            {dirty && (
              <p className="ve-help">
                Save your current changes before restoring another revision.
              </p>
            )}
            <ul className="ve-revisions">
              {state.revisions.map((revision) => (
                <li key={revision.id}>
                  <div>
                    <strong>{revision.action}</strong> · {revision.author}
                    <br />
                    <small>{revision.createdAt}</small>
                  </div>
                  <button
                    type="button"
                    className="ve-button"
                    disabled={busy || dirty}
                    onClick={() => void save("restore", revision.id)}
                    data-testid={`vintage-info-restore-${revision.id}`}
                  >
                    Restore as draft
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        </fieldset>
      </div>
    </main>
  );
}
