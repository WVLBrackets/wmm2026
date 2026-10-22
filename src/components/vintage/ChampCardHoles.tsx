"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import CardFooterCaption from "./CardFooterCaption";

/** Site-wide line-break token for champ name (same as captions). */
const NAME_BREAK = "||";

/** One candidate line-break layout for the champ name. */
type NameLayout = {
  lines: string[];
  /** Prefer larger type; then more balanced line widths. */
  balance: number;
};

/**
 * Normalize a champ name into uppercase word tokens.
 */
function champWords(name: string): string[] {
  return name
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Parse authored `||` breaks into fixed lines (max three for the name hole).
 */
function parseExplicitNameLines(raw: string): string[] | null {
  const upper = raw.trim().toUpperCase();
  if (!upper.includes(NAME_BREAK)) return null;
  const parts = upper
    .split(NAME_BREAK)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (!parts.length) return [""];
  if (parts.length === 1) return [parts[0]];
  if (parts.length === 2) return parts;
  return [parts[0], parts[1], parts.slice(2).join(" ")];
}

/**
 * Build 1–3 line layouts from word tokens (all sensible split points).
 */
function candidateLayouts(words: string[]): NameLayout[] {
  if (!words.length) return [{ lines: [""], balance: 0 }];
  if (words.length === 1) return [{ lines: [words[0]], balance: 0 }];

  const layouts: NameLayout[] = [];
  const joined = words.join(" ");
  layouts.push({ lines: [joined], balance: 0 });

  /**
   * Score how evenly line character counts balance (lower is better).
   */
  function balanceScore(lines: string[]): number {
    const lengths = lines.map((line) => line.length);
    const max = Math.max(...lengths);
    const min = Math.min(...lengths);
    return max - min + lengths.reduce((sum, n) => sum + Math.abs(n - max), 0) * 0.15;
  }

  for (let i = 1; i < words.length; i += 1) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    layouts.push({ lines, balance: balanceScore(lines) });
  }

  if (words.length >= 3) {
    for (let i = 1; i < words.length - 1; i += 1) {
      for (let j = i + 1; j < words.length; j += 1) {
        const lines = [
          words.slice(0, i).join(" "),
          words.slice(i, j).join(" "),
          words.slice(j).join(" "),
        ];
        layouts.push({ lines, balance: balanceScore(lines) });
      }
    }
  }

  if (words.length === 1 && words[0].length >= 10) {
    const token = words[0];
    const mid = Math.ceil(token.length / 2);
    layouts.push({
      lines: [token.slice(0, mid), token.slice(mid)],
      balance: 8,
    });
  }

  return layouts;
}

/**
 * Measure text width with the headline face at a given size.
 */
function measureLineWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
): number {
  ctx.font = `400 ${fontSize}px "Alfa Slab One", Georgia, serif`;
  return ctx.measureText(text).width;
}

/**
 * Pick the largest font size + line break that fits the name hole.
 * Explicit `||` locks the line breaks; otherwise auto-fit 1–3 lines.
 */
