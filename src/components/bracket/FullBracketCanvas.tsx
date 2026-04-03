'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import type { TournamentBracket, TournamentData, TournamentGame, TournamentTeam } from '@/types/tournament';
import {
  type LayoutSettings,
  type RoundDefinition,
  type RoundLayoutSettings,
  type RoundSlot,
  buildRegionalChampionSlots,
  buildRoundSlots,
  computeRoundGeometries,
  getPickedWinner,
} from '@/lib/fullBracket/fullBracketGeometry';
import { fullBracketDebugOutline } from '@/lib/fullBracket/fullBracketViewChrome';
import { filterTieBreakerIntegerString } from '@/lib/bracketTieBreakerHint';

export type FullBracketSizeMode = '64' | '32';

function TeamRow({
  team,
  isWinner,
  heightPx,
  widthPx,
  fontSizePx,
  labelText,
  labelDisplayMuted,
  winnerTone = 'blue',
  onClick,
}: {
  team?: TournamentTeam;
  isWinner?: boolean;
  heightPx: number;
  widthPx?: number;
  fontSizePx?: number;
  labelText?: string;
  /** When true (e.g. TBD), render label in smaller grey text. */
  labelDisplayMuted?: boolean;
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
        className={`flex items-center justify-center rounded border border-gray-300 bg-white px-2 ${
          labelDisplayMuted ? 'text-xs font-normal text-gray-400' : 'font-semibold text-gray-800'
        }`}
        style={{
          height: `${heightPx}px`,
          width: widthPx ? `${widthPx}px` : undefined,
          ...(labelDisplayMuted ? {} : { fontSize: `${fontSizePx ?? 12}px` }),
        }}
      >
        {labelText}
      </div>
    );
  }

  if (!team) {
    return (
      <div
        className="flex items-center rounded border border-dashed border-gray-300 bg-gray-50 px-2 text-gray-400"
        style={{ height: `${heightPx}px`, width: widthPx ? `${widthPx}px` : undefined, fontSize: `${fontSizePx ?? 12}px` }}
      >
        TBD
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 rounded border px-2 ${
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
        <Image src={team.logo} alt={team.name} width={12} height={12} className="h-3 w-3 flex-shrink-0 object-contain" unoptimized />
      )}
      <span className="truncate">{team.name}</span>
    </div>
  );
}

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
    <div
      className="relative min-w-0 pointer-events-none"
      style={{ width: `${settings.columnWidthPx}px`, height: `${columnHeight}px` }}
    >
      {slots.map((slot, index) => {
        const pickedTeamId = slot.team?.id;
        return (
          <div
            key={slot.id}
            className="pointer-events-auto absolute left-0 right-0 z-[1]"
            style={{ top: `${topOffsets[index] ?? 0}px` }}
          >
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

function RegionBoard({
  regionName,
  regionPosition,
  regionGames,
  picks,
  reverse,
  layout,
  bracketSize,
  onSelectTeam,
  embedded = false,
}: {
  regionName: string;
  regionPosition: string;
  regionGames: TournamentGame[];
  picks: Record<string, string>;
  reverse?: boolean;
  layout: LayoutSettings;
  bracketSize: FullBracketSizeMode;
  onSelectTeam?: (gameId: string, teamId: string) => void;
  /** When true, omit per-region card chrome (used inside one unified full-bracket card). */
  embedded?: boolean;
}) {
  const round64 = regionGames.filter((game) => game.round === 'Round of 64');
  const round32 = regionGames.filter((game) => game.round === 'Round of 32');
  const sweet16 = regionGames.filter((game) => game.round === 'Sweet 16');
  const elite8 = regionGames.filter((game) => game.round === 'Elite 8');
  const semifinalGameId: 'final-four-1' | 'final-four-2' =
    regionPosition === 'Top Left' || regionPosition === 'Bottom Left' ? 'final-four-1' : 'final-four-2';

  const definitions: RoundDefinition[] = useMemo(() => {
    const r64: RoundDefinition = {
      key: 'r64',
      slots: buildRoundSlots(round64, picks),
      settings: layout.rounds.r64,
    };
    const r32: RoundDefinition = {
      key: 'r32',
      slots: buildRoundSlots(round32, picks),
      settings: layout.rounds.r32,
    };
    const s16: RoundDefinition = {
      key: 's16',
      slots: buildRoundSlots(sweet16, picks),
      settings: layout.rounds.s16,
    };
    const e8: RoundDefinition = {
      key: 'e8',
      slots: buildRoundSlots(elite8, picks),
      settings: layout.rounds.e8,
    };
    const r5: RoundDefinition = {
      key: 'r5',
      slots: buildRegionalChampionSlots(elite8, picks, semifinalGameId),
      settings: layout.rounds.r5,
    };
    return bracketSize === '64' ? [r64, r32, s16, e8, r5] : [r32, s16, e8, r5];
  }, [bracketSize, elite8, layout.rounds, picks, round32, round64, semifinalGameId, sweet16]);

  const geometry = useMemo(() => computeRoundGeometries(definitions), [definitions]);

  const columns = useMemo(
    () =>
      definitions.map((def, index) => ({
        id: def.key,
        roundKey: def.key,
        slots: def.slots,
        settings: def.settings,
        index,
      })),
    [definitions]
  );

  return (
    <div
      className={
        embedded
          ? 'relative min-w-0 overflow-visible px-1.5 py-2 sm:px-2 sm:py-2.5'
          : 'relative min-w-0 overflow-visible rounded-lg border border-gray-200 bg-gray-50 p-3'
      }
    >
      <div className="flex min-w-0 items-start overflow-visible" style={{ flexDirection: reverse ? 'row-reverse' : 'row' }}>
        {columns.map((column, index) => {
          const roundGeometry = geometry.byRound[column.roundKey];
          const marginLeft = !reverse && index > 0 ? `-${column.settings.overlapPx}px` : 0;
          const marginRight = reverse && index > 0 ? `-${column.settings.overlapPx}px` : 0;
          const roundColumn = (
            <RoundColumn
              slots={column.slots}
              settings={column.settings}
              topOffsets={roundGeometry?.topOffsets || []}
              columnHeight={geometry.columnHeight}
              onSelectTeam={onSelectTeam}
            />
          );
          if (column.roundKey !== 'r5') {
            return (
              <div
                key={column.id}
                className="pointer-events-none flex-shrink-0"
                style={{ marginLeft, marginRight }}
              >
                {roundColumn}
              </div>
            );
          }
          /** Title centered above the regional champ column (gap above the R5 team row). */
          const r5SlotTop = roundGeometry?.topOffsets[0] ?? 0;
          const labelGapAboveSlotPx = 6;
          const labelBottomOffsetPx =
            geometry.columnHeight - r5SlotTop + labelGapAboveSlotPx;
          return (
            <div
              key={column.id}
              className="pointer-events-none relative flex-shrink-0"
              style={{
                marginLeft,
                marginRight,
                width: `${column.settings.columnWidthPx}px`,
              }}
              data-testid={`full-bracket-region-champ-column-${regionPosition.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {roundColumn}
              <div
                className="pointer-events-none absolute inset-x-0 z-[2] truncate text-center font-semibold leading-tight text-gray-500"
                style={{
                  bottom: `${labelBottomOffsetPx}px`,
                  fontSize: `${layout.regionLabels.fontSizePx}px`,
                  transform: `translate(${layout.regionLabels.offsetXPx}px, ${layout.regionLabels.offsetYPx}px)`,
                }}
                data-testid={`full-bracket-region-title-${regionPosition.replace(/\s+/g, '-').toLowerCase()}`}
              >
                {regionName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Semifinals bar + champ/tie square — centered over the quad grid in {@link FullBracketCanvas}.
 */
function FinalsStrip({
  updatedBracket,
  picks,
  finalsLayout,
  tieBreaker,
  readOnly,
  onTieBreakerChange,
  finalistLeftTitle,
  finalistRightTitle,
  onSelectTeam,
  tieBreakerHintTooltip,
}: {
  updatedBracket: TournamentBracket;
  picks: Record<string, string>;
  finalsLayout: LayoutSettings['finals'];
  tieBreaker: string;
  readOnly?: boolean;
  onTieBreakerChange?: (value: string) => void;
  finalistLeftTitle: string;
  finalistRightTitle: string;
  onSelectTeam?: (gameId: string, teamId: string) => void;
  /** Native tooltip on tie breaker field + label (e.g. My Picks one-page editor). */
  tieBreakerHintTooltip?: string;
}) {
  const finalistLeft = getPickedWinner(updatedBracket.finalFour[0], picks);
  const finalistRight = getPickedWinner(updatedBracket.finalFour[1], picks);
  const champion = getPickedWinner(updatedBracket.championship, picks);
  const championTeamId = champion?.id ?? null;

  const th = finalsLayout.champTieSquareTitleHeightFactor;
  /** Square below semifinals: fits champ row + tie row; sizing driven entirely by layout JSON. */
  const squareSidePx = Math.ceil(
    Math.max(
      finalsLayout.champTieSquareMinSidePx,
      finalsLayout.champWidthPx + finalsLayout.champTieSquareWidthBonusPx,
      finalsLayout.finalScoreWidthPx + finalsLayout.champTieSquareWidthBonusPx,
      finalsLayout.champHeightPx +
        finalsLayout.champTitleFontSizePx * th +
        finalsLayout.finalScoreHeightPx +
        finalsLayout.finalScoreTitleFontSizePx * th +
        finalsLayout.champTieSquareBottomBonusPx
    )
  );

  const stripTranslateY = finalsLayout.finalsClusterOffsetYPx + finalsLayout.finalistOffsetYPx;

  return (
    <div
      className="relative z-20 flex w-full max-w-full flex-col items-center"
      data-testid="full-bracket-finals-strip"
      style={{
        gap: `${finalsLayout.finalsStripStackGapPx}px`,
        transform: `translate(${finalsLayout.finalistOffsetXPx}px, ${stripTranslateY}px)`,
      }}
    >
      {/* Wide bar: left semifinal flush left, right semifinal flush right; titles centered under each slot */}
      <div
        className="flex w-full items-start justify-between rounded-xl border border-gray-300 bg-white/95 shadow-lg backdrop-blur-sm"
        data-testid="full-bracket-semifinals-bar"
        style={{
          gap: `${finalsLayout.semifinalsBarInterColumnGapPx}px`,
          paddingLeft: `${finalsLayout.semifinalsBarPaddingXPx}px`,
          paddingRight: `${finalsLayout.semifinalsBarPaddingXPx}px`,
          paddingTop: `${finalsLayout.semifinalsBarPaddingYPx}px`,
          paddingBottom: `${finalsLayout.semifinalsBarPaddingYPx}px`,
        }}
      >
        <div className="flex min-w-0 flex-col items-center">
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
            className="text-center font-semibold leading-tight text-gray-700"
            style={{
              marginTop: `${finalsLayout.finalistGapPx}px`,
              width: `${finalsLayout.finalistWidthPx}px`,
              fontSize: `${finalsLayout.finalistTitleFontSizePx}px`,
            }}
          >
            {finalistLeftTitle}
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-center">
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
            className="text-center font-semibold leading-tight text-gray-700"
            style={{
              marginTop: `${finalsLayout.finalistGapPx}px`,
              width: `${finalsLayout.finalistWidthPx}px`,
              fontSize: `${finalsLayout.finalistTitleFontSizePx}px`,
            }}
          >
            {finalistRightTitle}
          </div>
        </div>
      </div>

      {/* Centered square: CHAMP on top, tie breaker below */}
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-gray-300 bg-white/95 shadow-lg backdrop-blur-sm"
        data-testid="full-bracket-champ-tie-block"
        style={{
          width: `${squareSidePx}px`,
          height: `${squareSidePx}px`,
          gap: `${finalsLayout.champTieBlockInnerGapPx}px`,
          padding: `${finalsLayout.champTieBlockPaddingPx}px`,
        }}
      >
        <div
          className="flex flex-col items-center"
          style={{
            transform: `translate(${finalsLayout.champOffsetXPx}px, ${finalsLayout.champOffsetYPx}px)`,
          }}
        >
          <TeamRow
            team={champion ?? undefined}
            isWinner={Boolean(champion)}
            heightPx={finalsLayout.champHeightPx}
            widthPx={finalsLayout.champWidthPx}
            fontSizePx={finalsLayout.champFontSizePx}
            winnerTone="gold"
          />
          <div
            className="text-center font-semibold text-gray-700"
            style={{
              marginTop: `${finalsLayout.finalistGapPx}px`,
              width: `${finalsLayout.champWidthPx}px`,
              fontSize: `${finalsLayout.champTitleFontSizePx}px`,
            }}
          >
            CHAMP
          </div>
        </div>
        <div
          className="flex flex-col items-center"
          style={{
            transform: `translate(${finalsLayout.finalScoreOffsetXPx}px, ${finalsLayout.finalScoreOffsetYPx}px)`,
          }}
        >
          {readOnly ? (
            <TeamRow
              heightPx={finalsLayout.finalScoreHeightPx}
              widthPx={finalsLayout.finalScoreWidthPx}
              fontSizePx={finalsLayout.finalScoreFontSizePx}
              labelText={tieBreaker.trim() ? tieBreaker : 'TBD'}
              labelDisplayMuted={!tieBreaker.trim()}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded border border-gray-300 bg-white px-2 text-gray-800"
              style={{ height: `${finalsLayout.finalScoreHeightPx}px`, width: `${finalsLayout.finalScoreWidthPx}px` }}
              title={tieBreakerHintTooltip || undefined}
            >
              <input
                id="full-bracket-tiebreaker-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={tieBreaker}
                onChange={(event) => {
                  const next = filterTieBreakerIntegerString(event.target.value);
                  if (next !== null) onTieBreakerChange?.(next);
                }}
                placeholder="TBD"
                className="w-full min-w-0 bg-transparent text-center text-gray-900 outline-none placeholder:text-xs placeholder:text-gray-400"
                style={{ fontSize: `${finalsLayout.finalScoreFontSizePx}px` }}
                data-testid="full-bracket-tiebreaker-input"
              />
            </div>
          )}
          <div
            className="text-center font-semibold text-gray-700"
            style={{
              marginTop: `${finalsLayout.finalistGapPx}px`,
              width: `${finalsLayout.finalScoreWidthPx}px`,
              fontSize: `${finalsLayout.finalScoreTitleFontSizePx}px`,
            }}
            title={tieBreakerHintTooltip || undefined}
          >
            Tie Breaker
          </div>
        </div>
      </div>
    </div>
  );
}

export interface FullBracketCanvasProps {
  tournamentData: TournamentData;
  updatedBracket: TournamentBracket;
  picks: Record<string, string>;
  tieBreaker: string;
  layout: LayoutSettings;
  bracketSize: FullBracketSizeMode;
  readOnly?: boolean;
  onTieBreakerChange?: (value: string) => void;
  onSelectTeam?: (gameId: string, teamId: string) => void;
  /** Tooltip text for tie breaker input + label (My Picks one-page editor). */
  tieBreakerHintTooltip?: string;
}

/**
 * Full four-region bracket: one outer card, four embedded quadrants, finals centered over the middle void.
 */
export default function FullBracketCanvas({
  tournamentData,
  updatedBracket,
  picks,
  tieBreaker,
  layout,
  bracketSize,
  readOnly,
  onTieBreakerChange,
  onSelectTeam,
  tieBreakerHintTooltip,
}: FullBracketCanvasProps) {
  const getRegionByPosition = (position: string) => tournamentData.regions.find((region) => region.position === position);

  const topLeft = getRegionByPosition('Top Left');
  const bottomLeft = getRegionByPosition('Bottom Left');
  const topRight = getRegionByPosition('Top Right');
  const bottomRight = getRegionByPosition('Bottom Right');
  const bracketRegions = updatedBracket.regions;

  return (
    <div
      className={`min-w-0 w-full max-lg:mx-auto max-lg:w-max max-lg:max-w-none lg:w-full ${fullBracketDebugOutline('canvasRoot')}`.trim()}
      data-testid="full-bracket-canvas"
    >
      <div
        className={`relative w-full max-lg:w-max lg:w-full rounded-xl border-2 border-gray-300 bg-gray-100 px-1 py-2 shadow-md sm:px-2 sm:py-2.5 ${fullBracketDebugOutline('bracketFrame')}`.trim()}
      >
        <div className="relative min-w-0 w-full max-lg:w-max lg:w-full">
          {/*
            Always 2×2 (TL, TR / BL, BR). Below lg, columns use max-content so regions are not squeezed;
            parents should use overflow-auto so users pan horizontally and vertically on small screens.
            At lg+, columns share width 50/50 as before.
          */}
          <div
            className={`relative z-0 grid min-w-0 w-full max-lg:w-max max-lg:grid-cols-[max-content_max-content] max-lg:grid-rows-[max-content_max-content] lg:w-full lg:grid-cols-2 lg:grid-rows-2 ${fullBracketDebugOutline('grid')}`.trim()}
            style={{
              rowGap: layout.quadGrid.rowGapPx,
              columnGap: layout.quadGrid.columnGapPx,
            }}
          >
            <div className={`flex min-w-max justify-start ${fullBracketDebugOutline('cell')}`.trim()}>
              {topLeft ? (
                <RegionBoard
                  embedded
                  regionName={topLeft.name}
                  regionPosition={topLeft.position}
                  regionGames={bracketRegions[topLeft.position] || []}
                  picks={picks}
                  layout={layout}
                  bracketSize={bracketSize}
                  onSelectTeam={readOnly ? undefined : onSelectTeam}
                />
              ) : null}
            </div>
            <div className={`flex min-w-max justify-end ${fullBracketDebugOutline('cell')}`.trim()}>
              {topRight ? (
                <RegionBoard
                  embedded
                  regionName={topRight.name}
                  regionPosition={topRight.position}
                  regionGames={bracketRegions[topRight.position] || []}
                  picks={picks}
                  reverse
                  layout={layout}
                  bracketSize={bracketSize}
                  onSelectTeam={readOnly ? undefined : onSelectTeam}
                />
              ) : null}
            </div>
            <div className={`flex min-w-0 justify-start ${fullBracketDebugOutline('cell')}`.trim()}>
              {bottomLeft ? (
                <RegionBoard
                  embedded
                  regionName={bottomLeft.name}
                  regionPosition={bottomLeft.position}
                  regionGames={bracketRegions[bottomLeft.position] || []}
                  picks={picks}
                  layout={layout}
                  bracketSize={bracketSize}
                  onSelectTeam={readOnly ? undefined : onSelectTeam}
                />
              ) : null}
            </div>
            <div className={`flex min-w-max justify-end ${fullBracketDebugOutline('cell')}`.trim()}>
              {bottomRight ? (
                <RegionBoard
                  embedded
                  regionName={bottomRight.name}
                  regionPosition={bottomRight.position}
                  regionGames={bracketRegions[bottomRight.position] || []}
                  picks={picks}
                  reverse
                  layout={layout}
                  bracketSize={bracketSize}
                  onSelectTeam={readOnly ? undefined : onSelectTeam}
                />
              ) : null}
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            data-testid="full-bracket-finals-overlay"
            style={{
              padding: `${layout.finals.finalsOverlayPaddingPx}px`,
            }}
          >
            <div className="pointer-events-auto">
              <FinalsStrip
                updatedBracket={updatedBracket}
                picks={picks}
                finalsLayout={layout.finals}
                tieBreaker={tieBreaker}
                readOnly={readOnly}
                onTieBreakerChange={onTieBreakerChange}
                finalistLeftTitle={`${topLeft?.name ?? 'Top Left'} vs. ${bottomLeft?.name ?? 'Bottom Left'}`}
                finalistRightTitle={`${topRight?.name ?? 'Top Right'} vs. ${bottomRight?.name ?? 'Bottom Right'}`}
                onSelectTeam={readOnly ? undefined : onSelectTeam}
                tieBreakerHintTooltip={tieBreakerHintTooltip}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
