'use client';

import type { PublicScoreboardGame } from '@/lib/types/publicScoreboard';
import {
  formatPeriodDisplay,
  normalizePeriod,
  periodOptionsFor,
} from '@/lib/scoreboardPeriod';
import { formatScoreboardPlayedDate } from '@/lib/scoreboardDateLabel';

export { LIVE_PERIOD_OPTIONS, formatPeriodDisplay } from '@/lib/scoreboardPeriod';

type ScoreboardGameCardProps = {
  game: PublicScoreboardGame;
  timeZone?: string;
  /** When set, scores / status / period / clock are editable in place. */
  editable?: boolean;
  onChange?: (patch: Partial<PublicScoreboardGame>) => void;
};

/**
 * Convert ISO tipoff to datetime-local input value (local browser zone).
 */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Format tipoff pieces for status / upcoming display (America/New_York by default).
 */
function formatTipoff(
  iso: string | null,
  timeZone: string,
): {
  time: string;
  dateShort: string;
  dayKey: string;
  dayLabel: string;
  upcomingLabel: string;
} | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d);
  const dateShort = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);
  const dayLabel = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
    .format(d)
    .toUpperCase();
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return {
    time,
    dateShort,
    dayKey,
    dayLabel,
    upcomingLabel: `${dateShort} · ${time}`.toUpperCase(),
  };
}

/**
 * Public status label (FINAL / FINAL - 2OT / 1ST HALF · 4:32 / FRI MAR 20 · 7:10 PM ET).
 */
function statusLabel(
  game: PublicScoreboardGame,
  tip: ReturnType<typeof formatTipoff>,
): { text: string; live: boolean } {
  if (game.status === 'final') {
    const period = formatPeriodDisplay(game.periodLabel);
    const otSuffix = period.includes('OT') ? ` - ${period}` : '';
    const played = formatScoreboardPlayedDate(game.tipoffAt);
    const dateSuffix = played ? ` · ${played}` : '';
    return { text: `FINAL${otSuffix}${dateSuffix}`, live: false };
  }
  if (game.status === 'live') {
    const bits: string[] = [];
    const period = formatPeriodDisplay(game.periodLabel);
    if (period) bits.push(period);
    if (game.clock) bits.push(game.clock);
    return {
      text: bits.length > 0 ? bits.join(' · ') : 'LIVE',
      live: true,
    };
  }
  if (tip?.upcomingLabel) return { text: tip.upcomingLabel, live: false };
  return { text: 'UPCOMING', live: false };
}

/**
 * Footer: round + region name (e.g. ROUND OF 64 - MIDWEST).
 */
function footerLabel(game: PublicScoreboardGame): string {
  const round = (game.roundLabel || '').trim();
  const region = (game.region || '').trim();
  if (round && region) return `${round} - ${region}`.toUpperCase();
  if (round) return round.toUpperCase();
  if (region) return region.toUpperCase();
  return '';
}

/**
 * Infer winner from scores when status is final.
 */
function winnerFromScores(
  game: PublicScoreboardGame,
  score1: number | null,
  score2: number | null,
): string | null {
  if (
    score1 == null ||
    score2 == null ||
    !Number.isFinite(score1) ||
    !Number.isFinite(score2) ||
    score1 === score2
  ) {
    return game.winnerId;
  }
  return score1 > score2 ? game.team1Id : game.team2Id;
}

/**
 * One scoreboard game card — simple ESPN-style layout (read-only or inline edit).
 */
