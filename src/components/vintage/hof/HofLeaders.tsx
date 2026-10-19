"use client";

import { useId, useState } from "react";
import type {
  HofCareerLeader,
  HofSingleSeasonLeader,
} from "@/lib/hallOfFameStats";
import { formatHofDollars } from "@/lib/hallOfFameStats";
import type { VintageHofContent } from "@/lib/vintage/hofContent";
import { DEFAULT_VINTAGE_HOF_CONTENT } from "@/lib/vintage/hofContent";
import HofEditGear from "./HofEditGear";

const PREVIEW = 5;

/**
 * All-Time Leaders: Career Winnings + Single-Season Points with independent Top 25 toggles.
 */
export default function HofLeaders({
  career,
  singleSeason,
  copy = DEFAULT_VINTAGE_HOF_CONTENT,
  admin = false,
}: {
  career: HofCareerLeader[];
  singleSeason: HofSingleSeasonLeader[];
  copy?: VintageHofContent;
  admin?: boolean;
}) {
  return (
    <section
      className="v-hof-leaders"
      aria-labelledby="v-hof-leaders-heading"
      data-testid="vintage-hof-leaders"
    >
      {admin ? (
        <HofEditGear
          testId="vintage-hof-gear-leaders"
          label="Edit Hall of Fame titles"
        />
      ) : null}
      <h2
        id="v-hof-leaders-heading"
        className="v-hof-section-title v-hof-section-title-ink"
      >
        {copy.leadersHeading}
      </h2>
      <div className="v-hof-leaders-grid">
        <CareerTable rows={career} copy={copy} />
        <SingleSeasonTable rows={singleSeason} copy={copy} />
      </div>
    </section>
  );
}

/**
 * Career winnings table with expand control.
 */
function CareerTable({
  rows,
  copy,
}: {
  rows: HofCareerLeader[];
  copy: VintageHofContent;
}) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, PREVIEW);
  const canExpand = rows.length > PREVIEW;

  return (
    <div className="v-hof-leader-panel" data-testid="vintage-hof-career">
      <h3>{copy.careerHeading}</h3>
      <p className="v-hof-leader-sub">{copy.careerSubtitle}</p>
      <table className="v-hof-leader-table" id={panelId}>
        <caption className="v-hof-sr-only">Career winnings</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col">Winnings</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => {
            const years = row.finishes.slice(0, 5);
            const extra =
              row.finishes.length > 5
                ? ` +${row.finishes.length - 5}`
                : "";
            const fullYears = years.map((f) => f.year).join(" · ") + extra;
            const shortYears =
              years
                .map((f) => {
                  const y = f.year.trim();
                  return y.length >= 4 ? y.slice(-2) : y;
                })
                .join(" · ") + extra;
            return (
              <tr key={row.name}>
                <td className="v-hof-rank">{index + 1}</td>
                <td>
                  <div className="v-hof-leader-player">
                    <span className="v-hof-leader-name">{row.name}</span>
                    {years.length ? (
                      <>
                        <span className="v-hof-leader-meta v-hof-leader-meta-full">
                          {fullYears}
                        </span>
                        <span className="v-hof-leader-meta v-hof-leader-meta-short">
                          {shortYears}
                        </span>
                      </>
                    ) : null}
                  </div>
                </td>
                <td className="v-hof-leader-value">
                  {formatHofDollars(row.totalWinnings)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {canExpand ? (
        <ExpandButton
          testId="vintage-hof-career-toggle"
          expanded={expanded}
          panelId={panelId}
          onToggle={() => setExpanded((value) => !value)}
          expandLabel={copy.viewTop25Label}
          collapseLabel={copy.showTop5Label}
        />
      ) : null}
    </div>
  );
}

/**
 * Single-season points table with expand control.
 */
function SingleSeasonTable({
  rows,
  copy,
}: {
  rows: HofSingleSeasonLeader[];
  copy: VintageHofContent;
}) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, PREVIEW);
  const canExpand = rows.length > PREVIEW;

  return (
    <div
      className="v-hof-leader-panel"
      data-testid="vintage-hof-single-season"
    >
      <h3>{copy.singleSeasonHeading}</h3>
      <p className="v-hof-leader-sub">{copy.singleSeasonSubtitle}</p>
      <table className="v-hof-leader-table" id={panelId}>
        <caption className="v-hof-sr-only">Single-season points</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Year</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={`${row.name}-${row.year}-${row.place}`}>
              <td>
                <span className="v-hof-leader-name">{row.name}</span>
              </td>
              <td className="v-hof-leader-year">{row.year}</td>
              <td className="v-hof-leader-value">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canExpand ? (
        <ExpandButton
          testId="vintage-hof-single-season-toggle"
          expanded={expanded}
          panelId={panelId}
          onToggle={() => setExpanded((value) => !value)}
          expandLabel={copy.viewTop25Label}
          collapseLabel={copy.showTop5Label}
        />
      ) : null}
    </div>
  );
}

/**
 * Shared Top 5 / Top 25 toggle control.
 */
function ExpandButton({
  testId,
  expanded,
  panelId,
  onToggle,
  expandLabel,
  collapseLabel,
}: {
  testId: string;
  expanded: boolean;
  panelId: string;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <button
      type="button"
      className="v-hof-view-more"
      data-testid={testId}
      aria-expanded={expanded}
      aria-controls={panelId}
      onClick={onToggle}
    >
      {expanded ? collapseLabel : expandLabel}
    </button>
  );
}
