'use client';

import { useEffect, useRef, RefObject } from 'react';
import Image from 'next/image';
import { TournamentGame } from '@/types/tournament';
import { CheckCircle, Save, KeyRound, ArrowRight, X } from 'lucide-react';
import { BRACKET_EDITOR_BAR_ACTION_CLASSES } from '@/lib/bracketStepNavMetrics';
import BracketEditorTopMessage from './BracketEditorTopMessage';
import BracketStepNavBar from './BracketStepNavBar';
interface RegionBracketLayoutProps {
  regionName: string;
  games: TournamentGame[];
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
  readOnly?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onSave?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
  /** Large circular control to advance to the next region (bottom text Next removed). */
  onNext?: () => void;
  canProceed?: boolean;
  /** Full-bracket submit (uses `submitEnabled` / `submitDisabledMessage` from parent). */
  onSubmitBracket?: () => void;
  submitEnabled?: boolean;
  submitDisabledMessage?: string;
  isAdminMode?: boolean;
  currentStep?: number;
  totalSteps?: number;
  bracketNumber?: number;
  year?: number;
  // Step nav (region names + Final Four)
  onStepClick?: (stepIndex: number) => void;
  isStepComplete?: (step: number) => boolean;
  stepNavLabels?: string[];
  stepButtonWidthCh?: number;
  finalFourDisabledMessage?: string;
  // Entry name and region info props
  entryName?: string;
  onEntryNameChange?: (value: string) => void;
  isLiveResultsMode?: boolean;
  disableSave?: boolean;
  disableSaveMessage?: string;
  /** Site config `bracket_regional_message` — banner above the bracket on regional steps */
  bracketRegionalMessage?: string;
}

