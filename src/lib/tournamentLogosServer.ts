import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { TournamentData } from '@/types/tournament';

/** Generated from local PNGs; no fake reference team or remote SVG resources. */
export async function addCombinedPlayInLogos(data: TournamentData): Promise<TournamentData> {
  const regions = await Promise.all(data.regions.map(async region => ({ ...region, teams: await Promise.all(region.teams.map(async team => {
    if (!team.playIn || team.playIn.winnerId) return team;
    const pngs = await Promise.all(team.playIn.teams.map(async school => {
      if (!/^\/logos\/teams\/[a-zA-Z0-9_-]+\.png$/.test(school.logo)) return null;
      try { return (await readFile(path.join(process.cwd(), 'public', school.logo))).toString('base64'); }
      catch { return null; }
    }));
    const images = pngs.map((png, i) => png
      ? `<image x="${i * 32}" y="16" width="32" height="32" href="data:image/png;base64,${png}"/>`
      : `<text x="${i * 32 + 16}" y="38" text-anchor="middle" font-size="18">?</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${images}</svg>`;
    return { ...team, logo: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
  })) })));
  return { ...data, regions };
}
