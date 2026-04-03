/**
 * Pure layout + pick-cascade helpers for the full 64/32 bracket canvas (shared by KEY admin, My Picks, standings).
 */

import type { TournamentGame, TournamentTeam } from '@/types/tournament';
import committedFullBracketLayout from '@/lib/fullBracket/committedFullBracketLayout.json';
import { mergeLayoutSettings } from '@/lib/fullBracket/layoutMerge';

export interface RoundSlot {
  id: string;
  gameId: string;
  team?: TournamentTeam;
  isWinner: boolean;
}

export type RoundKey = 'r64' | 'r32' | 's16' | 'e8' | 'r5';

export interface RoundLayoutSettings {
  slotHeightPx: number;
  matchupGapPx: number;
  gameGapPx: number;
  columnWidthPx: number;
  overlapPx: number;
}

export interface FinalsLayoutSettings {
  finalistWidthPx: number;
  finalistHeightPx: number;
  finalistFontSizePx: number;
  finalistTitleFontSizePx: number;
  /** Space between each finalist team row and its region label (semifinals bar). */
  finalistGapPx: number;
  finalistOffsetXPx: number;
  finalistOffsetYPx: number;
  /** Vertical offset (px) for the whole finals cluster (semifinals bar + champ/tie square), applied together. */
  finalsClusterOffsetYPx: number;
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
  /** Padding on all sides of the overlay that centers the finals strip over the quad grid. */
  finalsOverlayPaddingPx: number;
  /** Vertical gap between the semifinals bar and the champ/tie square. */
  finalsStripStackGapPx: number;
  /** Inner horizontal padding of the semifinals row card. */
  semifinalsBarPaddingXPx: number;
  /** Inner vertical padding of the semifinals row card. */
  semifinalsBarPaddingYPx: number;
  /** Horizontal gap between the two finalist columns in the semifinals bar. */
  semifinalsBarInterColumnGapPx: number;
  /** Inner padding of the champ + tie breaker square card. */
  champTieBlockPaddingPx: number;
  /** Gap between the CHAMP block and the tie breaker block inside the square. */
  champTieBlockInnerGapPx: number;
  /** Minimum side length (px) for the champ/tie square. */
  champTieSquareMinSidePx: number;
  /** Extra horizontal room in the square size formula (legacy +24). */
  champTieSquareWidthBonusPx: number;
  /** Extra vertical room at the bottom of the square size formula (legacy +28). */
  champTieSquareBottomBonusPx: number;
  /** Title line-height factor when estimating vertical space inside the square (legacy 1.4). */
  champTieSquareTitleHeightFactor: number;
}

export interface RegionLabelLayoutSettings {
  fontSizePx: number;
  offsetXPx: number;
  offsetYPx: number;
}

/**
 * Gaps for the 2×2 quad of region boards. Column gap is the horizontal space between
 * left-half and right-half brackets (between facing Round‑5 columns); row gap separates
 * top and bottom rows. Not affected by per-round column width / overlap.
 */
export interface QuadGridLayoutSettings {
  columnGapPx: number;
  rowGapPx: number;
}

export interface LayoutSettings {
  rounds: Record<RoundKey, RoundLayoutSettings>;
  finals: FinalsLayoutSettings;
  regionLabels: RegionLabelLayoutSettings;
  quadGrid: QuadGridLayoutSettings;
}

/**
 * Built-in baseline before optional {@link committedFullBracketLayout} and browser overrides.
 * Keep in sync when adding new layout fields.
 */
export const BUILTIN_FULL_BRACKET_LAYOUT: LayoutSettings = {
  rounds: {
    r64: {
      slotHeightPx: 28,
      matchupGapPx: 0,
      gameGapPx: 4,
      columnWidthPx: 104,
      overlapPx: 0,
    },
    r32: {
      slotHeightPx: 28,
      matchupGapPx: 36,
      gameGapPx: 36,
      columnWidthPx: 104,
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
    finalistOffsetYPx: 0,
    finalsClusterOffsetYPx: 0,
    champWidthPx: 120,
    champHeightPx: 28,
    champFontSizePx: 12,
    champTitleFontSizePx: 11,
    champOffsetXPx: 0,
    champOffsetYPx: 0,
    finalScoreWidthPx: 120,
    finalScoreHeightPx: 28,
    finalScoreFontSizePx: 12,
    finalScoreTitleFontSizePx: 11,
    finalScoreOffsetXPx: 0,
    finalScoreOffsetYPx: 0,
    finalsOverlayPaddingPx: 16,
    finalsStripStackGapPx: 12,
    semifinalsBarPaddingXPx: 16,
    semifinalsBarPaddingYPx: 12,
    semifinalsBarInterColumnGapPx: 16,
    champTieBlockPaddingPx: 12,
    champTieBlockInnerGapPx: 8,
    champTieSquareMinSidePx: 120,
    champTieSquareWidthBonusPx: 24,
    champTieSquareBottomBonusPx: 28,
    champTieSquareTitleHeightFactor: 1.4,
  },
  regionLabels: {
    fontSizePx: 16,
    offsetXPx: 0,
    offsetYPx: 0,
  },
  quadGrid: {
    columnGapPx: 40,
    rowGapPx: 10,
  },
};

/**
 * Effective defaults for all full-bracket surfaces: builtin baseline + committed JSON (checked in for staging/prod).
 */
export const DEFAULT_FULL_BRACKET_LAYOUT: LayoutSettings = mergeLayoutSettings(
  BUILTIN_FULL_BRACKET_LAYOUT,
  committedFullBracketLayout
);

export function buildRoundTopOffsets(slotCount: number, settings: RoundLayoutSettings): number[] {
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

function getSlotCenters(topOffsets: number[], slotHeightPx: number): number[] {
  return topOffsets.map((top) => top + slotHeightPx / 2);
}

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
    deltaSum += previousGameCenters[index]! - currentSlotCenters[index]!;
  }
  const meanDelta = deltaSum / comparableCount;
  return rawTopOffsets.map((top) => top + meanDelta);
}

