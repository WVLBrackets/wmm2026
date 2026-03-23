'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { generate64TeamBracket, updateBracketWithPicks } from '@/lib/bracketGenerator';
import { loadTournamentData } from '@/lib/tournamentLoader';
import {
  applyDisplayNamesToTournamentData,
  buildTeamIdToDisplayNameMapFromApi,
} from '@/lib/teamDisplayName';
import { TournamentBracket, TournamentData, TournamentGame, TournamentTeam } from '@/types/tournament';

interface KeyBracketPreviewModalProps {
  isOpen: boolean;
  year: string;
  onClose: () => void;
  embedded?: boolean;
  readOnly?: boolean;
}

interface LiveResultsPreviewResponse {
  success: boolean;
  error?: string;
  data?: {
    picks?: Record<string, string>;
    tieBreaker?: number | null;
    bracketId?: string | null;
  };
}

interface RoundSlot {
  id: string;
  gameId: string;
  team?: TournamentTeam;
  isWinner: boolean;
}

type RoundKey = 'r64' | 'r32' | 's16' | 'e8' | 'r5';

interface RoundLayoutSettings {
  slotHeightPx: number;
  matchupGapPx: number;
  gameGapPx: number;
  columnWidthPx: number;
  overlapPx: number;
}

interface FinalsLayoutSettings {
  finalistWidthPx: number;
  finalistHeightPx: number;
  finalistFontSizePx: number;
  finalistTitleFontSizePx: number;
  finalistGapPx: number;
  finalistOffsetXPx: number;
  finalistOffsetYPx: number;
  champWidthPx: number;
  champHeightPx: number;
  champFontSizePx: number;
  champTitleFontSizePx: number;
  champOffsetXPx: number;
  champOffsetYPx: number;
  finalScoreWidthPx: number;
  finalScoreHeightPx: number;
  finalScoreFontSizePx: number;
  finalScoreTitleFontSizePx: number;
  finalScoreOffsetXPx: number;
  finalScoreOffsetYPx: number;
}

interface RegionLabelLayoutSettings {
  fontSizePx: number;
  offsetXPx: number;
  offsetYPx: number;
}

interface LayoutSettings {
  rounds: Record<RoundKey, RoundLayoutSettings>;
  finals: FinalsLayoutSettings;
  regionLabels: RegionLabelLayoutSettings;
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
    r5: {
      slotHeightPx: 28,
      matchupGapPx: 0,
      gameGapPx: 0,
      columnWidthPx: 120,
      overlapPx: 60,
    },
  },
  finals: {
    finalistWidthPx: 120,
    finalistHeightPx: 28,
    finalistFontSizePx: 12,
    finalistTitleFontSizePx: 11,
    finalistGapPx: 6,
    finalistOffsetXPx: 0,
    finalistOffsetYPx: -20,
    champWidthPx: 120,
    champHeightPx: 28,
    champFontSizePx: 12,
    champTitleFontSizePx: 11,
    champOffsetXPx: 0,
    champOffsetYPx: 45,
    finalScoreWidthPx: 120,
    finalScoreHeightPx: 28,
    finalScoreFontSizePx: 12,
    finalScoreTitleFontSizePx: 11,
    finalScoreOffsetXPx: 0,
    finalScoreOffsetYPx: 85,
  },
  regionLabels: {
    fontSizePx: 16,
    offsetXPx: 0,
    offsetYPx: 0,
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
function TeamRow({
  team,
  isWinner,
  heightPx,
  widthPx,
  fontSizePx,
  labelText,
  winnerTone = 'blue',
  onClick,
}: {
  team?: TournamentTeam;
  isWinner?: boolean;
  heightPx: number;
  widthPx?: number;
  fontSizePx?: number;
  labelText?: string;
  winnerTone?: 'blue' | 'gold';
  onClick?: () => void;
}) {
  const winnerClasses =
    winnerTone === 'gold'
      ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
      : 'border-blue-500 bg-blue-50 text-blue-900 font-semibold';

  if (labelText) {
    return (
      <div
        className="px-2 rounded border border-gray-300 bg-white text-gray-800 flex items-center justify-center font-semibold"
        style={{ height: `${heightPx}px`, width: widthPx ? `${widthPx}px` : undefined, fontSize: `${fontSizePx ?? 12}px` }}
      >
        {labelText}
      </div>
    );
  }

  if (!team) {
    return (
      <div
        className="px-2 rounded border border-dashed border-gray-300 bg-gray-50 text-gray-400 flex items-center"
        style={{ height: `${heightPx}px`, width: widthPx ? `${widthPx}px` : undefined, fontSize: `${fontSizePx ?? 12}px` }}
      >
        TBD
      </div>
    );
  }

  return (
    <div
      className={`px-2 rounded border flex items-center gap-1.5 ${
        isWinner ? winnerClasses : 'border-gray-300 bg-white text-gray-800'
      } ${onClick ? 'cursor-pointer select-none hover:border-gray-500' : ''}`}
      style={{ height: `${heightPx}px`, width: widthPx ? `${widthPx}px` : undefined, fontSize: `${fontSizePx ?? 12}px` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
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
      gameId: game.id,
      team: game.team1,
      isWinner: game.team1?.id === pickedTeamId,
    });
    slots.push({
      id: `${game.id}-2`,
      gameId: game.id,
      team: game.team2,
      isWinner: game.team2?.id === pickedTeamId,
    });
  });

  return slots;
}

