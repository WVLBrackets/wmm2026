"use client";

import { useLayoutEffect, useRef } from "react";

/** Measure the real font width rather than relying on SVG textLength support. */
export default function VintageMasthead({
  first,
  second,
}: {
  first: string;
  second: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const line = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = heading.current;
    const text = line.current;
    if (!container || !text) return;
    let active = true;
    const fit = () => {
      if (!active || !text.offsetWidth) return;
      text.style.transform = `scaleX(${Math.min(1, container.clientWidth / text.offsetWidth)})`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    observer.observe(text);
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    fit();
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [first, second]);

  return (
    <h1 ref={heading} className="v-nameplate" data-testid="vintage-masthead">
      <span
        ref={line}
        className="v-nameplate-line"
        style={{ transform: "scaleX(0)" }}
      >
        <span className="v-nameplate-first">{first}</span>{" "}
        <span className="v-nameplate-second">{second}</span>
      </span>
    </h1>
  );
}
