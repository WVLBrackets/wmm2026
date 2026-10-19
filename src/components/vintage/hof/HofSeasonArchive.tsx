"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { HofSeasonCard } from "@/lib/hallOfFameStats";
import type { VintageHofContent } from "@/lib/vintage/hofContent";
import { DEFAULT_VINTAGE_HOF_CONTENT } from "@/lib/vintage/hofContent";
import HofSeasonCardView from "./HofSeasonCardView";
import HofEditGear from "./HofEditGear";

const INITIAL_VISIBLE = 6;

/**
 * Champions-by-year grid with Show More / Show Fewer.
 */
export default function HofSeasonArchive({
  seasons,
  copy = DEFAULT_VINTAGE_HOF_CONTENT,
  admin = false,
}: {
  seasons: HofSeasonCard[];
  copy?: VintageHofContent;
  admin?: boolean;
}) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(false);
  const visible = expanded ? seasons : seasons.slice(0, INITIAL_VISIBLE);
  const canExpand = seasons.length > INITIAL_VISIBLE;

  useEffect(() => {
    // Only restore scroll/focus when collapsing after the user expanded —
    // never on initial mount (that jumped the page to Show More Years).
    if (expanded) {
      wasExpanded.current = true;
      return;
    }
    if (!wasExpanded.current || !sectionRef.current) return;
    wasExpanded.current = false;
    const headerOffset = 100;
    const top =
      sectionRef.current.getBoundingClientRect().top +
      window.scrollY -
      headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    toggleRef.current?.focus();
  }, [expanded]);

  return (
    <section
      ref={sectionRef}
      className="v-hof-archive"
      aria-labelledby="v-hof-archive-heading"
      data-testid="vintage-hof-archive"
    >
      {admin ? (
        <HofEditGear
          testId="vintage-hof-gear-archive"
          label="Edit Hall of Fame titles"
        />
      ) : null}
      <h2 id="v-hof-archive-heading" className="v-hof-section-title">
        {copy.archiveHeading}
      </h2>
      <ul className="v-hof-season-grid" id={panelId}>
        {visible.map((season) => (
          <li key={season.year}>
            <HofSeasonCardView season={season} />
          </li>
        ))}
      </ul>
      {canExpand ? (
        <div className="v-hof-archive-actions">
          <button
            ref={toggleRef}
            type="button"
            className="v-hof-expand-btn"
            data-testid="vintage-hof-years-toggle"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <>
                {copy.showFewerLabel}{" "}
                <ChevronUp size={16} aria-hidden="true" />
              </>
            ) : (
              <>
                {copy.showMoreLabel}{" "}
                <ChevronDown size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}
