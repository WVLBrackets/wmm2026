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
  normalizeVintageStandingsContent,
  validateVintageStandingsContent,
  type VintageStandingsContent,
} from "@/lib/vintage/standingsContent";
import type { VintageStandingsState } from "@/lib/vintage/standingsStore";
import VintageAdminNav from "../VintageAdminNav";
import "../editor.css";

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
  key: keyof VintageStandingsContent,
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
  function update(key: keyof VintageStandingsContent, value: string) {
    setContent((previous) => setField(previous, key, value));
    setDirty(true);
    if (key === "standingsYear" && /^\d{4}$/.test(value.trim())) {
      setRecomputeYear(value.trim());
    }
  }

  /**
   * Render a labeled text field.
   */
  function field(
    key: keyof VintageStandingsContent,
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
        action === "restore"
          ? undefined
          : normalizeVintageStandingsContent(content);
      if (payload) validateVintageStandingsContent(payload);
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
          revisionId,
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
      setMessage(
        action === "restore"
          ? "Revision restored as a draft."
          : "Draft saved.",
      );
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

      <h2>Snapshot status</h2>
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

      <h2>Page &amp; year</h2>
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

      <h2>Filters &amp; badges</h2>
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

      <h2>Logo sizing</h2>
      <p className="ve-help">
        Independent square tile sizes for desktop and mobile (breakpoint
        900px). Clamped to 12–64px for logos and 1–8px for the finalist border.
        Publish to apply on the public Standings page.
      </p>
      <div className="ve-grid">
        {field("finalFourLogoSizeDesktopPx", "Final Four square — desktop (px)", {
          help: "Default 22.",
        })}
        {field("champLogoSizeDesktopPx", "Champ square — desktop (px)", {
          help: "Default 28.",
        })}
        {field("finalFourLogoSizeMobilePx", "Final Four square — mobile (px)", {
          help: "Default 22.",
        })}
        {field("champLogoSizeMobilePx", "Champ square — mobile (px)", {
          help: "Default 28.",
        })}
        {field("finalistBorderWidthPx", "Finalist border width (px)", {
          help: "Default 2. Applies on both desktop and mobile.",
        })}
      </div>

      <h2>Result shade colors</h2>
      <p className="ve-help">
        Cell fill for Final Four / Champ icons (CSS colors). Correct = KEY
        match; incorrect = KEY mismatch or eliminated; pending = not decided
        yet and still alive.
      </p>
      <div className="ve-grid">
        {field("shadeCorrect", "Shade — correct (green)", {
          help: "Default #dcfce7",
        })}
        {field("shadeIncorrect", "Shade — incorrect (red)", {
          help: "Default #fee2e2",
        })}
        {field("shadePending", "Shade — pending (white)", {
          help: "Default #ffffff",
        })}
      </div>

      <h2>Result border colors</h2>
      <p className="ve-help">
        Finalist heavy frame (and Champ status border when decided). Pending
        finalists use the black/pending color at the width above.
      </p>
      <div className="ve-grid">
        {field("borderCorrect", "Border — correct (green)", {
          help: "Default #16a34a",
        })}
        {field("borderIncorrect", "Border — incorrect (red)", {
          help: "Default #dc2626",
        })}
        {field("borderPendingFinalist", "Border — pending finalist (black)", {
          help: "Default #000000",
        })}
      </div>

      <h2>Column headers (desktop)</h2>
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

      <h2>Column headers (mobile)</h2>
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

      <h2>Empty states &amp; legend</h2>
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

      <h2>Regenerate snapshot</h2>
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
