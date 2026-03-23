'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import type { TournamentData, TournamentRegion, TournamentTeam } from '@/types/tournament';
import {
  applyDisplayNamesToTournamentData,
  buildTeamIdToDisplayNameMapFromApi,
} from '@/lib/teamDisplayName';

const REGION_POSITION_ORDER = ['Top Left', 'Bottom Left', 'Top Right', 'Bottom Right'] as const;

/**
 * Order regions left-to-right / top-bottom to match the main bracket layout.
 */
function sortRegionsByBracketPosition(regions: TournamentRegion[]): TournamentRegion[] {
  return [...regions].sort((a, b) => {
    const ia = REGION_POSITION_ORDER.indexOf(a.position as (typeof REGION_POSITION_ORDER)[number]);
    const ib = REGION_POSITION_ORDER.indexOf(b.position as (typeof REGION_POSITION_ORDER)[number]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

/**
 * Build Round-of-64 pairings from a region's team list (same order as tournament JSON / loader).
 */
function buildRoundOf64Games(region: TournamentRegion): Array<{ gameNumber: number; team1: TournamentTeam; team2: TournamentTeam }> {
  const { teams } = region;
  const games: Array<{ gameNumber: number; team1: TournamentTeam; team2: TournamentTeam }> = [];
  const pairCount = Math.min(8, Math.floor(teams.length / 2));
  for (let i = 0; i < pairCount; i += 1) {
    games.push({
      gameNumber: i + 1,
      team1: teams[i * 2],
      team2: teams[i * 2 + 1],
    });
  }
  return games;
}

interface TeamLineProps {
  team: TournamentTeam;
}

/**
 * Single team row in a matchup (no winner styling).
 */
function TeamLine({ team }: TeamLineProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 border-b border-gray-100 last:border-b-0">
      <span className="text-[10px] font-mono text-gray-500 w-5 text-right shrink-0">{team.seed}</span>
      {!imgError && team.logo ? (
        <div className="relative h-6 w-6 shrink-0">
          <Image
            src={team.logo}
            alt=""
            width={24}
            height={24}
            className="object-contain"
            unoptimized
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="h-6 w-6 shrink-0 rounded bg-gray-100" aria-hidden />
      )}
      <span className="text-xs text-gray-900 truncate">{team.name}</span>
    </div>
  );
}

interface TourneyR1BracketPreviewProps {
  /** Tournament year matching `tournament-{year}.json` under public/data */
  year: string;
}

/**
 * Read-only preview of Round of 64 matchups from tournament JSON (admin Tourney tab).
 * Shows region names and first-round pairings only — no picks or winner styling.
 */
export default function TourneyR1BracketPreview({ year }: TourneyR1BracketPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<TournamentData | null>(null);

  const loadJson = useCallback(async () => {
    if (!year) return;
    setLoading(true);
    setLoadError(null);
    setData(null);
    try {
      const response = await fetch(`/data/tournament-${year}.json`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Could not load tournament-${year}.json (${response.status})`);
      }
      const json = (await response.json()) as TournamentData;
      if (!json.regions || !Array.isArray(json.regions)) {
        throw new Error('Invalid tournament file: missing regions');
      }
      let enriched = json;
      try {
        const refResponse = await fetch('/api/team-data?activeOnly=false', {
          cache: 'no-store',
        });
        const refJson = await refResponse.json();
        if (refJson.success && Array.isArray(refJson.data) && refJson.data.length > 0) {
          enriched = applyDisplayNamesToTournamentData(
            json,
            buildTeamIdToDisplayNameMapFromApi(refJson.data)
          );
        }
      } catch {
        /* use raw JSON names */
      }
      setData(enriched);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void loadJson();
  }, [loadJson]);

  if (!year) {
    return null;
  }

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Round of 64 preview</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Read-only snapshot from <code className="text-gray-700">public/data/tournament-{year}.json</code>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadJson()}
          disabled={loading}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-600 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>Loading tournament JSON…</span>
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {loadError}
        </div>
      )}

      {!loading && data && (
        <>
          <p className="text-xs text-gray-600 mb-4">{data.name}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {sortRegionsByBracketPosition(data.regions).map((region) => {
              const games = buildRoundOf64Games(region);
              const incomplete = region.teams.length < 16;
              return (
                <div
                  key={region.name}
                  className="rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden"
                >
                  <div className="bg-gray-200/90 px-3 py-2 border-b border-gray-300">
                    <div className="text-sm font-bold text-gray-900">{region.name}</div>
                    <div className="text-[10px] text-gray-600 uppercase tracking-wide">{region.position}</div>
                  </div>
                  {incomplete && (
                    <p className="text-[10px] text-amber-800 bg-amber-50 px-2 py-1 border-b border-amber-100">
                      This region has {region.teams.length} teams (expected 16 for a full R64).
                    </p>
                  )}
                  <div className="p-2 space-y-2">
                    {games.map((game) => (
                      <div
                        key={`${region.name}-r64-${game.gameNumber}`}
                        className="rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden"
                      >
                        <div className="text-[10px] text-gray-400 px-2 pt-1 font-medium">Game {game.gameNumber}</div>
                        <TeamLine team={game.team1} />
                        <TeamLine team={game.team2} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
