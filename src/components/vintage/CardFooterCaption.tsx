"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

/** Site-wide line-break token for vintage card footer captions (max two lines). */
export const FOOTER_CAPTION_BREAK = "||";

/**
 * Normalize caption copy: trim, ALL CAPS, and split on `||` into at most two lines.
 * Without `||`, returns a single line (word-wrap decisions happen at fit time).
 */
export function parseFooterCaptionLines(raw: string): string[] {
  const upper = raw.trim().toUpperCase();
  if (!upper) return [];
  if (!upper.includes(FOOTER_CAPTION_BREAK)) return [upper];

  const parts = upper
    .split(FOOTER_CAPTION_BREAK)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return parts.length ? [parts[0]] : [];
  // Never more than two lines — fold extras onto the second line.
  return [parts[0], parts.slice(1).join(" ")];
}

/**
 * Candidate layouts when the author did not set an explicit `||` break.
 * Prefers one line; offers balanced two-line splits as fallback.
 */
function autoCaptionLayouts(singleLine: string): string[][] {
  const words = singleLine.split(/\s+/).filter(Boolean);
  if (!words.length) return [[""]];
  if (words.length === 1) return [[words[0]]];

  const layouts: string[][] = [[words.join(" ")]];
  for (let i = 1; i < words.length; i += 1) {
    layouts.push([words.slice(0, i).join(" "), words.slice(i).join(" ")]);
  }
  return layouts;
}

/**
 * Measure Oswald Bold caption width at a given size.
 */
function measureCaptionWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
): number {
  ctx.font = `700 ${fontSize}px Oswald, Impact, sans-serif`;
  return ctx.measureText(text).width;
}

/**
 * Fit caption into the footer hole.
 * Explicit `||` → fixed two (or one) lines. Otherwise prefer one tall line
 * (Play Now / Champ / Excel one-line scale); drop to two smaller lines only if needed.
 */
function fitCaptionLayout(
  lines: string[],
  explicitBreak: boolean,
  boxWidth: number,
  boxHeight: number,
): { lines: string[]; fontSize: number } {
  const fallback = {
    lines: lines.length ? lines : [""],
    fontSize: 14,
  };
  if (!boxWidth || !boxHeight || !lines.length) return fallback;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;

  const lineHeight = 1.08;
  // One-line scale ≈ header-bar caps on the master plates.
  const oneMax = Math.min(28, Math.max(18, boxWidth * 0.078));
  const twoMax = Math.min(20, Math.max(13, boxWidth * 0.055));
  const minPx = 11;

  /**
   * Binary-search the largest font size that fits the given lines in the hole.
   */
  function bestSizeFor(candidate: string[], maxPx: number): number {
    const heightCap = boxHeight / (candidate.length * lineHeight + 0.04);
    let lo = minPx;
    let hi = Math.min(maxPx, heightCap);
    if (hi < lo) return minPx;

    let best = minPx;
    for (let i = 0; i < 16; i += 1) {
      const mid = (lo + hi) / 2;
      const tooWide = candidate.some(
        (line) => measureCaptionWidth(ctx!, line, mid) > boxWidth - 6,
      );
      const tooTall = candidate.length * mid * lineHeight > boxHeight - 2;
      if (tooWide || tooTall) hi = mid;
      else {
        best = mid;
        lo = mid;
      }
    }
    return Math.floor(best * 10) / 10;
  }

  if (explicitBreak || lines.length === 2) {
    const size = bestSizeFor(lines, lines.length === 1 ? oneMax : twoMax);
    return { lines, fontSize: size };
  }

  // Single authored line — prefer one-line Play Now scale; fallback to 2 lines.
  const layouts = autoCaptionLayouts(lines[0]);
  let bestOne: { lines: string[]; fontSize: number } | null = null;
  let bestTwo: { lines: string[]; fontSize: number } | null = null;

  for (const layout of layouts) {
    const size = bestSizeFor(
      layout,
      layout.length === 1 ? oneMax : twoMax,
    );
    if (layout.length === 1) {
      if (!bestOne || size > bestOne.fontSize) {
        bestOne = { lines: layout, fontSize: size };
      }
    } else if (!bestTwo || size > bestTwo.fontSize) {
      bestTwo = { lines: layout, fontSize: size };
    }
  }

  const oneComfortable = Math.min(16, boxWidth * 0.042);
  if (bestOne && bestOne.fontSize >= oneComfortable) return bestOne;
  return bestTwo ?? bestOne ?? fallback;
}

/**
 * Fit caption text into a footer hole (1 or 2 lines) whenever size/copy changes.
 */
function useFitFooterCaption(
  containerRef: RefObject<HTMLParagraphElement | null>,
  lines: string[],
  explicitBreak: boolean,
  setFittedLines: Dispatch<SetStateAction<string[]>>,
) {
  const linesKey = lines.join("\n");

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let active = true;
    const sourceLines = linesKey ? linesKey.split("\n") : [];

    /**
     * Recompute line breaks and font size for the footer hole.
     */
    const fit = () => {
      if (!active) return;
      const next = fitCaptionLayout(
        sourceLines,
        explicitBreak,
        el.clientWidth,
        el.clientHeight,
      );
      setFittedLines((previous) => {
        if (
          previous.length === next.lines.length &&
          previous.every((line, index) => line === next.lines[index])
        ) {
          return previous;
        }
        return next.lines;
      });
      el.style.fontSize = `${next.fontSize}px`;
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
  }, [containerRef, linesKey, explicitBreak, setFittedLines]);
}

/**
 * Shared home-card footer caption (Play Now, Champ, Excel, future locked plates).
 * Always ALL CAPS Oswald Bold; `||` = hard line break (max two lines).
 * Hole geometry is shared in CSS so all three cards stay consistent.
 */
export default function CardFooterCaption({
  text,
  className,
  testId,
}: {
  text: string;
  className: string;
  testId?: string;
}) {
  const explicitBreak = text.includes(FOOTER_CAPTION_BREAK);
  const parsed = parseFooterCaptionLines(text);
  const ref = useRef<HTMLParagraphElement>(null);
  const [fittedLines, setFittedLines] = useState(parsed);
  useFitFooterCaption(ref, parsed, explicitBreak, setFittedLines);

  if (!parsed.length) return null;

  return (
    <p
      ref={ref}
      className={`v-card-footer-caption ${className}`}
      data-testid={testId}
      data-lines={String(fittedLines.length)}
    >
      {fittedLines.map((line, index) => (
        <span key={`${index}-${line}`}>{line}</span>
      ))}
    </p>
  );
}
