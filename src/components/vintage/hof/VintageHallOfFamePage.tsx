import Image from "next/image";
import type { VintageContent } from "@/lib/vintage/content";
import type { HofViewModel } from "@/lib/hallOfFameStats";
import { formatHofDollars } from "@/lib/hallOfFameStats";
import type { VintageHofContent } from "@/lib/vintage/hofContent";
import { DEFAULT_VINTAGE_HOF_CONTENT } from "@/lib/vintage/hofContent";
import VintageShell from "../VintageShell";
import HofSeasonArchive from "./HofSeasonArchive";
import HofLeaders from "./HofLeaders";
import HofEditGear from "./HofEditGear";
import "./hof.css";

const HOF_CHAMPION_TROPHY = "/vintage/hof-champion-trophy.png";

/**
 * Vintage Hall of Fame body inside shared chrome.
 */
export default function VintageHallOfFamePage({
  model,
  home,
  copy = DEFAULT_VINTAGE_HOF_CONTENT,
  draft = false,
  admin = false,
}: {
  model: HofViewModel;
  home: VintageContent;
  copy?: VintageHofContent;
  draft?: boolean;
  admin?: boolean;
}) {
  const champ = model.reigningChampion;

  const metaParts: string[] = [];
  if (champ?.points != null) metaParts.push(`${champ.points} points`);
  if (champ?.entryCount != null) {
    metaParts.push(`${champ.entryCount.toLocaleString()} entries`);
  }

  return (
    <VintageShell
      content={home}
      draft={draft}
      draftReturnHref="/vintage/admin/hof"
      testId="vintage-hof-page"
    >
      <div className="v-hof" data-testid="vintage-hof">
        <header className="v-hof-intro">
          {admin ? (
            <HofEditGear
              testId="vintage-hof-gear-intro"
              label="Edit Hall of Fame titles"
            />
          ) : null}
          <h1 data-testid="vintage-hof-heading">{copy.heading}</h1>
          <p className="v-hof-supporting">{copy.supporting}</p>
        </header>

        <section
          className="v-hof-reigning"
          aria-labelledby="v-hof-reigning-label"
          data-testid="vintage-hof-reigning"
        >
          {admin ? (
            <HofEditGear
              testId="vintage-hof-gear-reigning"
              label="Edit Hall of Fame titles"
            />
          ) : null}
          <div className="v-hof-reigning-copy">
            <p id="v-hof-reigning-label" className="v-hof-reigning-label">
              {copy.reigningLabel}
            </p>
            <h2 className="v-hof-reigning-name">
              {champ?.name || "Champion TBD"}
            </h2>
            {metaParts.length ? (
              <p className="v-hof-reigning-meta">{metaParts.join(" · ")}</p>
            ) : null}
          </div>
          {champ?.year ? (
            <div className="v-hof-reigning-emblem">
              <Image
                src={HOF_CHAMPION_TROPHY}
                alt=""
                width={120}
                height={120}
                className="v-hof-reigning-trophy"
                data-testid="vintage-hof-reigning-trophy"
                priority
              />
              <span className="v-hof-reigning-year">{champ.year}</span>
            </div>
          ) : null}
        </section>

        <section
          className="v-hof-lifetime"
          aria-label="Lifetime statistics"
          data-testid="vintage-hof-lifetime"
        >
          <Stat
            value={String(model.lifetime.tournamentsCompleted)}
            label="Tournaments Completed"
          />
          <Stat
            value={String(model.lifetime.uniqueMoneyWinners)}
            label="Unique Money Winners"
          />
          <Stat
            value={
              model.lifetime.totalEntries != null
                ? model.lifetime.totalEntries.toLocaleString()
                : "—"
            }
            label="Total Entries"
          />
          <Stat
            value={
              model.lifetime.totalPrizeDollars != null
                ? formatHofDollars(model.lifetime.totalPrizeDollars)
                : "—"
            }
            label="Total Prize Dollars"
          />
        </section>

        <HofSeasonArchive seasons={model.seasons} copy={copy} admin={admin} />
        <HofLeaders
          career={model.careerLeaders}
          singleSeason={model.singleSeasonLeaders}
          copy={copy}
          admin={admin}
        />

        <p className="v-hof-closing">{copy.closing}</p>
      </div>
    </VintageShell>
  );
}

/**
 * One lifetime statistic cell.
 */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="v-hof-stat">
      <p className="v-hof-stat-value">{value}</p>
      <p className="v-hof-stat-label">{label}</p>
    </div>
  );
}
