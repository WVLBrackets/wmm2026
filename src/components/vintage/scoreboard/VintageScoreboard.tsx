'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import Link from 'next/link';
import { ChevronDown, Settings } from 'lucide-react';
import type { VintageContent } from '@/lib/vintage/content';
import {
  formatScoreboardCopy,
  type VintageScoreboardContent,
} from '@/lib/vintage/scoreboardContent';
import { parseViewingYear } from '@/lib/services/tournamentYearHelpers';
import type {
  PublicScoreboardGame,
  PublicScoreboardPayload,
} from '@/lib/types/publicScoreboard';
import VintageShell from '../VintageShell';
import LoadingBasketball from '@/components/vintage/feedback/LoadingBasketball';
import ScoreboardGameCard from './ScoreboardGameCard';
import ScoreboardEditPanel from './ScoreboardEditPanel';
import './scoreboard.css';

type VintageScoreboardProps = {
  home: VintageContent;
  copy: VintageScoreboardContent;
  admin: boolean;
  initialBoard: PublicScoreboardPayload;
  availableYears: number[];
  activeYear: number;
  viewingYear: number;
  editMode: boolean;
};

/**
 * Build `/scoreboard?group=&year=&edit=` (Standings-style flat route + searchParams).
 */
function buildScoreboardHref(
  group: string,
  year: number,
  activeYear: number,
  edit = false,
): string {
  const qs = new URLSearchParams();
  if (group) qs.set('group', group);
  if (year !== activeYear) qs.set('year', String(year));
  if (edit) qs.set('edit', '1');
  const q = qs.toString();
  return q ? `/scoreboard?${q}` : '/scoreboard';
}

/**
 * Format last-updated timestamp for the header (matches Standings stamp).
 */
function formatUpdatedAt(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return (
      d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
      }) + ' ET'
    );
  } catch {
    return iso;
  }
}

/**
 * One Live / Upcoming / Final section (flat tipoff/completion order — no day groups).
 */
