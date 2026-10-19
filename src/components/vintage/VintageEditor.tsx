"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseVintageAdminFocus,
  VINTAGE_EDITOR_TAB,
} from "@/lib/vintage/adminFocus";
import {
  ArrowLeft,
  ArrowUpRight,
  ImagePlus,
  Save,
  Upload,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DEFAULT_VINTAGE_CONTENT,
  emptyToolbarSlot,
  HOME_CARD_TYPE_LABELS,
  isToolbarItemPopulated,
  normalizeVintageContent,
  CHAMP_MASTER_SRC,
  EXCEL_MASTER_SRC,
  excelCardVariant,
  excelPlateSrc,
  PLAY_NOW_MASTER_SRC,
  VINTAGE_TOOLBAR_SLOTS,
  type VintageContent,
  type VintageHomeCard,
  type VintageToolbarItem,
  validateVintageContent,
} from "@/lib/vintage/content";

/**
 * Convert an ISO timestamp to a datetime-local input value (device local).
 */
function toDatetimeLocalValue(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
import type { VintageState } from "@/lib/vintage/store";
import type { VintageMedia } from "@/lib/vintage/media";
import { VINTAGE_FONT_OPTIONS } from "@/lib/vintage/fonts";
import {
  customToolbarIconUrl,
  resolveToolbarIcon,
} from "@/lib/vintage/toolbarIcons";
import IconPickerModal from "./IconPickerModal";
import "./editor.css";
const tabs = [
  "Masthead",
  "Toolbar & theme",
  "Home cards",
  "Explore band",
  "Announcements",
  "Tournament & countdown",
  "Media library",
  "Footer",
  "Revisions",
];
export default function VintageEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VintageState | null>(null);
  const [content, setContent] = useState<VintageContent>(
    structuredClone(DEFAULT_VINTAGE_CONTENT),
  );
  const [tab, setTab] = useState(tabs[0]);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [media, setMedia] = useState<VintageMedia[]>([]);
  const [imageTarget, setImageTarget] = useState(
    "homeCards.0.playImageSrc",
  );
  const [uploadAlt, setUploadAlt] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const [iconPickerIndex, setIconPickerIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [cardDragIndex, setCardDragIndex] = useState<number | null>(null);
  const [focusCardId, setFocusCardId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const focusApplied = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    fetch("/api/admin/vintage-homepage", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!cancelled) {
          setState(data.state);
          setContent(normalizeVintageContent(data.state.draft));
          setReady(data.storageReady);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  /**
   * Open the tab (and card slot) requested by homepage edit gears.
   */
  useEffect(() => {
    if (focusApplied.current || !state) return;
    const focus = parseVintageAdminFocus(
      searchParams?.get("focus"),
      searchParams?.get("id"),
    );
    if (!focus) return;
    focusApplied.current = true;
    if (focus.kind === "countdown") {
      setTab(VINTAGE_EDITOR_TAB.countdown);
      setFocusCardId("__countdown__");
      return;
    }
    if (focus.kind === "explore") {
      setTab(VINTAGE_EDITOR_TAB.explore);
      setFocusCardId("__explore__");
      return;
    }
    if (focus.kind === "announcements") {
      setTab(VINTAGE_EDITOR_TAB.announcements);
      setFocusCardId("__announcements__");
      return;
    }
    setTab(VINTAGE_EDITOR_TAB.homeCards);
    setFocusCardId(focus.id);
  }, [state, searchParams]);
  /**
   * Scroll the focused editor target into view after its panel mounts.
   */
  useEffect(() => {
    if (!focusCardId) return;
    const isCountdown = focusCardId === "__countdown__";
    const isExplore = focusCardId === "__explore__";
    const isAnnouncements = focusCardId === "__announcements__";
    if (isCountdown && tab !== VINTAGE_EDITOR_TAB.countdown) return;
    if (isExplore && tab !== VINTAGE_EDITOR_TAB.explore) return;
    if (isAnnouncements && tab !== VINTAGE_EDITOR_TAB.announcements) return;
    if (
      !isCountdown &&
      !isExplore &&
      !isAnnouncements &&
      tab !== VINTAGE_EDITOR_TAB.homeCards
    )
      return;

    const el = isCountdown
      ? document.querySelector<HTMLElement>(
          '[data-testid="vintage-editor-countdown-panel"]',
        )
      : isExplore
        ? document.querySelector<HTMLElement>(
            '[data-testid="vintage-editor-explore-panel"]',
          )
        : isAnnouncements
          ? document.querySelector<HTMLElement>(
              '[data-testid="vintage-editor-announcements-panel"]',
            )
          : document.querySelector<HTMLElement>(
              `[data-editor-card-id="${CSS.escape(focusCardId)}"]`,
            );
    if (!el) return;
    el.classList.add("ve-focus-target");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => {
      el.classList.remove("ve-focus-target");
      setFocusCardId(null);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [tab, focusCardId, content.homeCards]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function loadMedia() {
    setError("");
    try {
      const r = await fetch("/api/admin/vintage-homepage/media", {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMedia(d.media);
      return d.media as VintageMedia[];
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load media.");
      return [] as VintageMedia[];
    }
  }

  /**
   * Upload a custom SVG (or other allowed media) for toolbar icons.
   */
  async function uploadToolbarSvg(file: File, alt: string) {
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
  function update(path: string, value: string | boolean) {
    setContent((previous) => {
      const next = structuredClone(previous);
      const keys = path.split(".");
      let target = next as unknown as Record<string, unknown>;
      for (const key of keys.slice(0, -1))
        target = target[key] as Record<string, unknown>;
      target[keys[keys.length - 1]] = value;
      return next;
    });
    setDirty(true);
    setMessage("");
  }

  /**
   * Update one field on a toolbar slot.
   */
  function updateToolbar(
    index: number,
    patch: Partial<VintageToolbarItem>,
  ) {
    setContent((previous) => {
      const next = structuredClone(previous);
      next.toolbar[index] = { ...next.toolbar[index], ...patch };
      return next;
    });
    setDirty(true);
    setMessage("");
  }

  /**
   * Reorder toolbar slots after an HTML5 drop.
   */
  function reorderToolbar(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setContent((previous) => {
      const next = structuredClone(previous);
      const [moved] = next.toolbar.splice(from, 1);
      next.toolbar.splice(to, 0, moved);
      while (next.toolbar.length < VINTAGE_TOOLBAR_SLOTS) {
        next.toolbar.push(emptyToolbarSlot(next.toolbar.length));
      }
      next.toolbar = next.toolbar.slice(0, VINTAGE_TOOLBAR_SLOTS);
      return next;
    });
    setDirty(true);
    setMessage("");
  }

  /**
   * Clear a toolbar slot so it no longer appears on the homepage.
   */
  function clearToolbarSlot(index: number) {
    updateToolbar(index, { label: "", href: "", icon: "" });
  }

  /**
   * Patch fields on one homepage card slot.
   */
  function updateHomeCard(index: number, patch: Partial<VintageHomeCard>) {
    setContent((previous) => {
      const next = structuredClone(previous);
      next.homeCards[index] = { ...next.homeCards[index], ...patch };
      return next;
    });
    setDirty(true);
    setMessage("");
  }

  /**
   * Reorder homepage cards after drag-and-drop.
   */
  function reorderHomeCards(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setContent((previous) => {
      const next = structuredClone(previous);
      const [moved] = next.homeCards.splice(from, 1);
      next.homeCards.splice(to, 0, moved);
      return next;
    });
    setDirty(true);
    setMessage("");
  }
  function field(
    path: string,
    label: string,
    options: { multiline?: boolean; hint?: string; type?: string } = {},
  ) {
    let val: unknown = content;
    for (const key of path.split("."))
      val = (val as Record<string, unknown>)[key];
    const id = `vintage-${path.replace(/\./g, "-")}`;
    return (
      <label className="ve-field" key={path} htmlFor={id}>
        <span>{label}</span>
        {options.multiline ? (
          <textarea
            id={id}
            data-testid={id}
            value={String(val)}
            onChange={(e) => update(path, e.target.value)}
            rows={3}
            maxLength={6000}
          />
        ) : (
          <input
            id={id}
            data-testid={id}
            value={String(val)}
            onChange={(e) => update(path, e.target.value)}
            type={options.type || "text"}
            maxLength={6000}
          />
        )}
        {options.hint && <small>{options.hint}</small>}
      </label>
    );
  }
  function checkbox(path: string, label: string, value: boolean) {
    return (
      <label className="ve-check">
        <input
          type="checkbox"
          data-testid={`vintage-${path.replace(/\./g, "-")}`}
          checked={value}
          onChange={(e) => update(path, e.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  }
  async function csrfToken(): Promise<string> {
    const response = await fetch("/api/csrf-token", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not verify your session.");
    const d = await response.json();
    return d.csrfToken;
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
        action === "restore"
          ? undefined
          : normalizeVintageContent(content);
      if (payload) validateVintageContent(payload);
      const token = await csrfToken();
      const r = await fetch("/api/admin/vintage-homepage", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({
          action,
          content: payload,
          version: state.version,
          revisionId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setState(d.state);
      setContent(normalizeVintageContent(d.state.draft));
      setDirty(false);
      if (action === "publish") {
        router.push("/");
        router.refresh();
        return;
      }
      setMessage(
        action === "restore"
          ? "Revision restored as a draft. Preview it before publishing."
          : "Draft saved. It is ready to preview.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    const file = fileInput.current?.files?.[0];
    if (!file || !uploadAlt.trim()) {
      setError("Choose an image and add a description.");
      return;
    }
    if (file.size > 3000000) {
      setError("Choose an image under 3 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("alt", uploadAlt);
      const token = await csrfToken();
      const r = await fetch("/api/admin/vintage-homepage/media", {
        method: "POST",
        headers: { "x-csrf-token": token },
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMedia((previous) => [d.media, ...previous]);
      setMessage("Image uploaded. Select it below to use it.");
      setUploadAlt("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
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
            <h1>The editor’s desk.</h1>
          </div>
        </header>
        {error ? (
          <div className="ve-notice ve-error" role="alert">
            {error}{" "}
            <a href="/vintage/admin" data-testid="vintage-editor-retry">
              Try again
            </a>
          </div>
        ) : (
          <p className="ve-help" role="status">
            Loading your saved edition…
          </p>
        )}
        <Link
          href="/"
          className="ve-back"
          data-testid="vintage-editor-loading-back"
        >
          Back to the newspaper
        </Link>
      </main>
    );
  }
  return (
    <main className="vintage-editor">
      <header className="ve-header">
        <div>
          <Link href="/" className="ve-back" data-testid="vintage-editor-back">
            <ArrowLeft size={14} /> Back to the newspaper
          </Link>
          <p className="ve-eyebrow">WARREN’S MARCH MADNESS · PRIVATE ADMIN</p>
          <h1>The editor’s desk.</h1>
          <p>
            Make the front page your own.{" "}
            <Link href="/vintage/admin/info" data-testid="vintage-open-info-editor">
              Edit the Tournament Handbook
            </Link>
            {" · "}
            <Link href="/vintage/admin/hof" data-testid="vintage-open-hof-editor">
              Edit Hall of Fame titles
            </Link>
            {" · "}
            <Link href="/vintage/admin/picks" data-testid="vintage-open-picks-editor">
              Edit My Picks copy
            </Link>
            .
          </p>
        </div>
        <div className="ve-status">
          <span className={dirty ? "ve-dot dirty" : "ve-dot"} />
          {dirty
            ? "Unsaved changes"
            : state
              ? `Saved · revision ${state.version}`
              : "Loading…"}
        </div>
      </header>
      <div className="ve-toolbar">
        <div>
          <button
            className="ve-button"
            disabled={busy || !ready || !state}
            onClick={() => void save("save")}
            data-testid="vintage-save-draft"
          >
            <Save size={16} /> Save draft
          </button>
          <a
            href="/vintage/admin/preview"
            target="_blank"
            rel="noopener noreferrer"
            className="ve-button"
            data-testid="vintage-preview-draft"
          >
            Preview saved draft <ArrowUpRight size={16} />
          </a>
        </div>
        <button
          className="ve-button ve-primary"
          disabled={busy || !ready || !state}
          onClick={() => void save("publish")}
          data-testid="vintage-publish"
        >
          <Upload size={16} /> Publish homepage
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
      {state && !ready && (
        <div className="ve-notice ve-warning">
          You can explore the editor. Saving requires the dedicated vintage
          database; image uploads also require vintage image storage.
        </div>
      )}
      {dirty && (
        <p className="ve-draft-note">
          Save your draft before opening its preview. Your private homepage
          keeps showing the last published edition.
        </p>
      )}
      <div className="ve-workspace">
        <nav className="ve-tabs" aria-label="Editor sections">
          {tabs.map((name, i) => (
            <button
              key={name}
              aria-current={tab === name ? "page" : undefined}
              data-testid={`vintage-tab-${i}`}
              onClick={() => {
                setTab(name);
                if (name === "Media library") void loadMedia();
              }}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {name}
            </button>
          ))}
        </nav>
        <fieldset className="ve-panel" aria-label={tab} disabled={busy}>
          <p className="ve-eyebrow">THE {tab.toUpperCase()}</p>
          <h2>{tab}</h2>
          {tab === "Masthead" && (
            <>
              <p className="ve-help">
                Newspaper nameplate at the top of the homepage (two lines).
              </p>
              <div className="ve-grid">
                {field("masthead.first", "First line")}
                {field("masthead.second", "Second line")}
              </div>
            </>
          )}
          {tab === "Toolbar & theme" && (
            <>
              <h3>Theme colors</h3>
              <p className="ve-help">
                Primary drives fonts, lines, borders, and toolbar backgrounds.
                Headline is the masthead red. Background is the newspaper cream
                (also used inside toolbar icons). First / Second / Third are
                gold–silver–bronze accents for trophies, standings, and similar
                logos.
              </p>
              <div className="ve-grid ve-theme-grid">
                {(
                  [
                    ["theme.primary", "Primary color", content.theme.primary],
                    [
                      "theme.headline",
                      "Headline color",
                      content.theme.headline,
                    ],
                    [
                      "theme.background",
                      "Background color",
                      content.theme.background,
                    ],
                    [
                      "theme.first",
                      "First (gold)",
                      content.theme.first,
                    ],
                    [
                      "theme.second",
                      "Second (silver)",
                      content.theme.second,
                    ],
                    [
                      "theme.third",
                      "Third (bronze)",
                      content.theme.third,
                    ],
                  ] as const
                ).map(([path, label, value]) => (
                  <label className="ve-field" key={path} htmlFor={`vintage-${path.replace(/\./g, "-")}`}>
                    <span>{label}</span>
                    <div className="ve-color-row">
                      <input
                        type="color"
                        aria-label={`${label} swatch`}
                        value={value}
                        onChange={(event) =>
                          update(path, event.target.value)
                        }
                        data-testid={`vintage-${path.replace(/\./g, "-")}-swatch`}
                      />
                      <input
                        id={`vintage-${path.replace(/\./g, "-")}`}
                        data-testid={`vintage-${path.replace(/\./g, "-")}`}
                        value={value}
                        onChange={(event) =>
                          update(path, event.target.value)
                        }
                        placeholder="#152c3a"
                        spellCheck={false}
                      />
                    </div>
                  </label>
                ))}
              </div>
              <h3>Theme fonts</h3>
              <p className="ve-help">
                Four roles cover the homepage (and future content pages). Body
                default is Arial (Helvetica is only a fallback in that stack
                unless you pick Helvetica explicitly).
              </p>
              <div className="ve-grid ve-theme-grid">
                {(
                  [
                    [
                      "theme.fonts.headline",
                      "Headline",
                      content.theme.fonts.headline,
                    ],
                    ["theme.fonts.icons", "Icons & UI", content.theme.fonts.icons],
                    ["theme.fonts.body", "Body default", content.theme.fonts.body],
                    [
                      "theme.fonts.bodySpecialty",
                      "Body specialty",
                      content.theme.fonts.bodySpecialty,
                    ],
                  ] as const
                ).map(([path, label, value]) => (
                  <label
                    className="ve-field"
                    key={path}
                    htmlFor={`vintage-${path.replace(/\./g, "-")}`}
                  >
                    <span>{label}</span>
                    <select
                      id={`vintage-${path.replace(/\./g, "-")}`}
                      data-testid={`vintage-${path.replace(/\./g, "-")}`}
                      value={value}
                      onChange={(event) => update(path, event.target.value)}
                    >
                      {VINTAGE_FONT_OPTIONS.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                          {font.selfHosted ? " (self-hosted)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <h3>Toolbar buttons</h3>
              <p className="ve-help">
                Up to {VINTAGE_TOOLBAR_SLOTS} buttons. A button appears on the
                homepage only when caption, destination, and icon are all set.
                Drag the handle to reorder. Icons can be Lucide or your own
                uploaded SVGs.
              </p>
              <div
                className="ve-toolbar-slots"
                data-testid="vintage-toolbar-editor"
              >
                {content.toolbar.map((item, index) => {
                  const Icon = resolveToolbarIcon(item.icon);
                  const customSrc = customToolbarIconUrl(item.icon);
                  const populated = isToolbarItemPopulated(item);
                  return (
                    <div
                      key={item.id}
                      className={
                        populated
                          ? "ve-toolbar-slot"
                          : "ve-toolbar-slot ve-toolbar-slot-empty"
                      }
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) reorderToolbar(dragIndex, index);
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      data-testid={`vintage-toolbar-slot-${index}`}
                    >
                      <button
                        type="button"
                        className="ve-drag-handle"
                        aria-label={`Drag toolbar button ${index + 1}`}
                        data-testid={`vintage-toolbar-drag-${index}`}
                        onClick={(event) => event.preventDefault()}
                      >
                        ⋮⋮
                      </button>
                      <div className="ve-toolbar-slot-main">
                        <div className="ve-toolbar-slot-head">
                          <strong>Button {index + 1}</strong>
                          <span>
                            {populated ? "Visible on homepage" : "Hidden (incomplete)"}
                          </span>
                        </div>
                        <div className="ve-grid">
                          <label
                            className="ve-field"
                            htmlFor={`vintage-toolbar-label-${index}`}
                          >
                            <span>Caption</span>
                            <input
                              id={`vintage-toolbar-label-${index}`}
                              data-testid={`vintage-toolbar-label-${index}`}
                              value={item.label}
                              maxLength={40}
                              onChange={(event) =>
                                updateToolbar(index, {
                                  label: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label
                            className="ve-field"
                            htmlFor={`vintage-toolbar-href-${index}`}
                          >
                            <span>Destination</span>
                            <input
                              id={`vintage-toolbar-href-${index}`}
                              data-testid={`vintage-toolbar-href-${index}`}
                              value={item.href}
                              placeholder="/bracket or https://…"
                              onChange={(event) =>
                                updateToolbar(index, {
                                  href: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="ve-toolbar-icon-row">
                          <button
                            type="button"
                            className="ve-button ve-icon-pick"
                            data-testid={`vintage-toolbar-icon-${index}`}
                            onClick={() => {
                              setIconPickerIndex(index);
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
                            {customSrc
                              ? "Custom SVG"
                              : item.icon || "Choose icon"}
                          </button>
                          <button
                            type="button"
                            className="ve-button"
                            data-testid={`vintage-toolbar-clear-${index}`}
                            onClick={() => clearToolbarSlot(index)}
                          >
                            <Trash2 size={14} /> Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <IconPickerModal
                open={iconPickerIndex !== null}
                current={
                  iconPickerIndex !== null
                    ? content.toolbar[iconPickerIndex]?.icon || ""
                    : ""
                }
                media={media}
                onClose={() => setIconPickerIndex(null)}
                onSelect={(iconName) => {
                  if (iconPickerIndex !== null) {
                    updateToolbar(iconPickerIndex, { icon: iconName });
                  }
                }}
                onUploadSvg={uploadToolbarSvg}
              />
            </>
          )}
          {tab === "Home cards" && (
            <>
              <p className="ve-help">
                Three main cards below the countdown (Play Now, Reigning Champ,
                Excel Downloads). Drag to reorder; toggle visibility per card.
              </p>
              <div
                className="ve-toolbar-slots"
                data-testid="vintage-home-cards-editor"
              >
                {content.homeCards.map((card, index) => (
                  <div
                    key={card.id}
                    className={
                      card.enabled
                        ? "ve-toolbar-slot"
                        : "ve-toolbar-slot ve-toolbar-slot-empty"
                    }
                    draggable
                    onDragStart={() => setCardDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (cardDragIndex !== null)
                        reorderHomeCards(cardDragIndex, index);
                      setCardDragIndex(null);
                    }}
                    onDragEnd={() => setCardDragIndex(null)}
                    data-testid={`vintage-home-card-slot-${index}`}
                    data-editor-card-id={card.id}
                    id={`vintage-editor-card-${card.id}`}
                  >
                    <button
                      type="button"
                      className="ve-drag-handle"
                      aria-label={`Drag home card ${index + 1}`}
                      onClick={(event) => event.preventDefault()}
                    >
                      ⋮⋮
                    </button>
                    <div className="ve-toolbar-slot-main">
                      <div className="ve-toolbar-slot-head">
                        <strong>
                          {index + 1}. {HOME_CARD_TYPE_LABELS[card.type]}
                        </strong>
                        <label className="ve-inline-check">
                          <input
                            type="checkbox"
                            checked={card.enabled}
                            data-testid={`vintage-home-card-enabled-${index}`}
                            onChange={(event) =>
                              updateHomeCard(index, {
                                enabled: event.target.checked,
                              })
                            }
                          />
                          Show on homepage
                        </label>
                      </div>
                      {card.type === "playNow" && (
                        <div className="ve-grid">
                          <p className="ve-help" style={{ gridColumn: "1 / -1" }}>
                            Master plate with an empty footer band — caption is
                            administered here (same hole as Champ / Excel).
                            Header and body copy stay in the image.
                          </p>
                          <div
                            className="ve-image-fields"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <Image
                              src={
                                card.playImageSrc.trim() || PLAY_NOW_MASTER_SRC
                              }
                              alt="Play Now card preview"
                              className="ve-image-preview"
                              width={240}
                              height={144}
                              unoptimized
                              data-testid={`vintage-play-image-preview-${index}`}
                            />
                            <p className="ve-help">
                              {card.playImageSrc.trim()
                                ? "Custom upload in use."
                                : "Bundled design master in use."}
                            </p>
                            <button
                              className="ve-button"
                              type="button"
                              data-testid={`vintage-play-choose-media-${index}`}
                              onClick={() => {
                                setImageTarget(
                                  `homeCards.${index}.playImageSrc`,
                                );
                                setTab("Media library");
                                void loadMedia();
                              }}
                            >
                              <ImagePlus size={15} /> Upload / choose card image
                            </button>
                            {card.playImageSrc.trim() ? (
                              <button
                                className="ve-button"
                                type="button"
                                data-testid={`vintage-play-reset-image-${index}`}
                                onClick={() =>
                                  updateHomeCard(index, { playImageSrc: "" })
                                }
                              >
                                Reset to design master
                              </button>
                            ) : null}
                          </div>
                          <label
                            className="ve-field"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <span>Caption (footer)</span>
                            <input
                              value={card.playCtaLabel}
                              data-testid={`vintage-play-caption-${index}`}
                              placeholder="STEP INTO THE TOURNAMENT"
                              onChange={(e) =>
                                updateHomeCard(index, {
                                  playCtaLabel: e.target.value,
                                })
                              }
                            />
                            <small className="ve-help">
                              Always shown ALL CAPS (shared with Champ /
                              Excel). Use || for a two-line break; leave blank
                              to hide. Until the new blank-footer master is
                              uploaded, a baked-in caption may double up.
                            </small>
                          </label>
                          <label
                            className="ve-field"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <span>Destination URL</span>
                            <input
                              value={card.playHref}
                              data-testid={`vintage-play-href-${index}`}
                              onChange={(e) =>
                                updateHomeCard(index, {
                                  playHref: e.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      )}
                      {card.type === "reigningChamp" && (
                        <div className="ve-grid">
                          <p className="ve-help" style={{ gridColumn: "1 / -1" }}>
                            Exact card art with three text holes: name, year on
                            the wreath, and motto. Header chrome stays in the
                            image.
                          </p>
                          <div
                            className="ve-image-fields"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <Image
                              src={
                                card.champImageSrc.trim() || CHAMP_MASTER_SRC
                              }
                              alt="Reigning Champ card preview"
                              className="ve-image-preview"
                              width={240}
                              height={144}
                              unoptimized
                              data-testid={`vintage-champ-image-preview-${index}`}
                            />
                            <p className="ve-help">
                              {card.champImageSrc.trim()
                                ? "Custom upload in use."
                                : "Bundled design master in use."}
                            </p>
                            <button
                              className="ve-button"
                              type="button"
                              data-testid={`vintage-champ-choose-media-${index}`}
                              onClick={() => {
                                setImageTarget(
                                  `homeCards.${index}.champImageSrc`,
                                );
                                setTab("Media library");
                                void loadMedia();
                              }}
                            >
                              <ImagePlus size={15} /> Upload / choose card image
                            </button>
                            {card.champImageSrc.trim() ? (
                              <button
                                className="ve-button"
                                type="button"
                                data-testid={`vintage-champ-reset-image-${index}`}
                                onClick={() =>
                                  updateHomeCard(index, { champImageSrc: "" })
                                }
                              >
                                Reset to design master
                              </button>
                            ) : null}
                          </div>
                          <label className="ve-field">
                            <span>Year (on wreath)</span>
                            <input
                              value={card.champYear}
                              data-testid={`vintage-champ-year-${index}`}
                              onChange={(e) =>
                                updateHomeCard(index, {
                                  champYear: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="ve-field">
                            <span>Champ name</span>
                            <input
                              value={card.champName}
                              data-testid={`vintage-champ-name-${index}`}
                              onChange={(e) =>
                                updateHomeCard(index, {
                                  champName: e.target.value,
                                })
                              }
                            />
                            <small className="ve-help">
                              Always ALL CAPS. Use || for a hard line break (up
                              to three lines).
                            </small>
                          </label>
                          <label
                            className="ve-field"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <span>Motto (footer caption)</span>
                            <input
                              value={card.champMotto}
                              data-testid={`vintage-champ-motto-${index}`}
                              placeholder="Leave blank to hide"
                              onChange={(e) =>
                                updateHomeCard(index, {
                                  champMotto: e.target.value,
                                })
                              }
                            />
                            <small className="ve-help">
                              Always shown ALL CAPS. Use || for a two-line
                              break (max two lines).
                            </small>
                          </label>
                        </div>
                      )}
                      {card.type === "excelDownloads" && (
                        <div className="ve-grid">
                          <p className="ve-help" style={{ gridColumn: "1 / -1" }}>
                            Three master plates — site picks which one from
                            download URLs (neither / picks only / both). Path
                            set → download hotspot; empty → Coming Soon (+
                            optional date). Upload replacements like Play Now /
                            Champ, or leave blank for the bundled masters.
                          </p>
                          {(
                            [
                              {
                                variant: "neither" as const,
                                field: "excelNeitherImageSrc" as const,
                                label: "Neither available (both Coming Soon)",
                              },
                              {
                                variant: "picks" as const,
                                field: "excelPicksImageSrc" as const,
                                label: "Picks only (Tracker Coming Soon)",
                              },
                              {
                                variant: "both" as const,
                                field: "excelBothImageSrc" as const,
                                label: "Both downloads available",
                              },
                            ] as const
                          ).map((plate) => {
                            const custom = card[plate.field].trim();
                            const preview =
                              custom || EXCEL_MASTER_SRC[plate.variant];
                            return (
                              <div
                                key={plate.field}
                                className="ve-image-fields"
                                style={{ gridColumn: "1 / -1" }}
                              >
                                <strong>{plate.label}</strong>
                                <Image
                                  src={preview}
                                  alt={`${plate.label} preview`}
                                  className="ve-image-preview"
                                  width={240}
                                  height={144}
                                  unoptimized
                                  data-testid={`vintage-excel-${plate.variant}-preview-${index}`}
                                />
                                <p className="ve-help">
                                  {custom
                                    ? "Custom upload in use."
                                    : "Bundled design master in use."}
                                </p>
                                <button
                                  className="ve-button"
                                  type="button"
                                  data-testid={`vintage-excel-${plate.variant}-choose-media-${index}`}
                                  onClick={() => {
                                    setImageTarget(
                                      `homeCards.${index}.${plate.field}`,
                                    );
                                    setTab("Media library");
                                    void loadMedia();
                                  }}
                                >
                                  <ImagePlus size={15} /> Upload / choose plate
                                </button>
                                {custom ? (
                                  <button
                                    className="ve-button"
                                    type="button"
                                    data-testid={`vintage-excel-${plate.variant}-reset-image-${index}`}
                                    onClick={() =>
                                      updateHomeCard(index, {
                                        [plate.field]: "",
                                      })
                                    }
                                  >
                                    Reset to design master
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                          <div
                            className="ve-image-fields"
                            style={{ gridColumn: "1 / -1" }}
                            data-testid={`vintage-excel-active-variant-${index}`}
                          >
                            <p className="ve-help">
                              Active plate from current URLs:{" "}
                              <strong>{excelCardVariant(card)}</strong>
                            </p>
                            <Image
                              src={excelPlateSrc(card)}
                              alt="Active Excel plate"
                              className="ve-image-preview"
                              width={160}
                              height={96}
                              unoptimized
                            />
                          </div>
                          <label
                            className="ve-field"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <span>Caption (footer)</span>
                            <input
                              value={card.excelCaption}
                              data-testid={`vintage-excel-caption-${index}`}
                              placeholder="Prefer the old school?||Here you go ..."
                              onChange={(e) =>
                                updateHomeCard(index, {
                                  excelCaption: e.target.value,
                                })
                              }
                            />
                            <small className="ve-help">
                              Always shown ALL CAPS (same Oswald Bold red as
                              Champ / Play Now). Use || for a two-line break;
                              never more than two lines.
                            </small>
                          </label>
                          <fieldset
                            className="ve-card"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <legend>Picks Sheet</legend>
                            <label className="ve-field">
                              <span>Download URL</span>
                              <input
                                value={card.excelPicksHref}
                                data-testid={`vintage-excelPicksHref-${index}`}
                                placeholder="/files/picks.xlsx or https://… — blank = Coming Soon"
                                onChange={(e) =>
                                  updateHomeCard(index, {
                                    excelPicksHref: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="ve-field">
                              <span>Coming soon date/time (if no URL)</span>
                              <input
                                type="datetime-local"
                                step="60"
                                data-testid={`vintage-excelPicksAvailableAt-${index}`}
                                value={toDatetimeLocalValue(
                                  card.excelPicksAvailableAt,
                                )}
                                disabled={Boolean(card.excelPicksHref.trim())}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (!value) {
                                    updateHomeCard(index, {
                                      excelPicksAvailableAt: "",
                                    });
                                    return;
                                  }
                                  const date = new Date(value);
                                  if (!Number.isNaN(date.getTime())) {
                                    updateHomeCard(index, {
                                      excelPicksAvailableAt: date.toISOString(),
                                    });
                                  }
                                }}
                              />
                              <small>
                                Shown as e.g. 3/14/26 8:00 pm EST under Coming
                                Soon. Ignored when a URL is set. Time zone:{" "}
                                {timeZone || "your device"}.
                              </small>
                            </label>
                          </fieldset>
                          <fieldset
                            className="ve-card"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <legend>The Tracker</legend>
                            <label className="ve-field">
                              <span>Download URL</span>
                              <input
                                value={card.excelTrackerHref}
                                data-testid={`vintage-excelTrackerHref-${index}`}
                                placeholder="/files/tracker.xlsx or https://… — blank = Coming Soon"
                                onChange={(e) =>
                                  updateHomeCard(index, {
                                    excelTrackerHref: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="ve-field">
                              <span>Coming soon date/time (if no URL)</span>
                              <input
                                type="datetime-local"
                                step="60"
                                data-testid={`vintage-excelTrackerAvailableAt-${index}`}
                                value={toDatetimeLocalValue(
                                  card.excelTrackerAvailableAt,
                                )}
                                disabled={Boolean(
                                  card.excelTrackerHref.trim(),
                                )}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (!value) {
                                    updateHomeCard(index, {
                                      excelTrackerAvailableAt: "",
                                    });
                                    return;
                                  }
                                  const date = new Date(value);
                                  if (!Number.isNaN(date.getTime())) {
                                    updateHomeCard(index, {
                                      excelTrackerAvailableAt:
                                        date.toISOString(),
                                    });
                                  }
                                }}
                              />
                              <small>
                                Shown as e.g. 3/14/26 8:00 pm EST under Coming
                                Soon. Ignored when a URL is set. Time zone:{" "}
                                {timeZone || "your device"}.
                              </small>
                            </label>
                          </fieldset>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Explore band" && (
            <div data-testid="vintage-editor-explore-panel">
              <p className="ve-help">
                Wide band under the three main cards: Info and Hall of Fame
                side by side (stacked on mobile). Icons stay fixed to the
                design; edit copy and destinations here.
              </p>
              {checkbox(
                "exploreBand.enabled",
                "Show explore band on homepage",
                content.exploreBand.enabled,
              )}
              <fieldset className="ve-card">
                <legend>Info panel</legend>
                {field("exploreBand.info.headline", "Headline")}
                {field("exploreBand.info.body", "Body", { multiline: true })}
                {field("exploreBand.info.ctaLabel", "Link label")}
                {field("exploreBand.info.ctaHref", "Link destination", {
                  hint: "Usually /info",
                })}
              </fieldset>
              <fieldset className="ve-card">
                <legend>Hall of Fame panel</legend>
                {field("exploreBand.hall.headline", "Headline")}
                {field("exploreBand.hall.body", "Body", { multiline: true })}
                {field("exploreBand.hall.ctaLabel", "Link label")}
                {field("exploreBand.hall.ctaHref", "Link destination", {
                  hint: "Usually /hall-of-fame",
                })}
              </fieldset>
            </div>
          )}
          {tab === "Announcements" && (
            <div data-testid="vintage-editor-announcements-panel">
              <p className="ve-help">
                Full-width board under the explore band. Each line shows
                date/time then the message — no separate title. Newest appear
                first on the homepage.
              </p>
              {checkbox(
                "announcementBoard.enabled",
                "Show announcements board on homepage",
                content.announcementBoard.enabled,
              )}
              {field("announcementBoard.title", "Board title", {
                hint: "Shown next to the megaphone (e.g. ANNOUNCEMENTS).",
              })}
              {content.announcementBoard.items.map((item, index) => (
                <fieldset
                  className="ve-card"
                  key={item.id}
                  data-testid={`vintage-announce-editor-${index}`}
                >
                  <legend>Announcement {index + 1}</legend>
                  <label
                    className="ve-field"
                    htmlFor={`vintage-announce-at-${index}`}
                  >
                    <span>Date and time</span>
                    <input
                      id={`vintage-announce-at-${index}`}
                      data-testid={`vintage-announce-at-${index}`}
                      type="datetime-local"
                      step="60"
                      value={toDatetimeLocalValue(item.at)}
                      onChange={(event) => {
                        const value = event.target.value;
                        const next = [...content.announcementBoard.items];
                        next[index] = {
                          ...next[index],
                          at: value
                            ? new Date(value).toISOString()
                            : "",
                        };
                        setContent({
                          ...content,
                          announcementBoard: {
                            ...content.announcementBoard,
                            items: next,
                          },
                        });
                        setDirty(true);
                      }}
                    />
                    <small>
                      Shown as e.g. 10/15/26 12:00 pm EDT. Time zone:{" "}
                      {timeZone || "your device"}.
                    </small>
                  </label>
                  <label
                    className="ve-field"
                    htmlFor={`vintage-announce-text-${index}`}
                  >
                    <span>Message</span>
                    <textarea
                      id={`vintage-announce-text-${index}`}
                      data-testid={`vintage-announce-text-${index}`}
                      value={item.text}
                      rows={3}
                      maxLength={6000}
                      onChange={(event) => {
                        const next = [...content.announcementBoard.items];
                        next[index] = {
                          ...next[index],
                          text: event.target.value,
                        };
                        setContent({
                          ...content,
                          announcementBoard: {
                            ...content.announcementBoard,
                            items: next,
                          },
                        });
                        setDirty(true);
                      }}
                    />
                  </label>
                  <button
                    className="ve-button"
                    type="button"
                    data-testid={`vintage-announce-delete-${index}`}
                    onClick={() => {
                      setContent({
                        ...content,
                        announcementBoard: {
                          ...content.announcementBoard,
                          items: content.announcementBoard.items.filter(
                            (_, i) => i !== index,
                          ),
                        },
                      });
                      setDirty(true);
                    }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </fieldset>
              ))}
              <button
                className="ve-button"
                type="button"
                data-testid="vintage-announce-add"
                onClick={() => {
                  setContent({
                    ...content,
                    announcementBoard: {
                      ...content.announcementBoard,
                      items: [
                        ...content.announcementBoard.items,
                        {
                          id: `ann-${Date.now().toString(36)}`,
                          at: new Date().toISOString(),
                          text: "",
                        },
                      ],
                    },
                  });
                  setDirty(true);
                }}
              >
                <Plus size={16} /> Add announcement
              </button>
            </div>
          )}
          {tab === "Tournament & countdown" && (
            <div data-testid="vintage-editor-countdown-panel">
              <p className="ve-help">
                These are homepage display settings. Bracket availability and
                submission deadlines remain controlled by the existing bracket
                application.
              </p>
              <h3>Countdown clock</h3>
              {field("tournament.countdownTitle", "Countdown heading", {
                hint: "Shown above the tipoff clock when the countdown is on.",
              })}
              {checkbox(
                "tournament.countdownEnabled",
                "Show countdown",
                content.tournament.countdownEnabled,
              )}
              {field("tournament.liveTourneyMessage", "Live tourney message", {
                hint: "When Show countdown is off (tournament underway), this large message replaces the timer. Also used after tipoff if the clock reaches zero.",
              })}
              <label
                className="ve-field"
                htmlFor="vintage-tournament-countdownAt"
              >
                <span id="vintage-countdown-label">
                  Countdown date and time
                </span>
                <input
                  id="vintage-tournament-countdownAt"
                  data-testid="vintage-tournament-countdownAt"
                  type="datetime-local"
                  step="60"
                  value={(() => {
                    if (!content.tournament.countdownAt) return "";
                    const date = new Date(content.tournament.countdownAt);
                    if (Number.isNaN(date.getTime())) return "";
                    const pad = (value: number) =>
                      String(value).padStart(2, "0");
                    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                  })()}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) {
                      update("tournament.countdownAt", "");
                      return;
                    }
                    const date = new Date(value);
                    if (!Number.isNaN(date.getTime()))
                      update("tournament.countdownAt", date.toISOString());
                  }}
                  aria-describedby="vintage-countdown-timezone"
                  aria-labelledby="vintage-countdown-label"
                />
                <small id="vintage-countdown-timezone">
                  Time zone: {timeZone || "your device’s local time zone"}.
                  Saved as one exact moment for all visitors. Save Draft to
                  preview; Publish homepage to update the homepage.
                </small>
              </label>
            </div>
          )}
          {tab === "Media library" && (
            <>
              <p className="ve-help">
                Upload JPEG, PNG, WebP (under 3 MB) or SVG icons (under 500 KB,
                no scripts). Uploaded files are
                public assets; unpublished page copy remains private.
              </p>
              <div className="ve-card">
                <label className="ve-field">
                  <span>Use selected image for</span>
                  <select
                    data-testid="vintage-media-target"
                    value={imageTarget}
                    onChange={(e) => setImageTarget(e.target.value)}
                  >
                    {content.homeCards.flatMap((card, index) => {
                      if (card.type === "playNow") {
                        return [
                          <option
                            key={`${card.id}-play`}
                            value={`homeCards.${index}.playImageSrc`}
                          >
                            Play Now card image (slot {index + 1})
                          </option>,
                        ];
                      }
                      if (card.type === "reigningChamp") {
                        return [
                          <option
                            key={`${card.id}-champ`}
                            value={`homeCards.${index}.champImageSrc`}
                          >
                            Champ card image (slot {index + 1})
                          </option>,
                        ];
                      }
                      if (card.type === "excelDownloads") {
                        return [
                          <option
                            key={`${card.id}-neither`}
                            value={`homeCards.${index}.excelNeitherImageSrc`}
                          >
                            Excel neither plate (slot {index + 1})
                          </option>,
                          <option
                            key={`${card.id}-picks`}
                            value={`homeCards.${index}.excelPicksImageSrc`}
                          >
                            Excel picks-only plate (slot {index + 1})
                          </option>,
                          <option
                            key={`${card.id}-both`}
                            value={`homeCards.${index}.excelBothImageSrc`}
                          >
                            Excel both plate (slot {index + 1})
                          </option>,
                        ];
                      }
                      return [];
                    })}
                  </select>
                </label>
                <label className="ve-field">
                  <span>New image</span>
                  <input
                    data-testid="vintage-media-file"
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                </label>
                <label className="ve-field">
                  <span>Image description</span>
                  <input
                    data-testid="vintage-media-alt"
                    value={uploadAlt}
                    onChange={(e) => setUploadAlt(e.target.value)}
                    maxLength={500}
                  />
                </label>
                <button
                  className="ve-button"
                  disabled={busy || !ready}
                  data-testid="vintage-media-upload"
                  onClick={() => void upload()}
                >
                  <Upload size={15} /> Upload image
                </button>
              </div>
              <div className="ve-media-grid">
                {media.map((item) => (
                  <button
                    key={item.id}
                    className="ve-media-card"
                    data-testid={`vintage-media-use-${item.id}`}
                    onClick={() => {
                      if (imageTarget.endsWith("ImageSrc")) {
                        update(imageTarget, item.url);
                        setTab("Home cards");
                        return;
                      }
                      update(`${imageTarget}.src`, item.url);
                      update(`${imageTarget}.alt`, item.alt);
                      setTab("Home cards");
                    }}
                  >
                    <Image
                      src={item.url}
                      alt={item.alt}
                      width={240}
                      height={240}
                      unoptimized
                    />
                    <span>{item.filename}</span>
                    <small>Use this image</small>
                  </button>
                ))}
              </div>
              {media.length === 0 && (
                <p className="ve-help">No uploaded images yet.</p>
              )}
            </>
          )}
          {tab === "Footer" && (
            <>
              {field("footer.text", "Footer text")}
              {field("footer.contactLabel", "Contact link label", {
                hint: "Shown next to the envelope when a contact email is set.",
              })}
              {field("footer.contactEmail", "Contact email (optional)", {
                type: "email",
              })}
            </>
          )}
          {tab === "Revisions" && (
            <>
              <p className="ve-help">
                Restoring replaces your draft. It does not change the published
                homepage until you publish again.
              </p>
              {dirty && (
                <p className="ve-help">
                  Save your current changes before restoring another revision.
                </p>
              )}
              {state?.revisions.map((r) => (
                <div className="ve-revision" key={r.id}>
                  <div>
                    <strong>
                      {r.action === "publish"
                        ? "Published edition"
                        : r.action === "restore"
                          ? "Restored draft"
                          : "Saved draft"}
                    </strong>
                    <span>
                      {new Date(r.createdAt).toLocaleString()} · {r.author}
                    </span>
                  </div>
                  <button
                    className="ve-button"
                    disabled={busy || dirty}
                    data-testid={`vintage-restore-${r.id}`}
                    onClick={() => void save("restore", r.id)}
                  >
                    Restore as draft
                  </button>
                </div>
              ))}
              {!state?.revisions.length && (
                <p className="ve-help">Your saved editions will appear here.</p>
              )}
            </>
          )}
        </fieldset>
      </div>
    </main>
  );
}
