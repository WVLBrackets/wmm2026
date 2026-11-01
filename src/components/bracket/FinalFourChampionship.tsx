'use client';

import { useEffect, useMemo, useRef, useState, RefObject } from 'react';
import Image from 'next/image';
import { TournamentData, TournamentGame, TournamentTeam } from '@/types/tournament';
import { CheckCircle, Save, KeyRound, Send, Trophy, Info, X } from 'lucide-react';
import {
  BRACKET_EDITOR_BAR_ACTION_CLASSES,
  BRACKET_EDITOR_BORDERED_CONTENT_WIDTH_CLASS,
} from '@/lib/bracketStepNavMetrics';
import { useBracketEditorCopy } from '@/components/bracket/BracketEditorCopyContext';
import {
  formatTieBreakerInvalid,
  tieBreakerHintTooltip,
} from '@/lib/vintage/bracketEditorContent';
import { isTieBreakerInRange } from '@/lib/bracketSubmitReadiness';
import BracketEditorTopMessage from './BracketEditorTopMessage';
import BracketStepNavBar from './BracketStepNavBar';
import { FINAL_FOUR_GAMES_ROW_SHIPPED_MIN_HEIGHT_REM } from './finalFourGamesRowLayoutStorage';
import { filterTieBreakerIntegerString } from '@/lib/bracketTieBreakerHint';
import { getFinalFourSemifinalPairingLabels } from '@/lib/finalFourSemifinalPairings';

/**
 * Games-area height locked to the regional pane (8×R64 stack + card padding).
 * Internal content scrolls inside this box so the outer frame does not resize.
 */
const FINAL_FOUR_GAMES_AREA_HEIGHT_REM = FINAL_FOUR_GAMES_ROW_SHIPPED_MIN_HEIGHT_REM + 0.5;

interface FinalFourChampionshipProps {
  finalFourGames: TournamentGame[];
  championshipGame: TournamentGame;
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
  tieBreaker: string;
  onTieBreakerChange: (value: string) => void;
  /** Tournament definition — used for semifinal regional pairing labels. */
  tournamentData: TournamentData;
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
  entryName?: string;
  onEntryNameChange?: (value: string) => void;
  existingBracketNames?: string[];
  currentBracketId?: string;
  isAdminMode?: boolean;
  isLiveResultsMode?: boolean;
  disableSaveSubmit?: boolean;
  /** When set, overrides save-button disable independently of submit (Save WIP). */
  disableSave?: boolean;
  disableSaveSubmitMessage?: string;
  /** True when entry name matches another submitted bracket (yellow field). */
  entryNameDuplicate?: boolean;
}

/**
 * Final Four + championship step: fixed outer pane (matches regional frames) with
 * redesigned internal composition (semis → championship → champion → tiebreaker).
 */
