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

interface LayoutSettings {
  slotHeightPx: number;
  baseGapPx: number;
  columnWidthPx: number;
  overlapPx: number;
}

const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  slotHeightPx: 28,
  baseGapPx: 4,
  columnWidthPx: 120,
  overlapPx: 60,
};

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
function TeamRow({ team, isWinner, heightPx }: { team?: TournamentTeam; isWinner?: boolean; heightPx: number }) {
  if (!team) {
    return (
      <div
        className="px-2 rounded border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 flex items-center"
        style={{ height: `${heightPx}px` }}
      >
        TBD
      </div>
    );
  }

  return (
    <div
      className={`px-2 rounded border text-xs flex items-center gap-1.5 ${
        isWinner ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold' : 'border-gray-300 bg-white text-gray-800'
      }`}
      style={{ height: `${heightPx}px` }}
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
function getRoundSpacing(roundLevel: number, slotHeightPx: number, baseGapPx: number): { gapPx: number; offsetPx: number } {
  const multiplier = 2 ** roundLevel;
  const gapPx = multiplier * (slotHeightPx + baseGapPx) - slotHeightPx;
  const offsetPx = ((multiplier - 1) * (slotHeightPx + baseGapPx)) / 2;
  return { gapPx, offsetPx };
}

/**
 * Render one vertical round column with bracket-aligned spacing.
 */
function RoundColumn({
  roundLevel,
  slots,
  layout,
}: {
  roundLevel: number;
  slots: RoundSlot[];
  layout: LayoutSettings;
}) {
  const { gapPx, offsetPx } = getRoundSpacing(roundLevel, layout.slotHeightPx, layout.baseGapPx);

  return (
    <div className="min-w-0" style={{ width: `${layout.columnWidthPx}px` }}>
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
                      : `${layout.baseGapPx}px`
                    : `${gapPx}px`
                  : 0,
            }}
          >
            <TeamRow team={slot.team} isWinner={slot.isWinner} heightPx={layout.slotHeightPx} />
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
  layout,
}: {
  regionGames: TournamentGame[];
  picks: Record<string, string>;
  reverse?: boolean;
  layout: LayoutSettings;
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

          return (
            <div
              key={column.id}
              className="flex-shrink-0"
              style={{
                marginLeft: index === 0 ? 0 : touchesRoundOf64And32 ? 0 : `-${layout.overlapPx}px`,
              }}
            >
              <RoundColumn roundLevel={column.roundLevel} slots={column.slots} layout={layout} />
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
  const [layout, setLayout] = useState<LayoutSettings>(DEFAULT_LAYOUT_SETTINGS);
  const [showLayoutControls, setShowLayoutControls] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('keyBracketPreviewLayout');
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<LayoutSettings>;
      setLayout((previous) => ({
        slotHeightPx: saved.slotHeightPx ?? previous.slotHeightPx,
        baseGapPx: saved.baseGapPx ?? previous.baseGapPx,
        columnWidthPx: saved.columnWidthPx ?? previous.columnWidthPx,
        overlapPx: saved.overlapPx ?? previous.overlapPx,
      }));
    } catch (storageError) {
      console.warn('Failed to restore KEY bracket preview layout settings:', storageError);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('keyBracketPreviewLayout', JSON.stringify(layout));
  }, [layout]);

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
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setShowLayoutControls((previous) => !previous)}
              className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
            >
              {showLayoutControls ? 'Hide Layout Controls' : 'Show Layout Controls'}
            </button>
            {showLayoutControls && (
              <button
                onClick={() => setLayout(DEFAULT_LAYOUT_SETTINGS)}
                className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Reset Defaults
              </button>
            )}
          </div>

          {showLayoutControls && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="text-xs text-gray-700">
                  Box Height (px)
                  <input
                    type="number"
                    min={20}
                    max={48}
                    value={layout.slotHeightPx}
                    onChange={(event) =>
                      setLayout((previous) => ({
                        ...previous,
                        slotHeightPx: Number(event.target.value) || previous.slotHeightPx,
                      }))
                    }
                    className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                  />
                </label>

                <label className="text-xs text-gray-700">
                  Game Gap (px)
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={layout.baseGapPx}
                    onChange={(event) =>
                      setLayout((previous) => ({
                        ...previous,
                        baseGapPx: Number(event.target.value) || 0,
                      }))
                    }
                    className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                  />
                </label>

                <label className="text-xs text-gray-700">
                  Column Width (px)
                  <input
                    type="number"
                    min={90}
                    max={220}
                    value={layout.columnWidthPx}
                    onChange={(event) =>
                      setLayout((previous) => ({
                        ...previous,
                        columnWidthPx: Number(event.target.value) || previous.columnWidthPx,
                      }))
                    }
                    className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                  />
                </label>

                <label className="text-xs text-gray-700">
                  Overlap Shift (px)
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={layout.overlapPx}
                    onChange={(event) =>
                      setLayout((previous) => ({
                        ...previous,
                        overlapPx: Number(event.target.value) || 0,
                      }))
                    }
                    className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                  />
                </label>
              </div>
            </div>
          )}

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
                    layout={layout}
                  />
                )}
                {regionsByPosition.topRight && (
                  <RegionBoard
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.topRight.position] || []}
                    picks={picks}
                    reverse
                    layout={layout}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {regionsByPosition.bottomLeft && (
                  <RegionBoard
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.bottomLeft.position] || []}
                    picks={picks}
                    layout={layout}
                  />
                )}
                {regionsByPosition.bottomRight && (
                  <RegionBoard
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.bottomRight.position] || []}
                    picks={picks}
                    reverse
                    layout={layout}
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