export interface RoundDefinition {
  key: RoundKey;
  slots: RoundSlot[];
  settings: RoundLayoutSettings;
}

export interface RoundGeometry {
  topOffsets: number[];
  settings: RoundLayoutSettings;
  slots: RoundSlot[];
}

export function computeRoundGeometries(definitions: RoundDefinition[]): {
  byRound: Record<RoundKey, RoundGeometry>;
  columnHeight: number;
} {
  const intermediate: Array<{ key: RoundKey; geometry: RoundGeometry }> = [];

  definitions.forEach((definition, index) => {
    const rawTopOffsets = buildRoundTopOffsets(definition.slots.length, definition.settings);
    const topOffsets =
      index === 0
        ? rawTopOffsets
        : alignRoundToPrevious(
            rawTopOffsets,
            definition.settings,
            intermediate[index - 1]!.geometry.topOffsets,
            intermediate[index - 1]!.geometry.settings
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

export function buildRoundSlots(games: TournamentGame[], picks: Record<string, string>): RoundSlot[] {
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

export function buildRegionalChampionSlots(
  elite8Games: TournamentGame[],
  picks: Record<string, string>,
  semifinalGameId: 'final-four-1' | 'final-four-2'
): RoundSlot[] {
  const game = elite8Games[0];
  if (!game) {
    return [{ id: 'regional-champion-empty', gameId: 'regional-champion-empty', team: undefined, isWinner: false }];
  }

  const pickedTeamId = picks[game.id];
  const winnerTeam =
    game.team1?.id === pickedTeamId ? game.team1 : game.team2?.id === pickedTeamId ? game.team2 : undefined;

  return [
    {
      id: `${game.id}-winner`,
      gameId: semifinalGameId,
      team: winnerTeam,
      isWinner: Boolean(winnerTeam?.id && picks[semifinalGameId] === winnerTeam.id),
    },
  ];
}

export function getDirectChildGameId(gameId: string): string | null {
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

export function getDescendantGameIds(gameId: string): string[] {
  const descendants: string[] = [];
  let current = getDirectChildGameId(gameId);
  while (current) {
    descendants.push(current);
    current = getDirectChildGameId(current);
  }
  return descendants;
}

/**
 * Apply or toggle a pick with downstream cascade (same semantics as KEY preview).
 */
export function applyPickCascade(
  previous: Record<string, string>,
  gameId: string,
  teamId: string
): Record<string, string> {
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
}

export function getPickedWinner(
  game: TournamentGame | undefined,
  picks: Record<string, string>
): TournamentTeam | null {
  if (!game) return null;
  const pickedTeamId = picks[game.id];
  if (!pickedTeamId) return null;
  if (game.team1?.id === pickedTeamId) return game.team1;
  if (game.team2?.id === pickedTeamId) return game.team2;
  return null;
}

export function getRoundLabel(roundKey: RoundKey): string {
  if (roundKey === 'r64') return 'Round 1';
  if (roundKey === 'r32') return 'Round 2';
  if (roundKey === 's16') return 'Round 3';
  if (roundKey === 'e8') return 'Round 4';
  return 'Round 5';
}

/** Horizontal span of one region's round columns (matches flex + negative margins in RegionBoard). */
export function computeRegionBoardWidth(layout: LayoutSettings, bracketSize: '64' | '32'): number {
  const keys: RoundKey[] =
    bracketSize === '64' ? ['r64', 'r32', 's16', 'e8', 'r5'] : ['r32', 's16', 'e8', 'r5'];
  let w = 0;
  keys.forEach((key, index) => {
    const s = layout.rounds[key];
    if (index === 0) w = s.columnWidthPx;
    else w += s.columnWidthPx - s.overlapPx;
  });
  return w;
}

export function withUpdatedRoundSetting(
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
