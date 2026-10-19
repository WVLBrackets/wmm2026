import type { VintageContent } from "@/lib/vintage/content";
import VintageCountdown from "./VintageCountdown";
import HomeCardGrid from "./HomeCardGrid";
import ExploreBand from "./ExploreBand";
import AnnouncementBoard from "./AnnouncementBoard";
import VintageEditGear from "./VintageEditGear";
import VintageShell from "./VintageShell";

/**
 * Primary-admin vintage newspaper homepage.
 */
export default function VintageHomepage({
  content: c,
  draft = false,
  admin = false,
}: {
  content: VintageContent;
  draft?: boolean;
  /** When true (primary vintage admin), show edit gears on countdown + cards. */
  admin?: boolean;
}) {
  return (
    <VintageShell
      content={c}
      draft={draft}
      draftReturnHref="/vintage/admin"
      testId="vintage-homepage"
    >
      <section
        className="v-countdown-section"
        aria-labelledby={
          c.tournament.countdownEnabled
            ? "v-countdown-heading"
            : "v-live-tourney-message"
        }
        data-testid="vintage-countdown-section"
      >
        {admin ? (
          <VintageEditGear
            focus={{ kind: "countdown" }}
            testId="vintage-edit-gear-countdown"
            label="Edit tipoff countdown"
          />
        ) : null}
        {c.tournament.countdownEnabled ? (
          <>
            <h2 id="v-countdown-heading">
              {c.tournament.countdownTitle.trim() || "Countdown to tipoff"}
            </h2>
            <VintageCountdown
              at={c.tournament.countdownAt}
              liveMessage={c.tournament.liveTourneyMessage}
            />
          </>
        ) : (
          <p
            id="v-live-tourney-message"
            className="v-live-tourney-message"
            data-testid="vintage-live-tourney-message"
          >
            {c.tournament.liveTourneyMessage.trim() ||
              "The tournament is underway!"}
          </p>
        )}
      </section>
      <HomeCardGrid content={c} admin={admin} />
      <ExploreBand band={c.exploreBand} admin={admin} />
      <AnnouncementBoard board={c.announcementBoard} admin={admin} />
    </VintageShell>
  );
}
