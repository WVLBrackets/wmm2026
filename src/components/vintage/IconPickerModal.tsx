"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { VintageMedia } from "@/lib/vintage/media";
import {
  customToolbarIconUrl,
  customToolbarIconValue,
  resolveToolbarIcon,
  VINTAGE_TOOLBAR_ICON_NAMES,
} from "@/lib/vintage/toolbarIcons";

/**
 * Searchable Lucide + custom SVG icon picker for toolbar buttons.
 */
export default function IconPickerModal({
  open,
  current,
  media,
  onClose,
  onSelect,
  onUploadSvg,
}: {
  open: boolean;
  current: string;
  media: VintageMedia[];
  onClose: () => void;
  onSelect: (iconName: string) => void;
  onUploadSvg: (file: File, alt: string) => Promise<VintageMedia>;
}) {
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"lucide" | "custom">("lucide");
  const [query, setQuery] = useState("");
  const [uploadAlt, setUploadAlt] = useState("Toolbar icon");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError("");
    setTab(customToolbarIconUrl(current) ? "custom" : "lucide");
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, current]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? VINTAGE_TOOLBAR_ICON_NAMES.filter((name) =>
          name.toLowerCase().includes(q),
        )
      : VINTAGE_TOOLBAR_ICON_NAMES;
    return list.slice(0, 120);
  }, [query]);

  const svgLibrary = useMemo(
    () =>
      media.filter(
        (item) =>
          item.url.toLowerCase().includes(".svg") ||
          item.filename.toLowerCase().endsWith(".svg"),
      ),
    [media],
  );

  if (!open) return null;

  return (
    <div
      className="ve-icon-modal-backdrop"
      role="presentation"
      onClick={onClose}
      data-testid="vintage-icon-picker"
    >
      <div
        className="ve-icon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ve-icon-modal-header">
          <h3 id={titleId}>Choose an icon</h3>
          <button
            type="button"
            className="ve-button"
            onClick={onClose}
            data-testid="vintage-icon-picker-close"
          >
            Close
          </button>
        </header>
        <div className="ve-icon-tabs" role="tablist" aria-label="Icon source">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "lucide"}
            className={tab === "lucide" ? "ve-icon-tab active" : "ve-icon-tab"}
            onClick={() => setTab("lucide")}
            data-testid="vintage-icon-tab-lucide"
          >
            Lucide library
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "custom"}
            className={tab === "custom" ? "ve-icon-tab active" : "ve-icon-tab"}
            onClick={() => setTab("custom")}
            data-testid="vintage-icon-tab-custom"
          >
            My SVGs
          </button>
        </div>
        {error && (
          <p className="ve-notice ve-error" role="alert">
            {error}
          </p>
        )}
        {tab === "lucide" ? (
          <>
            <label className="ve-field" htmlFor="vintage-icon-search">
              <span>Search Lucide icons</span>
              <input
                id="vintage-icon-search"
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try trophy, house, users…"
                data-testid="vintage-icon-search"
              />
            </label>
            <p className="ve-help">
              Showing {matches.length}
              {query.trim() ? " matches" : " icons"} (type to narrow the full
              library).
            </p>
            <div className="ve-icon-grid" role="listbox" aria-label="Icons">
              {matches.map((name) => {
                const Icon = resolveToolbarIcon(name);
                if (!Icon) return null;
                const selected = name === current;
                return (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={
                      selected
                        ? "ve-icon-option ve-icon-selected"
                        : "ve-icon-option"
                    }
                    title={name}
                    data-testid={`vintage-icon-option-${name}`}
                    onClick={() => {
                      onSelect(name);
                      onClose();
                    }}
                  >
                    <Icon aria-hidden="true" size={22} strokeWidth={1.7} />
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="ve-help">
              Upload a simple SVG (under 500 KB). Icons are shown as images, not
              inlined, so scripts inside SVG files cannot run on the page.
            </p>
            <div className="ve-grid">
              <label className="ve-field" htmlFor="vintage-svg-alt">
                <span>Alt text</span>
                <input
                  id="vintage-svg-alt"
                  value={uploadAlt}
                  onChange={(event) => setUploadAlt(event.target.value)}
                  data-testid="vintage-svg-alt"
                />
              </label>
              <div className="ve-field">
                <span>Upload SVG</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".svg,image/svg+xml"
                  data-testid="vintage-svg-file"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setBusy(true);
                    setError("");
                    try {
                      const uploaded = await onUploadSvg(
                        file,
                        uploadAlt.trim() || "Toolbar icon",
                      );
                      onSelect(customToolbarIconValue(uploaded.url));
                      onClose();
                    } catch (uploadError) {
                      setError(
                        uploadError instanceof Error
                          ? uploadError.message
                          : "SVG upload failed.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </div>
            </div>
            <div className="ve-icon-grid" role="listbox" aria-label="Uploaded SVGs">
              {svgLibrary.length === 0 && (
                <p className="ve-help">No SVG icons in the media library yet.</p>
              )}
              {svgLibrary.map((item) => {
                const value = customToolbarIconValue(item.url);
                const selected = value === current;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={busy}
                    className={
                      selected
                        ? "ve-icon-option ve-icon-selected"
                        : "ve-icon-option"
                    }
                    title={item.filename}
                    data-testid={`vintage-svg-option-${item.id}`}
                    onClick={() => {
                      onSelect(value);
                      onClose();
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="" width={22} height={22} />
                    <span>{item.filename}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