/**
 * Build Round 5 as the regional champion slot (winner of Elite 8).
 */
function buildRegionalChampionSlots(
  elite8Games: TournamentGame[],
  picks: Record<string, string>,
  semifinalGameId: 'final-four-1' | 'final-four-2'
): RoundSlot[] {
  const game = elite8Games[0];
  if (!game) {
    return [{ id: 'regional-champion-empty', gameId: 'regional-champion-empty', team: undefined, isWinner: false }];
  }

  const pickedTeamId = picks[game.id];
  const winnerTeam = game.team1?.id === pickedTeamId ? game.team1 : game.team2?.id === pickedTeamId ? game.team2 : undefined;

  return [
    {
      id: `${game.id}-winner`,
      gameId: semifinalGameId,
      team: winnerTeam,
      isWinner: Boolean(winnerTeam?.id && picks[semifinalGameId] === winnerTeam.id),
    },
  ];
}

/**
 * Returns the direct child game for the provided game ID.
 */
function getDirectChildGameId(gameId: string): string | null {
  if (gameId === 'final-four-1' || gameId === 'final-four-2') {
    return 'championship';
  }
  if (gameId === 'championship') {
    return null;
  }

  const regionalMatch = gameId.match(/^(.*)-(r64|r32|s16|e8)-(\d+)$/);
  if (!regionalMatch) {
    return null;
  }

  const [, regionPosition, roundKey, gameNumberRaw] = regionalMatch;
  const gameNumber = Number(gameNumberRaw);

  if (roundKey === 'r64') {
    return `${regionPosition}-r32-${Math.ceil(gameNumber / 2)}`;
  }
  if (roundKey === 'r32') {
    return `${regionPosition}-s16-${Math.ceil(gameNumber / 2)}`;
  }
  if (roundKey === 's16') {
    return `${regionPosition}-e8-1`;
  }
  if (roundKey === 'e8') {
    const isLeftSide = regionPosition === 'Top Left' || regionPosition === 'Bottom Left';
    return isLeftSide ? 'final-four-1' : 'final-four-2';
  }
  return null;
}

/**
 * Builds descendant game IDs along a game's advancement path.
 */
function getDescendantGameIds(gameId: string): string[] {
  const descendants: string[] = [];
  let current = getDirectChildGameId(gameId);
  while (current) {
    descendants.push(current);
    current = getDirectChildGameId(current);
  }
  return descendants;
}

/**
 * Resolve picked winner for a game if teams are available.
 */
function getPickedWinner(game: TournamentGame | undefined, picks: Record<string, string>): TournamentTeam | null {
  if (!game) return null;
  const pickedTeamId = picks[game.id];
  if (!pickedTeamId) return null;
  if (game.team1?.id === pickedTeamId) return game.team1;
  if (game.team2?.id === pickedTeamId) return game.team2;
  return null;
}

