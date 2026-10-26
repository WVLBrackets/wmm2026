"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react";
import {
  DEFAULT_VINTAGE_STANDINGS_CONTENT,
  isPaper2020SectionHidden,
  normalizeVintageStandingsContent,
  validateVintageStandingsContent,
  type VintageStandingsContent,
  type VintageStandingsPaper2020,
  type VintageStandingsStringKey,
} from "@/lib/vintage/standingsContent";
import type { VintageStandingsState } from "@/lib/vintage/standingsStore";
import AdminColorField from "../AdminColorField";
import VintageAdminNav from "../VintageAdminNav";
import "../editor.css";
import {
  SectionPanel,
  SectionRail,
  sectionDomId,
  useSectionNav,
} from "../sectionNav";
import {
  StandingsLogoSizingPreview,
  StandingsResultBorderPreview,
  StandingsResultShadePreview,
} from "./StandingsAdminPreviews";

/** Section labels in page order. */
const SECTION_LABELS = [
  "Snapshot status",
  "Page & year",
  "Filters & badges",
  "Logo sizing",
  "Result shade colors",
  "Result border colors",
  "Result hover labels",
  "Column headers (desktop)",
  "Column headers (mobile)",
  "Empty states & legend",
  "2020 newspaper",
  "Regenerate snapshot",
] as const;

/** paper2020 hide-flag keys with admin checkbox labels. */
const PAPER_2020_HIDE_FLAGS: {
  key: keyof VintageStandingsPaper2020;
  label: string;
}[] = [
  { key: "hidePageSubhead", label: "Hide page subhead (under the year heading)" },
  { key: "hideDateline", label: "Hide dateline (kicker / volume)" },
  { key: "hideHeadline", label: "Hide headline & deck" },
  { key: "hideLead", label: "Hide lead story" },
  { key: "hideSidebar", label: "Hide sidebar & pull quote" },
  { key: "hideWire", label: "Hide Warren’s desk" },
  { key: "hideSources", label: "Hide sources line" },
];

/**
 * Stable DOM id of a stacked section from its label
 * (e.g. "Page & year" → `ve-section-page-and-year`).
 */
function sectionIdFor(label: string): string {
  return sectionDomId(label);
}

type SnapshotStatus = {
  year: number;
  exists: boolean;
  entryCount: number;
  computedAt: string | null;
  keyBracketId: string | null;
  keyExists: boolean;
  keyUpdatedAt: string | null;
};

/**
 * Set a string field on the Standings draft by key.
 */
function setField(
  source: VintageStandingsContent,
  key: VintageStandingsStringKey,
  value: string,
): VintageStandingsContent {
  return { ...source, [key]: value };
}

/**
 * Admin editor for Live Standings display copy + snapshot regenerate.
 */
