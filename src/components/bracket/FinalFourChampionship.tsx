'use client';

import { useEffect, useRef, useState, RefObject } from 'react';
import Image from 'next/image';
import { TournamentGame } from '@/types/tournament';
import { SiteConfigData } from '@/lib/siteConfig';
import { CheckCircle, Save, KeyRound, Send, Info, X } from 'lucide-react';
import {
  BRACKET_EDITOR_BAR_ACTION_CLASSES,
  BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM,
} from '@/lib/bracketStepNavMetrics';
import BracketEditorTopMessage from './BracketEditorTopMessage';
import BracketStepNavBar from './BracketStepNavBar';
import { getFinalFourGamesRowMinHeightRem, loadFinalFourGamesRowLayout } from './finalFourGamesRowLayoutStorage';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

interface FinalFourChampionshipProps {
  finalFourGames: TournamentGame[];
  championshipGame: TournamentGame;
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
  tieBreaker: string;
  onTieBreakerChange: (value: string) => void;
  readOnly?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onSave?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
  onSubmitBracket?: () => void;
  submitEnabled?: boolean;
  submitDisabledMessage?: string;
  currentStep?: number;
  totalSteps?: number;
  onStepClick?: (stepIndex: number) => void;
  isStepComplete?: (step: number) => boolean;
  stepNavLabels?: string[];
  stepButtonWidthCh?: number;
  finalFourDisabledMessage?: string;
  // Entry name props
  entryName?: string;
  onEntryNameChange?: (value: string) => void;
  // Site config and validation props
  siteConfig?: SiteConfigData | null;
  existingBracketNames?: string[];
  currentBracketId?: string;
  isAdminMode?: boolean;
  isLiveResultsMode?: boolean;
  disableSaveSubmit?: boolean;
  disableSaveSubmitMessage?: string;
}