export default function RegionBracketLayout({
  regionName,
  games,
  picks,
  onPick,
  readOnly = false,
  scrollContainerRef,
  onSave,
  onClose,
  onCancel,
  onNext,
  canProceed = false,
  currentStep = 0,
  totalSteps = 5,
  onStepClick,
  isStepComplete,
  stepNavLabels = [],
  stepButtonWidthCh = 12,
  finalFourDisabledMessage = '',
  entryName = '',
  onEntryNameChange,
  isLiveResultsMode = false,
  disableSave = false,
  disableSaveMessage = '',
  bracketRegionalMessage = '',
}: RegionBracketLayoutProps) {
  const hasScrolledRoundOf64Ref = useRef(false);
  const hasScrolledRoundOf32Ref = useRef(false);
  const hasScrolledSweet16Ref = useRef(false);

  const handleTeamClick = (game: TournamentGame, team: Record<string, unknown>) => {
    if (game.winner || readOnly) return;
    onPick(game.id, team.id as string);
  };

  const renderTeam = (team: Record<string, unknown> | undefined, game: TournamentGame) => {
    // Always render a slot, even if no team is assigned yet
    if (!team) {
      return (
        <div className="w-full h-6 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
          <span className="text-xs text-gray-400">-</span>
        </div>
      );
    }

    const isSelected = picks[game.id] === (team.id as string);
    const isClickable = !game.winner && !readOnly;

    // All rounds use same height
    const teamHeight = 'h-6';

    return (
      <div
        className={`
          flex items-center justify-between px-2 py-1 rounded border transition-all text-xs ${teamHeight}
          ${isSelected ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}
          ${isClickable ? 'cursor-pointer hover:border-gray-400 hover:bg-gray-50' : 'cursor-not-allowed opacity-50'}
        `}
        onClick={() => isClickable && handleTeamClick(game, team)}
      >
        <div className="flex items-center space-x-1 flex-1 min-w-0">
          <span className="text-xs font-bold text-gray-600">#{team.seed as number}</span>
          <Image src={team.logo as string} alt={team.name as string} width={12} height={12} className="w-3 h-3 flex-shrink-0" unoptimized />
          <span className="text-xs font-medium truncate text-black">{team.name as string}</span>
        </div>
        {isSelected && (
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        )}
      </div>
    );
  };

  const renderGame = (game: TournamentGame) => {
    // Always render both team slots, even if teams are not yet determined
    return (
      <div
        key={game.id}
        className="border border-gray-300 rounded p-1 space-y-0.5 mb-1 w-full"
      >
        {renderTeam(game.team1 as unknown as Record<string, unknown> | undefined, game)}
        {renderTeam(game.team2 as unknown as Record<string, unknown> | undefined, game)}
      </div>
    );
  };

  // Organize games by round
  const roundOf64 = games.filter(game => game.round === 'Round of 64');
  const roundOf32 = games.filter(game => game.round === 'Round of 32');
  const sweet16 = games.filter(game => game.round === 'Sweet 16');
  const elite8 = games.filter(game => game.round === 'Elite 8');

  // Reset scroll position and tracking refs when region changes (tracked by regionName or currentStep)
  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly) return;

    // Scroll to the left to show first round games
    scrollContainerRef.current.scrollTo({
      left: 0,
      behavior: 'smooth'
    });

    // Reset all scroll tracking refs for the new region
    hasScrolledRoundOf64Ref.current = false;
    hasScrolledRoundOf32Ref.current = false;
    hasScrolledSweet16Ref.current = false;
  }, [regionName, currentStep, scrollContainerRef, readOnly]);

  // Auto-scroll when Round of 64 is complete
  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly || hasScrolledRoundOf64Ref.current) return;

    // Check if all Round of 64 games have picks (8 games)
    const roundOf64Complete = roundOf64.length > 0 && roundOf64.every(game => picks[game.id]);

    if (roundOf64Complete) {
      const scrollAmount = 150;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
      hasScrolledRoundOf64Ref.current = true;
    }
  }, [roundOf64, picks, scrollContainerRef, readOnly]);

  // Auto-scroll when Round of 32 is complete
  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly || hasScrolledRoundOf32Ref.current) return;

    // Check if all Round of 32 games have picks (4 games)
    const roundOf32Complete = roundOf32.length > 0 && roundOf32.every(game => picks[game.id]);

    if (roundOf32Complete) {
      const scrollAmount = 150;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
      hasScrolledRoundOf32Ref.current = true;
    }
  }, [roundOf32, picks, scrollContainerRef, readOnly]);

  // Auto-scroll when Sweet 16 is complete
  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly || hasScrolledSweet16Ref.current) return;

    // Check if all Sweet 16 games have picks (2 games)
    const sweet16Complete = sweet16.length > 0 && sweet16.every(game => picks[game.id]);

    if (sweet16Complete) {
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: 'smooth'
      });
      hasScrolledSweet16Ref.current = true;
    }
  }, [sweet16, picks, scrollContainerRef, readOnly]);

  // Check if region is complete and find regional champion
  const isRegionComplete = () => {
    return games.every(game => picks[game.id]);
  };

  const getRegionalChampion = () => {
    if (!isRegionComplete()) return null;

    // Find the Elite 8 game (regional final)
    const regionalFinal = elite8[0];
    if (!regionalFinal) return null;

    const championId = picks[regionalFinal.id];
    if (!championId) return null;

    // Find the champion team
    const champion = regionalFinal.team1?.id === championId ? regionalFinal.team1 : regionalFinal.team2;
    return champion;
  };

  const regionalChampion = getRegionalChampion();
  const isComplete = isRegionComplete();

  return (
    <div className="mx-auto flex w-fit max-w-full min-w-0 flex-col">
      <div
        className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center gap-2"
        style={{ paddingLeft: '2px', paddingRight: '2px', paddingBottom: '2px' }}
      >
        <div className="inline-flex w-max max-w-full flex-col">
          <div className="min-w-0 overflow-hidden rounded-lg border-2 border-gray-300 bg-white shadow-sm">
            {/* Title bar: entry (left) · region (center) · champion (right) */}
            <div
              className={`grid w-full grid-cols-1 gap-2 border-b px-2 py-2 sm:grid-cols-3 sm:items-center ${
                isComplete ? 'border-green-200/90 bg-green-50' : 'border-gray-200'
              }`}
              data-testid="bracket-region-title-bar"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 justify-self-start">
                <label htmlFor="entryName" className="text-xs font-medium text-gray-700 whitespace-nowrap">
                  Entry Name:
                </label>
                {isLiveResultsMode ? (
                  <div className="flex min-w-[200px] items-center justify-center space-x-2 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-bold text-gray-800">
                    <KeyRound className="h-4 w-4 text-amber-600" />
                    <span>KEY</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    id="entryName"
                    value={entryName}
                    onChange={(e) => onEntryNameChange?.(e.target.value)}
                    disabled={readOnly}
                    className={`min-w-[180px] max-w-full flex-1 px-3 py-2 text-sm text-black sm:max-w-[20rem] ${
                      readOnly
                        ? 'cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 text-gray-500'
                        : 'rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
                    }`}
                    placeholder="Enter your bracket name"
                    data-testid="entry-name-input"
                  />
                )}
              </div>
              <div className="flex items-center justify-center gap-2 text-center text-lg font-bold text-gray-800">
                <span>{regionName} Region</span>
              </div>
              <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end text-right">
                {regionalChampion ? (
                  <>
                    <span className="text-lg font-bold text-gray-600">#{regionalChampion.seed}</span>
                    {regionalChampion.logo && (
                      <Image
                        src={regionalChampion.logo}
                        alt={regionalChampion.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 flex-shrink-0 object-contain"
                        unoptimized
                      />
                    )}
                    <span className="max-w-[10rem] truncate text-lg font-semibold text-gray-800 sm:max-w-none">
                      {regionalChampion.name}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {bracketRegionalMessage.trim() ? (
              <div className="min-w-0 border-b border-gray-200">
                <BracketEditorTopMessage
                  message={bracketRegionalMessage}
                  variant="regional"
                  embeddedInCard
                  data-testid="bracket-editor-regional-message"
                />
              </div>
            ) : null}

            {/* Bracket card: games only — round columns do not overlap horizontally */}
            <div
              className="min-w-0 overflow-x-auto px-1 py-1"
              data-testid="bracket-region-bracket-card"
            >
              <div className="flex min-w-max w-full shrink-0 items-stretch">
                <div className="relative z-10 w-48 shrink-0">
                  {roundOf64.map((game) => renderGame(game))}
                </div>

                <div className="relative z-20 w-48 shrink-0">
                  {roundOf32.map((game, index) => (
                    <div key={game.id} style={{ marginTop: index === 0 ? '2rem' : '4.25rem' }}>
                      {renderGame(game)}
                    </div>
                  ))}
                </div>

                <div className="relative z-30 w-48 shrink-0">
                  {sweet16.map((game, index) => (
                    <div key={game.id} style={{ marginTop: index === 0 ? '6rem' : '12.25rem' }}>
                      {renderGame(game)}
                    </div>
                  ))}
                </div>

                <div className="relative z-40 flex w-48 shrink-0 flex-col items-stretch">
                  <div>
                    {elite8.map((game, index) => (
                      <div key={game.id} style={{ marginTop: index === 0 ? '14rem' : '0' }}>
                        {renderGame(game)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fifth column: absorbs remaining bracket-card width; Next centered in this lane */}
                {onNext && !readOnly ? (
                  <div className="relative z-[45] flex min-w-[3rem] flex-1 shrink-0 flex-col items-center justify-center py-2">
                    <button
                      type="button"
                      aria-label="Next region"
                      data-testid="bracket-region-next-arrow"
                      onClick={isComplete ? onNext : undefined}
                      disabled={!isComplete || !canProceed}
                      className={`
                        flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all
                        ${
                          isComplete && canProceed
                            ? 'cursor-pointer bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg hover:from-blue-700 hover:to-blue-800 hover:shadow-xl active:shadow-md'
                            : 'cursor-not-allowed bg-gradient-to-br from-gray-300 to-gray-400 text-gray-500 shadow'
                        }
                      `}
                      style={{
                        boxShadow:
                          isComplete && canProceed
                            ? '0 4px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.2)'
                            : '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <ArrowRight
                        className="h-7 w-7"
                        style={{
                          filter:
                            isComplete && canProceed ? 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' : 'none',
                        }}
                      />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="w-full min-w-0 border-t border-gray-200 px-2 pb-1.5 pt-2">
              <div className="flex min-w-0 w-full justify-center overflow-x-auto">
                {onStepClick && isStepComplete && (
                  <BracketStepNavBar
                    totalSteps={totalSteps}
                    currentStep={currentStep}
                    stepLabels={stepNavLabels}
                    columnWidthCh={stepButtonWidthCh}
                    isStepComplete={isStepComplete}
                    onStepClick={onStepClick}
                    finalFourDisabledMessage={
                      finalFourDisabledMessage.trim() ||
                      'Complete all four regions before you can work on the Final Four and championship.'
                    }
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-2 py-2 shadow-sm">
            {readOnly ? (
              onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    width: `${stepButtonWidthCh}ch`,
                    minWidth: `${stepButtonWidthCh}ch`,
                    maxWidth: `${stepButtonWidthCh}ch`,
                  }}
                  className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} bg-red-500 text-white hover:bg-red-600 cursor-pointer`}
                >
                  <span>Close</span>
                </button>
              )
            ) : (
              <>
                {onSave && (
                  <button
                    type="button"
                    onClick={() => !disableSave && onSave()}
                    disabled={disableSave}
                    title={disableSave ? disableSaveMessage : 'Save'}
                    style={{
                      width: `${stepButtonWidthCh}ch`,
                      minWidth: `${stepButtonWidthCh}ch`,
                      maxWidth: `${stepButtonWidthCh}ch`,
                    }}
                    className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} ${
                      disableSave
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'
                    }`}
                  >
                    <Save className="h-3.5 w-3.5 shrink-0" />
                    <span>Save</span>
                  </button>
                )}
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    style={{
                      width: `${stepButtonWidthCh}ch`,
                      minWidth: `${stepButtonWidthCh}ch`,
                      maxWidth: `${stepButtonWidthCh}ch`,
                    }}
                    className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} bg-red-500 text-white hover:bg-red-600 cursor-pointer`}
                  >
                    <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                    <span>Cancel</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
