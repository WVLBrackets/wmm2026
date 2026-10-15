import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Trophy,
  Megaphone,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";
import type { VintageContent, VintagePromotion } from "@/lib/vintage/content";
import HomeViewToggle from "@/components/HomeViewToggle";
import VintageCountdown from "./VintageCountdown";
import BasketballMark from "./BasketballMark";
import "./vintage.css";
function EditorialLink({
  href,
  children,
  className = "",
  testId,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  testId: string;
}) {
  const external = href.startsWith("https://");
  return (
    <Link
      href={href}
      className={className}
      data-testid={testId}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
function Promotion({ item, index }: { item: VintagePromotion; index: number }) {
  if (!item.enabled) return null;
  return (
    <aside
      className={`v-ad v-ad-${index}`}
      aria-label={`Promotional placement ${index + 1}`}
      data-testid={`vintage-promotion-${index + 1}`}
    >
      {item.image.src && (
        <div className="v-ad-image">
          {/* Admin images may be local uploads or validated HTTPS URLs. */}
          <Image
            src={item.image.src}
            alt={item.image.alt}
            style={{ objectPosition: item.image.position }}
            fill
            unoptimized
            sizes="(max-width: 700px) 40vw, 20vw"
          />
        </div>
      )}
      <div className="v-ad-copy">
        <span className="v-eyebrow">{item.eyebrow}</span>
        <h3>{item.headline}</h3>
        <p>{item.text}</p>
        {item.href && (
          <EditorialLink
            href={item.href}
            className="v-text-link"
            testId={`vintage-promotion-link-${index + 1}`}
          >
            {item.linkLabel} <ArrowUpRight size={15} />
          </EditorialLink>
        )}
        <small>ADVERTISEMENT · {String(index + 1).padStart(2, "0")}</small>
      </div>
    </aside>
  );
}
export default function VintageHomepage({
  content: c,
  draft = false,
}: {
  content: VintageContent;
  draft?: boolean;
}) {
  return (
    <div className="vintage-page" data-testid="vintage-homepage">
      {draft && (
        <div className="v-draft-banner">
          UNPUBLISHED DRAFT{" "}
          <Link
            href="/admin/vintage-homepage"
            data-testid="vintage-return-editor"
          >
            Return to editor →
          </Link>
        </div>
      )}
      <div className="v-paper">
        <header className="v-header">
          <div className="v-topline">
            <span>{c.masthead.established}</span>
            <span>{c.masthead.tagline}</span>
            <span>{c.masthead.slogan}</span>
          </div>
          <h1 className="v-masthead">
            <span>{c.masthead.first}</span>
            <BasketballMark />
            <span>{c.masthead.second}</span>
          </h1>
          <nav className="v-nav" aria-label="Main navigation">
            <div>
              <Link
                data-testid="vintage-nav-home"
                className="v-active"
                href="/vintage"
                aria-current="page"
              >
                Home
              </Link>
              {c.tournament.picksEnabled && (
                <Link data-testid="vintage-nav-picks" href="/bracket">
                  My Picks
                </Link>
              )}
              <Link data-testid="vintage-nav-info" href="/info">
                Pool Info
              </Link>
              <Link data-testid="vintage-nav-standings" href="/standings">
                Standings
              </Link>
              <Link data-testid="vintage-nav-history" href="/hall-of-fame">
                Hall of Fame
              </Link>
            </div>
            <div>
              <Link href="/auth/signin" data-testid="vintage-signin">
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="v-account"
                data-testid="vintage-create-account"
              >
                Create Account <ArrowUpRight size={13} />
              </Link>
            </div>
          </nav>
        </header>
        <main className="v-main">
          <section className="v-frontpage" aria-label="The front page">
            <article className="v-hero">
              <Image
                src={
                  c.hero.image.src ||
                  "/images/vintage/basketball-editorial.webp"
                }
                alt={c.hero.image.alt}
                style={{ objectPosition: c.hero.image.position }}
                priority
                width={900}
                height={1200}
                sizes="(max-width: 700px) 100vw, 40vw"
                unoptimized={
                  c.hero.image.src !==
                  "/images/vintage/basketball-editorial.webp"
                }
              />
              <div className="v-hero-copy">
                <span className="v-eyebrow">THE MARCH TRADITION</span>
                <h2>{c.hero.headline}</h2>
                <p>{c.hero.subtitle}</p>
                <EditorialLink
                  testId="vintage-hero-action"
                  className="v-hero-cta"
                  href={c.hero.ctaHref || "/info"}
                >
                  {c.hero.ctaLabel} <ArrowUpRight size={17} />
                </EditorialLink>
              </div>
            </article>
            <div className="v-lead">
              <div className="v-tournament-row">
                <div className="v-tipoff">
                  <span className="v-eyebrow">
                    {c.tournament.countdownEnabled
                      ? "COUNTDOWN TO TIPOFF"
                      : "NEXT UP · THE BIG DANCE"}
                  </span>
                  {c.tournament.countdownEnabled ? (
                    <VintageCountdown at={c.tournament.countdownAt} />
                  ) : (
                    <h2>
                      March is
                      <br />
                      <em>our season.</em>
                    </h2>
                  )}
                </div>
                <div className="v-datebox">
                  <BasketballMark />
                  <strong>{c.tournament.year}</strong>
                  <b>{c.tournament.title}</b>
                  <p>{c.tournament.dates}</p>
                </div>
              </div>
              <div className="v-editorial">
                <span className="v-eyebrow">{c.introduction.eyebrow}</span>
                <h2>{c.introduction.headline}</h2>
                <p>{c.introduction.body}</p>
                <Link
                  data-testid="vintage-info-action"
                  href="/info"
                  className="v-text-link"
                >
                  Get to know the pool <ArrowRight size={16} />
                </Link>
              </div>
              <div className="v-lead-bottom">
                <span>FRIENDS. FAMILY. BRAGGING RIGHTS.</span>
                <span>A TRADITION SINCE 2001</span>
              </div>
            </div>
          </section>
          <section className="v-news-row">
            <div className="v-news">
              <div className="v-section-heading">
                <h2>
                  <Megaphone size={23} /> The latest dispatches
                </h2>
                <span>POOL NEWS & NOTES</span>
              </div>
              {c.announcements.length ? (
                c.announcements.map((a) => (
                  <article className="v-news-item" key={a.id}>
                    <time dateTime={a.date}>
                      {new Date(a.date + "T12:00:00Z").toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        },
                      )}
                    </time>
                    <div>
                      <h3>{a.headline}</h3>
                      <p>{a.text}</p>
                    </div>
                  </article>
                ))
              ) : (
                <p className="v-empty">
                  The newsroom is quiet. Check back for tournament updates.
                </p>
              )}
            </div>
            <aside className="v-history">
              <Trophy size={32} strokeWidth={1.4} />
              <span className="v-eyebrow">{c.history.eyebrow}</span>
              <h2>{c.history.headline}</h2>
              {c.history.winner && (
                <p className="v-winner">
                  {c.history.winner}
                  <span>{c.history.winnerYear} POOL CHAMPION</span>
                </p>
              )}
              <p>{c.history.text}</p>
              {c.history.entries && (
                <p className="v-entry-count">
                  {c.history.entries}
                  <span>ENTRIES</span>
                </p>
              )}
              <Link
                data-testid="vintage-history-action"
                href="/hall-of-fame"
                className="v-text-link"
              >
                Visit the Hall of Fame <ArrowRight size={15} />
              </Link>
            </aside>
          </section>
          <section className="v-promotions" aria-label="From our friends">
            {c.promotions.map((item, index) => (
              <Promotion item={item} index={index} key={index} />
            ))}
          </section>
          <section className="v-resources" aria-label="Excel downloads">
            <span className="v-eyebrow">PREFER A SPREADSHEET?</span>
            <div>
              {c.downloads.map((d, i) => (
                <div
                  className="v-resource"
                  key={i}
                  data-testid={`vintage-download-${i + 1}`}
                >
                  <FileSpreadsheet size={22} />
                  <div>
                    {d.href ? (
                      <EditorialLink
                        href={d.href}
                        testId={`vintage-download-link-${i + 1}`}
                      >
                        {d.label} <ArrowUpRight size={13} />
                      </EditorialLink>
                    ) : (
                      <span>{d.label}</span>
                    )}
                    <p>{d.href ? d.description : "Download coming soon."}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
        <footer className="v-footer">
          <span>{c.footer.text}</span>
          {c.footer.contactEmail && (
            <a
              data-testid="vintage-contact"
              href={`mailto:${c.footer.contactEmail}`}
            >
              A note to the commissioner <ArrowUpRight size={13} />
            </a>
          )}
          <Link
            data-testid="vintage-open-editor"
            href="/admin/vintage-homepage"
          >
            Homepage editor
          </Link>
        </footer>
        <HomeViewToggle vintage />
      </div>
    </div>
  );
}
