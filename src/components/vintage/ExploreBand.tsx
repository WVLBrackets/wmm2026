"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Star, Trophy } from "lucide-react";
import type { VintageExploreBand } from "@/lib/vintage/content";
import VintageEditGear from "./VintageEditGear";

/**
 * One explore panel: icon, headline, body, and CTA link.
 */
function ExplorePanel({
  panelKey,
  headline,
  body,
  ctaLabel,
  ctaHref,
  icon,
}: {
  panelKey: "info" | "hall";
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  icon: ReactNode;
}) {
  const href = ctaHref.trim() || (panelKey === "info" ? "/info" : "/hall-of-fame");
  return (
    <article
      className={`v-explore-panel v-explore-panel-${panelKey}`}
      data-testid={`vintage-explore-${panelKey}`}
    >
      <div className="v-explore-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="v-explore-copy">
        <h3>{headline}</h3>
        <p>{body}</p>
        <Link
          href={href}
          className="v-explore-cta"
          data-testid={`vintage-explore-${panelKey}-cta`}
        >
          {ctaLabel} <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

/**
 * Wide band under the main home cards: Info + Hall of Fame (stacks on mobile).
 */
export default function ExploreBand({
  band,
  admin = false,
}: {
  band: VintageExploreBand;
  admin?: boolean;
}) {
  if (!band.enabled) return null;

  return (
    <section
      className="v-explore-band"
      aria-label="Explore the pool"
      data-testid="vintage-explore-band"
    >
      {admin ? (
        <VintageEditGear
          focus={{ kind: "explore" }}
          testId="vintage-edit-gear-explore"
          label="Edit explore band"
        />
      ) : null}
      <ExplorePanel
        panelKey="info"
        headline={band.info.headline}
        body={band.info.body}
        ctaLabel={band.info.ctaLabel}
        ctaHref={band.info.ctaHref}
        icon={<BookOpen size={36} strokeWidth={1.6} />}
      />
      <ExplorePanel
        panelKey="hall"
        headline={band.hall.headline}
        body={band.hall.body}
        ctaLabel={band.hall.ctaLabel}
        ctaHref={band.hall.ctaHref}
        icon={
          <span className="v-explore-trophy">
            <Trophy size={36} strokeWidth={1.6} />
            <Star
              className="v-explore-trophy-star"
              size={12}
              strokeWidth={0}
              fill="currentColor"
              aria-hidden="true"
            />
          </span>
        }
      />
    </section>
  );
}
