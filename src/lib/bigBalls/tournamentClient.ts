/**
 * Big Balls Sports Data — NCAAB tournament bracket client.
 * @see https://bigballsdata.com/docs/ncaab-stats
 *
 * Note: Big Balls `season` is the season-start year. March Madness 2026
 * (app tournament year 2026) is requested as `season=2025`.
 */

export type BbsTournamentMatch = {
  matchId: string;
  /** Normalized game status for our board. */
  status: 'scheduled' | 'live' | 'final' | string;
  /** Raw status string from the feed (e.g. post, scheduled). */
  rawStatus: string;
  statusState: string | null;
  round: number | null;
  regionLabel: string | null;
  bracketLocation: number | null;
  draw: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeName: string | null;
  awayName: string | null;
  homeSchool: string | null;
  awaySchool: string | null;
  homeSeed: number | null;
  awaySeed: number | null;
  homeScore: number | null;
  awayScore: number | null;
  /** true when feed marks that side the winner. */
  homeWinner: boolean | null;
  awayWinner: boolean | null;
  /** Scheduled tipoff when the feed provides one (ISO). */
  tipoffAt: string | null;
  periodLabel: string | null;
  clock: string | null;
  raw: Record<string, unknown>;
};

type BbsTeamSide = {
  school: string | null;
  fullName: string | null;
  abbreviation: string | null;
  seed: number | null;
  score: number | null;
  winner: boolean | null;
  id: string | null;
};

/**
 * Read a nested team object from the current tournament payload shape.
 */
function readTeamSide(raw: unknown): BbsTeamSide {
  if (!raw || typeof raw !== 'object') {
    return {
      school: null,
      fullName: null,
      abbreviation: null,
      seed: null,
      score: null,
      winner: null,
      id: null,
    };
  }
  const t = raw as Record<string, unknown>;
  const seedRaw = t.seed;
  const seed =
    seedRaw != null && String(seedRaw).trim() !== ''
      ? Number(seedRaw)
      : null;
  return {
    school: t.school != null ? String(t.school) : null,
    fullName:
      t.full_name != null
        ? String(t.full_name)
        : t.fullName != null
          ? String(t.fullName)
          : null,
    abbreviation:
      t.abbreviation != null
        ? String(t.abbreviation)
        : t.abbr != null
          ? String(t.abbr)
          : null,
    seed: seed != null && Number.isFinite(seed) ? seed : null,
    score: t.score != null && Number.isFinite(Number(t.score)) ? Number(t.score) : null,
    winner: typeof t.winner === 'boolean' ? t.winner : null,
    id: t.id != null ? String(t.id) : null,
  };
}

/**
 * Pull a scheduled tipoff ISO from common BBS / feed field names.
 */
