"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  type VintageContent,
  validateVintageContent,
} from "@/lib/vintage/content";
import type { VintageState } from "@/lib/vintage/store";
import type { VintageMedia } from "@/lib/vintage/media";
import "./editor.css";
const tabs = [
  "Front page",
  "Tournament & countdown",
  "Newsroom",
  "History",
  "Promotions",
  "Excel resources",
  "Media library",
  "Footer",
  "Revisions",
];
export default function VintageEditor() {
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
  const [imageTarget, setImageTarget] = useState("hero.image");
  const [uploadAlt, setUploadAlt] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false;
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    fetch("/api/admin/vintage-homepage", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!cancelled) {
          setState(data.state);
          setContent(data.state.draft);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load media.");
    }
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
  function imageFields(path: string) {
    let value: unknown = content;
    for (const key of path.split("."))
      value = (value as Record<string, unknown>)[key];
    const image = value as { src: string; position: string };
    return (
      <div className="ve-image-fields">
        {image.src && (
          <Image
            src={image.src}
            alt="Selected image preview"
            className="ve-image-preview"
            width={120}
            height={170}
            unoptimized
          />
        )}
        {field(`${path}.src`, "Image URL", {
          hint: "Use an image from the media library or an HTTPS address.",
        })}
        {field(`${path}.alt`, "Image description (alt text)")}
        <label className="ve-field">
          <span>Image focus</span>
          <select
            data-testid={`vintage-${path.replace(/\./g, "-")}-position`}
            value={image.position}
            onChange={(e) => update(`${path}.position`, e.target.value)}
          >
            {["center", "top", "bottom", "left", "right"].map((pos) => (
              <option key={pos}>{pos}</option>
            ))}
          </select>
        </label>
        <button
          className="ve-button"
          type="button"
          data-testid={`vintage-${path.replace(/\./g, "-")}-choose-media`}
          onClick={() => {
            setImageTarget(path);
            setTab("Media library");
            void loadMedia();
          }}
        >
          <ImagePlus size={15} /> Choose from media library
        </button>
      </div>
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
      if (action !== "restore") validateVintageContent(content);
      const token = await csrfToken();
      const r = await fetch("/api/admin/vintage-homepage", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({
          action,
          content,
          version: state.version,
          revisionId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setState(d.state);
      setContent(d.state.draft);
      setDirty(false);
      setMessage(
        action === "publish"
          ? "Published to the Preview homepage."
          : action === "restore"
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
            <p className="ve-eyebrow">WARREN’S MARCH MADNESS · PREVIEW</p>
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
          href="/vintage"
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
          <Link
            href="/vintage"
            className="ve-back"
            data-testid="vintage-editor-back"
          >
            <ArrowLeft size={14} /> Back to the newspaper
          </Link>
          <p className="ve-eyebrow">WARREN’S MARCH MADNESS · PREVIEW</p>
          <h1>The editor’s desk.</h1>
          <p>Make the front page your own.</p>
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
          <Upload size={16} /> Publish to Preview
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
          Save your draft before opening its preview. The public Preview
          homepage keeps showing the last published edition.
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
          {tab === "Front page" && (
            <>
              <h3>Masthead</h3>
              <div className="ve-grid">
                {field("masthead.first", "First line")}
                {field("masthead.second", "Second line")}
                {field("masthead.established", "Established label")}
                {field("masthead.slogan", "Right-hand slogan")}
              </div>
              {field("masthead.tagline", "Tagline")}
              <h3>Lead story</h3>
              {field("hero.headline", "Main headline", {
                multiline: true,
                hint: "Use line breaks to control the newspaper headline.",
              })}
              {field("hero.subtitle", "Subtitle")}
              <div className="ve-grid">
                {field("hero.ctaLabel", "Action label")}
                {field("hero.ctaHref", "Action destination")}
              </div>
              {imageFields("hero.image")}
              <h3>Welcome column</h3>
              {field("introduction.eyebrow", "Section label")}
              {field("introduction.headline", "Welcome headline", {
                multiline: true,
              })}
              {field("introduction.body", "Welcome text", { multiline: true })}
            </>
          )}
          {tab === "Tournament & countdown" && (
            <>
              <p className="ve-help">
                These are homepage display settings. Bracket availability and
                submission deadlines remain controlled by the existing bracket
                application.
              </p>
              <h3>Countdown clock</h3>
              {checkbox(
                "tournament.countdownEnabled",
                "Show countdown",
                content.tournament.countdownEnabled,
              )}
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
                  preview; Publish to Preview to update the homepage.
                </small>
              </label>
              <h3>Tournament details</h3>
              <div className="ve-grid">
                {field("tournament.year", "Tournament year")}
                {field("tournament.title", "Tournament title")}
              </div>
              {field("tournament.dates", "Dates or display message")}
              {checkbox(
                "tournament.picksEnabled",
                "Show My Picks link in homepage navigation",
                content.tournament.picksEnabled,
              )}
            </>
          )}
          {tab === "Newsroom" && (
            <>
              <p className="ve-help">
                Create and arrange the updates that appear on the front page.
              </p>
              {content.announcements.map((a, i) => (
                <fieldset className="ve-card" key={a.id}>
                  <legend>Dispatch {i + 1}</legend>
                  {field(`announcements.${i}.date`, "Date", { type: "date" })}
                  {field(`announcements.${i}.headline`, "Headline")}
                  {field(`announcements.${i}.text`, "Story", {
                    multiline: true,
                  })}
                  <div className="ve-row">
                    <button
                      className="ve-button"
                      disabled={i === 0}
                      data-testid={`vintage-news-up-${i}`}
                      onClick={() => {
                        const next = [...content.announcements];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        setContent({ ...content, announcements: next });
                        setDirty(true);
                      }}
                    >
                      Move up
                    </button>
                    <button
                      className="ve-button"
                      data-testid={`vintage-news-delete-${i}`}
                      onClick={() => {
                        setContent({
                          ...content,
                          announcements: content.announcements.filter(
                            (_, n) => n !== i,
                          ),
                        });
                        setDirty(true);
                      }}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </fieldset>
              ))}
              <button
                className="ve-button"
                disabled={content.announcements.length >= 30}
                data-testid="vintage-news-add"
                onClick={() => {
                  setContent({
                    ...content,
                    announcements: [
                      ...content.announcements,
                      {
                        id: crypto.randomUUID(),
                        date: new Date().toISOString().slice(0, 10),
                        headline: "",
                        text: "",
                      },
                    ],
                  });
                  setDirty(true);
                }}
              >
                <Plus size={16} /> Add dispatch
              </button>
            </>
          )}
          {tab === "History" && (
            <>
              {field("history.eyebrow", "Section label")}
              {field("history.headline", "Headline")}
              {field("history.text", "History text", { multiline: true })}
              <div className="ve-grid">
                {field("history.winner", "Champion name (optional)")}
                {field("history.winnerYear", "Champion year (optional)")}
                {field("history.entries", "Entry count (optional)")}
              </div>
            </>
          )}
          {tab === "Promotions" && (
            <>
              {content.promotions.map((p, i) => (
                <fieldset className="ve-card" key={i}>
                  <legend>Placement {i + 1}</legend>
                  {checkbox(
                    `promotions.${i}.enabled`,
                    "Show this placement",
                    p.enabled,
                  )}
                  {field(`promotions.${i}.eyebrow`, "Section label")}
                  {field(`promotions.${i}.headline`, "Headline", {
                    multiline: true,
                  })}
                  {field(`promotions.${i}.text`, "Description", {
                    multiline: true,
                  })}
                  <div className="ve-grid">
                    {field(`promotions.${i}.linkLabel`, "Link label")}
                    {field(`promotions.${i}.href`, "Destination URL")}
                  </div>
                  {imageFields(`promotions.${i}.image`)}
                </fieldset>
              ))}
            </>
          )}
          {tab === "Excel resources" && (
            <>
              <p className="ve-help">
                Each workbook can become available separately. Leave its URL
                blank to show “Download coming soon.” Pending downloads do not
                prevent you from publishing other homepage changes.
              </p>
              {content.downloads.map((_, i) => (
                <fieldset className="ve-card" key={i}>
                  <legend>Excel resource {i + 1}</legend>
                  {field(`downloads.${i}.label`, "Download label")}
                  {field(`downloads.${i}.description`, "Short description")}
                  {field(`downloads.${i}.href`, "Download URL (optional)", {
                    hint: content.downloads[i].href
                      ? "Available: this workbook will have a download link."
                      : "Pending: Download coming soon. Add this workbook’s URL when it is ready.",
                  })}
                </fieldset>
              ))}
            </>
          )}
          {tab === "Media library" && (
            <>
              <p className="ve-help">
                Upload JPEG, PNG or WebP images under 3 MB. Uploaded images are
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
                    <option value="hero.image">Lead story</option>
                    <option value="promotions.0.image">Promotion 1</option>
                    <option value="promotions.1.image">Promotion 2</option>
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
                      update(`${imageTarget}.src`, item.url);
                      update(`${imageTarget}.alt`, item.alt);
                      setTab(
                        imageTarget === "hero.image"
                          ? "Front page"
                          : "Promotions",
                      );
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