/**
 * Render one vertical round column with bracket-aligned spacing.
 */
function RoundColumn({
  slots,
  settings,
  topOffsets,
  columnHeight,
  onSelectTeam,
}: {
  slots: RoundSlot[];
  settings: RoundLayoutSettings;
  topOffsets: number[];
  columnHeight: number;
  onSelectTeam?: (gameId: string, teamId: string) => void;
}) {
  return (
    <div className="min-w-0 relative" style={{ width: `${settings.columnWidthPx}px`, height: `${columnHeight}px` }}>
      {slots.map((slot, index) => {
        const pickedTeamId = slot.team?.id;
        return (
        <div key={slot.id} className="absolute left-0 right-0" style={{ top: `${topOffsets[index] ?? 0}px` }}>
          <TeamRow
            team={slot.team}
            isWinner={slot.isWinner}
            heightPx={settings.slotHeightPx}
            onClick={pickedTeamId && onSelectTeam ? () => onSelectTeam(slot.gameId, pickedTeamId) : undefined}
          />
        </div>
        );
      })}
    </div>
  );
}

/**
 * Render finalists and champion in a centered, tunable layout zone.
 */
function FinalsPlacement({
  updatedBracket,
  picks,
  finalsLayout,
  tieBreaker,
  onTieBreakerChange,
  readOnly,
  finalistLeftTitle,
  finalistRightTitle,
  onSelectTeam,
}: {
  updatedBracket: TournamentBracket;
  picks: Record<string, string>;
  finalsLayout: FinalsLayoutSettings;
  tieBreaker: string;
  onTieBreakerChange?: (value: string) => void;
  readOnly?: boolean;
  finalistLeftTitle: string;
  finalistRightTitle: string;
  onSelectTeam?: (gameId: string, teamId: string) => void;
}) {
  const finalistLeft = getPickedWinner(updatedBracket.finalFour[0], picks);
  const finalistRight = getPickedWinner(updatedBracket.finalFour[1], picks);
  const champion = getPickedWinner(updatedBracket.championship, picks);
  const championTeamId = champion?.id ?? null;

  return (
    <div className="relative w-full h-0">
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          marginLeft: `${finalsLayout.finalistOffsetXPx}px`,
          marginTop: `${finalsLayout.finalistOffsetYPx}px`,
        }}
      >
        <div className="flex items-center" style={{ gap: `${finalsLayout.finalistGapPx}px` }}>
          <div className="flex flex-col items-center">
            <TeamRow
              team={finalistLeft ?? undefined}
              isWinner={Boolean(finalistLeft?.id && championTeamId && finalistLeft.id === championTeamId)}
              heightPx={finalsLayout.finalistHeightPx}
              widthPx={finalsLayout.finalistWidthPx}
              fontSizePx={finalsLayout.finalistFontSizePx}
              onClick={
                finalistLeft?.id && onSelectTeam && !readOnly
                  ? () => onSelectTeam(updatedBracket.championship.id, finalistLeft.id)
                  : undefined
              }
            />
            <div
              className="mt-1 text-center font-semibold text-gray-700"
              style={{ width: `${finalsLayout.finalistWidthPx}px`, fontSize: `${finalsLayout.finalistTitleFontSizePx}px` }}
            >
              {finalistLeftTitle}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <TeamRow
              team={finalistRight ?? undefined}
              isWinner={Boolean(finalistRight?.id && championTeamId && finalistRight.id === championTeamId)}
              heightPx={finalsLayout.finalistHeightPx}
              widthPx={finalsLayout.finalistWidthPx}
              fontSizePx={finalsLayout.finalistFontSizePx}
              onClick={
                finalistRight?.id && onSelectTeam && !readOnly
                  ? () => onSelectTeam(updatedBracket.championship.id, finalistRight.id)
                  : undefined
              }
            />
            <div
              className="mt-1 text-center font-semibold text-gray-700"
              style={{ width: `${finalsLayout.finalistWidthPx}px`, fontSize: `${finalsLayout.finalistTitleFontSizePx}px` }}
            >
              {finalistRightTitle}
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          marginLeft: `${finalsLayout.champOffsetXPx}px`,
          marginTop: `${finalsLayout.champOffsetYPx}px`,
        }}
      >
        <div className="flex flex-col items-center">
          <TeamRow
            team={champion ?? undefined}
            isWinner={Boolean(champion)}
            heightPx={finalsLayout.champHeightPx}
            widthPx={finalsLayout.champWidthPx}
            fontSizePx={finalsLayout.champFontSizePx}
            winnerTone="gold"
          />
          <div
            className="mt-1 text-center font-semibold text-gray-700"
            style={{ width: `${finalsLayout.champWidthPx}px`, fontSize: `${finalsLayout.champTitleFontSizePx}px` }}
          >
            CHAMP
          </div>
        </div>
      </div>

      <div
        className="absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          marginLeft: `${finalsLayout.finalScoreOffsetXPx}px`,
          marginTop: `${finalsLayout.finalScoreOffsetYPx}px`,
        }}
      >
        <div className="flex flex-col items-center">
          {readOnly ? (
            <TeamRow
              heightPx={finalsLayout.finalScoreHeightPx}
              widthPx={finalsLayout.finalScoreWidthPx}
              fontSizePx={finalsLayout.finalScoreFontSizePx}
              labelText={tieBreaker.trim() || 'Tie Breaker'}
            />
          ) : (
            <div
              className="px-2 rounded border border-gray-300 bg-white text-gray-800 flex items-center justify-center"
              style={{ height: `${finalsLayout.finalScoreHeightPx}px`, width: `${finalsLayout.finalScoreWidthPx}px` }}
            >
              <input
                type="number"
                inputMode="numeric"
                value={tieBreaker}
                onChange={(event) => onTieBreakerChange?.(event.target.value)}
                placeholder="Tie Breaker"
                className="w-full bg-transparent text-center outline-none text-gray-900 placeholder:text-gray-400"
                style={{ fontSize: `${finalsLayout.finalScoreFontSizePx}px` }}
              />
            </div>
          )}
          <div
            className="mt-1 text-center font-semibold text-gray-700"
            style={{ width: `${finalsLayout.finalScoreWidthPx}px`, fontSize: `${finalsLayout.finalScoreTitleFontSizePx}px` }}
          >
            Tie Breaker
          </div>
        </div>
      </div>
    </div>
  );
}

