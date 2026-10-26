import {
  isPaper2020SectionHidden,
  type VintageStandingsPaper2020,
} from "@/lib/vintage/standingsContent";

/**
 * Short newspaper edition for Standings year=2020 (CMS-driven copy).
 * Section visibility follows paper2020 hide* flags.
 */
export default function Standings2020Newspaper({
  copy,
}: {
  copy: VintageStandingsPaper2020;
}) {
  const showDateline = !isPaper2020SectionHidden(copy.hideDateline);
  const showHeadline = !isPaper2020SectionHidden(copy.hideHeadline);
  const showLead = !isPaper2020SectionHidden(copy.hideLead);
  const showSidebar = !isPaper2020SectionHidden(copy.hideSidebar);
  const showWire = !isPaper2020SectionHidden(copy.hideWire);
  const showSources = !isPaper2020SectionHidden(copy.hideSources);
  const showColumns = showLead || showSidebar;
  const showSourcesLine =
    showSources &&
    (copy.source1Label.trim() || copy.source2Label.trim());

  return (
    <article
      className="v-paper-2020"
      data-testid="standings-2020-newspaper"
      aria-labelledby={showHeadline ? "paper-2020-headline" : undefined}
    >
      {showDateline ? (
        <header className="v-paper-2020__dateline">
          <p className="v-paper-2020__kicker">{copy.kicker}</p>
          <p className="v-paper-2020__vol">{copy.volume}</p>
        </header>
      ) : null}

      {showHeadline ? (
        <>
          <h2 id="paper-2020-headline" className="v-paper-2020__headline">
            {copy.headline}
          </h2>
          {copy.deck.trim() ? (
            <p className="v-paper-2020__deck">{copy.deck}</p>
          ) : null}
        </>
      ) : null}

      {showHeadline || showDateline ? (
        <div className="v-paper-2020__rule" aria-hidden="true" />
      ) : null}

      {showColumns ? (
        <div className="v-paper-2020__columns">
          {showLead ? (
            <section className="v-paper-2020__lead">
              {copy.leadSubhead.trim() ? (
                <h3 className="v-paper-2020__subhead">{copy.leadSubhead}</h3>
              ) : null}
              {copy.leadBody1.trim() ? <p>{copy.leadBody1}</p> : null}
              {copy.leadBody2.trim() ? <p>{copy.leadBody2}</p> : null}
            </section>
          ) : null}

          {showSidebar ? (
            <aside className="v-paper-2020__sidebar">
              {copy.sidebarSubhead.trim() ? (
                <h3 className="v-paper-2020__subhead">
                  {copy.sidebarSubhead}
                </h3>
              ) : null}
              {copy.sidebarBody.trim() ? <p>{copy.sidebarBody}</p> : null}
              {copy.pullQuote.trim() ? (
                <p className="v-paper-2020__pull">
                  {copy.pullQuote}
                  {copy.pullCite.trim() ? <cite> {copy.pullCite}</cite> : null}
                </p>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}

      {showColumns && (showWire || showSourcesLine) ? (
        <div className="v-paper-2020__rule" aria-hidden="true" />
      ) : null}

      {showWire || showSourcesLine ? (
        <section className="v-paper-2020__wire">
          {showWire ? (
            <>
              {copy.wireSubhead.trim() ? (
                <h3 className="v-paper-2020__subhead">{copy.wireSubhead}</h3>
              ) : null}
              {copy.wireBody.trim() ? <p>{copy.wireBody}</p> : null}
            </>
          ) : null}
          {showSourcesLine ? (
            <p className="v-paper-2020__footer-note">
              {copy.sourcesIntro}
              {copy.source1Label.trim() && copy.source1Href.trim() ? (
                <a
                  href={copy.source1Href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {copy.source1Label}
                </a>
              ) : (
                copy.source1Label
              )}
              {copy.sourcesBetween}
              {copy.source2Label.trim() && copy.source2Href.trim() ? (
                <a
                  href={copy.source2Href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {copy.source2Label}
                </a>
              ) : (
                copy.source2Label
              )}
              {copy.sourcesOutro}
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
