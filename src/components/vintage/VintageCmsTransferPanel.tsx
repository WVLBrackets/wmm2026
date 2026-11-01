"use client";

import { useMemo, useRef, useState } from "react";
import { useAdminConfirm } from "@/components/admin/useAdminConfirm";
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
 * Export / import published vintage CMS fields from the Home admin desk.
 * Import shows a field-level diff with per-row Include toggles (default ON).
 */
export default function VintageCmsTransferPanel({
  onApplied,
}: {
  /** Called after a successful import so the editor can reload. */
  onApplied?: () => void;
}) {
  const { confirm, dialog } = useAdminConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceLabel, setSourceLabel] = useState("local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  /** Paths included in the apply (default: all previewed changes). */
  const [includedPaths, setIncludedPaths] = useState<Set<string>>(new Set());

  const selectedCount = useMemo(() => {
    if (!preview) return 0;
    return preview.changes.filter((c) => includedPaths.has(c.path)).length;
  }, [preview, includedPaths]);

  /**
   * Stamp this environment’s CMS as schema v2 (idempotent one-time migrate).
   */
  async function completeCmsSections() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await csrfToken();
      const response = await fetch("/api/admin/vintage-cms-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "CMS complete failed.");
      }
      setMessage(
        `CMS schema v${data.schema} ready (row version ${data.version}). Public pages should load.`,
      );
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CMS complete failed.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Download the current environment’s published CMS package as JSON.
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
      setMessage(
        "Published CMS package downloaded. Import it on Staging or Prod admin.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Parse a chosen file and request a server-side published-field diff.
   */
  async function previewFile(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    setIncludedPaths(new Set());
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
      const changes = data.changes as CmsFieldChange[];
      setPreview({
        version: data.version,
        changes,
        summary: data.summary,
        bundle: data.bundle,
      });
      setIncludedPaths(new Set(changes.map((c) => c.path)));
      if (data.summary.total === 0) {
        setMessage(
          "No differences — this environment’s published CMS already matches the package.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /**
   * Toggle whether a diff row’s incoming value will be applied.
   */
  function setRowIncluded(path: string, include: boolean) {
    setIncludedPaths((prev) => {
      const next = new Set(prev);
      if (include) next.add(path);
      else next.delete(path);
      return next;
    });
  }

  /**
   * Apply selected published fields after the admin confirms.
   */
  async function applyImport() {
    if (!preview) return;
    if (selectedCount === 0) {
      setError(
        "Turn Include ON for at least one field, or cancel if you do not want to import.",
      );
      return;
    }
    const confirmed = await confirm({
      title: "Apply CMS import",
      message: `Apply ${selectedCount} of ${preview.summary.total} published field change(s) to this environment? Draft is left unchanged. This cannot be undone from Admin.`,
      confirmLabel: "Apply",
      testId: "cms-transfer-apply-confirm",
      tone: "danger",
    });
    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await csrfToken();
      const selectedPaths = preview.changes
        .filter((c) => includedPaths.has(c.path))
        .map((c) => c.path);
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
          selectedPaths,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed.");
      setMessage(
        `Import applied (${data.appliedChanges} published field change(s)). Reload the editor desks to see the new values.`,
      );
      setPreview(null);
      setIncludedPaths(new Set());
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
          Move <strong>published</strong> Home, Guidebook, Hall of Fame,
          Standings, and Picks copy between environments. Export downloads a
          JSON package from <strong>this</strong> database. Import compares
          published fields to what is here now; turn Include OFF on any row to
          keep the current value. Draft is not exported or overwritten. Image
          URLs stay as stored — re-upload media on the target env if links point
          at another bucket.
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
          onClick={() => void completeCmsSections()}
          data-testid="vintage-cms-complete-sections"
        >
          {busy ? <Loader2 size={16} className="ve-spin" /> : <CheckCircle2 size={16} />}
          Complete CMS sections
        </button>
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
              <strong>{preview.summary.total}</strong> published field change
              {preview.summary.total === 1 ? "" : "s"}
              {preview.summary.total > 0 ? (
                <>
                  {" · "}
                  <strong data-testid="vintage-cms-transfer-selected-count">
                    {selectedCount}
                  </strong>{" "}
                  selected to import
                </>
              ) : null}
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
                    <th scope="col">Include</th>
                    <th scope="col">Desk</th>
                    <th scope="col">Field</th>
                    <th scope="col">Current</th>
                    <th scope="col">Incoming</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.changes.map((change) => {
                    const included = includedPaths.has(change.path);
                    return (
                      <tr
                        key={change.path}
                        data-testid="vintage-cms-transfer-change-row"
                        data-included={included ? "true" : "false"}
                        className={
                          included
                            ? undefined
                            : "ve-cms-transfer__row--excluded"
                        }
                      >
                        <td>
                          <label className="ve-cms-transfer__include">
                            <input
                              type="checkbox"
                              checked={included}
                              disabled={busy}
                              onChange={(e) =>
                                setRowIncluded(change.path, e.target.checked)
                              }
                              data-testid="vintage-cms-transfer-include"
                              aria-label={`Include ${change.path} from import`}
                            />
                            <span>{included ? "ON" : "OFF"}</span>
                          </label>
                        </td>
                        <td>{cmsTransferDeskLabel(change.desk)}</td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ve-help">
              Every published field already matches this environment.
            </p>
          )}

          <div className="ve-cms-transfer__confirm">
            <button
              type="button"
              className="ve-button ve-primary"
              disabled={busy || selectedCount === 0}
              onClick={() => void applyImport()}
              data-testid="vintage-cms-transfer-apply"
            >
              Confirm and apply import
              {preview.summary.total > 0 ? ` (${selectedCount})` : ""}
            </button>
            <button
              type="button"
              className="ve-button"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setIncludedPaths(new Set());
              }}
              data-testid="vintage-cms-transfer-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {dialog}
    </section>
  );
}