function getRoundKeyFromLevel(level: number): RoundKey {
  if (level === 0) return 'r64';
  if (level === 1) return 'r32';
  if (level === 2) return 's16';
  if (level === 3) return 'e8';
  return 'r5';
}

function getRoundLabel(roundKey: RoundKey): string {
  if (roundKey === 'r64') return 'Round 1';
  if (roundKey === 'r32') return 'Round 2';
  if (roundKey === 's16') return 'Round 3';
  if (roundKey === 'e8') return 'Round 4';
  return 'Round 5';
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
  regionName,
  regionPosition,
  regionGames,
  picks,
  reverse,
  layout,
  onSelectTeam,
}: {
  regionName: string;
  regionPosition: string;
  regionGames: TournamentGame[];
  picks: Record<string, string>;
  reverse?: boolean;
  layout: LayoutSettings;
  onSelectTeam?: (gameId: string, teamId: string) => void;
}) {
  const round64 = regionGames.filter((game) => game.round === 'Round of 64');
  const round32 = regionGames.filter((game) => game.round === 'Round of 32');
  const sweet16 = regionGames.filter((game) => game.round === 'Sweet 16');
  const elite8 = regionGames.filter((game) => game.round === 'Elite 8');
  const semifinalGameId: 'final-four-1' | 'final-four-2' =
    regionPosition === 'Top Left' || regionPosition === 'Bottom Left' ? 'final-four-1' : 'final-four-2';

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
    {
      id: 'r5',
      roundLevel: 4,
      slots: buildRegionalChampionSlots(elite8, picks, semifinalGameId),
      settings: layout.rounds.r5,
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

  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 min-w-0 relative overflow-hidden">
      <div
        className={`absolute top-1 ${reverse ? 'left-2' : 'right-2'} text-gray-500 font-semibold pointer-events-none`}
        style={{
          marginTop: `${layout.regionLabels.offsetYPx}px`,
          transform: `translateX(${reverse ? -layout.regionLabels.offsetXPx : layout.regionLabels.offsetXPx}px)`,
          fontSize: `${layout.regionLabels.fontSizePx}px`,
        }}
      >
        {regionName}
      </div>
      <div className="flex items-start" style={{ flexDirection: reverse ? 'row-reverse' : 'row' }}>
        {columns.map((column, index) => {
          const roundKey = getRoundKeyFromLevel(column.roundLevel);
          const roundGeometry = geometry.byRound[roundKey];

          return (
            <div
              key={column.id}
              className="flex-shrink-0"
              style={{
                marginLeft: !reverse && index > 0 ? `-${column.settings.overlapPx}px` : 0,
                marginRight: reverse && index > 0 ? `-${column.settings.overlapPx}px` : 0,
              }}
            >
              <RoundColumn
                slots={column.slots}
                settings={column.settings}
                topOffsets={roundGeometry?.topOffsets || []}
                columnHeight={geometry.columnHeight}
                onSelectTeam={onSelectTeam}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function KeyBracketPreviewModal({
  isOpen,
  year,
  onClose,
  embedded = false,
  readOnly = false,
}: KeyBracketPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [updatedBracket, setUpdatedBracket] = useState<TournamentBracket | null>(null);
  const [tieBreaker, setTieBreaker] = useState<string>('');
  const [keyBracketId, setKeyBracketId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [layout, setLayout] = useState<LayoutSettings>(DEFAULT_LAYOUT_SETTINGS);
  const [showLayoutControls, setShowLayoutControls] = useState(false);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const lastSavedRef = useRef<string>('');

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
              r5: { ...previous.rounds.r5, ...saved.rounds.r5 },
            },
            finals: {
              ...previous.finals,
              ...(saved.finals ?? {}),
            },
            regionLabels: {
              ...previous.regionLabels,
              ...(saved.regionLabels ?? {}),
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
            r5: {
              ...previous.rounds.r5,
              slotHeightPx: legacy.slotHeightPx ?? previous.rounds.r5.slotHeightPx,
              columnWidthPx: legacy.columnWidthPx ?? previous.rounds.r5.columnWidthPx,
              overlapPx: legacy.overlapPx ?? previous.rounds.r5.overlapPx,
            },
          },
          finals: previous.finals,
          regionLabels: previous.regionLabels,
        };
      });
    } catch (storageError) {
      console.warn('Failed to restore KEY bracket preview layout settings:', storageError);
    } finally {
      setLayoutLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!layoutLoaded) return;
    window.localStorage.setItem('keyBracketPreviewLayout', JSON.stringify(layout));
  }, [layout, layoutLoaded]);

  useEffect(() => {
    if (!isOpen) return;

    const loadPreviewData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [previewResponse, rawTournament] = await Promise.all([
          fetch(`/api/admin/live-results?year=${encodeURIComponent(year)}`),
          loadTournamentData(year),
        ]);

        let tournament = rawTournament;
        try {
          const refResponse = await fetch('/api/team-data?activeOnly=false', {
            cache: 'no-store',
          });
          const refJson = await refResponse.json();
          if (refJson.success && Array.isArray(refJson.data) && refJson.data.length > 0) {
            tournament = applyDisplayNamesToTournamentData(
              rawTournament,
              buildTeamIdToDisplayNameMapFromApi(refJson.data)
            );
          }
        } catch (refError) {
          console.warn('[KEY preview] Could not apply team display names:', refError);
        }

        const previewResult = (await previewResponse.json()) as LiveResultsPreviewResponse;
        if (!previewResponse.ok || !previewResult.success) {
          throw new Error(previewResult.error || 'Failed to load KEY preview data.');
        }

        const previewPicks = previewResult.data?.picks ?? {};
        const baseBracket = generate64TeamBracket(tournament);
        const resolvedBracket = updateBracketWithPicks(baseBracket, previewPicks, tournament);

        setPicks(previewPicks);
        setTieBreaker(previewResult.data?.tieBreaker != null ? String(previewResult.data.tieBreaker) : '');
        setTournamentData(tournament);
        setUpdatedBracket(resolvedBracket);
        setKeyBracketId(previewResult.data?.bracketId ?? null);
        setSaveError(null);
        lastSavedRef.current = JSON.stringify({
          picks: previewPicks,
          tieBreaker: previewResult.data?.tieBreaker != null ? String(previewResult.data.tieBreaker) : '',
        });
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
    if (!tournamentData) return;
    const baseBracket = generate64TeamBracket(tournamentData);
    const resolvedBracket = updateBracketWithPicks(baseBracket, picks, tournamentData);
    setUpdatedBracket(resolvedBracket);
  }, [picks, tournamentData]);

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

  /**
   * Applies click behavior for winner picks with downstream cascade semantics.
   */
  const handleTeamPick = (gameId: string, teamId: string) => {
    setPicks((previous) => {
      const currentPick = previous[gameId];
      const next = { ...previous };
      const downstreamGameIds = getDescendantGameIds(gameId);

      if (!currentPick) {
        next[gameId] = teamId;
        return next;
      }

      if (currentPick === teamId) {
        delete next[gameId];
        downstreamGameIds.forEach((downstreamGameId) => {
          if (next[downstreamGameId] === teamId) {
            delete next[downstreamGameId];
          }
        });
        return next;
      }

      next[gameId] = teamId;
      downstreamGameIds.forEach((downstreamGameId) => {
        if (next[downstreamGameId] === currentPick) {
          next[downstreamGameId] = teamId;
        }
      });
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen || !tournamentData) return;
    if (readOnly) return;

    const saveSignature = JSON.stringify({ picks, tieBreaker });
    if (saveSignature === lastSavedRef.current) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSaving(true);
        setSaveError(null);

        let activeBracketId = keyBracketId;
        if (!activeBracketId) {
          const openResponse = await fetch('/api/admin/live-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: Number(year) }),
          });
          const openResult = (await openResponse.json()) as { success?: boolean; error?: string; data?: { bracketId?: string } };
          if (!openResponse.ok || !openResult.success || !openResult.data?.bracketId) {
            throw new Error(openResult.error || 'Failed to initialize KEY bracket session');
          }
          activeBracketId = openResult.data.bracketId;
          if (!cancelled) {
            setKeyBracketId(activeBracketId);
          }
        }

        let tieBreakerPayload: number | null = null;
        if (tieBreaker.trim() !== '') {
          const parsed = Number(tieBreaker);
          if (Number.isFinite(parsed)) {
            tieBreakerPayload = parsed;
          }
        }

        const saveResponse = await fetch(`/api/admin/live-results/${activeBracketId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ picks, tieBreaker: tieBreakerPayload }),
        });
        const saveResult = (await saveResponse.json()) as { success?: boolean; error?: string };
        if (!saveResponse.ok || !saveResult.success) {
          throw new Error(saveResult.error || 'Failed to save KEY bracket changes');
        }

        if (!cancelled) {
          lastSavedRef.current = saveSignature;
        }
      } catch (persistError) {
        if (!cancelled) {
          setSaveError(persistError instanceof Error ? persistError.message : 'Failed to save KEY changes');
        }
      } finally {
        if (!cancelled) {
          setIsSaving(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, keyBracketId, picks, tieBreaker, tournamentData, year, readOnly]);

  if (!isOpen) return null;

  return (
    <div
      className={
        embedded
          ? 'mt-6 rounded-xl border border-gray-200 bg-white shadow-sm'
          : 'fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4'
      }
      onClick={embedded ? undefined : onClose}
    >
      <div
        className={embedded ? 'w-full overflow-hidden' : 'bg-white rounded-xl shadow-2xl w-[96vw] max-w-[1500px] max-h-[92vh] overflow-hidden'}
        onClick={embedded ? undefined : (event) => event.stopPropagation()}
      >
        <div className={`p-4 overflow-auto bg-white ${embedded ? '' : 'max-h-[92vh]'}`}>
          <div className="mb-3 flex items-center gap-2">
            {!embedded && (
              <>
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
              </>
            )}
            {!showLayoutControls && !readOnly && !embedded && (
              <div className="text-xs text-gray-500">
                {isSaving ? 'Saving KEY changes...' : saveError ? `Save error: ${saveError}` : 'KEY changes auto-save on click/edit'}
              </div>
            )}
          </div>

          {showLayoutControls && !embedded && (
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
                {(['r64', 'r32', 's16', 'e8', 'r5'] as RoundKey[]).map((roundKey) => {
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

              <div className="mt-4 border-t border-gray-200 pt-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Finalists</div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  <label className="text-xs text-gray-700">
                    Width (px)
                    <input
                      type="number"
                      min={80}
                      max={260}
                      value={layout.finals.finalistWidthPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalistWidthPx: Number(event.target.value) || previous.finals.finalistWidthPx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Height (px)
                    <input
                      type="number"
                      min={20}
                      max={52}
                      value={layout.finals.finalistHeightPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalistHeightPx: Number(event.target.value) || previous.finals.finalistHeightPx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Font Size (px)
                    <input
                      type="number"
                      min={9}
                      max={24}
                      value={layout.finals.finalistFontSizePx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalistFontSizePx: Number(event.target.value) || previous.finals.finalistFontSizePx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Title Font Size (px)
                    <input
                      type="number"
                      min={9}
                      max={24}
                      value={layout.finals.finalistTitleFontSizePx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalistTitleFontSizePx: Number(event.target.value) || previous.finals.finalistTitleFontSizePx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Gap (px)
                    <input
                      type="number"
                      min={0}
                      max={80}
                      value={layout.finals.finalistGapPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalistGapPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Move X (px)
                    <input
                      type="number"
                      min={-300}
                      max={300}
                      value={layout.finals.finalistOffsetXPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalistOffsetXPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Move Y (px)
                    <input
                      type="number"
                      min={-300}
                      max={300}
                      value={layout.finals.finalistOffsetYPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalistOffsetYPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Champion</div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  <label className="text-xs text-gray-700">
                    Width (px)
                    <input
                      type="number"
                      min={80}
                      max={260}
                      value={layout.finals.champWidthPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            champWidthPx: Number(event.target.value) || previous.finals.champWidthPx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Height (px)
                    <input
                      type="number"
                      min={20}
                      max={52}
                      value={layout.finals.champHeightPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            champHeightPx: Number(event.target.value) || previous.finals.champHeightPx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Font Size (px)
                    <input
                      type="number"
                      min={9}
                      max={24}
                      value={layout.finals.champFontSizePx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            champFontSizePx: Number(event.target.value) || previous.finals.champFontSizePx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Title Font Size (px)
                    <input
                      type="number"
                      min={9}
                      max={24}
                      value={layout.finals.champTitleFontSizePx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            champTitleFontSizePx: Number(event.target.value) || previous.finals.champTitleFontSizePx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Move X (px)
                    <input
                      type="number"
                      min={-300}
                      max={300}
                      value={layout.finals.champOffsetXPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            champOffsetXPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Move Y (px)
                    <input
                      type="number"
                      min={-300}
                      max={300}
                      value={layout.finals.champOffsetYPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            champOffsetYPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Final Score Box</div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  <label className="text-xs text-gray-700">
                    Width (px)
                    <input
                      type="number"
                      min={80}
                      max={260}
                      value={layout.finals.finalScoreWidthPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalScoreWidthPx: Number(event.target.value) || previous.finals.finalScoreWidthPx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Height (px)
                    <input
                      type="number"
                      min={20}
                      max={52}
                      value={layout.finals.finalScoreHeightPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalScoreHeightPx: Number(event.target.value) || previous.finals.finalScoreHeightPx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Font Size (px)
                    <input
                      type="number"
                      min={9}
                      max={24}
                      value={layout.finals.finalScoreFontSizePx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalScoreFontSizePx: Number(event.target.value) || previous.finals.finalScoreFontSizePx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Title Font Size (px)
                    <input
                      type="number"
                      min={9}
                      max={24}
                      value={layout.finals.finalScoreTitleFontSizePx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalScoreTitleFontSizePx: Number(event.target.value) || previous.finals.finalScoreTitleFontSizePx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Move X (px)
                    <input
                      type="number"
                      min={-300}
                      max={300}
                      value={layout.finals.finalScoreOffsetXPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalScoreOffsetXPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Move Y (px)
                    <input
                      type="number"
                      min={-300}
                      max={300}
                      value={layout.finals.finalScoreOffsetYPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          finals: {
                            ...previous.finals,
                            finalScoreOffsetYPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Region Labels</div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  <label className="text-xs text-gray-700">
                    Font Size (px)
                    <input
                      type="number"
                      min={10}
                      max={36}
                      value={layout.regionLabels.fontSizePx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          regionLabels: {
                            ...previous.regionLabels,
                            fontSizePx: Number(event.target.value) || previous.regionLabels.fontSizePx,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Move X (px)
                    <input
                      type="number"
                      min={-120}
                      max={120}
                      value={layout.regionLabels.offsetXPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          regionLabels: {
                            ...previous.regionLabels,
                            offsetXPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    Move Y (px)
                    <input
                      type="number"
                      min={-60}
                      max={250}
                      value={layout.regionLabels.offsetYPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          regionLabels: {
                            ...previous.regionLabels,
                            offsetYPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900"
                    />
                  </label>
                </div>
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
            <div className="relative space-y-4 min-w-[1100px]">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {regionsByPosition.topLeft && (
                  <RegionBoard
                    regionName={regionsByPosition.topLeft.name}
                    regionPosition={regionsByPosition.topLeft.position}
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.topLeft.position] || []}
                    picks={picks}
                    layout={layout}
                    onSelectTeam={readOnly ? undefined : handleTeamPick}
                  />
                )}
                {regionsByPosition.topRight && (
                  <RegionBoard
                    regionName={regionsByPosition.topRight.name}
                    regionPosition={regionsByPosition.topRight.position}
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.topRight.position] || []}
                    picks={picks}
                    reverse
                    layout={layout}
                    onSelectTeam={readOnly ? undefined : handleTeamPick}
                  />
                )}
              </div>

              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                {updatedBracket && (
                  <FinalsPlacement
                    updatedBracket={updatedBracket}
                    picks={picks}
                    finalsLayout={layout.finals}
                    tieBreaker={tieBreaker}
                    readOnly={readOnly}
                    onTieBreakerChange={setTieBreaker}
                    finalistLeftTitle={`${regionsByPosition.topLeft?.name ?? 'Top Left'} vs. ${regionsByPosition.bottomLeft?.name ?? 'Bottom Left'}`}
                    finalistRightTitle={`${regionsByPosition.topRight?.name ?? 'Top Right'} vs. ${regionsByPosition.bottomRight?.name ?? 'Bottom Right'}`}
                    onSelectTeam={readOnly ? undefined : handleTeamPick}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {regionsByPosition.bottomLeft && (
                  <RegionBoard
                    regionName={regionsByPosition.bottomLeft.name}
                    regionPosition={regionsByPosition.bottomLeft.position}
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.bottomLeft.position] || []}
                    picks={picks}
                    layout={layout}
                    onSelectTeam={readOnly ? undefined : handleTeamPick}
                  />
                )}
                {regionsByPosition.bottomRight && (
                  <RegionBoard
                    regionName={regionsByPosition.bottomRight.name}
                    regionPosition={regionsByPosition.bottomRight.position}
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.bottomRight.position] || []}
                    picks={picks}
                    reverse
                    layout={layout}
                    onSelectTeam={readOnly ? undefined : handleTeamPick}
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
