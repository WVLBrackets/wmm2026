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

type RoundKey = 'r64' | 'r32' | 's16' | 'e8';

interface RoundLayoutSettings {
  slotHeightPx: number;
  matchupGapPx: number;
  gameGapPx: number;
  columnWidthPx: number;
  overlapPx: number;
}

interface LayoutSettings {
  rounds: Record<RoundKey, RoundLayoutSettings>;
}

const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  rounds: {
    r64: {
      slotHeightPx: 28,
      matchupGapPx: 0,
      gameGapPx: 4,
      columnWidthPx: 120,
      overlapPx: 0,
    },
    r32: {
      slotHeightPx: 28,
      matchupGapPx: 36,
      gameGapPx: 36,
      columnWidthPx: 120,
      overlapPx: 0,
    },
    s16: {
      slotHeightPx: 28,
      matchupGapPx: 100,
      gameGapPx: 100,
      columnWidthPx: 120,
      overlapPx: 60,
    },
    e8: {
      slotHeightPx: 28,
      matchupGapPx: 228,
      gameGapPx: 228,
      columnWidthPx: 120,
      overlapPx: 60,
    },
  },
};

/**
 * Build raw top offsets for each slot in a round.
 */
function buildRoundTopOffsets(slotCount: number, settings: RoundLayoutSettings): number[] {
  const offsets: number[] = [];
  let cursor = 0;

  for (let index = 0; index < slotCount; index += 1) {
    offsets.push(cursor);

    if (index === slotCount - 1) continue;
    const isTopTeamInGame = index % 2 === 0;
    cursor += settings.slotHeightPx + (isTopTeamInGame ? settings.matchupGapPx : settings.gameGapPx);
  }

  return offsets;
}

/**
 * Derive slot center points from top offsets and slot height.
 */
function getSlotCenters(topOffsets: number[], slotHeightPx: number): number[] {
  return topOffsets.map((top) => top + slotHeightPx / 2);
}

/**
 * Derive game centers by averaging each pair of slot centers.
 */
function getGameCenters(topOffsets: number[], slotHeightPx: number): number[] {
  const centers = getSlotCenters(topOffsets, slotHeightPx);
  const gameCenters: number[] = [];

  for (let index = 0; index < centers.length; index += 2) {
    const topCenter = centers[index];
    const bottomCenter = centers[index + 1];
    if (topCenter === undefined || bottomCenter === undefined) continue;
    gameCenters.push((topCenter + bottomCenter) / 2);
  }

  return gameCenters;
}

/**
 * Shift current round vertically toward previous-round game centers.
 * Uses mean delta so user-controlled spacing can still diverge intentionally.
 */
function alignRoundToPrevious(
  rawTopOffsets: number[],
  currentSettings: RoundLayoutSettings,
  previousTopOffsets: number[],
  previousSettings: RoundLayoutSettings
): number[] {
  const previousGameCenters = getGameCenters(previousTopOffsets, previousSettings.slotHeightPx);
  const currentSlotCenters = getSlotCenters(rawTopOffsets, currentSettings.slotHeightPx);
  const comparableCount = Math.min(previousGameCenters.length, currentSlotCenters.length);

  if (comparableCount === 0) {
    return rawTopOffsets;
  }

  let deltaSum = 0;
  for (let index = 0; index < comparableCount; index += 1) {
    deltaSum += previousGameCenters[index] - currentSlotCenters[index];
  }
  const meanDelta = deltaSum / comparableCount;
  return rawTopOffsets.map((top) => top + meanDelta);
}

interface RoundDefinition {
  key: RoundKey;
  slots: RoundSlot[];
  settings: RoundLayoutSettings;
}

interface RoundGeometry {
  topOffsets: number[];
  settings: RoundLayoutSettings;
  slots: RoundSlot[];
}

/**
 * Compute vertically aligned geometry for all rounds in one region.
 */
