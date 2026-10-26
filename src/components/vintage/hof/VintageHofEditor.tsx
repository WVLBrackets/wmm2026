"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Save,
  Upload,
} from "lucide-react";
import {
  DEFAULT_VINTAGE_HOF_CONTENT,
  normalizeVintageHofContent,
  validateVintageHofContent,
  type VintageHofContent,
} from "@/lib/vintage/hofContent";
import type { VintageHofState } from "@/lib/vintage/hofStore";
import VintageAdminNav from "../VintageAdminNav";
import "../editor.css";
import {
  SectionPanel,
  SectionRail,
  sectionDomId,
  useSectionNav,
} from "../sectionNav";

/** Section labels in page order. */
const SECTION_LABELS = [
  "Page header",
  "Champions by year",
  "All-time leaders",
  "Closing",
] as const;

/**
 * Stable DOM id of a stacked section from its label
 * (e.g. "All-time leaders" → `ve-section-all-time-leaders`).
 */
function sectionIdFor(label: string): string {
  return sectionDomId(label);
}

/**
 * Set a string field on the HoF draft by key.
 */
function setField(
  source: VintageHofContent,
  key: keyof VintageHofContent,
  value: string,
): VintageHofContent {
  return { ...source, [key]: value };
}

/**
 * Admin editor for Hall of Fame display copy (titles / subtitles).
 */
export default function VintageHofEditor() {
  const router = useRouter();
  const [state, setState] = useState<VintageHofState | null>(null);
  const [content, setContent] = useState<VintageHofContent>(
    structuredClone(DEFAULT_VINTAGE_HOF_CONTENT),
  );
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const SECTIONS = SECTION_LABELS.map((label) => ({
    label,
    id: sectionIdFor(label),
  }));
  const { activeId, jumpTo } = useSectionNav(
    SECTIONS.map((section) => section.id),
    Boolean(state),
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/admin/vintage-hof", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load.");
        if (!active) return;
        setState(data.state);
        setContent(normalizeVintageHofContent(data.state.draft));
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
   * Update one CMS field and mark the draft dirty.
   */
  function update(key: keyof VintageHofContent, value: string) {
    setContent((previous) => setField(previous, key, value));
    setDirty(true);
  }

  /**
   * Render a labeled text field.
   */
  function field(
    key: keyof VintageHofContent,
    label: string,
    options: { multiline?: boolean } = {},
  ) {
    const id = `vintage-hof-${key}`;
    return (
      <label className="ve-field" key={key} htmlFor={id}>
        <span>{label}</span>
        {options.multiline ? (
          <textarea
            id={id}
            data-testid={id}
            value={content[key]}
            onChange={(e) => update(key, e.target.value)}
            rows={2}
            maxLength={6000}
          />
        ) : (
          <input
            id={id}
            data-testid={id}
            value={content[key]}
            onChange={(e) => update(key, e.target.value)}
            maxLength={6000}
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
      const payload = normalizeVintageHofContent(content);
      validateVintageHofContent(payload);
      const token = await csrfToken();
      const response = await fetch("/api/admin/vintage-hof", {
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
      setContent(normalizeVintageHofContent(data.state.draft));
      setDirty(false);
      if (action === "publish") {
        router.push("/hall-of-fame");
        router.refresh();
        return;
      }
      setMessage("Draft saved. It is ready to preview.");
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
          <p>Loading Hall of Fame editor…</p>
        )}
      </main>
    );
  }

  return (
    <main className="vintage-editor" data-testid="vintage-hof-editor">
      <VintageAdminNav current="hof" />
      <header className="ve-header">
        <div>
          <Link href="/hall-of-fame" className="ve-back">
            <ArrowLeft size={16} /> Hall of Fame
          </Link>
          <h1>Hall of Fame copy</h1>
          <p className="ve-help">
            Edit titles and subtitles shown on the vintage Hall of Fame. Historical
            records still come from the Google Sheet.
          </p>
        </div>
        <div className="ve-actions">
          <Link
            href="/vintage/admin/hof/preview"
            className="ve-button"
            target="_blank"
          >
            <ArrowUpRight size={16} /> Preview
          </Link>
          <button
            type="button"
            className="ve-button"
            disabled={busy || !ready}
            onClick={() => void save("save")}
            data-testid="vintage-hof-save"
          >
            <Save size={16} /> Save draft
          </button>
          <button
            type="button"
            className="ve-button ve-primary"
            disabled={busy || !ready}
            onClick={() => void save("publish")}
            data-testid="vintage-hof-publish"
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
          ariaLabel="Hall of Fame sections"
          testIdPrefix="vintage-hof-tab"
        />
        <div className="ve-sections">
          <SectionPanel id={sectionIdFor("Page header")} title="Page header">
            <div className="ve-grid">
              {field("heading", "Main heading")}
              {field("supporting", "Supporting sentence", { multiline: true })}
              {field("reigningLabel", "Reigning champion label")}
            </div>
          </SectionPanel>
          <SectionPanel
            id={sectionIdFor("Champions by year")}
            title="Champions by year"
          >
            <div className="ve-grid">
              {field("archiveHeading", "Champions by Year heading")}
              {field("showMoreLabel", "Show More Years label")}
              {field("showFewerLabel", "Show Fewer Years label")}
            </div>
          </SectionPanel>
          <SectionPanel
            id={sectionIdFor("All-time leaders")}
            title="All-time leaders"
          >
            <div className="ve-grid">
              {field("leadersHeading", "All-Time Leaders heading")}
              {field("careerHeading", "Career Winnings heading")}
              {field("careerSubtitle", "Career Winnings subtitle")}
              {field("singleSeasonHeading", "Single-Season Points heading")}
              {field("singleSeasonSubtitle", "Single-Season Points subtitle")}
              {field("viewTop25Label", "View Top 25 label")}
              {field("showTop5Label", "Show Top 5 label")}
            </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Closing")} title="Closing">
            <div className="ve-grid">{field("closing", "Closing line")}</div>
          </SectionPanel>
        </div>
      </div>
    </main>
  );
}
