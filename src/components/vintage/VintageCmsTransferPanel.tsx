"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
} from "lucide-react";
import {
  cmsTransferDeskLabel,
  type CmsFieldChange,
  type CmsTransferDesk,
  type VintageCmsTransferBundle,
} from "@/lib/vintage/cmsTransfer";

type PreviewState = {
  version: number;
  changes: CmsFieldChange[];
  summary: {
    total: number;
    byDesk: Record<CmsTransferDesk, number>;
    draftCount: number;
    publishedCount: number;
  };
  bundle: VintageCmsTransferBundle;
};

/**
 * Fetch a CSRF token for vintage admin mutations.
 */
async function csrfToken(): Promise<string> {
  const response = await fetch("/api/csrf-token", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not verify your session.");
  const data = await response.json();
  return data.csrfToken as string;
}

/**
 * Export / import the full vintage CMS package from the Home admin desk.
 * Import always shows a field-level diff and requires explicit confirm.
 */
export default function VintageCmsTransferPanel({
  onApplied,
}: {
  /** Called after a successful import so the editor can reload. */
  onApplied?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceLabel, setSourceLabel] = useState("local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);

  /**
   * Download the current environment’s CMS package as JSON.
   */
  async function exportPackage() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const label = encodeURIComponent(sourceLabel.trim() || "export");
      const response = await fetch(
        `/api/admin/vintage-cms-transfer?label=${label}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Export failed.");
      const bundle = data.bundle as VintageCmsTransferBundle;
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vintage-cms-${bundle.sourceLabel || "export"}-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("CMS package downloaded. Import it on Staging or Prod admin.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Parse a chosen file and request a server-side diff against this environment.
   */
  async function previewFile(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("That file is not valid JSON.");
      }
      const token = await csrfToken();
      const response = await fetch("/api/admin/vintage-cms-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({ action: "preview", bundle: parsed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Preview failed.");
      setPreview({
        version: data.version,
        changes: data.changes,
        summary: data.summary,
        bundle: data.bundle,
      });
      if (data.summary.total === 0) {
        setMessage("No differences — this environment already matches the package.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /**
   * Apply the previewed package after the admin confirms the listed changes.
   */
  async function applyImport() {
    if (!preview) return;
    const confirmed = window.confirm(
      preview.summary.total === 0
        ? "No field changes. Apply anyway (rewrite draft + published from the package)?"
        : `Apply ${preview.summary.total} field change(s) to this environment’s draft and published CMS? This cannot be undone from Admin.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await csrfToken();
      const response = await fetch("/api/admin/vintage-cms-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          action: "apply",
          bundle: preview.bundle,
          version: preview.version,
          expectedChangeCount: preview.summary.total,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed.");
      setMessage(
        `Import applied (${data.appliedChanges} field change(s)). Reload the editor desks to see the new values.`,
      );
      setPreview(null);
      onApplied?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const desks = (
    ["home", "guidebook", "hof", "standings", "picks"] as CmsTransferDesk[]
  ).filter((desk) => (preview?.summary.byDesk[desk] ?? 0) > 0);

  return (
    <section
      className="ve-cms-transfer"
      data-testid="vintage-cms-transfer"
      aria-labelledby="vintage-cms-transfer-title"
    >
      <div className="ve-cms-transfer__intro">
        <h2 id="vintage-cms-transfer-title">CMS export / import</h2>
        <p className="ve-help">
          Move Home, Guidebook, Hall of Fame, Standings, and Picks copy between
          environments. Export downloads a JSON package from{" "}
          <strong>this</strong> database. Import compares every field to what is
          here now and asks you to confirm before writing draft and published.
          Image URLs stay as stored — re-upload media on the target env if links
          point at another bucket.
        </p>
      </div>

      <div className="ve-cms-transfer__actions">
        <label className="ve-field ve-cms-transfer__label">
          <span>Export label</span>
          <input
            data-testid="vintage-cms-transfer-label"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="local"
            maxLength={80}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="ve-button"
          disabled={busy}
          onClick={() => void exportPackage()}
          data-testid="vintage-cms-transfer-export"
        >
          {busy ? <Loader2 size={16} className="ve-spin" /> : <Download size={16} />}
          Export CMS package
        </button>
        <button
          type="button"
          className="ve-button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          data-testid="vintage-cms-transfer-import"
        >
          <FileUp size={16} />
          Choose package to import…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="ve-sr-only"
          data-testid="vintage-cms-transfer-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void previewFile(file);
          }}
        />
      </div>

      {error ? (
        <div className="ve-notice ve-error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="ve-notice" role="status">
          <CheckCircle2 size={18} />
          {message}
        </div>
      ) : null}

      {preview ? (
        <div
          className="ve-cms-transfer__preview"
          data-testid="vintage-cms-transfer-preview"
        >
          <div className="ve-cms-transfer__summary">
            <p>
              Package from{" "}
              <strong>{preview.bundle.sourceLabel || "unknown source"}</strong>
              {preview.bundle.exportedAt
                ? ` · exported ${new Date(preview.bundle.exportedAt).toLocaleString()}`
                : null}
            </p>
            <p>
              <strong>{preview.summary.total}</strong> field change
              {preview.summary.total === 1 ? "" : "s"}
              {" · "}
              {preview.summary.publishedCount} published
              {" · "}
              {preview.summary.draftCount} draft
            </p>
            {desks.length > 0 ? (
              <ul className="ve-cms-transfer__desk-counts">
                {desks.map((desk) => (
                  <li key={desk}>
                    {cmsTransferDeskLabel(desk)}: {preview.summary.byDesk[desk]}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {preview.changes.length > 0 ? (
            <div className="ve-cms-transfer__table-wrap">
              <table className="ve-cms-transfer__table">
                <thead>
                  <tr>
                    <th scope="col">Desk</th>
                    <th scope="col">Edition</th>
                    <th scope="col">Field</th>
                    <th scope="col">Current</th>
                    <th scope="col">Incoming</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.changes.map((change) => (
                    <tr
                      key={`${change.edition}:${change.path}`}
                      data-testid="vintage-cms-transfer-change-row"
                    >
                      <td>{cmsTransferDeskLabel(change.desk)}</td>
                      <td>{change.edition}</td>
                      <td>
                        <code>{change.path}</code>
                      </td>
                      <td>
                        <pre>{change.before}</pre>
                      </td>
                      <td>
                        <pre>{change.after}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ve-help">Every field already matches this environment.</p>
          )}

          <div className="ve-cms-transfer__confirm">
            <button
              type="button"
              className="ve-button ve-primary"
              disabled={busy}
              onClick={() => void applyImport()}
              data-testid="vintage-cms-transfer-apply"
            >
              Confirm and apply import
            </button>
            <button
              type="button"
              className="ve-button"
              disabled={busy}
              onClick={() => setPreview(null)}
              data-testid="vintage-cms-transfer-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