function fitChampNameLayout(
  name: string,
  boxWidth: number,
  boxHeight: number,
): { lines: string[]; fontSize: number } {
  const explicit = parseExplicitNameLines(name);
  const words = champWords(name.replace(/\|\|/g, " "));
  const fallback = {
    lines: explicit ?? (words.length ? [words.join(" ")] : [""]),
    fontSize: 18,
  };
  if (!boxWidth || !boxHeight) return fallback;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;

  const layouts: NameLayout[] = explicit
    ? [{ lines: explicit, balance: 0 }]
    : candidateLayouts(words);
  const lineHeight = 0.9;
  // ~10% larger than the original fit scale.
  const maxPx = Math.min(75, Math.max(35, boxWidth * 0.53));
  const minPx = 12;

  type Candidate = {
    lines: string[];
    fontSize: number;
    lineCount: number;
    balance: number;
  };
  const fittedLayouts: Candidate[] = [];

  for (const layout of layouts) {
    const lineCount = layout.lines.length;
    const heightCap = boxHeight / (lineCount * lineHeight + 0.08);
    let lo = minPx;
    let hi = Math.min(maxPx, heightCap);
    if (hi < lo) continue;

    let fitted = minPx;
    for (let i = 0; i < 16; i += 1) {
      const mid = (lo + hi) / 2;
      const tooWide = layout.lines.some(
        (line) => measureLineWidth(ctx, line, mid) > boxWidth - 2,
      );
      const tooTall = lineCount * mid * lineHeight > boxHeight - 2;
      if (tooWide || tooTall) hi = mid;
      else {
        fitted = mid;
        lo = mid;
      }
    }

    fittedLayouts.push({
      lines: layout.lines,
      fontSize: fitted,
      lineCount,
      balance: layout.balance,
    });
  }

  if (!fittedLayouts.length) return fallback;

  if (explicit) {
    const winner = fittedLayouts[0];
    return {
      lines: winner.lines,
      fontSize: Math.floor(winner.fontSize * 10) / 10,
    };
  }

  const bestOne = Math.max(
    0,
    ...fittedLayouts.filter((item) => item.lineCount === 1).map((item) => item.fontSize),
  );
  const bestTwo = Math.max(
    0,
    ...fittedLayouts.filter((item) => item.lineCount === 2).map((item) => item.fontSize),
  );
  const twoLineComfortable = Math.min(20, boxWidth * 0.125);
  const oneLineComfortable = Math.min(26, boxWidth * 0.175);

  let pool = fittedLayouts;
  if (bestOne >= oneLineComfortable) {
    pool = fittedLayouts.filter((item) => item.lineCount === 1);
  } else if (bestTwo >= twoLineComfortable) {
    pool = fittedLayouts.filter((item) => item.lineCount <= 2);
  }

  pool.sort(
    (a, b) =>
      b.fontSize - a.fontSize ||
      a.lineCount - b.lineCount ||
      a.balance - b.balance,
  );
  const winner = pool[0] ?? fittedLayouts[0];

  return {
    lines: winner.lines,
    fontSize: Math.floor(winner.fontSize * 10) / 10,
  };
}

/**
 * Grow/shrink + re-break the champ name to fill its hole flexibly.
 */
function useFitChampName(
  containerRef: RefObject<HTMLParagraphElement | null>,
  name: string,
  setLines: Dispatch<SetStateAction<string[]>>,
) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let active = true;

    /**
     * Recompute line breaks and font size from the hole’s box.
     */
    const fit = () => {
      if (!active) return;
      const next = fitChampNameLayout(name, el.clientWidth, el.clientHeight);
      setLines((previous) => {
        if (
          previous.length === next.lines.length &&
          previous.every((line, index) => line === next.lines[index])
        ) {
          return previous;
        }
        return next.lines;
      });
      el.style.fontSize = `${next.fontSize}px`;
      el.style.letterSpacing =
        next.fontSize >= 28 ? "-0.55px" : next.fontSize >= 18 ? "-0.25px" : "0px";
      el.dataset.lines = String(next.lines.length);
    };

    const observer = new ResizeObserver(fit);
    observer.observe(el);
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    fit();
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [containerRef, name, setLines]);
}

/**
 * Locked straight-slab year centered on the wreath.
 */
function ChampYearMark({ year }: { year: string }) {
  return (
    <span
      className="v-card-champ-year v-card-champ-year--straight"
      data-testid="vintage-champ-year"
    >
      <span className="v-card-champ-year-inner">{year}</span>
    </span>
  );
}

/**
 * Text holes for the Reigning Champ master: fitted name, year, CTA motto.
 */
export default function ChampCardHoles({
  name,
  year,
  motto,
}: {
  name: string;
  year: string;
  motto: string;
}) {
  const displayName = name.trim() || "CHAMPION";
  const nameRef = useRef<HTMLParagraphElement>(null);
  const [lines, setLines] = useState(() => [
    displayName.toUpperCase().replace(/\|\|/g, " ").replace(/\s+/g, " ").trim(),
  ]);
  useFitChampName(nameRef, displayName, setLines);

  return (
    <div className="v-card-champ-holes">
      <p
        ref={nameRef}
        className="v-card-champ-name"
        data-testid="vintage-champ-name"
      >
        {lines.map((line, index) => (
          <span key={`${index}-${line}`}>{line}</span>
        ))}
      </p>
      {year ? <ChampYearMark year={year} /> : null}
      {motto ? (
        <CardFooterCaption
          text={motto}
          className="v-card-champ-motto"
          testId="vintage-champ-motto"
        />
      ) : null}
    </div>
  );
}
