import abbreviations from './data/collegeTeamAbbreviations.json';
import widths from './data/playInLabelWidths.json';
import type { PlayInSchool } from '@/types/tournament';

export const PLAY_IN_LABEL_MAX_LENGTH = 40;
// A conservative common label budget, rather than device-specific names.
export const PLAY_IN_LABEL_WIDTH = 140;

/** 14px Arial glyph measurements; shared by server and client to avoid hydration changes. */
export function playInLabelWidth(label: string): number {
  return Array.from(label).reduce((total, char) => total + ((widths as Record<string, number>)[char] ?? 10), 0);
}

function compactSchool(school: PlayInSchool): string {
  const known = (abbreviations as Record<string, string>)[school.id];
  if (known && playInLabelWidth(known) < playInLabelWidth(school.name)) return known;
  // Unknown schools retain recognizable words; never invent an initials acronym.
  return school.name.replace(/\bUniversity\b/gi, 'U').replace(/\bState\b/gi, 'St')
    .replace(/\bNorth\b/gi, 'N').replace(/\bSouth\b/gi, 'S')
    .replace(/\bEast\b/gi, 'E').replace(/\bWest\b/gi, 'W');
}

function fitSchool(name: string, budget: number): string {
  if (playInLabelWidth(name) <= budget) return name;
  let shortened = name;
  while (shortened && playInLabelWidth(`${shortened}…`) > budget) shortened = Array.from(shortened).slice(0, -1).join('');
  return `${shortened.trimEnd()}…`;
}

/** One consistent unresolved label for picks, standings, previews, and exports. */
export function getPlayInDisplayName(teams: [PlayInSchool, PlayInSchool], override?: string): string {
  if (override?.trim()) return override.trim();
  const names = teams.map(t => t.name.trim());
  const full = names.join(' / ');
  if (playInLabelWidth(full) <= PLAY_IN_LABEL_WIDTH) return full;
  const short = teams.map(compactSchool);
  // Some providers reuse abbreviations. Keep distinct school names in that case.
  if (short[0].toLowerCase() === short[1].toLowerCase()) short.splice(0, 2, ...names);
  if (playInLabelWidth(short.join(' / ')) <= PLAY_IN_LABEL_WIDTH) return short.join(' / ');
  const available = PLAY_IN_LABEL_WIDTH - playInLabelWidth(' / ');
  const firstBudget = Math.max(available / 2, available - playInLabelWidth(short[1]));
  const secondBudget = Math.max(available / 2, available - playInLabelWidth(short[0]));
  return `${fitSchool(short[0], firstBudget)} / ${fitSchool(short[1], secondBudget)}`;
}
