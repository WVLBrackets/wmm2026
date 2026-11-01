"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Save, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BusyOverlay from "@/components/vintage/feedback/BusyOverlay";
import LoadingBasketball from "@/components/vintage/feedback/LoadingBasketball";
import type { CopyLeaf, CopyTree } from "@/lib/vintage/copyTree";
import type { VintageAdminNavId } from "../VintageAdminNav";
import VintageAdminNav from "../VintageAdminNav";
import VintageCmsTransferPanel from "../VintageCmsTransferPanel";
import {
  SectionPanel,
  SectionRail,
  sectionDomId,
  useSectionNav,
} from "../sectionNav";
import "../editor.css";

type CopySlot = "emails" | "bracketEditor" | "scoreboard";

type Field = {
  path: string[];
  group: string;
  label: string;
  kind: "string" | "number" | "boolean";
  value: CopyLeaf;
};

/**
 * Humanize a camelCase key for admin labels.
 *
 * @param key - Object key
 */
function camelToLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Walk a copy tree into editable leaf fields grouped by top-level key.
 *
 * @param tree - Section JSON
 * @param prefix - Recursion path
 */
function walkFields(tree: CopyTree, prefix: string[] = []): Field[] {
  const out: Field[] = [];
  for (const [key, val] of Object.entries(tree)) {
    const path = [...prefix, key];
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      out.push({
        path,
        group: prefix[0] ?? key,
        label: camelToLabel(key),
        kind: typeof val as Field["kind"],
        value: val,
      });
    } else if (val && typeof val === "object") {
      out.push(...walkFields(val, path));
    }
  }
  return out;
}

/**
 * Immutably set a leaf at `path`.
 *
 * @param tree - Current tree
 * @param path - Key path
 * @param value - New leaf
 */
function setPath(tree: CopyTree, path: string[], value: CopyLeaf): CopyTree {
  if (path.length === 0) return tree;
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...tree, [head]: value };
  const current = tree[head];
  if (!current || typeof current !== "object") return tree;
  return { ...tree, [head]: setPath(current, rest, value) };
}

type VintageCopyTreeEditorProps = {
  slot: CopySlot;
  title: string;
  navId: VintageAdminNavId;
  seed: CopyTree;
  intro: string;
};

/**
 * Generic admin editor for copy-tree CMS sidecars (Emails, Bracket Editor
 * Messages, Scoreboard). Defaults seed a brand-new empty draft only.
 */
export default function VintageCopyTreeEditor({
  slot,
  title,
  navId,
  seed,
  intro,
}: VintageCopyTreeEditorProps) {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [content, setContent] = useState<CopyTree>(structuredClone(seed));
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fields = useMemo(() => walkFields(content), [content]);
  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const field of fields) {
      if (!seen.includes(field.group)) seen.push(field.group);
    }
    return seen;
  }, [fields]);
  const sections = groups.map((group) => ({
    label: camelToLabel(group),
    id: sectionDomId(camelToLabel(group)),
  }));
  const { activeId, jumpTo } = useSectionNav(
    sections.map((s) => s.id),
    ready,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/admin/vintage-sidecar?slot=${slot}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load.");
        if (!active) return;
        setVersion(data.state.version);
        setContent(data.state.draft);
        setReady(Boolean(data.storageReady));
        setDirty(false);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load.");
      }
    })();
    return () => {
      active = false;
    };
  }, [slot]);

  /**
   * Persist draft or publish.
   *
   * @param action - Save vs publish
   */
  async function submit(action: "save" | "publish") {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/vintage-sidecar?slot=${slot}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version, content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save.");
      setVersion(data.state.version);
      setContent(data.state.draft);
      setDirty(false);
      setMessage(action === "publish" ? "Published." : "Draft saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setBusy(null);
    }
  }

  if (!ready && !error) {
    return <LoadingBasketball message="Loading editor…" testId={`vintage-${slot}-loading`} />;
  }

  return (
    <div className="ve" data-testid={`vintage-${slot}-editor`}>
      <VintageAdminNav current={navId} />
      <header className="ve-head">
        <Link href="/vintage/admin" className="ve-back">
          <ArrowLeft size={16} aria-hidden /> Home CMS
        </Link>
        <h1>{title}</h1>
        <p className="ve-help">{intro} Blank fields are hidden on the public site.</p>
      </header>
      {error ? (
        <p className="ve-error" role="alert">
          <AlertCircle size={16} aria-hidden /> {error}
        </p>
      ) : null}
      {message ? (
        <p className="ve-ok" role="status">
          <CheckCircle2 size={16} aria-hidden /> {message}
        </p>
      ) : null}
      <div className="ve-workspace">
        <SectionRail
          sections={sections}
          activeId={activeId}
          onJump={jumpTo}
          ariaLabel="Editor sections"
          testIdPrefix={`vintage-${slot}-tab`}
        />
        <div className="ve-sections">
          {groups.map((group) => {
            const id = sectionDomId(camelToLabel(group));
            const groupFields = fields.filter((f) => f.group === group);
            return (
              <SectionPanel key={group} id={id} title={camelToLabel(group)} disabled={Boolean(busy)}>
                <div className="ve-grid">
                  {groupFields.map((field) => {
                    const fieldId = `ve-${slot}-${field.path.join("-")}`;
                    const value = field.value;
                    return (
                      <label className="ve-field" key={fieldId} htmlFor={fieldId}>
                        <span>{field.label}</span>
                        {field.kind === "boolean" ? (
                          <input
                            id={fieldId}
                            data-testid={fieldId}
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => {
                              setContent((prev) => setPath(prev, field.path, e.target.checked));
                              setDirty(true);
                            }}
                          />
                        ) : field.kind === "number" ? (
                          <input
                            id={fieldId}
                            data-testid={fieldId}
                            type="number"
                            value={typeof value === "number" ? value : 0}
                            onChange={(e) => {
                              setContent((prev) =>
                                setPath(prev, field.path, Number(e.target.value)),
                              );
                              setDirty(true);
                            }}
                          />
                        ) : (
                          <textarea
                            id={fieldId}
                            data-testid={fieldId}
                            rows={String(value).length > 80 ? 4 : 2}
                            maxLength={6000}
                            value={typeof value === "string" ? value : ""}
                            onChange={(e) => {
                              setContent((prev) => setPath(prev, field.path, e.target.value));
                              setDirty(true);
                            }}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </SectionPanel>
            );
          })}
        </div>
      </div>
      <div className="ve-actions">
        <button
          type="button"
          className="ve-btn"
          disabled={Boolean(busy) || !dirty}
          onClick={() => void submit("save")}
          data-testid={`vintage-${slot}-save`}
        >
          <Save size={16} aria-hidden /> Save draft
        </button>
        <button
          type="button"
          className="ve-btn ve-btn-primary"
          disabled={Boolean(busy)}
          onClick={() => void submit("publish")}
          data-testid={`vintage-${slot}-publish`}
        >
          <Upload size={16} aria-hidden /> Publish
        </button>
      </div>
      <VintageCmsTransferPanel />
      <BusyOverlay
        open={Boolean(busy)}
        message={busy === "publish" ? "Publishing…" : "Saving…"}
        testId={`vintage-${slot}-busy`}
      />
    </div>
  );
}
