"use client";

import { useEffect, useState } from "react";
import { useCSRF } from "@/hooks/useCSRF";
import type { HallOfFameEntry } from "@/lib/hallOfFameStats";
import ConfirmDialog from "../feedback/ConfirmDialog";

/**
 * Empty podium row for the add/edit form.
 */
function empty(): HallOfFameEntry {
  return {
    year: "",
    firstPlace: { name: "", team: "", score: 0 },
    secondPlace: { name: "", score: 0 },
    thirdPlace: { name: "", score: 0 },
    totalEntries: 0,
  };
}

/**
 * Admin editor for Hall of Fame podium years stored in `hof_seasons`.
 * Lives under /vintage/admin/hof as the “Podium history” section.
 */
export default function HofSeasonsEditor() {
  const { fetchWithCSRF } = useCSRF();
  const [rows, setRows] = useState<HallOfFameEntry[]>([]);
  const [draft, setDraft] = useState<HallOfFameEntry>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  /**
   * Reload the season list from the admin API.
   */
  async function load() {
    setError("");
    const res = await fetch("/api/admin/hof-seasons", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.error || "Could not load podium history.");
      return;
    }
    setRows(json.data as HallOfFameEntry[]);
  }

  useEffect(() => {
    void load();
  }, []);

  /**
   * Prefill the form from an existing year.
   *
   * @param row - Season to edit
   */
  function editRow(row: HallOfFameEntry) {
    setDraft(structuredClone(row));
  }

  /**
   * Insert or replace the draft year in `hof_seasons`.
   */
  async function save() {
    if (!draft.year.trim()) {
      setError("Year is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetchWithCSRF("/api/admin/hof-seasons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Could not save year.");
      }
      setDraft(empty());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save year.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="hof-seasons-editor">
      <p className="ve-help">
        Winner names, NCAA champ, scores, and entry counts for each year. Saving
        a year overwrites that row in the database (not a Google Sheet). Changes
        show on the public Hall of Fame immediately — no CMS Publish needed.
      </p>
      {error ? (
        <p className="ve-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ve-grid">
        <label className="ve-field" htmlFor="hof-season-year">
          <span>Year</span>
          <input
            id="hof-season-year"
            value={draft.year}
            onChange={(e) => setDraft({ ...draft, year: e.target.value })}
            placeholder="2027"
            data-testid="hof-season-year"
          />
        </label>
        <label className="ve-field" htmlFor="hof-season-entries">
          <span>Total entries</span>
          <input
            id="hof-season-entries"
            type="number"
            value={draft.totalEntries}
            onChange={(e) =>
              setDraft({ ...draft, totalEntries: Number(e.target.value) || 0 })
            }
            data-testid="hof-season-entries"
          />
        </label>
        <label className="ve-field" htmlFor="hof-season-first-name">
          <span>1st place — name</span>
          <input
            id="hof-season-first-name"
            value={draft.firstPlace.name}
            onChange={(e) =>
              setDraft({
                ...draft,
                firstPlace: { ...draft.firstPlace, name: e.target.value },
              })
            }
            data-testid="hof-season-first-name"
          />
        </label>
        <label className="ve-field" htmlFor="hof-season-first-team">
          <span>1st place — NCAA champ</span>
          <input
            id="hof-season-first-team"
            value={draft.firstPlace.team}
            onChange={(e) =>
              setDraft({
                ...draft,
                firstPlace: { ...draft.firstPlace, team: e.target.value },
              })
            }
            data-testid="hof-season-first-team"
          />
        </label>
        <label className="ve-field" htmlFor="hof-season-first-score">
          <span>1st place — score</span>
          <input
            id="hof-season-first-score"
            type="number"
            value={draft.firstPlace.score}
            onChange={(e) =>
              setDraft({
                ...draft,
                firstPlace: {
                  ...draft.firstPlace,
                  score: Number(e.target.value) || 0,
                },
              })
            }
            data-testid="hof-season-first-score"
          />
        </label>
        <label className="ve-field" htmlFor="hof-season-second-name">
          <span>2nd place — name</span>
          <input
            id="hof-season-second-name"
            value={draft.secondPlace.name}
            onChange={(e) =>
              setDraft({
                ...draft,
                secondPlace: { ...draft.secondPlace, name: e.target.value },
              })
            }
          />
        </label>
        <label className="ve-field" htmlFor="hof-season-second-score">
          <span>2nd place — score</span>
          <input
            id="hof-season-second-score"
            type="number"
            value={draft.secondPlace.score}
            onChange={(e) =>
              setDraft({
                ...draft,
                secondPlace: {
                  ...draft.secondPlace,
                  score: Number(e.target.value) || 0,
                },
              })
            }
          />
        </label>
        <label className="ve-field" htmlFor="hof-season-third-name">
          <span>3rd place — name</span>
          <input
            id="hof-season-third-name"
            value={draft.thirdPlace.name}
            onChange={(e) =>
              setDraft({
                ...draft,
                thirdPlace: { ...draft.thirdPlace, name: e.target.value },
              })
            }
          />
        </label>
        <label className="ve-field" htmlFor="hof-season-third-score">
          <span>3rd place — score</span>
          <input
            id="hof-season-third-score"
            type="number"
            value={draft.thirdPlace.score}
            onChange={(e) =>
              setDraft({
                ...draft,
                thirdPlace: {
                  ...draft.thirdPlace,
                  score: Number(e.target.value) || 0,
                },
              })
            }
          />
        </label>
      </div>

      <div className="ve-actions" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="ve-button ve-primary"
          disabled={busy}
          onClick={() => void save()}
          data-testid="hof-season-save"
        >
          Save year
        </button>
        <button
          type="button"
          className="ve-button"
          disabled={busy}
          onClick={() => setDraft(empty())}
        >
          Clear form
        </button>
      </div>

      <ul className="ve-help" style={{ marginTop: 20, paddingLeft: 0, listStyle: "none" }}>
        {rows.map((row) => (
          <li
            key={row.year}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <strong>{row.year}</strong>
            <span>
              {row.firstPlace.name}
              {row.firstPlace.team ? ` (${row.firstPlace.team})` : ""} —{" "}
              {row.firstPlace.score}
            </span>
            <button
              type="button"
              className="ve-button"
              onClick={() => editRow(row)}
              data-testid={`hof-season-edit-${row.year}`}
            >
              Edit
            </button>
            <button
              type="button"
              className="ve-button"
              onClick={() => setPendingDelete(row.year)}
              data-testid={`hof-season-delete-${row.year}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this year?"
        message={
          pendingDelete
            ? `Remove ${pendingDelete} from Hall of Fame history.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        busy={busy}
        testId="hof-season-delete-confirm"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          setBusy(true);
          void fetchWithCSRF(
            `/api/admin/hof-seasons?year=${encodeURIComponent(pendingDelete)}`,
            { method: "DELETE" },
          ).then(async () => {
            setPendingDelete(null);
            setBusy(false);
            await load();
          });
        }}
      />
    </div>
  );
}
