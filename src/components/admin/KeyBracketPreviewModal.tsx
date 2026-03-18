'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { generate64TeamBracket, updateBracketWithPicks } from '@/lib/bracketGenerator';
import { loadTournamentData } from '@/lib/tournamentLoader';
import { TournamentBracket, TournamentData, TournamentGame, TournamentTeam } from '@/types/tournament';

interface KeyBracketPreviewModalProps {
  isOpen: boolean;
  year: string;
  onClose: () => void;
}

interface LiveResultsPreviewResponse {
  success: boolean;
  error?: string;
  data?: {
    picks?: Record<string, string>;
  };
}

interface RoundSlot {
  id: string;
  team?: TournamentTeam;
  isWinner: boolean;
}

const SLOT_HEIGHT_PX = 28;
const BASE_GAP_PX = 4;
const COLUMN_WIDTH_PX = 120;

/**
 * Resolve the picked winner for a game from current picks.
 */
function getPickedWinner(game: TournamentGame, picks: Record<string, string>): TournamentTeam | null {
  const pickedTeamId = picks[game.id];
  if (!pickedTeamId) return null;
  if (game.team1?.id === pickedTeamId) return game.team1;
  if (game.team2?.id === pickedTeamId) return game.team2;
  return null;
}

/**
 * Render a compact team row with optional winner highlighting.
 */
function TeamRow({ team, isWinner }: { team?: TournamentTeam; isWinner?: boolean }) {
  if (!team) {
    return (
      <div className="h-7 px-2 rounded border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 flex items-center">
        TBD
      </div>
    );
  }

  return (
    <div
      className={`h-7 px-2 rounded border text-xs flex items-center gap-1.5 ${
        isWinner ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold' : 'border-gray-300 bg-white text-gray-800'
      }`}
    >
      <span className="font-bold">#{team.seed}</span>
      {team.logo && (
        <Image src={team.logo} alt={team.name} width={12} height={12} className="w-3 h-3 object-contain flex-shrink-0" unoptimized />
      )}
      <span className="truncate">{team.name}</span>
    </div>
  );
}

/**
 * Convert games in a round to explicit vertical team slots.
 */
function buildRoundSlots(games: TournamentGame[], picks: Record<string, string>): RoundSlot[] {
  const slots: RoundSlot[] = [];

  games.forEach((game) => {
    const pickedTeamId = picks[game.id];
    slots.push({
      id: `${game.id}-1`,
      team: game.team1,
      isWinner: game.team1?.id === pickedTeamId,
    });
    slots.push({
      id: `${game.id}-2`,
      team: game.team2,
      isWinner: game.team2?.id === pickedTeamId,
    });
  });

  return slots;
}

/**
 * Get vertical spacing values for each round level.
 * This keeps advancing slots centered between prior-round matchup teams.
 */
function getRoundSpacing(roundLevel: number): { gapPx: number; offsetPx: number } {
  const multiplier = 2 ** roundLevel;
  const gapPx = multiplier * (SLOT_HEIGHT_PX + BASE_GAP_PX) - SLOT_HEIGHT_PX;
  const offsetPx = ((multiplier - 1) * (SLOT_HEIGHT_PX + BASE_GAP_PX)) / 2;
  return { gapPx, offsetPx };
}

/**
 * Render one vertical round column with bracket-aligned spacing.
 */