export default function ScoreboardGameCard({
  game,
  timeZone = 'America/New_York',
  editable = false,
  onChange,
}: ScoreboardGameCardProps) {
  const tip = formatTipoff(game.tipoffAt, timeZone);
  const status = statusLabel(game, tip);
  const foot = footerLabel(game);

  const score1Display =
    game.status === 'scheduled' && game.score1 == null
      ? ''
      : game.score1 == null
        ? '—'
        : String(game.score1);
  const score2Display =
    game.status === 'scheduled' && game.score2 == null
      ? ''
      : game.score2 == null
        ? '—'
        : String(game.score2);

  const team1Wins = game.status === 'final' && game.winnerId === game.team1Id;
  const team2Wins = game.status === 'final' && game.winnerId === game.team2Id;
  const team1Muted = game.status === 'final' && !team1Wins;
  const team2Muted = game.status === 'final' && !team2Wins;

  const a11y = [
    status.text,
    game.team1Name || 'TBD',
    score1Display || 'no score',
    'versus',
    game.team2Name || 'TBD',
    score2Display || 'no score',
    team1Wins ? `${game.team1Name} wins` : team2Wins ? `${game.team2Name} wins` : '',
  ]
    .filter(Boolean)
    .join('. ');

  /**
   * Patch helper for editable mode.
   */
  function patch(next: Partial<PublicScoreboardGame>) {
    onChange?.(next);
  }

  /**
   * Score change; when Final, keep winner aligned to higher score.
   */
  function setScore(which: 1 | 2, raw: string) {
    const value = raw === '' ? null : Number(raw);
    const score1 = which === 1 ? value : game.score1;
    const score2 = which === 2 ? value : game.score2;
    const next: Partial<PublicScoreboardGame> = {
      score1,
      score2,
    };
    if (game.status === 'final') {
      next.winnerId = winnerFromScores(game, score1, score2);
    }
    patch(next);
  }

  /**
   * Status change; clear live-only fields when leaving Live.
   */
  function setStatus(statusValue: PublicScoreboardGame['status']) {
    const next: Partial<PublicScoreboardGame> = { status: statusValue };
    if (statusValue === 'scheduled') {
      next.periodLabel = null;
      next.clock = null;
      next.winnerId = null;
    } else if (statusValue === 'live') {
      next.winnerId = null;
      if (!game.periodLabel) next.periodLabel = '1st';
    } else if (statusValue === 'final') {
      next.winnerId = winnerFromScores(game, game.score1, game.score2);
      next.clock = null;
    }
    patch(next);
  }

  const periodSelectValue =
    normalizePeriod(game.periodLabel) ||
    (game.status === 'live' ? '1st' : '');
  const periodOptions = periodOptionsFor(
    game.periodLabel || (game.status === 'live' ? '1st' : null),
  );

  return (
    <article
      className={`v-scoreboard__card${editable ? ' v-scoreboard__card--edit' : ''}${game.status === 'scheduled' ? ' v-scoreboard__card--upcoming' : ''}`}
      data-testid={`scoreboard-card-${game.gameKey}`}
      data-game-key={game.gameKey}
      aria-label={a11y}
    >
      <div className="v-scoreboard__card-status">
        {editable ? (
          <div className="v-scoreboard__card-edit-status">
            <label className="v-sr-only" htmlFor={`sb-status-${game.gameKey}`}>
              Game status
            </label>
            <select
              id={`sb-status-${game.gameKey}`}
              value={game.status}
              onChange={(e) =>
                setStatus(e.target.value as PublicScoreboardGame['status'])
              }
              data-testid={`scoreboard-status-${game.gameKey}`}
            >
              <option value="scheduled">Upcoming</option>
              <option value="live">Live</option>
              <option value="final">Final</option>
            </select>
            {game.status === 'live' || game.status === 'final' ? (
              <>
                <label className="v-sr-only" htmlFor={`sb-period-${game.gameKey}`}>
                  Period
                </label>
                <select
                  id={`sb-period-${game.gameKey}`}
                  value={periodSelectValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'custom') return;
                    patch({ periodLabel: v === '' ? null : v });
                  }}
                  data-testid={`scoreboard-period-${game.gameKey}`}
                >
                  {game.status === 'final' ? (
                    <option value="">Regulation</option>
                  ) : null}
                  {periodOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {game.status === 'live' ? (
              <>
                <label className="v-sr-only" htmlFor={`sb-clock-${game.gameKey}`}>
                  Time remaining
                </label>
                <input
                  id={`sb-clock-${game.gameKey}`}
                  className="v-scoreboard__clock-input"
                  value={game.clock || ''}
                  onChange={(e) => patch({ clock: e.target.value || null })}
                  placeholder="4:32"
                  inputMode="numeric"
                  data-testid={`scoreboard-clock-${game.gameKey}`}
                  aria-label="Time remaining"
                />
              </>
            ) : null}
            {game.status === 'scheduled' ? (
              <>
                <label className="v-sr-only" htmlFor={`sb-tipoff-${game.gameKey}`}>
                  Tipoff date and time
                </label>
                <input
                  id={`sb-tipoff-${game.gameKey}`}
                  type="datetime-local"
                  className="v-scoreboard__tipoff-input"
                  value={toDatetimeLocalValue(game.tipoffAt)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw) {
                      patch({ tipoffAt: null });
                      return;
                    }
                    const d = new Date(raw);
                    patch({
                      tipoffAt: Number.isNaN(d.getTime())
                        ? null
                        : d.toISOString(),
                    });
                  }}
                  data-testid={`scoreboard-tipoff-${game.gameKey}`}
                  aria-label="Tipoff date and time"
                />
              </>
            ) : null}
          </div>
        ) : (
          <span
            className={`v-scoreboard__status${status.live ? ' v-scoreboard__status--live' : ''}${game.status === 'scheduled' ? ' v-scoreboard__status--upcoming' : ''}`}
          >
            {status.live ? (
              <span className="v-scoreboard__live-dot" aria-hidden />
            ) : (
              <span className="v-scoreboard__status-dot" aria-hidden />
            )}
            {status.text}
          </span>
        )}
      </div>

      <div className="v-scoreboard__teams">
        <TeamRow
          seed={game.seed1}
          name={game.team1Name}
          logoUrl={game.team1LogoUrl}
          score={score1Display}
          muted={team1Muted}
          editable={editable}
          onScoreChange={(raw) => setScore(1, raw)}
          scoreTestId={`scoreboard-score1-${game.gameKey}`}
        />
        <TeamRow
          seed={game.seed2}
          name={game.team2Name}
          logoUrl={game.team2LogoUrl}
          score={score2Display}
          muted={team2Muted}
          editable={editable}
          onScoreChange={(raw) => setScore(2, raw)}
          scoreTestId={`scoreboard-score2-${game.gameKey}`}
        />
      </div>

      {foot ? <p className="v-scoreboard__card-foot">{foot}</p> : null}
    </article>
  );
}