function computeRoundGeometries(definitions: RoundDefinition[]): { byRound: Record<RoundKey, RoundGeometry>; columnHeight: number } {
  const intermediate: Array<{ key: RoundKey; geometry: RoundGeometry }> = [];

  definitions.forEach((definition, index) => {
    const rawTopOffsets = buildRoundTopOffsets(definition.slots.length, definition.settings);
    const topOffsets =
      index === 0
        ? rawTopOffsets
        : alignRoundToPrevious(
            rawTopOffsets,
            definition.settings,
            intermediate[index - 1].geometry.topOffsets,
            intermediate[index - 1].geometry.settings
          );

    intermediate.push({
      key: definition.key,
      geometry: {
        topOffsets,
        settings: definition.settings,
        slots: definition.slots,
      },
    });
  });

  let minTop = 0;
  let maxBottom = 0;

  intermediate.forEach(({ geometry }) => {
    geometry.topOffsets.forEach((top) => {
      if (top < minTop) minTop = top;
      const bottom = top + geometry.settings.slotHeightPx;
      if (bottom > maxBottom) maxBottom = bottom;
    });
  });

  const globalShift = minTop < 0 ? -minTop : 0;

  const byRound = {} as Record<RoundKey, RoundGeometry>;
  intermediate.forEach(({ key, geometry }) => {
    byRound[key] = {
      ...geometry,
      topOffsets: geometry.topOffsets.map((top) => top + globalShift),
    };
  });

  return {
    byRound,
    columnHeight: maxBottom + globalShift,
  };
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
 * Render one vertical round column with bracket-aligned spacing.
 */
function RoundColumn({
  slots,
  settings,
  topOffsets,
  columnHeight,
}: {
  slots: RoundSlot[];
  settings: RoundLayoutSettings;
  topOffsets: number[];
  columnHeight: number;
}) {
  return (
    <div className="min-w-0 relative" style={{ width: `${settings.columnWidthPx}px`, height: `${columnHeight}px` }}>
      {slots.map((slot, index) => (
        <div key={slot.id} className="absolute left-0 right-0" style={{ top: `${topOffsets[index] ?? 0}px` }}>
          <TeamRow team={slot.team} isWinner={slot.isWinner} heightPx={settings.slotHeightPx} />
        </div>
      ))}
    </div>
  );
}

function getRoundKeyFromLevel(level: number): RoundKey {
  if (level === 0) return 'r64';
  if (level === 1) return 'r32';
  if (level === 2) return 's16';
  return 'e8';
}

function getRoundLabel(roundKey: RoundKey): string {
  if (roundKey === 'r64') return 'Round 1';
  if (roundKey === 'r32') return 'Round 2';
  if (roundKey === 's16') return 'Round 3';
  return 'Round 4';
}

function withUpdatedRoundSetting(
  previousLayout: LayoutSettings,
  roundKey: RoundKey,
  updater: (settings: RoundLayoutSettings) => RoundLayoutSettings
): LayoutSettings {
  return {
    ...previousLayout,
    rounds: {
      ...previousLayout.rounds,
      [roundKey]: updater(previousLayout.rounds[roundKey]),
    },
  };
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

  const columns: Array<{ id: string; roundLevel: number; slots: RoundSlot[]; settings: RoundLayoutSettings }> = [
    {
      id: 'r64',
      roundLevel: 0,
      slots: buildRoundSlots(round64, picks),
      settings: layout.rounds.r64,
    },
    {
      id: 'r32',
      roundLevel: 1,
      slots: buildRoundSlots(round32, picks),
      settings: layout.rounds.r32,
    },
    {
      id: 's16',
      roundLevel: 2,
      slots: buildRoundSlots(sweet16, picks),
      settings: layout.rounds.s16,
    },
    {
      id: 'e8',
      roundLevel: 3,
      slots: buildRoundSlots(elite8, picks),
      settings: layout.rounds.e8,
    },
  ];

  const geometry = useMemo(
    () =>
      computeRoundGeometries(
        columns.map((column) => ({
          key: getRoundKeyFromLevel(column.roundLevel),
          slots: column.slots,
          settings: column.settings,
        }))
      ),
    [columns]
  );

  const orderedColumns = reverse ? [...columns].reverse() : columns;

  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 min-w-0">
      <div className="flex items-start">
        {orderedColumns.map((column, index) => {
          const roundKey = getRoundKeyFromLevel(column.roundLevel);
          const roundGeometry = geometry.byRound[roundKey];

          return (
            <div
              key={column.id}
              className="flex-shrink-0"
              style={{
                marginLeft: index === 0 ? 0 : `-${column.settings.overlapPx}px`,
              }}
            >
              <RoundColumn
                slots={column.slots}
                settings={column.settings}
                topOffsets={roundGeometry?.topOffsets || []}
                columnHeight={geometry.columnHeight}
              />
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
      const saved = JSON.parse(raw) as Partial<LayoutSettings> & Partial<RoundLayoutSettings>;
      setLayout((previous) => {
        if (saved.rounds) {
          return {
            rounds: {
              r64: { ...previous.rounds.r64, ...saved.rounds.r64 },
              r32: { ...previous.rounds.r32, ...saved.rounds.r32 },
              s16: { ...previous.rounds.s16, ...saved.rounds.s16 },
              e8: { ...previous.rounds.e8, ...saved.rounds.e8 },
            },
          };
        }

        // Backward compatibility for earlier flat-layout control format.
        const legacy = saved;
        return {
          rounds: {
            r64: {
              ...previous.rounds.r64,
              slotHeightPx: legacy.slotHeightPx ?? previous.rounds.r64.slotHeightPx,
              gameGapPx: legacy.gameGapPx ?? legacy.matchupGapPx ?? previous.rounds.r64.gameGapPx,
              columnWidthPx: legacy.columnWidthPx ?? previous.rounds.r64.columnWidthPx,
              overlapPx: 0,
            },
            r32: {
              ...previous.rounds.r32,
              slotHeightPx: legacy.slotHeightPx ?? previous.rounds.r32.slotHeightPx,
              gameGapPx: legacy.gameGapPx ?? legacy.matchupGapPx ?? previous.rounds.r32.gameGapPx,
              columnWidthPx: legacy.columnWidthPx ?? previous.rounds.r32.columnWidthPx,
              overlapPx: 0,
            },
            s16: {
              ...previous.rounds.s16,
              slotHeightPx: legacy.slotHeightPx ?? previous.rounds.s16.slotHeightPx,
              gameGapPx: legacy.gameGapPx ?? legacy.matchupGapPx ?? previous.rounds.s16.gameGapPx,
              columnWidthPx: legacy.columnWidthPx ?? previous.rounds.s16.columnWidthPx,
              overlapPx: legacy.overlapPx ?? previous.rounds.s16.overlapPx,
            },
            e8: {
              ...previous.rounds.e8,
              slotHeightPx: legacy.slotHeightPx ?? previous.rounds.e8.slotHeightPx,
              gameGapPx: legacy.gameGapPx ?? legacy.matchupGapPx ?? previous.rounds.e8.gameGapPx,
              columnWidthPx: legacy.columnWidthPx ?? previous.rounds.e8.columnWidthPx,
              overlapPx: legacy.overlapPx ?? previous.rounds.e8.overlapPx,
            },
          },
        };
      });
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
              <div className="hidden lg:grid lg:grid-cols-[110px_repeat(5,minmax(120px,1fr))] gap-2 mb-2 px-1">
                <div className="text-[11px] font-semibold text-gray-600">Round</div>
                <div className="text-[11px] font-semibold text-gray-600">Box Height</div>
                <div className="text-[11px] font-semibold text-gray-600">Matchup Gap</div>
                <div className="text-[11px] font-semibold text-gray-600">Game Gap</div>
                <div className="text-[11px] font-semibold text-gray-600">Column Width</div>
                <div className="text-[11px] font-semibold text-gray-600">Overlap Shift</div>
              </div>

              <div className="space-y-2">
                {(['r64', 'r32', 's16', 'e8'] as RoundKey[]).map((roundKey) => {
                  const settings = layout.rounds[roundKey];

                  return (
                    <div key={roundKey} className="grid grid-cols-1 lg:grid-cols-[110px_repeat(5,minmax(120px,1fr))] gap-2">
                      <div className="text-xs font-semibold text-gray-700 self-center">{getRoundLabel(roundKey)}</div>

                      <label className="text-xs text-gray-700">
                        <span className="lg:hidden">Box Height (px)</span>
                        <input
                          type="number"
                          min={20}
                          max={52}
                          value={settings.slotHeightPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                slotHeightPx: Number(event.target.value) || current.slotHeightPx,
                              }))
                            )
                          }
                          className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                        />
                      </label>

                      <label className="text-xs text-gray-700">
                        <span className="lg:hidden">Matchup Gap (px)</span>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={settings.matchupGapPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                matchupGapPx: Number(event.target.value) || 0,
                              }))
                            )
                          }
                          className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                        />
                      </label>

                      <label className="text-xs text-gray-700">
                        <span className="lg:hidden">Game Gap (px)</span>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={settings.gameGapPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                gameGapPx: Number(event.target.value) || 0,
                              }))
                            )
                          }
                          className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                        />
                      </label>

                      <label className="text-xs text-gray-700">
                        <span className="lg:hidden">Column Width (px)</span>
                        <input
                          type="number"
                          min={90}
                          max={240}
                          value={settings.columnWidthPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                columnWidthPx: Number(event.target.value) || current.columnWidthPx,
                              }))
                            )
                          }
                          className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                        />
                      </label>

                      <label className="text-xs text-gray-700">
                        <span className="lg:hidden">Overlap Shift (px)</span>
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={settings.overlapPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                overlapPx: Number(event.target.value) || 0,
                              }))
                            )
                          }
                          className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                        />
                      </label>
                    </div>
                  );
                })}
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