function ScoreboardSection({
  id,
  title,
  games,
  empty,
  note,
}: {
  id: string;
  title: string;
  games: PublicScoreboardGame[];
  empty?: string;
  note?: string;
}) {
  if (games.length === 0 && !empty) return null;
  return (
    <section className="v-scoreboard__section" aria-labelledby={title ? id : undefined}>
      <div className="v-scoreboard__section-head">
        {title ? (
        <h3 id={id} className="v-scoreboard__section-title">
          {title}
        </h3>
        ) : null}
        {note ? <p className="v-scoreboard__section-note">{note}</p> : null}
      </div>
      {games.length === 0 ? (
        <p className="v-scoreboard__empty">{empty}</p>
      ) : (
        <div className="v-scoreboard__grid">
          {games.map((g) => (
            <ScoreboardGameCard key={g.gameKey} game={g} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Public Scoreboard page — read-only for the pool; admin gear opens editor.
 * Group/year switches soft-update via fetch + history.replaceState (Standings pattern)
 * so VintageShell / toolbar never remount.
 */
export default function VintageScoreboard({
  home,
  copy,
  admin,
  initialBoard,
  availableYears,
  activeYear,
  viewingYear: initialViewingYear,
  editMode,
}: VintageScoreboardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [viewingYear, setViewingYear] = useState(initialViewingYear);
  const [editing, setEditing] = useState(editMode && admin);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  useEffect(() => {
    setViewingYear(initialViewingYear);
  }, [initialViewingYear]);

  useEffect(() => {
    setEditing(editMode && admin);
  }, [editMode, admin]);

  const years = useMemo(() => {
    const set = new Set(availableYears);
    set.add(activeYear);
    set.add(viewingYear);
    set.add(board.year);
    return Array.from(set).sort((a, b) => b - a);
  }, [availableYears, activeYear, viewingYear, board.year]);

  const pageIndex = board.pages.findIndex((p) => p.slug === board.page.slug);
  const prevPage = pageIndex > 0 ? board.pages[pageIndex - 1] : null;
  const nextPage =
    pageIndex >= 0 && pageIndex < board.pages.length - 1
      ? board.pages[pageIndex + 1]
      : null;

  /**
   * Path for a group + year (+ optional edit). Shareable; soft-nav uses replaceState.
   */
  const hrefFor = useCallback(
    (slug: string, year: number, edit = false) =>
      buildScoreboardHref(slug, year, activeYear, edit && admin),
    [activeYear, admin],
  );

  /**
   * Soft-load a group/year without remounting VintageShell (Standings year pattern).
   */
  const softNavigate = useCallback(
    async (slug: string, year: number, edit: boolean) => {
      setBusy(true);
      try {
        const qs = new URLSearchParams();
        qs.set('slug', slug);
        qs.set('year', String(year));
        const res = await fetch(`/api/scoreboard?${qs.toString()}`);
        const json = (await res.json()) as {
          success?: boolean;
          data?: PublicScoreboardPayload;
        };
        if (!res.ok || !json.success || !json.data) {
          console.error('[scoreboard softNavigate] failed', res.status, json);
          return;
        }
        setBoard(json.data);
        setViewingYear(year);
        window.history.replaceState(
          null,
          '',
          hrefFor(json.data.page.slug, year, edit),
        );
      } catch (error) {
        console.error('[scoreboard softNavigate]', error);
      } finally {
        setBusy(false);
      }
    },
    [hrefFor],
  );

  /**
   * Intercept in-app group links so the shell stays mounted; keep href for new tabs.
   */
  const onGroupClick = useCallback(
    (slug: string, e: MouseEvent<HTMLAnchorElement>) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      ) {
        return;
      }
      e.preventDefault();
      if (slug === board.page.slug && viewingYear === board.year) return;
      void softNavigate(slug, viewingYear, editing);
    },
    [board.page.slug, board.year, viewingYear, editing, softNavigate],
  );

  /**
   * Soft-switch year via history (Standings pattern) without full remount.
   */
  const handleYearChange = (year: number) => {
    if (year === viewingYear) return;
    void softNavigate(board.page.slug, year, editing);
  };

  /**
   * Toggle edit mode in the URL without remounting the shell.
   */
  const setEditMode = (next: boolean) => {
    setEditing(next);
    window.history.replaceState(
      null,
      '',
      hrefFor(board.page.slug, viewingYear, next),
    );
  };

  const updatedText =
    board.lastUpdatedAt && copy.updatedLabel.trim()
      ? formatScoreboardCopy(copy.updatedLabel, {
          time: formatUpdatedAt(board.lastUpdatedAt),
        })
      : '';

  const live = board.live || [];
  const upcoming = board.upcoming || [];
  const completed = board.completed || [];

  const desktopCols = Math.min(4, Math.max(1, board.page.desktopCols));
  const mobileCols = Math.min(2, Math.max(1, board.page.mobileCols));

  return (
    <VintageShell content={home} testId="vintage-scoreboard-page">
      <div
        className={`v-scoreboard${busy ? ' v-scoreboard--busy' : ''}${editing ? ' v-scoreboard--editing' : ''}`}
        data-testid="scoreboard-root"
        data-desktop-cols={desktopCols}
        data-mobile-cols={mobileCols}
        aria-busy={busy || undefined}
        style={
          {
            ['--vsb-desktop-cols' as string]: String(desktopCols),
            ['--vsb-mobile-cols' as string]: String(mobileCols),
          } as CSSProperties
        }
      >
        <header className="v-scoreboard__header">
          <div className="v-scoreboard__title-block">
            {copy.heading ? (
              <h1 className="v-scoreboard__heading">{copy.heading}</h1>
            ) : null}
            {updatedText ? (
              <p
                className="v-scoreboard__updated"
                data-testid="scoreboard-updated"
              >
                {updatedText}
              </p>
            ) : null}
          </div>
          <div className="v-scoreboard__header-right">
            <div className="v-scoreboard__year">
              {copy.yearLabel ? (
              <label className="v-sr-only" htmlFor="scoreboard-year">
                {copy.yearLabel}
              </label>
              ) : null}
              <select
                id="scoreboard-year"
                value={String(viewingYear)}
                onChange={(e) => {
                  const y = parseViewingYear(e.target.value, activeYear);
                  handleYearChange(y);
                }}
                disabled={busy}
                aria-label={`Viewing year ${viewingYear}. Change scoreboard year`}
                data-testid="scoreboard-year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="v-scoreboard__year-icon" aria-hidden />
            </div>
            {admin ? (
              <Link
                href={hrefFor(board.page.slug, viewingYear, !editing)}
                className="v-edit-gear v-scoreboard__gear"
                aria-label={
                  editing ? 'Close scoreboard editor' : 'Edit scoreboard'
                }
                title={editing ? 'Close editor' : 'Edit scoreboard'}
                data-testid="scoreboard-admin-gear"
                onClick={(e) => {
                  e.preventDefault();
                  setEditMode(!editing);
                }}
              >
                <Settings size={13} strokeWidth={2.25} aria-hidden />
              </Link>
            ) : null}
          </div>
        </header>

        <nav
          className="v-scoreboard__tabs"
          aria-label={copy.groupsAriaLabel || undefined}
          data-testid="scoreboard-tabs-desktop"
        >
          {board.pages.map((p) => (
            <Link
              key={p.slug}
              href={hrefFor(p.slug, viewingYear, editing)}
              className={`v-scoreboard__tab${p.slug === board.page.slug ? ' v-scoreboard__tab--active' : ''}`}
              aria-current={p.slug === board.page.slug ? 'page' : undefined}
              onClick={(e) => onGroupClick(p.slug, e)}
            >
              {p.label} · {p.gameCount}
            </Link>
          ))}
        </nav>

        <div
          className="v-scoreboard__mobile-nav"
          data-testid="scoreboard-tabs-mobile"
        >
          <label className="v-scoreboard__group-label" htmlFor="scoreboard-group">
            Group
          </label>
          <select
            id="scoreboard-group"
            className="v-scoreboard__group-select"
            value={board.page.slug}
            disabled={busy}
            onChange={(e) => {
              void softNavigate(e.target.value, viewingYear, editing);
            }}
          >
            {board.pages.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label} · {p.gameCount} game{p.gameCount === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          <div className="v-scoreboard__mobile-pager">
            {prevPage ? (
              <Link
                href={hrefFor(prevPage.slug, viewingYear, editing)}
                onClick={(e) => onGroupClick(prevPage.slug, e)}
              >
                ← Previous
              </Link>
            ) : (
              <a aria-disabled="true">← Previous</a>
            )}
            <span>{board.pages.length} tournament groups</span>
            {nextPage ? (
              <Link
                href={hrefFor(nextPage.slug, viewingYear, editing)}
                onClick={(e) => onGroupClick(nextPage.slug, e)}
              >
                Next: {nextPage.label} →
              </Link>
            ) : (
              <a aria-disabled="true">Next →</a>
            )}
          </div>
        </div>

        {busy ? (
          <LoadingBasketball
            message={copy.loadingMessage}
            variant="page"
            testId="scoreboard-busy"
          />
        ) : editing && admin ? (
          <ScoreboardEditPanel
            year={board.year}
            board={board}
            availableYears={years}
            defaultYear={activeYear}
            onUpdated={setBoard}
            onClose={() => setEditMode(false)}
          />
        ) : (
          <>
            <div className="v-scoreboard__page-intro">
              <h2 className="v-scoreboard__page-title">
                {board.page.label}
                {board.dateLabel ? (
                  <span
                    className="v-scoreboard__page-dates"
                    data-testid="scoreboard-page-dates"
                  >
                    {board.dateLabel}
                  </span>
                ) : null}
              </h2>
            </div>

            <ScoreboardSection
              id="scoreboard-live-heading"
              title={copy.liveTitle}
              games={live}
            />
            <ScoreboardSection
              id="scoreboard-upcoming-heading"
              title={copy.upcomingTitle}
              games={upcoming}
            />
            <ScoreboardSection
              id="scoreboard-final-heading"
              title={copy.finalTitle}
              games={completed}
              empty={copy.finalEmptyMessage}
            />

            <div className="v-scoreboard__pager">
              {prevPage ? (
                <Link
                  href={hrefFor(prevPage.slug, viewingYear, editing)}
                  onClick={(e) => onGroupClick(prevPage.slug, e)}
                >
                  Previous: {prevPage.label}
                </Link>
              ) : (
                <span>Previous: (none)</span>
              )}
              {nextPage ? (
                <Link
                  href={hrefFor(nextPage.slug, viewingYear, editing)}
                  onClick={(e) => onGroupClick(nextPage.slug, e)}
                >
                  Next: {nextPage.label} →
                </Link>
              ) : (
                <span>Next: (none)</span>
              )}
            </div>
          </>
        )}
      </div>
    </VintageShell>
  );
}