/**
 * Export tipoff day helpers for section grouping.
 */
export function gameDayMeta(
  game: PublicScoreboardGame,
  timeZone = 'America/New_York',
): { dayKey: string; dayLabel: string } {
  const tip = formatTipoff(game.tipoffAt, timeZone);
  if (tip) return { dayKey: tip.dayKey, dayLabel: tip.dayLabel };
  return { dayKey: 'unscheduled', dayLabel: 'TIME TBD' };
}

function TeamRow({
  seed,
  name,
  logoUrl,
  score,
  muted,
  editable,
  onScoreChange,
  scoreTestId,
}: {
  seed: number | null;
  name: string | null;
  logoUrl: string | null;
  score: string;
  muted: boolean;
  editable?: boolean;
  onScoreChange?: (raw: string) => void;
  scoreTestId?: string;
}) {
  const display = name || 'TBD';
  return (
    <div
      className={`v-scoreboard__team-row${muted ? ' v-scoreboard__team-row--muted' : ''}`}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="v-scoreboard__logo"
          src={logoUrl}
          alt=""
          width={28}
          height={28}
        />
      ) : (
        <span className="v-scoreboard__logo-fallback" aria-hidden>
          ·
        </span>
      )}
      <span className="v-scoreboard__seed">{seed != null ? seed : ''}</span>
      <span className="v-scoreboard__team-name" title={display}>
        {display}
      </span>
      {editable ? (
        <input
          className="v-scoreboard__score-input"
          value={score === '—' ? '' : score}
          onChange={(e) => onScoreChange?.(e.target.value)}
          inputMode="numeric"
          aria-label={`${display} score`}
          data-testid={scoreTestId}
        />
      ) : (
        <span className="v-scoreboard__score">{score || '—'}</span>
      )}
    </div>
  );
}
