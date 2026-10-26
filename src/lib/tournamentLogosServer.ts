import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { TournamentData } from '@/types/tournament';
import { buildPlayInLogoSvg, normalizePlayInLogoStyle } from '@/lib/playInLogoStyle';

/** Generated from local PNGs; no fake reference team or remote SVG resources. */
export async function addCombinedPlayInLogos(data: TournamentData): Promise<TournamentData> {
  const style = normalizePlayInLogoStyle(data.display?.playInLogo);
  const regions = await Promise.all(data.regions.map(async region => ({ ...region, teams: await Promise.all(region.teams.map(async team => {
    if (!team.playIn || team.playIn.winnerId) return team;
    const hrefs = await Promise.all(team.playIn.teams.map(async school => {
      if (!/^\/logos\/teams\/[a-zA-Z0-9_-]+\.png$/.test(school.logo)) return null;
      try { return `data:image/png;base64,${(await readFile(path.join(process.cwd(), 'public', school.logo))).toString('base64')}`; }
      catch { return null; }
    }));
    const svg = buildPlayInLogoSvg([hrefs[0] ?? null, hrefs[1] ?? null], style);
    return { ...team, logo: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
  })) })));
  return { ...data, regions };
}