export default function FinalFourChampionship({
  finalFourGames,
  championshipGame,
  picks,
  onPick,
  tieBreaker,
  onTieBreakerChange,
  readOnly = false,
  scrollContainerRef,
  onSave,
  onClose,
  onCancel,
  onSubmitBracket,
  submitEnabled = false,
  submitDisabledMessage = '',
  currentStep = 4,
  totalSteps = 5,
  onStepClick,
  isStepComplete,
  stepNavLabels = [],
  stepButtonWidthCh = 12,
  finalFourDisabledMessage = '',
  entryName,
  onEntryNameChange,
  siteConfig,
  existingBracketNames = [],
  isAdminMode = false,
  isLiveResultsMode = false,
  disableSaveSubmit = false,
  disableSaveSubmitMessage = '',
}: FinalFourChampionshipProps) {
  const [tieBreakerHintOpen, setTieBreakerHintOpen] = useState(false);
  /** Games-row min height (rem); after mount matches persisted Final Four layout (no UI — see `finalFourGamesRowLayoutStorage`). */
  const [gamesRowMinHeightRem, setGamesRowMinHeightRem] = useState(BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM);

  useEffect(() => {
    const { adjustRem } = loadFinalFourGamesRowLayout();
    setGamesRowMinHeightRem(getFinalFourGamesRowMinHeightRem(adjustRem));
  }, []);

  const handleTeamClick = (game: TournamentGame, team: Record<string, unknown>) => {
    if (game.winner || readOnly) return;
    onPick(game.id, team.id as string);
  };

  const renderTeam = (team: Record<string, unknown> | undefined, game: TournamentGame) => {
    if (!team) {
      return (
        <div className="flex h-6 w-full items-center justify-center rounded border border-gray-200 bg-gray-100">
          <span className="text-xs text-gray-400">-</span>
        </div>
      );
    }

    const isSelected = picks[game.id] === (team.id as string);
    const isClickable = !game.winner && !readOnly;

    return (
      <div
        className={`
          flex h-6 items-center justify-between rounded border px-2 py-1 text-xs transition-all
          ${isSelected ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-white'}
          ${isClickable ? 'cursor-pointer hover:border-gray-400 hover:bg-gray-50' : 'cursor-not-allowed opacity-50'}
        `}
        onClick={() => isClickable && handleTeamClick(game, team)}
      >
        <div className="flex min-w-0 flex-1 items-center space-x-1">
          <span className="text-xs font-bold text-gray-600">#{team.seed as number}</span>
          <Image src={team.logo as string} alt={team.name as string} width={12} height={12} className="h-3 w-3 flex-shrink-0" unoptimized />
          <span className="truncate text-xs font-medium text-black">{team.name as string}</span>
        </div>
        {isSelected && (
          <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
        )}
      </div>
    );
  };

  const renderGame = (game: TournamentGame) => (
    <div key={game.id} className="mb-1 w-full space-y-0.5 rounded border border-gray-300 p-1">
      {renderTeam(game.team1 as unknown as Record<string, unknown> | undefined, game)}
      {renderTeam(game.team2 as unknown as Record<string, unknown> | undefined, game)}
    </div>
  );

  /** Invisible slot matching one game card so column 1 reserves the same space as a real matchup. */
  const ghostGameSlot = (
    <div
      className="mb-1 w-full space-y-0.5 rounded border border-transparent p-1 select-none"
      aria-hidden
    >
      <div className="h-6 w-full rounded border border-transparent bg-transparent" />
      <div className="h-6 w-full rounded border border-transparent bg-transparent" />
    </div>
  );

  const isChampionshipComplete = () => Boolean(picks[championshipGame.id]);

  const getChampion = () => {
    if (!isChampionshipComplete()) return null;

    const championId = picks[championshipGame.id];
    if (!championId) return null;

    const team1Id = championshipGame.team1?.id;
    const team2Id = championshipGame.team2?.id;

    if (championId !== team1Id && championId !== team2Id) {
      return null;
    }

    return championshipGame.team1?.id === championId ? championshipGame.team1 : championshipGame.team2;
  };

  const champion = getChampion();

  const allWinnersSelected = () => {
    const allFinalFourSelected = finalFourGames.every(game => picks[game.id]);
    const championshipSelected = picks[championshipGame.id];

    if (!allFinalFourSelected || !championshipSelected) {
      return false;
    }

    const championId = picks[championshipGame.id];
    const team1Id = championshipGame.team1?.id;
    const team2Id = championshipGame.team2?.id;

    if (championId !== team1Id && championId !== team2Id) {
      return false;
    }

    return true;
  };
  const isComplete = allWinnersSelected();

  const tieBreakerValid = () => {
    if (!tieBreaker) return false;
    const value = Number(tieBreaker);
    const low = siteConfig?.tieBreakerLow ?? 50;
    const high = siteConfig?.tieBreakerHigh ?? 500;
    return !isNaN(value) && value >= low && value <= high;
  };

  const entryNameValid = () => {
    return entryName && entryName.trim().length > 0;
  };

  const isDuplicateName = () => {
    if (!entryNameValid() || !siteConfig?.tournamentYear) return false;
    const trimmedName = entryName?.trim() || '';
    return existingBracketNames.some(name => name === trimmedName);
  };

  const getSubmissionDisabledReason = () => {
    if (siteConfig?.stopSubmitToggle === 'Yes') {
      return siteConfig?.finalMessageSubmitOff || 'Bracket submissions are currently disabled.';
    }

    if (siteConfig?.stopSubmitDateTime) {
      try {
        const deadline = new Date(siteConfig.stopSubmitDateTime);
        const now = new Date();
        if (now >= deadline) {
          return siteConfig?.finalMessageTooLate || 'Bracket submissions are closed. The deadline has passed.';
        }
      } catch {
        /* ignore */
      }
    }

    return null;
  };

  const getMessageState = () => {
    const disabledReason = getSubmissionDisabledReason();
    if (disabledReason) {
      return {
        color: 'yellow' as const,
        message: disabledReason
      };
    }

    if (!allWinnersSelected()) {
      return {
        color: 'yellow' as const,
        message: siteConfig?.finalMessageTeamsMissing || 'Please select winners for all Final Four and Championship games.'
      };
    }

    if (!tieBreaker) {
      return {
        color: 'yellow' as const,
        message: siteConfig?.finalMessageTieBreakerMissing || 'Please enter a tie breaker value.'
      };
    }

    if (!tieBreakerValid()) {
      const low = siteConfig?.tieBreakerLow ?? 50;
      const high = siteConfig?.tieBreakerHigh ?? 500;
      const message = (siteConfig?.finalMessageTieBreakerInvalid || 'Tie breaker must be between {low} and {high}.')
        .replace(/{low}/g, String(low))
        .replace(/{high}/g, String(high));
      return {
        color: 'yellow' as const,
        message
      };
    }

    if (isDuplicateName()) {
      return {
        color: 'yellow' as const,
        message: siteConfig?.finalMessageDuplicateName || 'An entry with this name already exists for this year. Please choose a different name.'
      };
    }

    return {
      color: 'green' as const,
      message: siteConfig?.finalMessageReadyToSubmit || 'Your bracket is complete and ready to submit!'
    };
  };

  const messageState = getMessageState();
  const tieBreakerNeedsAttention = !tieBreaker || !tieBreakerValid();

  const tieBreakerHintSource = (
    siteConfig?.tieBreakerHint?.trim() ||
    FALLBACK_CONFIG.tieBreakerHint ||
    ''
  ).trim();
  const tieBreakerHintParagraphs = tieBreakerHintSource
    ? tieBreakerHintSource.split(/\|\|/).map((p) => p.trim()).filter(Boolean)
    : [];

  const hasScrolledToStartRef = useRef(false);
  const hasScrolledToChampionshipRef = useRef(false);
  const hasScrolledToEndRef = useRef(false);

  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly) return;

    hasScrolledToStartRef.current = false;
    hasScrolledToChampionshipRef.current = false;
    hasScrolledToEndRef.current = false;

    scrollContainerRef.current.scrollTo({
      left: 0,
      behavior: 'smooth'
    });

    hasScrolledToStartRef.current = true;
  }, [currentStep, scrollContainerRef, readOnly]);

  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly || hasScrolledToChampionshipRef.current) return;

    const bothSemifinalsComplete = finalFourGames.length === 2 &&
      finalFourGames.every(game => picks[game.id]);

    if (bothSemifinalsComplete) {
      const scrollAmount = 150;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
      hasScrolledToChampionshipRef.current = true;
    }
  }, [finalFourGames, picks, scrollContainerRef, readOnly]);

  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly || hasScrolledToEndRef.current) return;

    const championshipPick = picks[championshipGame.id];
    if (championshipPick) {
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: 'smooth'
      });
      hasScrolledToEndRef.current = true;
    }
  }, [championshipGame.id, picks, scrollContainerRef, readOnly]);

  const semi1 = finalFourGames[0];
  const semi2 = finalFourGames[1];
  const showCircleSubmit = Boolean(onSubmitBracket && !readOnly && !isAdminMode);

  return (
    <div className="mx-auto flex w-fit max-w-full min-w-0 flex-col">
      <div
        className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center gap-2"
        style={{ paddingLeft: '2px', paddingRight: '2px', paddingBottom: '2px' }}
      >
        <div className="inline-flex w-max max-w-full flex-col">
          <div className="min-w-0 overflow-hidden rounded-lg border-2 border-gray-300 bg-white shadow-sm">
            <div
              className={`grid w-full grid-cols-1 gap-2 border-b px-2 py-2 sm:grid-cols-3 sm:items-center ${
                isComplete ? 'border-green-200/90 bg-green-50' : 'border-gray-200'
              }`}
              data-testid="bracket-final-four-title-bar"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 justify-self-start">
                <label htmlFor="entryName" className="whitespace-nowrap text-xs font-medium text-gray-700">
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
                <span>Final Four</span>
              </div>
              <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end text-right">
                {champion ? (
                  <>
                    <span className="text-lg font-bold text-gray-600">#{champion.seed}</span>
                    {champion.logo && (
                      <Image
                        src={champion.logo}
                        alt={champion.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 flex-shrink-0 object-contain"
                        unoptimized
                      />
                    )}
                    <span className="max-w-[10rem] truncate text-lg font-semibold text-gray-800 sm:max-w-none">
                      {champion.name}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {!readOnly && (
              <div className="min-w-0 border-b border-gray-200">
                <BracketEditorTopMessage
                  message={messageState.message}
                  variant={messageState.color === 'yellow' ? 'validation-yellow' : 'validation-green'}
                  embeddedInCard
                  data-testid="bracket-editor-final-validation-message"
                />
              </div>
            )}

            <div
              className="min-w-0 overflow-x-auto px-1 py-1"
              data-testid="bracket-final-four-bracket-card"
            >
              <div
                className="flex min-w-max w-full shrink-0 items-stretch"
                style={{ minHeight: `${gamesRowMinHeightRem}rem` }}
              >
                <div
                  className="grid grid-cols-[12rem_12rem_12rem_12rem] grid-rows-[1fr_4.25rem_6rem]"
                  style={{ width: '48rem' }}
                >
                  {/* Row 1: games */}
                  <div className="relative z-10 row-start-1 col-start-1 flex justify-center" data-testid="bracket-final-four-col-placeholder">
                    {ghostGameSlot}
                  </div>
                  <div
                    className="relative z-20 row-start-1 col-start-2 flex flex-col justify-center"
                    data-testid="bracket-final-four-col-semis"
                  >
                    <div className="w-full">
                      {semi1 ? renderGame(semi1) : null}
                      {semi2 ? <div className="mt-4">{renderGame(semi2)}</div> : null}
                    </div>
                  </div>
                  <div
                    className="relative z-30 row-start-1 col-start-3 flex flex-col justify-center"
                    data-testid="bracket-final-four-col-championship"
                  >
                    {renderGame(championshipGame)}
                  </div>
                  <div
                    className="relative z-40 row-start-1 col-start-4"
                    data-testid="bracket-final-four-col-right-spacer"
                  >
                    {ghostGameSlot}
                  </div>

                  {/* Row 2: tie breaker label + input */}
                  <div className="row-start-2 col-start-1" aria-hidden />
                  <div className="row-start-2 col-start-2 flex h-full items-center px-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {tieBreakerHintParagraphs.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setTieBreakerHintOpen((o) => !o)}
                          className="inline-flex rounded-full p-0.5 text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-800"
                          aria-expanded={tieBreakerHintOpen}
                          aria-controls="tie-breaker-hint-panel"
                          title="About the tie breaker"
                          data-testid="bracket-final-four-tiebreaker-hint-toggle"
                        >
                          <span className="sr-only">Tie breaker help</span>
                          <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </button>
                      ) : null}
                      <label htmlFor="tieBreaker" className="text-right text-xs font-medium text-gray-700">
                        Tie Breaker:
                      </label>
                    </div>
                  </div>
                  <div className="row-start-2 col-start-3 flex h-full items-center px-2">
                    <input
                      type="number"
                      id="tieBreaker"
                      value={tieBreaker}
                      onChange={(e) => onTieBreakerChange(e.target.value)}
                      min="50"
                      max="500"
                      disabled={readOnly}
                      className={`w-full min-w-0 rounded-lg border px-3 py-2 text-sm ${
                        readOnly
                          ? 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500'
                          : tieBreakerNeedsAttention
                            ? 'border-yellow-300 bg-yellow-50 text-black placeholder:text-gray-300 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300'
                            : 'border-gray-300 text-black placeholder:text-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
                      }`}
                      placeholder="###"
                      title="Total combined points scored in the championship game"
                      data-testid="tiebreaker-input"
                    />
                  </div>
                  <div className="row-start-2 col-start-4" aria-hidden />

                  {/* Row 3: reserved hint row (always consumes space) */}
                  <div className="row-start-3 col-start-1" aria-hidden />
                  <div
                    id="tie-breaker-hint-panel"
                    className="row-start-3 col-start-2 col-end-4 p-1.5"
                    role="region"
                    data-testid="bracket-final-four-tiebreaker-hint-text"
                    aria-hidden={!tieBreakerHintOpen || tieBreakerHintParagraphs.length === 0}
                  >
                    <div
                      className={`h-full overflow-y-auto rounded border border-gray-200 bg-gray-50/90 p-2 text-xs leading-snug text-gray-700 ${
                        tieBreakerHintOpen && tieBreakerHintParagraphs.length > 0 ? '' : 'opacity-0'
                      }`}
                    >
                      {tieBreakerHintOpen && tieBreakerHintParagraphs.length > 0
                        ? tieBreakerHintParagraphs.map((para, i) => (
                            <p key={i} className="m-0 mb-1.5 last:mb-0">
                              {para}
                            </p>
                          ))
                        : null}
                    </div>
                  </div>
                  <div className="row-start-3 col-start-4" aria-hidden />
                </div>

                {showCircleSubmit ? (
                  <div className="relative z-[45] flex min-w-[3rem] flex-1 shrink-0 flex-col items-center justify-center py-2">
                    <button
                      type="button"
                      aria-label="Submit bracket"
                      data-testid="submit-bracket-editor-button"
                      onClick={() => submitEnabled && onSubmitBracket?.()}
                      disabled={!submitEnabled}
                      title={submitDisabledMessage || undefined}
                      className={`
                        flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all
                        ${
                          submitEnabled
                            ? 'cursor-pointer bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg hover:from-blue-700 hover:to-blue-800 hover:shadow-xl active:shadow-md'
                            : 'cursor-not-allowed bg-gradient-to-br from-gray-300 to-gray-400 text-gray-500 shadow'
                        }
                      `}
                      style={{
                        boxShadow: submitEnabled
                          ? '0 4px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.2)'
                          : '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <Send
                        className="h-7 w-7"
                        aria-hidden
                        style={{
                          filter: submitEnabled ? 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' : 'none',
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
                      siteConfig?.finalFourDisabledMessage?.trim() ||
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
                  className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} cursor-pointer bg-red-500 text-white hover:bg-red-600`}
                >
                  <span>Close</span>
                </button>
              )
            ) : (
              <>
                {onSave && (
                  <button
                    type="button"
                    onClick={() => !disableSaveSubmit && onSave()}
                    disabled={disableSaveSubmit}
                    title={disableSaveSubmit ? disableSaveSubmitMessage : 'Save'}
                    style={{
                      width: `${stepButtonWidthCh}ch`,
                      minWidth: `${stepButtonWidthCh}ch`,
                      maxWidth: `${stepButtonWidthCh}ch`,
                    }}
                    className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} ${
                      disableSaveSubmit
                        ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                        : 'cursor-pointer bg-purple-600 text-white hover:bg-purple-700'
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
                    className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} cursor-pointer bg-red-500 text-white hover:bg-red-600`}
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
