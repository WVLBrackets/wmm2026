import type { PlayInSchool, TournamentData, TournamentTeam } from '@/types/tournament';

export const MATCHUP_SEEDS = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
export const REGION_POSITIONS = ['Top Left', 'Bottom Left', 'Top Right', 'Bottom Right'];
export const FIRST_MANAGED_YEAR = 2027;
export type FirstFourResults = Record<string, string>;

export function playInSlotId(year: string, position: string, seed: number): string {
  return `playin:${year}:${position.toLowerCase().replace(/ /g, '-')}:${seed}`;
}

export function createPlayInTeam(year: string, position: string, seed: number, teams: [PlayInSchool, PlayInSchool]): TournamentTeam {
  return {
    id: playInSlotId(year, position, seed), seed,
    name: teams.map(t => t.name).join(' / '),
    logo: '/images/basketball icon.png', playIn: { teams },
  };
}

/** Resolves display only. Never substitute the school id for a saved slot id. */
export function resolveFirstFour(data: TournamentData, results: FirstFourResults): TournamentData {
  return {
    ...data,
    regions: data.regions.map(region => ({ ...region, teams: region.teams.map(team => {
      if (!team.playIn) return { ...team };
      const winner = team.playIn.teams.find(t => t.id === results[team.id]);
      return {
        ...team,
        name: winner?.name ?? team.playIn.teams.map(t => t.name).join(' / '),
        logo: winner?.logo ?? '/images/basketball icon.png',
        playIn: { teams: team.playIn.teams, ...(winner ? { winnerId: winner.id } : {}) },
      };
    }) })),
  };
}

/** Explicit whitelist: never persist resolved winners or arbitrary browser fields in a definition. */
export function canonicalTournament(data: TournamentData): TournamentData {
  return {
    schemaVersion: 2, year: data.year, name: data.name.trim(),
    regions: REGION_POSITIONS.map(position => {
      const region = data.regions.find(r => r.position === position)!;
      return { name: region.name.trim(), position, teams: MATCHUP_SEEDS.map(seed => {
        const team = region.teams.find(t => t.seed === seed)!;
        const school = (t: PlayInSchool): PlayInSchool => ({ id: t.id, name: t.name.trim(), logo: t.logo });
        return team.playIn
          ? createPlayInTeam(data.year, position, seed, team.playIn.teams.map(school) as [PlayInSchool, PlayInSchool])
          : { ...school(team), seed };
      }) };
    }),
    finalFour: { location: data.finalFour.location },
    metadata: { startDate: data.metadata.startDate, scoring: data.metadata.scoring.map(r => ({ round: r.round, points: r.points })) },
  };
}

function validLogo(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 500 &&
    (/^\/logos\/teams\/[a-zA-Z0-9_-]+\.png$/.test(value) || value === '/images/basketball icon.png');
}

/** The same validation is used for preview/export and enforced server-side on publish. */
export function validateTournamentDefinition(value: unknown, complete = true): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return ['Tournament is required.'];
  const d = value as TournamentData;
  if (typeof d.year !== 'string' || !/^20\d{2}$/.test(d.year) || Number(d.year) < FIRST_MANAGED_YEAR) errors.push('New tournament publishing supports 2027 onward. Historical files are unchanged.');
  if (typeof d.name !== 'string' || !d.name.trim() || d.name.length > 150) errors.push('Enter a tournament name (150 characters maximum).');
  if (!Array.isArray(d.regions) || d.regions.length !== 4) return [...errors, 'Exactly four regions are required.'];
  const ids = new Set<string>();
  const names = new Set<string>();
  const positions = new Set<string>();
  let playIns = 0;
  const checkSchool = (s: PlayInSchool, label: string) => {
    if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.logo !== 'string') {
      errors.push(`${label}: invalid school data.`);
      return;
    }
    if (!s.id && !complete) return;
    if (!/^\d+$/.test(s.id) || !s.name.trim() || s.name.length > 150 || !validLogo(s.logo)) {
      errors.push(`${label}: select a valid school.`);
      return;
    }
    if (ids.has(s.id)) errors.push(`${label}: ${s.name} is already used in this tournament.`);
    ids.add(s.id);
  };
  for (const r of d.regions) {
    if (!r || !REGION_POSITIONS.includes(r.position) || positions.has(r.position)) { errors.push('Region positions must be unique.'); continue; }
    positions.add(r.position);
    if (typeof r.name !== 'string' || r.name.length > 150) errors.push(`${r.position}: invalid region name.`);
    else if (!r.name.trim()) { if (complete) errors.push(`${r.position}: enter a region name.`); }
    else {
      const name = r.name.trim().toLowerCase();
      if (names.has(name)) errors.push('Region names must be unique.');
      names.add(name);
    }
    if (!Array.isArray(r.teams) || r.teams.length !== 16) { errors.push(`${r.position}: 16 slots are required.`); continue; }
    const seeds = new Set<number>();
    for (const t of r.teams) {
      if (!t || !Number.isInteger(t.seed) || t.seed < 1 || t.seed > 16 || seeds.has(t.seed)) { errors.push(`${r.position}: seeds must be 1–16, once each.`); continue; }
      seeds.add(t.seed);
      const label = `${r.name || r.position}, seed ${t.seed}`;
      if (t.playIn) {
        playIns++;
        if (!Array.isArray(t.playIn.teams) || t.playIn.teams.length !== 2 || t.id !== playInSlotId(d.year, r.position, t.seed)) { errors.push(`${label}: invalid play-in slot.`); continue; }
        t.playIn.teams.forEach(s => checkSchool(s, label));
      } else checkSchool(t, label);
    }
  }
  if (playIns > 4) errors.push('At most four play-in slots are allowed.');
  if (!d.finalFour || typeof d.finalFour.location !== 'string') errors.push('Final Four location is required.');
  if (!d.metadata || typeof d.metadata.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.metadata.startDate) || !Array.isArray(d.metadata.scoring) || d.metadata.scoring.some(r => !r || typeof r.round !== 'string' || !Number.isFinite(r.points))) errors.push('Valid tournament metadata is required.');
  return errors;
}

export function validateFirstFourResults(data: TournamentData, results: unknown): results is FirstFourResults {
  if (!results || typeof results !== 'object' || Array.isArray(results)) return false;
  const slots = data.regions.flatMap(r => r.teams).filter(t => t.playIn);
  return Object.entries(results).every(([id, winner]) => slots.some(t => t.id === id && t.playIn!.teams.some(s => s.id === winner)));
}

/** Entry creation freezes the entire published field, including names and seeds. */
export function sameTournamentDefinition(a: TournamentData, b: TournamentData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