export default function FinalFourChampionship({
  finalFourGames,
  championshipGame,
  picks,
  onPick,
  tieBreaker,
  onTieBreakerChange,
  tournamentData,
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
  existingBracketNames = [],
  isAdminMode = false,
  isLiveResultsMode = false,
  disableSaveSubmit = false,
  disableSave,
  disableSaveSubmitMessage = '',
  entryNameDuplicate = false,
}: FinalFourChampionshipProps) {
  const copy = useBracketEditorCopy();
  const saveDisabled = disableSave ?? disableSaveSubmit;
  const [tieBreakerHintOpen, setTieBreakerHintOpen] = useState(false);

  const handleTeamClick = (game: TournamentGame, team: TournamentTeam) => {
    if (game.winner || readOnly) return;
    onPick(game.id, team.id);
  };

  /**
   * Renders one selectable team row (seed, logo, name, selection check).
   */
  const renderTeamRow = (team: TournamentTeam | undefined, game: TournamentGame) => {
    if (!team) {
      return (
        <div
          className="flex min-h-[2.5rem] w-full items-center justify-center rounded border border-gray-200 bg-gray-100 px-2 py-1.5"
          data-testid="bracket-final-four-empty-slot"
        >
          <span className="text-xs text-gray-400">-</span>
        </div>
      );
    }

    const isSelected = picks[game.id] === team.id;
    const isClickable = !game.winner && !readOnly;

    return (
      <button
        type="button"
        disabled={!isClickable}
        aria-pressed={isSelected}
        onClick={() => isClickable && handleTeamClick(game, team)}
        className={`
          flex min-h-[2.5rem] w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-xs transition-all
          ${isSelected ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-white'}
          ${isClickable ? 'cursor-pointer hover:border-gray-400 hover:bg-gray-50' : 'cursor-not-allowed opacity-50'}
        `}
        data-testid={`bracket-final-four-team-${game.id}-${team.id}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-xs font-bold text-gray-600">#{team.seed}</span>
          {team.logo ? (
            <Image
              src={team.logo}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 object-contain"
              unoptimized
            />
          ) : null}
          <span className="min-w-0 text-xs font-medium leading-snug text-black [overflow-wrap:anywhere]">
            {team.name}
          </span>
        </span>
        {isSelected ? (
          <CheckCircle className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
        ) : null}
      </button>
    );
  };

  /**
   * Renders a labeled matchup card (semifinal or championship).
   */
  const renderMatchupCard = (
    game: TournamentGame | undefined,
    opts: { title: string; pairingLabel?: string; testId: string }
  ) => {
    if (!game) return null;
    return (
      <div
        className="be-ff-matchup w-full max-w-sm rounded border border-gray-300 bg-white p-2 shadow-sm"
        data-testid={opts.testId}
      >
        <p
          className="be-ff-matchup__title m-0 text-center text-sm font-bold uppercase tracking-wide text-gray-800 font-[family-name:var(--be-font-ui)]"
        >
          {opts.title || '\u00a0'}
        </p>
        {opts.pairingLabel ? (
          <p
            className="be-ff-matchup__pairing m-0 mt-0.5 text-center text-xs font-medium text-gray-600"
            data-testid={`${opts.testId}-pairing`}
          >
            {opts.pairingLabel}
          </p>
        ) : null}
        <div className="mt-2 space-y-1">
          {renderTeamRow(game.team1, game)}
          {renderTeamRow(game.team2, game)}
        </div>
      </div>
    );
  };

  const isChampionshipComplete = () => Boolean(picks[championshipGame.id]);

  const getChampion = (): TournamentTeam | null => {
    if (!isChampionshipComplete()) return null;

    const championId = picks[championshipGame.id];
    if (!championId) return null;

    const team1Id = championshipGame.team1?.id;
    const team2Id = championshipGame.team2?.id;

    if (championId !== team1Id && championId !== team2Id) {
      return null;
    }

    return championshipGame.team1?.id === championId
      ? championshipGame.team1 ?? null
      : championshipGame.team2 ?? null;
  };

  const champion = getChampion();

  const allWinnersSelected = () => {
    const allFinalFourSelected = finalFourGames.every((game) => picks[game.id]);
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

  const tieBreakerValid = () => isTieBreakerInRange(tieBreaker, copy);

  const isDuplicateName = () => {
    const trimmedName = entryName?.trim() || '';
    if (!trimmedName) return false;
    return existingBracketNames.some((name) => name === trimmedName);
  };

  /**
   * First unmet submit requirement, or the ready message (all from Bracket Editor Messages CMS).
   */
  const getMessageState = () => {
    if (!allWinnersSelected()) return { color: 'yellow' as const, message: copy.teamsMissingMessage };
    if (!tieBreaker) return { color: 'yellow' as const, message: copy.tieBreakerMissingMessage };
    if (!tieBreakerValid()) return { color: 'yellow' as const, message: formatTieBreakerInvalid(copy) };
    if (isDuplicateName()) return { color: 'yellow' as const, message: copy.duplicateNameMessage };
    return { color: 'green' as const, message: copy.readyToSubmitMessage };
  };

  const messageState = getMessageState();
  const tieBreakerNeedsAttention = !tieBreaker || !tieBreakerValid();
  const tieBreakerTooltip = tieBreakerHintTooltip(copy.tieBreakerHint);

  const pairingLabels = useMemo(
    () => getFinalFourSemifinalPairingLabels(tournamentData, copy.finalistPairingLabel),
    [tournamentData, copy.finalistPairingLabel]
  );

  const hasScrolledToStartRef = useRef(false);

  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly) return;

    hasScrolledToStartRef.current = false;
    scrollContainerRef.current.scrollTo({
      left: 0,
      behavior: 'smooth',
    });
    hasScrolledToStartRef.current = true;
  }, [currentStep, scrollContainerRef, readOnly]);

  useEffect(() => {
    if (!tieBreakerHintOpen) return;
    /** Close tie-breaker help modal on Escape. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTieBreakerHintOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tieBreakerHintOpen]);

  const semi1 = finalFourGames[0];
  const semi2 = finalFourGames[1];
  const showBarSubmit = Boolean(onSubmitBracket && !readOnly && !isAdminMode);

  return (
    <div className="mx-auto flex w-fit max-w-full min-w-0 flex-col">
      <div
        className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center gap-2"
        style={{ paddingLeft: '2px', paddingRight: '2px', paddingBottom: '2px' }}
      >
        <div className="inline-flex w-max max-w-full flex-col">
          <div
            className={`be-workspace-card be-region-frame min-w-0 overflow-hidden rounded-lg border-2 border-gray-300 bg-white shadow-sm ${BRACKET_EDITOR_BORDERED_CONTENT_WIDTH_CLASS}`}
          >
            <div
              className={`be-title-bar grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1 gap-y-0 border-b px-2 py-2 sm:gap-x-2 ${
                isComplete ? 'be-title-bar--ready' : 'border-gray-200'
              }`}
              data-testid="bracket-final-four-title-bar"
            >
              <div className="flex min-w-0 flex-nowrap items-center gap-x-1 justify-self-start sm:gap-x-2">
                {copy.entryNameLabel ? (
                  <>
                    <label htmlFor="entryName" className="sr-only">
                      {copy.entryNameLabel}
                    </label>
                    <span
                      className="be-entry-label hidden shrink-0 text-xs font-medium whitespace-nowrap text-gray-700 sm:inline"
                      aria-hidden="true"
                    >
                      {copy.entryNameLabel}
                    </span>
                  </>
                ) : null}
                {isLiveResultsMode ? (
                  <div className="flex min-w-0 max-w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-gray-100 px-2 py-1.5 text-xs font-bold text-gray-800 sm:min-w-[200px] sm:px-3 sm:py-2 sm:text-sm">
                    <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>{copy.keyEntryLabel}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    id="entryName"
                    value={entryName}
                    onChange={(e) => onEntryNameChange?.(e.target.value)}
                    disabled={readOnly}
                    className={`be-entry-input min-w-0 w-full max-w-full flex-1 px-2 py-1.5 text-xs sm:min-w-[180px] sm:max-w-[20rem] sm:px-3 sm:py-2 sm:text-sm ${
                      readOnly
                        ? 'cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 text-gray-500'
                        : entryNameDuplicate
                          ? 'rounded-lg border-2 border-yellow-400 bg-yellow-50 text-yellow-800 shadow-sm focus:border-yellow-500 focus:ring-2 focus:ring-yellow-300'
                          : 'rounded-lg border border-gray-300 !bg-white text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
                    }`}
                    placeholder={copy.entryNamePlaceholder || undefined}
                    aria-label={copy.entryNameLabel || undefined}
                    data-testid="entry-name-input"
                  />
                )}
              </div>
              <div
                className="flex items-center justify-center px-0.5 text-center font-bold leading-tight text-gray-800 font-[family-name:var(--be-font-ui)] text-sm uppercase tracking-wider sm:text-base"
              >
                <span>{copy.finalFourTitle}</span>
              </div>
              <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 justify-self-end text-right sm:gap-2">
                {champion ? (
                  <>
                    <span className="text-sm font-bold text-gray-600 sm:text-lg">#{champion.seed}</span>
                    {champion.logo && (
                      <Image
                        src={champion.logo}
                        alt={champion.name}
                        width={32}
                        height={32}
                        className="h-6 w-6 shrink-0 object-contain sm:h-8 sm:w-8"
                        unoptimized
                      />
                    )}
                    <span className="hidden max-w-[10rem] truncate text-lg font-semibold text-gray-800 sm:inline sm:max-w-none">
                      {champion.name}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {!readOnly && messageState.message ? (
              <div className="min-w-0 border-b border-gray-200">
                <BracketEditorTopMessage
                  message={messageState.message}
                  variant={messageState.color === 'yellow' ? 'validation-yellow' : 'validation-green'}
                  embeddedInCard
                  data-testid="bracket-editor-final-validation-message"
                />
              </div>
            ) : null}

            <div
              className="be-ff-games-area min-w-0 overflow-x-hidden overflow-y-auto px-1 py-1"
              style={{
                height: `${FINAL_FOUR_GAMES_AREA_HEIGHT_REM}rem`,
                maxHeight: `${FINAL_FOUR_GAMES_AREA_HEIGHT_REM}rem`,
              }}
              data-testid="bracket-final-four-bracket-card"
            >
              <div
                className="be-ff-panel mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-3 px-2 py-3 sm:gap-4 sm:px-4"
                data-testid="bracket-final-four-panel"
              >
                {/* Semifinals: side-by-side on md+, stacked on mobile (no SF1→SF2 arrow) */}
                <div className="flex w-full flex-col items-stretch gap-3 md:flex-row md:items-start md:justify-center md:gap-6 lg:gap-10">
                  {renderMatchupCard(semi1, {
                    title: copy.semifinal1Title,
                    pairingLabel: pairingLabels[0] || undefined,
                    testId: 'bracket-final-four-semifinal-1',
                  })}
                  {renderMatchupCard(semi2, {
                    title: copy.semifinal2Title,
                    pairingLabel: pairingLabels[1] || undefined,
                    testId: 'bracket-final-four-semifinal-2',
                  })}
                </div>

                {/* Advancement connectors (desktop): both semis → championship */}
                <div
                  className="be-ff-connectors hidden w-full max-w-md justify-center md:flex"
                  aria-hidden
                  data-testid="bracket-final-four-connectors"
                >
                  <svg viewBox="0 0 200 28" className="h-7 w-48 text-gray-800" fill="none">
                    <path
                      d="M40 2 V12 H100 V26 M160 2 V12 H100"
                      stroke="currentColor"
                      strokeWidth="1.25"
                    />
                    <path d="M96 22 L100 26 L104 22" stroke="currentColor" strokeWidth="1.25" />
                  </svg>
                </div>

                {renderMatchupCard(championshipGame, {
                  title: copy.championshipTitle,
                  testId: 'bracket-final-four-championship',
                })}

                {/* Your Champion — read-only reflection of championship pick */}
                <div
                  className="be-ff-champion flex w-full max-w-md items-center justify-center gap-2 rounded border-2 border-[var(--be-ink)] bg-[var(--be-paper)] px-3 py-2 text-center"
                  data-testid="bracket-final-four-champion-summary"
                  aria-live="polite"
                >
                  <Trophy className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                  <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1">
                    {copy.yourChampionLabel ? (
                      <span className="shrink-0 text-xs font-bold uppercase tracking-wide font-[family-name:var(--be-font-ui)]">
                        {copy.yourChampionLabel}
                      </span>
                    ) : null}
                    {champion ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-sm font-bold">#{champion.seed}</span>
                        {champion.logo ? (
                          <Image
                            src={champion.logo}
                            alt=""
                            width={24}
                            height={24}
                            className="h-6 w-6 shrink-0 object-contain"
                            unoptimized
                          />
                        ) : null}
                        <span className="min-w-0 text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
                          {champion.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">{copy.championNotSelected}</span>
                    )}
                  </div>
                  <Trophy className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                </div>

                {/* Tiebreaker — caption moved to info icon (hover tooltip + click modal) */}
                <div
                  className="be-ff-tiebreaker flex w-full max-w-sm flex-col items-center gap-1.5 text-center"
                  data-testid="bracket-final-four-tiebreaker-block"
                >
                  {copy.tieBreakerLabel ? (
                    <label
                      htmlFor="tieBreaker"
                      className="m-0 text-xs font-bold tracking-wide text-gray-800 font-[family-name:var(--be-font-ui)]"
                    >
                      {copy.tieBreakerLabel}
                    </label>
                  ) : null}
                  <div className="flex items-center justify-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      id="tieBreaker"
                      value={tieBreaker}
                      onChange={(e) => {
                        const next = filterTieBreakerIntegerString(e.target.value);
                        if (next !== null) onTieBreakerChange(next);
                      }}
                      disabled={readOnly}
                      aria-label={copy.tieBreakerLabel || undefined}
                      aria-describedby={tieBreakerTooltip ? 'tie-breaker-explanation' : undefined}
                      className={`be-ff-tiebreaker__input w-28 rounded-lg border px-3 py-2 text-center text-sm ${
                        readOnly
                          ? 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500'
                          : tieBreakerNeedsAttention
                            ? 'border-yellow-300 bg-yellow-50 text-black placeholder:text-xs placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-300'
                            : 'border-gray-300 text-black placeholder:text-xs placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
                      }`}
                      placeholder={copy.tieBreakerPlaceholder || undefined}
                      data-testid="tiebreaker-input"
                    />
                    {tieBreakerTooltip ? (
                    <span className="relative inline-flex">
                      <button
                        type="button"
                        className="be-ff-tiebreaker__info peer inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-400 text-gray-600 transition-colors hover:border-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label={copy.tieBreakerHelpAriaLabel || undefined}
                        title={tieBreakerTooltip}
                        data-testid="bracket-final-four-tiebreaker-hint-toggle"
                        onClick={() => setTieBreakerHintOpen(true)}
                      >
                        <Info className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                      </button>
                      <span
                        role="tooltip"
                        id="tie-breaker-explanation"
                        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded border border-gray-300 bg-white px-2.5 py-2 text-left text-xs leading-snug text-gray-700 opacity-0 shadow-md transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
                        data-testid="bracket-final-four-tiebreaker-tooltip"
                      >
                        {tieBreakerTooltip}
                      </span>
                    </span>
                    ) : null}
                  </div>
                </div>
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
                      finalFourDisabledMessage.trim() || copy.finalFourDisabledMessage
                    }
                  />
                )}
              </div>
            </div>
          </div>

          <div className="be-action-bar mt-1 flex w-full flex-wrap items-center justify-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-2 py-2 shadow-sm">
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
                  className={`be-btn be-btn--close cursor-pointer ${BRACKET_EDITOR_BAR_ACTION_CLASSES}`}
                  data-testid="bracket-final-four-close-button"
                >
                  <span>{copy.closeLabel}</span>
                </button>
              )
            ) : (
              <>
                {onSave && (
                  <button
                    type="button"
                    onClick={() => !saveDisabled && onSave()}
                    disabled={saveDisabled}
                    title={saveDisabled ? disableSaveSubmitMessage : copy.saveLabel}
                    style={{
                      width: `${stepButtonWidthCh}ch`,
                      minWidth: `${stepButtonWidthCh}ch`,
                      maxWidth: `${stepButtonWidthCh}ch`,
                    }}
                    className={`be-btn be-btn--save ${BRACKET_EDITOR_BAR_ACTION_CLASSES} ${
                      saveDisabled
                        ? 'be-btn--disabled cursor-not-allowed bg-gray-300 text-gray-500'
                        : 'cursor-pointer'
                    }`}
                    data-testid="bracket-final-four-save-button"
                  >
                    <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{copy.saveLabel}</span>
                  </button>
                )}
                {showBarSubmit ? (
                  <button
                    type="button"
                    onClick={() => submitEnabled && onSubmitBracket?.()}
                    disabled={!submitEnabled}
                    title={submitEnabled ? copy.submitReadyTooltip || undefined : submitDisabledMessage || undefined}
                    style={{
                      width: `${stepButtonWidthCh}ch`,
                      minWidth: `${stepButtonWidthCh}ch`,
                      maxWidth: `${stepButtonWidthCh}ch`,
                    }}
                    className={`be-btn be-btn--submit ${BRACKET_EDITOR_BAR_ACTION_CLASSES} ${
                      submitEnabled
                        ? 'cursor-pointer'
                        : 'be-btn--disabled cursor-not-allowed bg-gray-300 text-gray-500'
                    }`}
                    data-testid="submit-bracket-editor-button"
                  >
                    <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{copy.submitLabel}</span>
                  </button>
                ) : null}
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    style={{
                      width: `${stepButtonWidthCh}ch`,
                      minWidth: `${stepButtonWidthCh}ch`,
                      maxWidth: `${stepButtonWidthCh}ch`,
                    }}
                    className={`be-btn be-btn--cancel cursor-pointer ${BRACKET_EDITOR_BAR_ACTION_CLASSES}`}
                    data-testid="bracket-final-four-cancel-button"
                  >
                    <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                    <span>{copy.cancelLabel}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {tieBreakerHintOpen && tieBreakerTooltip ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          data-testid="bracket-final-four-tiebreaker-modal-backdrop"
          onClick={() => setTieBreakerHintOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tie-breaker-modal-title"
            className="be-ff-tiebreaker-modal max-w-sm rounded-lg border-2 border-[var(--be-ink)] bg-white p-4 shadow-lg"
            data-testid="bracket-final-four-tiebreaker-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2
                id="tie-breaker-modal-title"
                className="m-0 text-sm font-bold uppercase tracking-wide font-[family-name:var(--be-font-ui)]"
              >
                {copy.tieBreakerLabel}
              </h2>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                aria-label={copy.tieBreakerHelpCloseAriaLabel || undefined}
                data-testid="bracket-final-four-tiebreaker-modal-close"
                onClick={() => setTieBreakerHintOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="m-0 whitespace-pre-line text-sm leading-snug text-gray-700">{tieBreakerTooltip}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