export function extractBbsTipoffAt(
  row: Record<string, unknown>,
): string | null {
  const candidates = [
    row.scheduled_at,
    row.scheduledAt,
    row.kickoff_utc,
    row.kickoffUtc,
    row.start_time,
    row.startTime,
    row.scheduled_start,
    row.scheduledStart,
    row.tipoff,
    row.tip_off,
    row.tipoff_at,
    row.tipoffAt,
    row.game_time,
    row.gameTime,
    row.datetime,
    row.date_time,
    row.start,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    if (typeof c === 'number' && Number.isFinite(c)) {
      const ms = c < 1e12 ? c * 1000 : c;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

/**
 * Map BBS status / status_state onto scheduled | live | final.
 */
export function mapBbsGameStatus(
  status: string | null | undefined,
  statusState: string | null | undefined,
): 'scheduled' | 'live' | 'final' | string {
  const state = (statusState || '').toLowerCase().trim();
  const raw = (status || '').toLowerCase().trim();
  if (
    state === 'final' ||
    raw === 'post' ||
    raw === 'finished' ||
    raw === 'final' ||
    raw === 'complete' ||
    raw === 'completed' ||
    raw === 'closed'
  ) {
    return 'final';
  }
  if (
    state === 'in' ||
    state === 'live' ||
    raw === 'live' ||
    raw === 'inprogress' ||
    raw === 'in_progress' ||
    raw === 'in play'
  ) {
    return 'live';
  }
  if (
    state === 'pre' ||
    raw === 'scheduled' ||
    raw === 'pre' ||
    raw === 'upcoming' ||
    raw === ''
  ) {
    return 'scheduled';
  }
  return raw || 'scheduled';
}

/**
 * True when BBS status means the game is complete.
 */
export function isBbsMatchFinished(
  status: string,
  statusState?: string | null,
): boolean {
  return mapBbsGameStatus(status, statusState) === 'final';
}

/**
 * Stable synthetic id when the tournament feed omits match_id.
 */
export function buildBbsTournamentMatchId(parts: {
  season: string | number | null;
  gender: string | null;
  round: number | null;
  bracketLocation: number | null;
  homeAbbr: string | null;
  awayAbbr: string | null;
  tipoffAt: string | null;
}): string {
  return [
    'bbs',
    'ncaab',
    parts.season ?? 'na',
    parts.gender || 'men',
    `r${parts.round ?? 'x'}`,
    `loc${parts.bracketLocation ?? 'x'}`,
    parts.homeAbbr || 'home',
    parts.awayAbbr || 'away',
    parts.tipoffAt || 'notip',
  ].join(':');
}

/**
 * Read Big Balls API key from env (server only).
 * Canonical: `API_KEY_BIGBALL` (also accepts legacy `BBS_API_KEY` / `BIGBALLS_API_KEY`).
 * @see https://bigballsdata.com/docs
 */
export function getBbsApiKey(): string | null {
  const key =
    process.env.API_KEY_BIGBALL?.trim() ||
    process.env.BBS_API_KEY?.trim() ||
    process.env.BIGBALLS_API_KEY?.trim();
  return key || null;
}

/**
 * Normalize a BBS tournament row into a stable shape (current + legacy field names).
 *
 * @param row - Raw data[] element
 */
export function normalizeBbsTournamentRow(
  row: Record<string, unknown>,
): BbsTournamentMatch {
  const homeTeam = readTeamSide(row.home_team ?? row.homeTeam ?? row.home);
  const awayTeam = readTeamSide(row.away_team ?? row.awayTeam ?? row.away);

  const legacyScore =
    row.score && typeof row.score === 'object'
      ? (row.score as Record<string, unknown>)
      : {};

  const homeScore =
    homeTeam.score ??
    (legacyScore.home != null ? Number(legacyScore.home) : null) ??
    (row.home_score != null ? Number(row.home_score) : null);
  const awayScore =
    awayTeam.score ??
    (legacyScore.away != null ? Number(legacyScore.away) : null) ??
    (row.away_score != null ? Number(row.away_score) : null);

  const tipoffAt = extractBbsTipoffAt(row);
  const gender =
    row.gender != null
      ? String(row.gender).toLowerCase()
      : row.draw != null
        ? String(row.draw).toLowerCase()
        : null;
  const round = row.round != null ? Number(row.round) : null;
  const bracketLocation =
    row.bracket_location != null
      ? Number(row.bracket_location)
      : row.bracketLocation != null
        ? Number(row.bracketLocation)
        : null;
  const season =
    row.season != null ? String(row.season) : null;
  const rawStatus = String(row.status ?? '').toLowerCase();
  const statusState =
    row.status_state != null
      ? String(row.status_state)
      : row.statusState != null
        ? String(row.statusState)
        : null;

  const explicitId = row.match_id ?? row.matchId ?? row.id;
  const matchId = explicitId
    ? String(explicitId)
    : buildBbsTournamentMatchId({
        season,
        gender,
        round,
        bracketLocation,
        homeAbbr: homeTeam.abbreviation || homeTeam.school,
        awayAbbr: awayTeam.abbreviation || awayTeam.school,
        tipoffAt,
      });

  // Prefer school names — our bracket uses "Ohio State", not "Ohio State Buckeyes".
  const homeName =
    homeTeam.school ||
    homeTeam.fullName ||
    (typeof row.home === 'string' ? row.home : null) ||
    (row.home_name != null ? String(row.home_name) : null);
  const awayName =
    awayTeam.school ||
    awayTeam.fullName ||
    (typeof row.away === 'string' ? row.away : null) ||
    (row.away_name != null ? String(row.away_name) : null);

  const periodLabel =
    row.period_label != null
      ? String(row.period_label)
      : row.period != null
        ? String(row.period)
        : row.half != null
          ? String(row.half)
          : null;
  const clock =
    row.clock != null
      ? String(row.clock)
      : row.time_remaining != null
        ? String(row.time_remaining)
        : null;

  return {
    matchId,
    status: mapBbsGameStatus(rawStatus, statusState),
    rawStatus,
    statusState,
    round: round != null && Number.isFinite(round) ? round : null,
    regionLabel:
      row.region_label != null
        ? String(row.region_label)
        : row.region != null
          ? String(row.region)
          : null,
    bracketLocation:
      bracketLocation != null && Number.isFinite(bracketLocation)
        ? bracketLocation
        : null,
    draw: gender,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeName,
    awayName,
    homeSchool: homeTeam.school,
    awaySchool: awayTeam.school,
    homeSeed: homeTeam.seed,
    awaySeed: awayTeam.seed,
    homeScore:
      homeScore != null && Number.isFinite(homeScore) ? homeScore : null,
    awayScore:
      awayScore != null && Number.isFinite(awayScore) ? awayScore : null,
    homeWinner: homeTeam.winner,
    awayWinner: awayTeam.winner,
    tipoffAt,
    periodLabel,
    clock,
    raw: row,
  };
}

/**
 * Fetch March Madness tournament games from Big Balls.
 *
 * @param season - Season start year (e.g. 2025 for March 2026 bracket)
 */
export async function fetchBbsTournament(
  season: string,
): Promise<BbsTournamentMatch[]> {
  const apiKey = getBbsApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_BIGBALL is not configured');
  }
  const url = new URL('https://api.bigballsdata.com/v1/ncaab/tournament');
  url.searchParams.set('season', season);
  url.searchParams.set('limit', '200');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Big Balls tournament HTTP ${response.status}: ${body.slice(0, 240)}`,
    );
  }

  const json = (await response.json()) as {
    data?: unknown;
    error?: unknown;
  };
  if (!Array.isArray(json.data)) {
    throw new Error('Big Balls tournament response missing data array');
  }

  return json.data
    .filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object',
    )
    .map(normalizeBbsTournamentRow)
    .filter((m) => m.matchId);
}