function RoundColumn({
  roundLevel,
  slots,
}: {
  roundLevel: number;
  slots: RoundSlot[];
}) {
  const { gapPx, offsetPx } = getRoundSpacing(roundLevel);

  return (
    <div className="min-w-0" style={{ width: `${COLUMN_WIDTH_PX}px` }}>
      <div style={{ paddingTop: `${offsetPx}px`, paddingBottom: `${offsetPx}px` }}>
        {slots.map((slot, index) => (
          <div
            key={slot.id}
            style={{
              marginBottom:
                index < slots.length - 1
                  ? roundLevel === 0
                    ? index % 2 === 0
                      ? 0
                      : `${BASE_GAP_PX}px`
                    : `${gapPx}px`
                  : 0,
            }}
          >
            <TeamRow team={slot.team} isWinner={slot.isWinner} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Render one region as round columns with alignment-accurate slot spacing.
 */
function RegionBoard({
  regionGames,
  picks,
  reverse,
}: {
  regionGames: TournamentGame[];
  picks: Record<string, string>;
  reverse?: boolean;
}) {
  const round64 = regionGames.filter((game) => game.round === 'Round of 64');
  const round32 = regionGames.filter((game) => game.round === 'Round of 32');
  const sweet16 = regionGames.filter((game) => game.round === 'Sweet 16');
  const elite8 = regionGames.filter((game) => game.round === 'Elite 8');

  const columns: Array<{ id: string; roundLevel: number; slots: RoundSlot[] }> = [
    {
      id: 'r64',
      roundLevel: 0,
      slots: buildRoundSlots(round64, picks),
    },
    {
      id: 'r32',
      roundLevel: 1,
      slots: buildRoundSlots(round32, picks),
    },
    {
      id: 's16',
      roundLevel: 2,
      slots: buildRoundSlots(sweet16, picks),
    },
    {
      id: 'e8',
      roundLevel: 3,
      slots: buildRoundSlots(elite8, picks),
    },
  ];

  const orderedColumns = reverse ? [...columns].reverse() : columns;

  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 min-w-0">
      <div className="flex items-start">
        {orderedColumns.map((column, index) => {
          const previousRoundLevel = index > 0 ? orderedColumns[index - 1].roundLevel : null;
          const touchesRoundOf64And32 =
            previousRoundLevel !== null &&
            ((previousRoundLevel === 0 && column.roundLevel === 1) ||
              (previousRoundLevel === 1 && column.roundLevel === 0));
          const overlapPx = Math.floor(COLUMN_WIDTH_PX / 2);

          return (
            <div
              key={column.id}
              className="flex-shrink-0"
              style={{
                marginLeft: index === 0 ? 0 : touchesRoundOf64And32 ? 0 : `-${overlapPx}px`,
              }}
            >
              <RoundColumn roundLevel={column.roundLevel} slots={column.slots} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function KeyBracketPreviewModal({ isOpen, year, onClose }: KeyBracketPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [updatedBracket, setUpdatedBracket] = useState<TournamentBracket | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadPreviewData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [previewResponse, tournament] = await Promise.all([
          fetch(`/api/admin/live-results?year=${encodeURIComponent(year)}`),
          loadTournamentData(year),
        ]);

        const previewResult = (await previewResponse.json()) as LiveResultsPreviewResponse;
        if (!previewResponse.ok || !previewResult.success) {
          throw new Error(previewResult.error || 'Failed to load KEY preview data.');
        }

        const previewPicks = previewResult.data?.picks ?? {};
        const baseBracket = generate64TeamBracket(tournament);
        const resolvedBracket = updateBracketWithPicks(baseBracket, previewPicks, tournament);

        setPicks(previewPicks);
        setTournamentData(tournament);
        setUpdatedBracket(resolvedBracket);
      } catch (previewError) {
        console.error('Error loading KEY bracket preview:', previewError);
        setError(previewError instanceof Error ? previewError.message : 'Failed to load KEY bracket preview.');
      } finally {
        setLoading(false);
      }
    };

    loadPreviewData();
  }, [isOpen, year]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const regionsByPosition = useMemo(() => {
    if (!tournamentData || !updatedBracket) return null;

    const getRegionByPosition = (position: string) =>
      tournamentData.regions.find((region) => region.position === position);

    const topLeft = getRegionByPosition('Top Left');
    const bottomLeft = getRegionByPosition('Bottom Left');
    const topRight = getRegionByPosition('Top Right');
    const bottomRight = getRegionByPosition('Bottom Right');

    return {
      topLeft,
      bottomLeft,
      topRight,
      bottomRight,
      bracketRegions: updatedBracket.regions,
    };
  }, [tournamentData, updatedBracket]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[96vw] max-w-[1500px] max-h-[92vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-4 overflow-auto max-h-[92vh] bg-white">
          {loading && (
            <div className="h-[420px] flex items-center justify-center text-gray-600">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading bracket preview...
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {!loading && !error && regionsByPosition && (
            <div className="space-y-4 min-w-[1100px]">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {regionsByPosition.topLeft && (
                  <RegionBoard
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.topLeft.position] || []}
                    picks={picks}
                  />
                )}
                {regionsByPosition.topRight && (
                  <RegionBoard
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.topRight.position] || []}
                    picks={picks}
                    reverse
                  />
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {regionsByPosition.bottomLeft && (
                  <RegionBoard
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.bottomLeft.position] || []}
                    picks={picks}
                  />
                )}
                {regionsByPosition.bottomRight && (
                  <RegionBoard
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.bottomRight.position] || []}
                    picks={picks}
                    reverse
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
