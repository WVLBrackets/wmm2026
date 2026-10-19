import Link from "next/link";
import type { VintageContent, VintageHomeCard } from "@/lib/vintage/content";
import {
  CHAMP_MASTER_SRC,
  excelCardVariant,
  excelPlateSrc,
  formatExcelComingSoonAt,
  PLAY_NOW_MASTER_SRC,
} from "@/lib/vintage/homeCards";
import CardFooterCaption from "./CardFooterCaption";
import ChampCardHoles from "./ChampCardHoles";
import VintageEditGear from "./VintageEditGear";

/**
 * Resolve Play Now art: CMS upload when set, otherwise the bundled master.
 */
function playNowImageSrc(card: VintageHomeCard): string {
  const custom = card.playImageSrc?.trim();
  return custom || PLAY_NOW_MASTER_SRC;
}

/**
 * Resolve Champ art: CMS upload when set, otherwise the bundled master.
 */
function champImageSrc(card: VintageHomeCard): string {
  const custom = card.champImageSrc?.trim();
  return custom || CHAMP_MASTER_SRC;
}

/**
 * Play Now — master art + shared footer caption hole (caption not baked in).
 */
function PlayNowCard({ card }: { card: VintageHomeCard }) {
  const href = card.playHref || "/auth/signin";
  const src = playNowImageSrc(card);
  const caption = card.playCtaLabel.trim();
  const ariaLabel = caption
    ? `Play now — ${caption.replace(/\|\|/g, " ").replace(/\s+/g, " ").trim()}`
    : "Play now";

  return (
    <article
      className={
        caption
          ? "v-home-card v-card-play"
          : "v-home-card v-card-play v-card-play-no-caption"
      }
      data-testid={`vintage-card-${card.id}`}
    >
      <Link
        href={href}
        className="v-card-play-frame"
        aria-label={ariaLabel}
        data-testid={`vintage-card-play-${card.id}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- design card asset */}
        <img
          className="v-card-play-plate"
          src={src}
          alt=""
          draggable={false}
        />
        {caption ? (
          <CardFooterCaption
            text={caption}
            className="v-card-play-caption"
            testId={`vintage-play-caption-${card.id}`}
          />
        ) : null}
      </Link>
    </article>
  );
}

/**
 * Reigning Champ — exact master art + three text holes (name, year, motto).
 */
function ReigningChampCard({ card }: { card: VintageHomeCard }) {
  const name = (card.champName || "CHAMPION").trim();
  const year = (card.champYear || "").trim();
  const motto = card.champMotto.trim();
  const src = champImageSrc(card);

  return (
    <article
      className={
        motto
          ? "v-home-card v-card-champ"
          : "v-home-card v-card-champ v-card-champ-no-motto"
      }
      data-testid={`vintage-card-${card.id}`}
    >
      <div
        className="v-card-champ-frame"
        data-testid={`vintage-card-champ-${card.id}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- design card asset */}
        <img
          className="v-card-champ-plate"
          src={src}
          alt=""
          draggable={false}
        />
        <ChampCardHoles name={name} year={year} motto={motto} />
      </div>
    </article>
  );
}

/**
 * Excel Downloads — scenario plate + caption / coming-soon dates / download hotspots.
 */
function ExcelDownloadsCard({ card }: { card: VintageHomeCard }) {
  const picksHref = card.excelPicksHref.trim();
  const trackerHref = card.excelTrackerHref.trim();
  const variant = excelCardVariant(card);
  const src = excelPlateSrc(card);
  const caption = card.excelCaption.trim();
  const picksDate =
    !picksHref && card.excelPicksAvailableAt.trim()
      ? formatExcelComingSoonAt(card.excelPicksAvailableAt)
      : "";
  const trackerDate =
    !trackerHref && card.excelTrackerAvailableAt.trim()
      ? formatExcelComingSoonAt(card.excelTrackerAvailableAt)
      : "";

  return (
    <article
      className="v-home-card v-card-excel"
      data-testid={`vintage-card-${card.id}`}
    >
      <div
        className="v-card-excel-frame"
        data-testid={`vintage-card-excel-${card.id}`}
        data-excel-variant={variant}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- design card asset */}
        <img
          className="v-card-excel-plate"
          src={src}
          alt="Excel downloads"
          draggable={false}
        />
        <div className="v-card-excel-holes">
          {picksHref ? (
            <a
              className="v-card-excel-hotspot v-card-excel-hotspot-picks"
              href={picksHref}
              data-testid={`vintage-card-excel-picks-${card.id}`}
              {...(picksHref.startsWith("https://") ||
              picksHref.startsWith("http://")
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              <span className="v-sr-only">Download Picks Sheet</span>
            </a>
          ) : null}
          {trackerHref ? (
            <a
              className="v-card-excel-hotspot v-card-excel-hotspot-tracker"
              href={trackerHref}
              data-testid={`vintage-card-excel-tracker-${card.id}`}
              {...(trackerHref.startsWith("https://") ||
              trackerHref.startsWith("http://")
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              <span className="v-sr-only">Download The Tracker</span>
            </a>
          ) : null}
          {picksDate ? (
            <p className="v-card-excel-soon-date v-card-excel-soon-picks">
              {picksDate}
            </p>
          ) : null}
          {trackerDate ? (
            <p className="v-card-excel-soon-date v-card-excel-soon-tracker">
              {trackerDate}
            </p>
          ) : null}
          {caption ? (
            <CardFooterCaption
              text={caption}
              className="v-card-excel-caption"
              testId={`vintage-excel-caption-${card.id}`}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

/**
 * Render one of the three main homepage cards by type.
 */
function HomeCard({ card }: { card: VintageHomeCard }) {
  switch (card.type) {
    case "playNow":
      return <PlayNowCard card={card} />;
    case "reigningChamp":
      return <ReigningChampCard card={card} />;
    case "excelDownloads":
      return <ExcelDownloadsCard card={card} />;
  }
}

/**
 * Three main homepage cards below the countdown (Play / Champ / Excel).
 * When `admin`, each card gets a tiny gear deep-linking to its editor slot.
 */
export default function HomeCardGrid({
  content,
  admin = false,
}: {
  content: VintageContent;
  admin?: boolean;
}) {
  const visible = content.homeCards.filter((card) => card.enabled);
  if (!visible.length) return null;
  return (
    <section
      className="v-home-cards"
      aria-label="Homepage cards"
      data-testid="vintage-home-cards"
    >
      {visible.map((card) =>
        admin ? (
          <div key={card.id} className="v-card-shell">
            <HomeCard card={card} />
            <VintageEditGear
              focus={{ kind: "card", id: card.id }}
              testId={`vintage-edit-gear-card-${card.id}`}
              label={`Edit ${card.type} card`}
            />
          </div>
        ) : (
          <HomeCard key={card.id} card={card} />
        ),
      )}
    </section>
  );
}
