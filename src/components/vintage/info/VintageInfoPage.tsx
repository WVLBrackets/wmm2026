import Link from "next/link";
import type { VintageContent } from "@/lib/vintage/content";
import {
  formatInfoDeadline,
  parseInfoNotesLines,
  resolveInfoPrizeDisplay,
  type VintageInfoContent,
} from "@/lib/vintage/infoContent";
import VintageShell from "../VintageShell";
import InfoFactIcon from "./InfoFactIcon";
import InfoTocSelect from "./InfoTocSelect";
import InfoEditGear from "./InfoEditGear";
import "./info.css";

/**
 * Tournament Handbook page body inside shared vintage chrome.
 */
export default function VintageInfoPage({
  content,
  home,
  draft = false,
  admin = false,
}: {
  content: VintageInfoContent;
  /** Published homepage CMS — tipoff deadline and chrome. */
  home: VintageContent;
  draft?: boolean;
  /** When true, show edit gears that deep-link into the handbook editor. */
  admin?: boolean;
}) {
  const deadline = formatInfoDeadline(home.tournament.tipoffAt);
  const prizeDisplay = resolveInfoPrizeDisplay(content.prizes);
  const trackerNotes = parseInfoNotesLines(content.tracker.notes);

  return (
    <VintageShell
      content={home}
      draft={draft}
      draftReturnHref="/vintage/admin/info"
      testId="vintage-info-page"
    >
      <div className="v-info" data-testid="vintage-info-handbook">
        <header className="v-info-intro">
          {admin ? (
            <InfoEditGear
              focus={{ kind: "intro" }}
              testId="vintage-info-gear-intro"
              label="Edit handbook introduction"
            />
          ) : null}
          <h1 data-testid="vintage-info-heading">{content.intro.heading}</h1>
          <p className="v-info-supporting">{content.intro.supporting}</p>
        </header>

        <div className="v-info-facts" data-testid="vintage-info-facts">
          {admin ? (
            <InfoEditGear
              focus={{ kind: "facts" }}
              testId="vintage-info-gear-facts"
              label="Edit quick facts"
            />
          ) : null}
          <div className="v-info-fact">
            <span className="v-info-fact-title">
              {content.quickFacts.feeTitle}
            </span>
            <InfoFactIcon name={content.quickFacts.feeIcon} />
            <strong className="v-info-fact-caption">
              {content.quickFacts.feeValue}
            </strong>
          </div>
          <div className="v-info-fact">
            <span className="v-info-fact-title">
              {content.quickFacts.deadlineTitle}
            </span>
            <InfoFactIcon name={content.quickFacts.deadlineIcon} />
            <strong className="v-info-fact-caption">
              {deadline || "TBA"}
            </strong>
          </div>
          <Link
            href="/bracket"
            className="v-info-fact v-info-fact-cta"
            data-testid="vintage-info-picks-cta"
          >
            <span className="v-info-fact-title">
              {content.quickFacts.ctaTitle}
            </span>
            <InfoFactIcon
              name={content.quickFacts.ctaIcon}
              strokeWidth={2.2}
            />
            <strong className="v-info-fact-caption">
              {content.quickFacts.ctaLabel}
            </strong>
          </Link>
        </div>

        <div className="v-info-sections">
          <InfoTocSelect
            heading={content.toc.heading}
            items={content.toc.items}
          />
            <section
              id="entry-payment"
              className="v-info-section"
              data-testid="vintage-info-entry"
            >
              {admin ? (
                <InfoEditGear
                  focus={{ kind: "entry" }}
                  testId="vintage-info-gear-entry"
                  label="Edit entry and payment"
                />
              ) : null}
              <h2>{content.entry.heading}</h2>
              <ol className="v-info-steps">
                {content.entry.steps.map((step, index) => (
                  <li key={index}>
                    <span className="v-info-step-num" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="v-info-note">{content.entry.multiEntryNote}</p>
              <div className="v-info-payment">
                <div>
                  <h3>{content.entry.electronicHeading}</h3>
                  <p>{content.entry.electronicBody}</p>
                </div>
                <div>
                  <h3>{content.entry.cashHeading}</h3>
                  <p>{content.entry.cashBody}</p>
                </div>
              </div>
            </section>

            <section
              id="scoring"
              className="v-info-section"
              data-testid="vintage-info-scoring"
            >
              {admin ? (
                <InfoEditGear
                  focus={{ kind: "scoring" }}
                  testId="vintage-info-gear-scoring"
                  label="Edit scoring"
                />
              ) : null}
              <h2>{content.scoring.heading}</h2>
              <div className="v-info-scoring-grid">
                <table className="v-info-table">
                  <caption className="sr-only">
                    {content.scoring.tableCaption}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Round</th>
                      <th scope="col">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.scoring.rows.map((row) => (
                      <tr key={row.round}>
                        <td>{row.round}</td>
                        <td>{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <aside className="v-info-underdog">
                  <p className="v-info-underdog-mark" aria-hidden="true">
                    +2
                  </p>
                  <h3>{content.scoring.underdogHeading}</h3>
                  <p>{content.scoring.underdogBody}</p>
                </aside>
              </div>
              <p className="v-info-note">{content.scoring.firstFourNote}</p>
              <div className="v-info-examples">
                <h3>{content.scoring.examplesHeading}</h3>
                <ul>
                  {content.scoring.examples.map((example, index) => (
                    <li key={index}>{example}</li>
                  ))}
                </ul>
              </div>
            </section>

            <section
              id="prizes"
              className="v-info-section"
              data-testid="vintage-info-prizes"
            >
              {admin ? (
                <InfoEditGear
                  focus={{ kind: "prizes" }}
                  testId="vintage-info-gear-prizes"
                  label="Edit prizes"
                />
              ) : null}
              <h2>{content.prizes.heading}</h2>
              <div className="v-info-pool">
                <p className="v-info-pool-label">{prizeDisplay.poolLabel}</p>
                <p className="v-info-pool-total">{prizeDisplay.poolTotalLabel}</p>
                <p>{prizeDisplay.poolExplanation}</p>
              </div>
              <div className="v-info-places">
                {prizeDisplay.places.map((place) => (
                  <div key={place.place} className="v-info-place">
                    <h3>{place.place}</h3>
                    <p className="v-info-place-pct">{place.percentLabel}</p>
                    <p className="v-info-place-amt">{place.amountLabel}</p>
                  </div>
                ))}
              </div>
              {prizeDisplay.showFootnote ? (
                <p className="v-info-footnote">{content.prizes.footnote}</p>
              ) : null}
            </section>

            <section
              id="tracker"
              className="v-info-section"
              data-testid="vintage-info-tracker"
            >
              {admin ? (
                <InfoEditGear
                  focus={{ kind: "tracker" }}
                  testId="vintage-info-gear-tracker"
                  label="Edit tracker section"
                />
              ) : null}
              <h2>{content.tracker.heading}</h2>
              {trackerNotes.map((line, index) => (
                <p key={`tracker-note-${index}`}>{line}</p>
              ))}
            </section>

            <section
              id="questions"
              className="v-info-section v-info-questions"
              data-testid="vintage-info-questions"
            >
              {admin ? (
                <InfoEditGear
                  focus={{ kind: "questions" }}
                  testId="vintage-info-gear-questions"
                  label="Edit questions section"
                />
              ) : null}
              <h2>{content.questions.heading}</h2>
              <p>{content.questions.body}</p>
              {content.questions.contactEmail ? (
                <a
                  className="v-info-questions-cta"
                  href={`mailto:${content.questions.contactEmail}`}
                  data-testid="vintage-info-contact"
                >
                  {content.questions.actionLabel}
                </a>
              ) : null}
            </section>
        </div>
      </div>
    </VintageShell>
  );
}
