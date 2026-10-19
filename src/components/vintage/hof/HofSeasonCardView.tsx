import { Calendar, Pause } from "lucide-react";
import TeamLogo from "@/app/hall-of-fame/TeamLogo";
import type { HofSeasonCard } from "@/lib/hallOfFameStats";

/**
 * NCAA champion label + team name (single line) + logo.
 */
function NcaaChampionBlock({ team }: { team: string }) {
  return (
    <div className="v-hof-ncaa">
      <div className="v-hof-ncaa-copy">
        <span className="v-hof-ncaa-label">NCAA Champion</span>
        <span className="v-hof-ncaa-team">{team}</span>
      </div>
      <div className="v-hof-ncaa-logo">
        <TeamLogo teamName={team} size={40} />
      </div>
    </div>
  );
}

/**
 * One Champions-by-Year card (normal or specialty), fixed outer footprint via CSS.
 */
export default function HofSeasonCardView({
  season,
}: {
  season: HofSeasonCard;
}) {
  if (season.kind === "cancelled2020") {
    return (
      <article
        className="v-hof-season-card v-hof-season-special"
        data-testid={`vintage-hof-season-${season.year}`}
      >
        <p className="v-hof-season-year">{season.year}</p>
        <div className="v-hof-season-special-body">
          <span className="v-hof-special-icon" aria-hidden="true">
            <Pause size={28} strokeWidth={2.2} />
          </span>
          <h3>Tournament Cancelled</h3>
          <p className="v-hof-special-note">Global pandemic.</p>
        </div>
      </article>
    );
  }

  if (season.kind === "hiatus2016" || season.kind === "hiatus") {
    return (
      <article
        className="v-hof-season-card v-hof-season-special"
        data-testid={`vintage-hof-season-${season.year}`}
      >
        <div className="v-hof-season-head">
          <p className="v-hof-season-year">{season.year}</p>
          {season.ncaaChampionTeam ? (
            <NcaaChampionBlock team={season.ncaaChampionTeam} />
          ) : null}
        </div>
        <div className="v-hof-season-special-body">
          <span className="v-hof-special-icon" aria-hidden="true">
            <Calendar size={28} strokeWidth={1.8} />
          </span>
          <h3>{season.kind === "hiatus2016" ? "WMM Hiatus" : "Tournament Not Held"}</h3>
          <p className="v-hof-special-note">
            {season.kind === "hiatus2016"
              ? "No WMM competition held."
              : "Tournament not held."}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article
      className="v-hof-season-card"
      data-testid={`vintage-hof-season-${season.year}`}
    >
      <div className="v-hof-season-head">
        <div>
          <p className="v-hof-season-year">{season.year}</p>
          {season.entryCount != null ? (
            <p className="v-hof-season-entries">
              {season.entryCount.toLocaleString()} entries
            </p>
          ) : null}
        </div>
        {season.ncaaChampionTeam ? (
          <NcaaChampionBlock team={season.ncaaChampionTeam} />
        ) : null}
      </div>
      <ol className="v-hof-finishers">
        {season.finishers.map((finisher) => (
          <li key={`${season.year}-${finisher.place}`}>
            <span className="v-hof-finisher-place" aria-label={`${finisher.place}`}>
              {finisher.place}
            </span>
            <span className="v-hof-finisher-name">{finisher.name}</span>
            <span className="v-hof-finisher-pts">
              {finisher.points > 0 ? finisher.points : "—"}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