export default function VintageStandingsEditor() {
  const router = useRouter();
  const [state, setState] = useState<VintageStandingsState | null>(null);
  const [content, setContent] = useState<VintageStandingsContent>(
    structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT),
  );
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recomputeYear, setRecomputeYear] = useState("2026");
  const [snapshot, setSnapshot] = useState<SnapshotStatus | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const SECTIONS = SECTION_LABELS.map((label) => ({
    label,
    id: sectionIdFor(label),
  }));
  const { activeId, jumpTo } = useSectionNav(
    SECTIONS.map((section) => section.id),
    Boolean(state),
  );

  /**
   * Load snapshot freshness for the regenerator year.
   */
  const loadSnapshotStatus = useCallback(async (year: string) => {
    if (!/^\d{4}$/.test(year.trim())) {
      setSnapshot(null);
      return;
    }
    setSnapshotLoading(true);
    try {
      const response = await fetch(
        `/api/admin/vintage-standings/snapshot?year=${encodeURIComponent(year.trim())}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load snapshot.");
      setSnapshot(data as SnapshotStatus);
    } catch {
      setSnapshot(null);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/admin/vintage-standings", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load.");
        if (!active) return;
        setState(data.state);
        const normalized = normalizeVintageStandingsContent(data.state.draft);
        setContent(normalized);
        setRecomputeYear(normalized.standingsYear);
        setReady(Boolean(data.storageReady));
        setDirty(false);
        await loadSnapshotStatus(normalized.standingsYear);
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : "Unable to load.");
      }
    })();
    return () => {
      active = false;
    };
  }, [loadSnapshotStatus]);

  /**
   * Update one CMS field and mark the draft dirty.
   */
  function update(key: VintageStandingsStringKey, value: string) {
    setContent((previous) => setField(previous, key, value));
    setDirty(true);
    if (key === "standingsYear" && /^\d{4}$/.test(value.trim())) {
      setRecomputeYear(value.trim());
    }
  }

  /**
   * Update one nested 2020 newspaper field.
   */
  function updatePaper(key: keyof VintageStandingsPaper2020, value: string) {
    setContent((previous) => ({
      ...previous,
      paper2020: { ...previous.paper2020, [key]: value },
    }));
    setDirty(true);
  }

  /**
   * Render a labeled text field.
   */
  function field(
    key: VintageStandingsStringKey,
    label: string,
    options: { multiline?: boolean; help?: string } = {},
  ) {
    const id = `vintage-standings-${key}`;
    return (
      <label className="ve-field" key={key} htmlFor={id}>
        <span>{label}</span>
        {options.help ? <span className="ve-help">{options.help}</span> : null}
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

  /**
   * Render a labeled color field (swatch + wheel + hex + eyedropper).
   */
  function colorField(
    key: VintageStandingsStringKey,
    label: string,
    options: { help?: string; placeholder?: string } = {},
  ) {
    return (
      <AdminColorField
        key={key}
        id={`vintage-standings-${key}`}
        testId={`vintage-standings-${key}`}
        label={label}
        value={content[key]}
        onChange={(next) => update(key, next)}
        help={options.help}
        placeholder={options.placeholder}
      />
    );
  }

  /**
   * Render a labeled 2020 newspaper text field.
   */
  function paperField(
    key: keyof VintageStandingsPaper2020,
    label: string,
    options: { multiline?: boolean; help?: string; rows?: number } = {},
  ) {
    const id = `vintage-standings-paper2020-${key}`;
    return (
      <label className="ve-field" key={key} htmlFor={id}>
        <span>{label}</span>
        {options.help ? <span className="ve-help">{options.help}</span> : null}
        {options.multiline ? (
          <textarea
            id={id}
            data-testid={id}
            value={content.paper2020[key]}
            onChange={(e) => updatePaper(key, e.target.value)}
            rows={options.rows ?? 3}
            maxLength={8000}
          />
        ) : (
          <input
            id={id}
            data-testid={id}
            value={content.paper2020[key]}
            onChange={(e) => updatePaper(key, e.target.value)}
            maxLength={4000}
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
      const payload = normalizeVintageStandingsContent(content);
      validateVintageStandingsContent(payload);
      const token = await csrfToken();
      const response = await fetch("/api/admin/vintage-standings", {
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
      const normalized = normalizeVintageStandingsContent(data.state.draft);
      setContent(normalized);
      setDirty(false);
      if (action === "publish") {
        router.push("/standings");
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

  /**
   * Rebuild live_standings_snapshots for the chosen year from KEY + pool.
   */
  async function regenerateSnapshot() {
    const year = parseInt(recomputeYear.trim(), 10);
    if (!Number.isFinite(year) || !/^\d{4}$/.test(String(year))) {
      setError("Regenerate year must be four digits.");
      return;
    }
    setError("");
    setMessage("");
    setRecomputing(true);
    try {
      const token = await csrfToken();
      const response = await fetch(
        "/api/admin/vintage-standings/recompute",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": token,
          },
          body: JSON.stringify({ year }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Regenerate failed.");
      const when = data.computedAt
        ? new Date(data.computedAt as string).toLocaleString()
        : "now";
      setMessage(
        `Standings snapshot regenerated for ${year}: ${data.entryCount ?? 0} entries · ${when}.`,
      );
      await loadSnapshotStatus(String(year));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not regenerate snapshot.",
      );
    } finally {
      setRecomputing(false);
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
          <p>Loading Standings editor…</p>
        )}
      </main>
    );
  }

  const keyEditorHref = `/admin?tab=live-results&year=${encodeURIComponent(
    recomputeYear.trim() || content.standingsYear,
  )}`;

  return (
    <main className="vintage-editor" data-testid="vintage-standings-editor">
      <VintageAdminNav current="standings" />
      <header className="ve-header">
        <div>
          <Link href="/standings" className="ve-back">
            <ArrowLeft size={16} /> Standings
          </Link>
          <h1>Standings admin</h1>
          <p className="ve-help">
            Labels, column headers, and empty-state copy for vintage Live
            Standings. Ranking data still comes from the KEY-driven snapshot —
            use Regenerate below if that cache looks wrong.
          </p>
        </div>
        <div className="ve-actions">
          <button
            type="button"
            className="ve-button"
            disabled={busy || !ready}
            onClick={() => void save("save")}
            data-testid="vintage-standings-save"
          >
            <Save size={16} /> Save draft
          </button>
          <button
            type="button"
            className="ve-button ve-primary"
            disabled={busy || !ready}
            onClick={() => void save("publish")}
            data-testid="vintage-standings-publish"
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
          ariaLabel="Standings sections"
          testIdPrefix="vintage-standings-tab"
        />
        <div className="ve-sections">
          <SectionPanel id={sectionIdFor("Snapshot status")} title="Snapshot status">
          <div
            className="ve-notice"
            data-testid="standings-snapshot-status"
            role="status"
          >
            {snapshotLoading ? (
              <p>Loading snapshot status…</p>
            ) : snapshot ? (
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                <li>
                  <strong>Year:</strong> {snapshot.year}
                </li>
                <li>
                  <strong>Snapshot:</strong>{" "}
                  {snapshot.exists
                    ? `${snapshot.entryCount} entries`
                    : "None yet"}
                </li>
                <li>
                  <strong>Computed:</strong>{" "}
                  {snapshot.computedAt
                    ? new Date(snapshot.computedAt).toLocaleString()
                    : "—"}
                </li>
                <li>
                  <strong>KEY:</strong>{" "}
                  {snapshot.keyExists
                    ? snapshot.keyBracketId ?? "present"
                    : "Missing"}
                  {snapshot.keyUpdatedAt
                    ? ` · updated ${new Date(snapshot.keyUpdatedAt).toLocaleString()}`
                    : ""}
                </li>
              </ul>
            ) : (
              <p>No snapshot status for this year.</p>
            )}
            <p style={{ marginTop: 10, marginBottom: 0 }}>
              <Link
                href={keyEditorHref}
                className="ve-button"
                data-testid="standings-key-editor-link"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <ExternalLink size={14} aria-hidden /> Open KEY editor (
                {recomputeYear.trim() || content.standingsYear})
              </Link>
            </p>
          </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Page & year")} title="Page & year">
          <div className="ve-grid">
            {field("heading", "Page heading")}
            {field("standingsYear", "Standings Year", {
              help: "Default year for the standings selector (four digits). Independent of Tourney Year on the homepage.",
            })}
            {field("updatedLabel", "Updated message (prefix)", {
              help: 'Prepended to the snapshot timestamp. Example: "Updated" or "Standings last updated".',
            })}
            {field("searchPlaceholder", "Search placeholder")}
            {field("yearSelectAriaLabel", "Year select aria label", {
              help: "Token: {year}",
            })}
          </div>
          <p className="ve-help" style={{ marginTop: "0.75rem" }}>
            Year 2020 shows a cancellation newspaper instead of a table — edit
            it in the <strong>2020 newspaper</strong> section below.
          </p>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Filters & badges")} title="Filters & badges">
          <div className="ve-grid">
            {field("filterAllLabel", "All Entries button")}
            {field("filterMineLabel", "My Entries button")}
            {field("yoursBadgeLabel", "YOURS badge (signed-in owner)")}
            {field("showPaidIndicator", "Show paid indicator", {
              help: 'Use "true" or "false". When false, paid glyphs are hidden.',
            })}
            {field("paidGlyph", "Paid glyph", {
              help: 'Shown next to paid entries (default "$").',
            })}
            {field("paidAriaLabel", "Paid accessible label", {
              help: "Title / screen-reader text for the paid glyph.",
            })}
          </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Logo sizing")} title="Logo sizing">
          <p className="ve-help">
            Shared by Standings and My Picks. Independent square tile sizes for
            desktop and mobile (breakpoint 900px). Clamped to 12–64px for logos,
            50–100% for logo fill, and 1–8px for the finalist border. Preview
            updates as you type; publish to apply on the live pages.
          </p>
          <StandingsLogoSizingPreview content={content} />
          <div className="ve-grid">
            {field("finalFourLogoSizeDesktopPx", "Final Four square — desktop (px)", {
              help: "Default 32.",
            })}
            {field("champLogoSizeDesktopPx", "Champ square — desktop (px)", {
              help: "Default 42.",
            })}
            {field("finalFourLogoSizeMobilePx", "Final Four square — mobile (px)", {
              help: "Default 32.",
            })}
            {field("champLogoSizeMobilePx", "Champ square — mobile (px)", {
              help: "Default 42.",
            })}
            {field("finalFourLogoSizeCardPx", "Final Four square — My Picks mobile card (px)", {
              help: "Default 26. The 2×2 grid on phone entry cards.",
            })}
            {field("champLogoSizeCardPx", "Champ square — My Picks mobile card (px)", {
              help: "Default 39.",
            })}
            {field("logoFillPercent", "Logo fill (% of square)", {
              help: "Default 100. Lower adds breathing room inside every Final Four / Champ square.",
            })}
            {field("finalistBorderWidthPx", "Finalist border width (px)", {
              help: "Default 2. Applies on both desktop and mobile.",
            })}
          </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Result shade colors")} title="Result shade colors">
          <p className="ve-help">
            Cell fill for Final Four / Champ icons (CSS colors). Correct = KEY
            match; incorrect = KEY mismatch or eliminated; pending = not decided
            yet and still alive.
          </p>
          <StandingsResultShadePreview content={content} />
          <div className="ve-grid">
            {colorField("shadeCorrect", "Shade — correct (green)", {
              help: "Default #dcfce7",
              placeholder: "#dcfce7",
            })}
            {colorField("shadeIncorrect", "Shade — incorrect (red)", {
              help: "Default #fee2e2",
              placeholder: "#fee2e2",
            })}
            {colorField("shadePending", "Shade — pending (white)", {
              help: "Default #ffffff",
              placeholder: "#ffffff",
            })}
          </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Result border colors")} title="Result border colors">
          <p className="ve-help">
            Finalist heavy frame (and Champ status border when decided). Pending
            finalists use the black/pending color at the width above.
          </p>
          <StandingsResultBorderPreview content={content} />
          <div className="ve-grid">
            {colorField("borderCorrect", "Border — correct (green)", {
              help: "Default #16a34a",
              placeholder: "#16a34a",
            })}
            {colorField("borderIncorrect", "Border — incorrect (red)", {
              help: "Default #dc2626",
              placeholder: "#dc2626",
            })}
            {colorField("borderPendingFinalist", "Border — pending finalist (black)", {
              help: "Default #000000",
              placeholder: "#000000",
            })}
          </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Result hover labels")} title="Result hover labels">
          <p className="ve-help">
            Mouseover / screen-reader phrases for Final Four and Champ tiles.
            Shared by Standings and My Picks — edit once here. Shade and finalist
            frame stay as separate phrases in the composed tip.
          </p>
          <div className="ve-grid">
            {field("a11yEmptySelection", "Empty Final Four cell")}
            {field("a11yNoChampionPick", "Empty champion cell")}
            {field("a11yCorrectRegional", "Correct — regional")}
            {field("a11yIncorrectRegional", "Incorrect — regional")}
            {field("a11yCorrectChampion", "Correct — champion")}
            {field("a11yIncorrectChampion", "Incorrect — champion")}
            {field("a11yCorrectFinalist", "Correct — finalist frame")}
            {field("a11yIncorrectFinalist", "Incorrect — finalist frame")}
            {field("a11yPending", "Pending (any column)")}
            {field("a11yFinalistFrame", "Finalist frame meaning", {
              help: 'Added when the tile has a heavy frame. Example: "picked to reach the final".',
            })}
          </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Column headers (desktop)")} title="Column headers (desktop)">
          <div className="ve-grid">
            {field("colRankHeader", "Rank")}
            {field("colEntryHeader", "Entry")}
            {field("colPaidHeader", "Paid")}
            {field("colPointsHeader", "Points")}
            {field("colGapHeader", "Back")}
            {field("colTbHeader", "TB")}
            {field("colFinalFourHeader", "Final Four")}
            {field("colChampHeader", "Champ")}
            {field("gapColumnAriaLabel", "Gap accessible name (screen readers)")}
          </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Column headers (mobile)")} title="Column headers (mobile)">
          <p className="ve-help">
            Short labels for the compact mobile grid (e.g. #, PAID, FF, Ch.).
          </p>
          <div className="ve-grid">
            {field("colRankHeaderMobile", "Rank (mobile)")}
            {field("colEntryHeaderMobile", "Entry (mobile)")}
            {field("colPaidHeaderMobile", "Paid (mobile)")}
            {field("colFinalFourHeaderMobile", "Final Four (mobile)")}
            {field("colChampHeaderMobile", "Champ (mobile)")}
          </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Empty states & legend")} title="Empty states & legend">
          <div className="ve-grid">
            {field("notAvailableMessage", "Standings not available", {
              multiline: true,
              help: "Token: {year}",
            })}
            {field("noSearchResultsMessage", "No search results")}
            {field("noMyEntriesMessage", "No My Entries")}
            {field("showingCountTemplate", "Showing count footer", {
              help: "Tokens: {shown}, {total}",
            })}
            {field("legendFinalFourChamp", "Legend — Final Four / Champ", {
              multiline: true,
            })}
            {field("legendFinalistFrame", "Legend — black finalist frame", {
              multiline: true,
            })}
            {field("legendYoursPaid", "Legend — YOURS / paid", {
              multiline: true,
              help: "Blank hides this segment. Example: YOURS = your entries · $ = paid entry",
            })}
          </div>
          </SectionPanel>
          <SectionPanel
            id={sectionIdFor("2020 newspaper")}
            title="2020 newspaper"
          >
            <p className="ve-help">
              Cancellation edition shown when Standings year is 2020. Hide
              checkboxes omit sections on the live page without deleting copy.
              Preview:{" "}
              <Link href="/standings?year=2020" target="_blank">
                /standings?year=2020
              </Link>
              .
            </p>
            <div
              className="ve-grid"
              style={{ marginBottom: 12 }}
              data-testid="vintage-standings-paper2020-hide-flags"
            >
              {PAPER_2020_HIDE_FLAGS.map(({ key, label }) => {
                const id = `vintage-standings-paper2020-${key}`;
                const checked = isPaper2020SectionHidden(
                  content.paper2020[key],
                );
                return (
                  <label className="ve-checkbox-row" key={key} htmlFor={id}>
                    <input
                      id={id}
                      data-testid={id}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        updatePaper(key, e.target.checked ? "true" : "false")
                      }
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
            <h3>Page header</h3>
            <div className="ve-grid">
              {paperField("pageHeading", "Page heading", {
                help: "Title in the Standings header bar (next to the year).",
              })}
              {paperField("pageSubhead", "Page subhead", {
                help: "Line under the heading (replaces “Updated …” on 2020).",
              })}
            </div>
            <h3>Dateline</h3>
            <div className="ve-grid">
              {paperField("kicker", "Kicker")}
              {paperField("volume", "Volume line")}
            </div>
            <h3>Headline</h3>
            <div className="ve-grid">
              {paperField("headline", "Headline")}
              {paperField("deck", "Deck", { multiline: true, rows: 2 })}
            </div>
            <h3>Lead story</h3>
            <div className="ve-grid">
              {paperField("leadSubhead", "Lead subhead")}
              {paperField("leadBody1", "Lead paragraph 1", {
                multiline: true,
                rows: 4,
              })}
              {paperField("leadBody2", "Lead paragraph 2", {
                multiline: true,
                rows: 4,
              })}
            </div>
            <h3>Sidebar</h3>
            <div className="ve-grid">
              {paperField("sidebarSubhead", "Sidebar subhead")}
              {paperField("sidebarBody", "Sidebar body", {
                multiline: true,
                rows: 4,
              })}
              {paperField("pullQuote", "Pull quote", {
                multiline: true,
                rows: 3,
              })}
              {paperField("pullCite", "Pull quote citation")}
            </div>
            <h3>Warren’s desk</h3>
            <div className="ve-grid">
              {paperField("wireSubhead", "Desk subhead")}
              {paperField("wireBody", "Desk body", {
                multiline: true,
                rows: 4,
              })}
            </div>
            <h3>Sources</h3>
            <div className="ve-grid">
              {paperField("sourcesIntro", "Sources intro")}
              {paperField("source1Label", "Source 1 label")}
              {paperField("source1Href", "Source 1 URL")}
              {paperField("sourcesBetween", "Text between sources")}
              {paperField("source2Label", "Source 2 label")}
              {paperField("source2Href", "Source 2 URL")}
              {paperField("sourcesOutro", "Sources outro")}
            </div>
          </SectionPanel>
          <SectionPanel id={sectionIdFor("Regenerate snapshot")} title="Regenerate snapshot">
          <p className="ve-help">
            Rebuilds <code>live_standings_snapshots</code> for the year from the
            current KEY bracket and all submitted pool brackets. Does not change the
            KEY itself. The public Updated stamp will move to the new compute time.
          </p>
          <div className="ve-grid">
            <label className="ve-field" htmlFor="standings-recompute-year">
              <span>Regenerate year</span>
              <input
                id="standings-recompute-year"
                data-testid="standings-recompute-year"
                value={recomputeYear}
                onChange={(e) => {
                  setRecomputeYear(e.target.value);
                  if (/^\d{4}$/.test(e.target.value.trim())) {
                    void loadSnapshotStatus(e.target.value.trim());
                  }
                }}
                maxLength={4}
                inputMode="numeric"
              />
            </label>
          </div>
          <div className="ve-actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="ve-button"
              disabled={recomputing || busy}
              onClick={() => void regenerateSnapshot()}
              data-testid="standings-recompute"
            >
              <RefreshCw size={16} />{" "}
              {recomputing ? "Regenerating…" : "Regenerate standings snapshot"}
            </button>
          </div>
          </SectionPanel>
        </div>
      </div>
    </main>
  );
}
