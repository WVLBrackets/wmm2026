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
  type VintagePicksContent,
} from "@/lib/vintage/picksContent";
import type { VintagePicksState } from "@/lib/vintage/picksStore";
import "../editor.css";

/**
 * Set a top-level string field on the My Picks draft.
 */
function setField(
  source: VintagePicksContent,
  key: keyof Pick<
    VintagePicksContent,
    | "countdownToBracketLabel"
    | "countdownToTipoffLabel"
    | "viewingPriorYearLabel"
  >,
  value: string,
): VintagePicksContent {
  return { ...source, [key]: value };
}

/**
 * Admin editor for My Picks landing copy (timers + prior-year switch).
 * Pool flavor buckets exist in storage for later expansion.
 */
export default function VintagePicksEditor() {
  const router = useRouter();
  const [state, setState] = useState<VintagePicksState | null>(null);
  const [content, setContent] = useState<VintagePicksContent>(
    structuredClone(DEFAULT_VINTAGE_PICKS_CONTENT),
  );
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
   * Update one CMS string field and mark the draft dirty.
   */
  function update(
    key: keyof Pick<
      VintagePicksContent,
      | "countdownToBracketLabel"
      | "countdownToTipoffLabel"
      | "viewingPriorYearLabel"
    >,
    value: string,
  ) {
    setContent((previous) => setField(previous, key, value));
    setDirty(true);
  }

  /**
   * Render a labeled text field.
   */
  function field(
    key: keyof Pick<
      VintagePicksContent,
      | "countdownToBracketLabel"
      | "countdownToTipoffLabel"
      | "viewingPriorYearLabel"
    >,
    label: string,
    help?: string,
  ) {
    const id = `vintage-picks-${key}`;
    return (
      <label className="ve-field" key={key} htmlFor={id}>
        <span>{label}</span>
        {help ? <span className="ve-help">{help}</span> : null}
        <input
          id={id}
          data-testid={id}
          value={content[key]}
          onChange={(e) => update(key, e.target.value)}
          maxLength={6000}
        />
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
      <header className="ve-header">
        <div>
          <Link href="/bracket" className="ve-back">
            <ArrowLeft size={16} /> My Picks
          </Link>
          <h1>My Picks copy</h1>
          <p className="ve-help">
            Edit countdown labels and the prior-year switch control. Use{" "}
            <code>{"{year}"}</code> and <code>{"{activeYear}"}</code> tokens.
            Current vs historic pool message flavors will land here later —
            storage already has those buckets.
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

      <div className="ve-grid">
        {field(
          "countdownToBracketLabel",
          "Countdown — brackets not yet available",
          "Shown before brackets publish. Token: {year}",
        )}
        {field(
          "countdownToTipoffLabel",
          "Countdown — tip-off",
          "Shown once brackets are available. Token: {year}",
        )}
        {field(
          "viewingPriorYearLabel",
          "Prior-year switch control",
          "Replaces the timer when viewing an archived year. Tokens: {year}, {activeYear}",
        )}
      </div>

      <section className="ve-help" aria-label="Future flavors">
        <p>
          Reserved flavor buckets in published JSON:{" "}
          <code>poolFlavors.current</code> and <code>poolFlavors.historic</code>
          . Leave empty for now — we will add fields when product defines the
          message set.
        </p>
      </section>

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
