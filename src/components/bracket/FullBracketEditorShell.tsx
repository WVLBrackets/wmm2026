'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { KeyRound, Save, Send, X } from 'lucide-react';
import type { TournamentBracket, TournamentData } from '@/types/tournament';
import { updateBracketWithPicks } from '@/lib/bracketGenerator';
import {
  computeCanProceedToSubmit,
  getBracketSubmitReadinessHint,
  getBracketSubmissionClosedMessage,
  isBracketSubmissionClosed,
  isSubmitDuplicateEntryName,
} from '@/lib/bracketSubmitReadiness';
import type { SiteConfigData } from '@/lib/siteConfig';
import { BRACKET_EDITOR_BAR_ACTION_CLASSES } from '@/lib/bracketStepNavMetrics';
import BracketEditorTopMessage from '@/components/bracket/BracketEditorTopMessage';
import FullBracketCanvas, { type FullBracketSizeMode } from '@/components/bracket/FullBracketCanvas';
import {
  DEFAULT_FULL_BRACKET_LAYOUT,
  type LayoutSettings,
} from '@/lib/fullBracket/fullBracketGeometry';
import { FULL_BRACKET_VIEWPORT_PADDING_X, fullBracketDebugOutline } from '@/lib/fullBracket/fullBracketViewChrome';

export interface FullBracketEditorShellProps {
  tournamentData: TournamentData;
  bracket: TournamentBracket;
  picks: Record<string, string>;
  onPick: (gameId: string, teamId: string) => void;
  entryName: string;
  tieBreaker: string;
  onEntryNameChange: (value: string) => void;
  onTieBreakerChange: (value: string) => void;
  readOnly?: boolean;
  submitError?: string;
  siteConfig?: SiteConfigData | null;
  existingBracketNames?: string[];
  isAdminMode?: boolean;
  isLiveResultsMode?: boolean;
  disableSaveSubmit?: boolean;
  disableMessage?: string;
  onSave?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
  onComplete: () => void;
  /** Column layout when not in 5P step mode (parent `Layout` control). */
  bracketSize: FullBracketSizeMode;
}

const STEP_BUTTON_CH = 12;

/**
 * Full 64/32 canvas with the same save/submit/entry chrome as the Final Four step.
 */
