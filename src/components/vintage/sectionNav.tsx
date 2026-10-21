"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** One entry in a sticky section rail. */
export type VintageEditorSection = {
  /** DOM id of the stacked panel (e.g. `ve-section-masthead`). */
  id: string;
  /** Visible label in the left rail. */
  label: string;
};

/**
 * Build a stable DOM id for a stacked editor section from its label.
 *
 * @param label - Human label, e.g. "Toolbar & theme".
 * @param prefix - Id prefix (defaults to `ve-section`).
 * @returns Slugified id such as `ve-section-toolbar-and-theme`.
 */
export function sectionDomId(label: string, prefix = "ve-section"): string {
  const slug = label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}-${slug}`;
}

/**
 * Track which stacked section is current (scroll-spy) and jump to sections.
 *
 * Uses an IntersectionObserver band near the top of the viewport. Clicking a
 * rail item sets the active id immediately and briefly ignores observer
 * updates so smooth scrolling does not flicker the highlight.
 *
 * @param ids - Ordered section DOM ids (document order).
 * @param enabled - Set true once the section elements are mounted.
 * @returns `activeId`, `jumpTo(id)` to scroll + activate, and `markActive(id)`
 *   to highlight a section without scrolling (used by deep-link focus).
 */
export function useSectionNav(ids: readonly string[], enabled: boolean) {
  const [activeId, setActiveId] = useState(ids[0] ?? "");
  const lockUntil = useRef(0);
  const idsKey = ids.join("|");

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const order = idsKey ? idsKey.split("|") : [];
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        if (Date.now() < lockUntil.current) return;
        const first = order.find((id) => visible.has(id));
        if (first) setActiveId(first);
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: 0 },
    );
    for (const id of order) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    /** Highlight the last section once the page is scrolled to the bottom. */
    const onScroll = () => {
      if (Date.now() < lockUntil.current || order.length === 0) return;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) setActiveId(order[order.length - 1]);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled, idsKey]);

  /**
   * Highlight a section in the rail without scrolling.
   */
  const markActive = useCallback((id: string) => {
    lockUntil.current = Date.now() + 1200;
    setActiveId(id);
  }, []);

  /**
   * Smooth-scroll to a section and mark it active.
   */
  const jumpTo = useCallback((id: string) => {
    markActive(id);
    const el = document.getElementById(id);
    if (!el) return;
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [markActive]);

  return { activeId, jumpTo, markActive };
}

/**
 * Sticky left rail of section jump buttons (keeps the `.ve-tabs` styling).
 *
 * @param props.sections - Ordered sections to list.
 * @param props.activeId - Currently highlighted section id.
 * @param props.onJump - Called with a section id when a rail item is clicked.
 * @param props.ariaLabel - Accessible name for the nav landmark.
 * @param props.testIdPrefix - Buttons get `data-testid="{prefix}-{index}"`.
 */
export function SectionRail({
  sections,
  activeId,
  onJump,
  ariaLabel,
  testIdPrefix,
}: {
  sections: readonly VintageEditorSection[];
  activeId: string;
  onJump: (id: string) => void;
  ariaLabel: string;
  testIdPrefix: string;
}) {
  return (
    <nav className="ve-tabs" aria-label={ariaLabel}>
      {sections.map((section, i) => (
        <button
          key={section.id}
          type="button"
          aria-current={activeId === section.id ? "page" : undefined}
          data-testid={`${testIdPrefix}-${i}`}
          onClick={() => onJump(section.id)}
        >
          <span>{String(i + 1).padStart(2, "0")}</span>
          {section.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * One stacked editor section (replaces the old single swapped panel).
 *
 * @param props.id - Stable DOM id used by the rail and deep links.
 * @param props.title - Section heading (also drives the eyebrow text).
 * @param props.disabled - Disables nested controls (e.g. while saving).
 * @param props.children - Section body.
 */
export function SectionPanel({
  id,
  title,
  disabled,
  children,
}: {
  id: string;
  title: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      id={id}
      className="ve-panel ve-section"
      aria-label={title}
      disabled={disabled}
      data-testid={id}
    >
      <p className="ve-eyebrow">THE {title.toUpperCase()}</p>
      <h2>{title}</h2>
      {children}
    </fieldset>
  );
}