export default function FullBracketEditorShell({
  tournamentData,
  bracket,
  picks,
  onPick,
  entryName,
  tieBreaker,
  onEntryNameChange,
  onTieBreakerChange,
  readOnly = false,
  submitError = '',
  siteConfig,
  existingBracketNames = [],
  isAdminMode = false,
  isLiveResultsMode = false,
  disableSaveSubmit = false,
  disableMessage = '',
  onSave,
  onClose,
  onCancel,
  onComplete,
  bracketSize,
}: FullBracketEditorShellProps) {
  /** Geometry from committed full-bracket layout JSON (bundled at build time). */
  const [fullBracketLayout] = useState<LayoutSettings>(DEFAULT_FULL_BRACKET_LAYOUT);

  const updatedBracket = useMemo(
    () => updateBracketWithPicks(bracket, picks, tournamentData),
    [bracket, picks, tournamentData]
  );

  const entryNameDuplicate = useMemo(
    () => isSubmitDuplicateEntryName(entryName, siteConfig, existingBracketNames),
    [entryName, siteConfig, existingBracketNames]
  );

  const { submitEnabled, submitDisabledMessage } = useMemo(() => {
    if (readOnly || isAdminMode) {
      return { submitEnabled: false, submitDisabledMessage: '' };
    }
    if (disableSaveSubmit) {
      return {
        submitEnabled: false,
        submitDisabledMessage: disableMessage?.trim() || 'Saving and submitting are temporarily disabled.',
      };
    }
    if (isBracketSubmissionClosed(siteConfig)) {
      return {
        submitEnabled: false,
        submitDisabledMessage: getBracketSubmissionClosedMessage(siteConfig),
      };
    }
    if (isSubmitDuplicateEntryName(entryName, siteConfig, existingBracketNames)) {
      return {
        submitEnabled: false,
        submitDisabledMessage:
          siteConfig?.finalMessageDuplicateName ||
          'An entry with this name already exists for this year. Please choose a different name.',
      };
    }
    if (
      !computeCanProceedToSubmit(
        tournamentData,
        updatedBracket,
        picks,
        entryName,
        tieBreaker,
        siteConfig
      )
    ) {
      return {
        submitEnabled: false,
        submitDisabledMessage: getBracketSubmitReadinessHint(
          tournamentData,
          updatedBracket,
          picks,
          entryName,
          tieBreaker,
          siteConfig
        ),
      };
    }
    return { submitEnabled: true, submitDisabledMessage: 'Submit your bracket' };
  }, [
    readOnly,
    isAdminMode,
    disableSaveSubmit,
    disableMessage,
    siteConfig,
    entryName,
    existingBracketNames,
    tournamentData,
    updatedBracket,
    picks,
    tieBreaker,
  ]);

  const validationBanner = useMemo(() => {
    if (readOnly) return null;
    if (submitEnabled) {
      return {
        variant: 'validation-green' as const,
        message: siteConfig?.finalMessageReadyToSubmit || 'Your bracket is complete and ready to submit!',
      };
    }
    return {
      variant: 'validation-yellow' as const,
      message: submitDisabledMessage || 'Complete your bracket to submit.',
    };
  }, [readOnly, submitEnabled, submitDisabledMessage, siteConfig?.finalMessageReadyToSubmit]);

  const championshipGame = updatedBracket.championship;
  const championId = picks[championshipGame.id];
  const champion =
    championId && championshipGame.team1?.id === championId
      ? championshipGame.team1
      : championId && championshipGame.team2?.id === championId
        ? championshipGame.team2
        : null;

  const showBarSubmit = Boolean(!readOnly && !isAdminMode);

  const handleSubmitClick = () => {
    if (submitEnabled) onComplete();
  };

  return (
    <div
      className={`relative w-full min-h-screen overflow-auto bg-gray-200 ${fullBracketDebugOutline('page')}`.trim()}
    >
      <div
        className={`mx-auto w-full max-w-[min(100vw,1500px)] rounded-lg bg-white pb-3 pt-2 shadow-lg ${FULL_BRACKET_VIEWPORT_PADDING_X} ${fullBracketDebugOutline('shell')}`.trim()}
      >
        <div className="flex w-full min-w-0 flex-col">
          <div
            className={`min-w-0 overflow-hidden rounded-lg border-2 border-gray-300 bg-white shadow-sm ${fullBracketDebugOutline('card')}`.trim()}
          >
            <div
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-0 border-b px-2 py-2 sm:gap-x-2 ${
                submitEnabled ? 'border-green-200/90 bg-green-50' : 'border-gray-200'
              }`}
              data-testid="full-bracket-editor-title-bar"
            >
              <div className="flex min-w-0 flex-nowrap items-center gap-x-1 justify-self-start sm:gap-x-2">
                <label htmlFor="full-bracket-entry-name" className="sr-only">
                  Entry Name:
                </label>
                <span
                  className="hidden shrink-0 text-xs font-medium whitespace-nowrap text-gray-700 sm:inline"
                  aria-hidden="true"
                >
                  Entry Name:
                </span>
                {isLiveResultsMode ? (
                  <div className="flex min-w-0 max-w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-gray-100 px-2 py-1.5 text-xs font-bold text-gray-800 sm:min-w-[200px] sm:px-3 sm:py-2 sm:text-sm">
                    <KeyRound className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    <span>KEY</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    id="full-bracket-entry-name"
                    value={entryName}
                    onChange={(e) => onEntryNameChange(e.target.value)}
                    disabled={readOnly}
                    className={`min-w-0 w-full max-w-full flex-1 px-2 py-1.5 text-xs sm:min-w-[180px] sm:max-w-[20rem] sm:px-3 sm:py-2 sm:text-sm ${
                      readOnly
                        ? 'cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 text-gray-500'
                        : entryNameDuplicate
                          ? 'rounded-lg border-2 border-yellow-400 bg-yellow-50 text-yellow-800 shadow-sm focus:border-yellow-500 focus:ring-2 focus:ring-yellow-300'
                          : 'rounded-lg border border-gray-300 !bg-white text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
                    }`}
                    placeholder="Enter your bracket name"
                    data-testid="full-bracket-entry-name-input"
                  />
                )}
              </div>
              <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 justify-self-end text-right sm:gap-2">
                {champion ? (
                  <>
                    <span className="text-sm font-bold text-gray-600 sm:text-lg">#{champion.seed}</span>
                    {champion.logo ? (
                      <Image
                        src={champion.logo}
                        alt={champion.name}
                        width={32}
                        height={32}
                        className="h-6 w-6 shrink-0 object-contain sm:h-8 sm:w-8"
                        unoptimized
                      />
                    ) : null}
                    <span className="hidden max-w-[10rem] truncate text-lg font-semibold text-gray-800 sm:inline sm:max-w-none">
                      {champion.name}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {!readOnly && validationBanner ? (
              <div className="min-w-0 border-b border-gray-200">
                <BracketEditorTopMessage
                  message={validationBanner.message}
                  variant={validationBanner.variant}
                  embeddedInCard
                  data-testid="full-bracket-editor-validation-message"
                />
              </div>
            ) : null}

            <div
              className={`relative min-w-0 overflow-auto px-0 py-3 ${fullBracketDebugOutline('canvasWrap')}`.trim()}
              data-testid="full-bracket-editor-canvas-wrap"
            >
              <FullBracketCanvas
                tournamentData={tournamentData}
                updatedBracket={updatedBracket}
                picks={picks}
                tieBreaker={tieBreaker}
                layout={fullBracketLayout}
                bracketSize={bracketSize}
                readOnly={readOnly}
                onTieBreakerChange={readOnly ? undefined : onTieBreakerChange}
                onSelectTeam={readOnly ? undefined : onPick}
              />
            </div>
          </div>

          <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-2 py-2 shadow-sm">
            {readOnly ? (
              onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    width: `${STEP_BUTTON_CH}ch`,
                    minWidth: `${STEP_BUTTON_CH}ch`,
                    maxWidth: `${STEP_BUTTON_CH}ch`,
                  }}
                  className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} cursor-pointer bg-red-500 text-white hover:bg-red-600`}
                >
                  <span>Close</span>
                </button>
              )
            ) : (
              <>
                {onSave ? (
                  <button
                    type="button"
                    onClick={() => !disableSaveSubmit && onSave()}
                    disabled={disableSaveSubmit}
                    title={disableSaveSubmit ? disableMessage : 'Save'}
                    style={{
                      width: `${STEP_BUTTON_CH}ch`,
                      minWidth: `${STEP_BUTTON_CH}ch`,
                      maxWidth: `${STEP_BUTTON_CH}ch`,
                    }}
                    className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} ${
                      disableSaveSubmit
                        ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                        : 'cursor-pointer bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                    data-testid="full-bracket-save-button"
                  >
                    <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>Save</span>
                  </button>
                ) : null}
                {showBarSubmit ? (
                  <button
                    type="button"
                    onClick={() => handleSubmitClick()}
                    disabled={!submitEnabled}
                    title={submitDisabledMessage || undefined}
                    style={{
                      width: `${STEP_BUTTON_CH}ch`,
                      minWidth: `${STEP_BUTTON_CH}ch`,
                      maxWidth: `${STEP_BUTTON_CH}ch`,
                    }}
                    className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} ${
                      submitEnabled
                        ? 'cursor-pointer bg-blue-600 text-white hover:bg-blue-700'
                        : 'cursor-not-allowed bg-gray-300 text-gray-500'
                    }`}
                    data-testid="full-bracket-submit-button"
                  >
                    <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>Submit</span>
                  </button>
                ) : null}
                {onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    style={{
                      width: `${STEP_BUTTON_CH}ch`,
                      minWidth: `${STEP_BUTTON_CH}ch`,
                      maxWidth: `${STEP_BUTTON_CH}ch`,
                    }}
                    className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} cursor-pointer bg-red-500 text-white hover:bg-red-600`}
                    data-testid="full-bracket-cancel-button"
                  >
                    <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                    <span>Cancel</span>
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {submitError ? (
        <div className="mx-auto mt-4 max-w-4xl animate-fade-in rounded-lg border-l-4 border-red-500 bg-red-50 p-4 shadow-lg">
          <p className="text-sm font-medium text-red-800">{submitError}</p>
        </div>
      ) : null}
    </div>
  );
}
