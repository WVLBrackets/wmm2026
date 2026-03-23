'use client';

import { useEffect, useRef, RefObject } from 'react';
import Image from 'next/image';
import { TournamentGame } from '@/types/tournament';
import { CheckCircle, Save, KeyRound, ArrowRight, Send, X } from 'lucide-react';
import {
  BRACKET_EDITOR_BAR_ACTION_CLASSES,
  BRACKET_EDITOR_STAGE_MIN_HEIGHT_CLASS,
} from '@/lib/bracketStepNavMetrics';
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
  onSubmitBracket,
  submitEnabled = false,
  submitDisabledMessage = '',
  isAdminMode = false,
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
  disableSaveMessage = ''
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
      <div key={game.id} className="border border-gray-300 rounded p-1 space-y-0.5 mb-1 w-full">
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
      // Scroll horizontally to bring Round of 32 into view
      // Round of 64 column (w-48 = 192px) + spacer (w-8 = 32px) = 224px
      // Scroll by ~150px to bring Round of 32 into view while keeping some of Round of 64 visible
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
      // Scroll horizontally to bring Sweet 16 into view
      // Round of 32 column (w-48 = 192px) + spacer (w-6 = 24px) = 216px
      // Scroll by ~150px to bring Sweet 16 into view while keeping some of Round of 32 visible
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
      // Scroll all the way to the right end of the container to fully show Elite 8
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

  // Extract region letters for vertical display (split by character, filter spaces, uppercase)
  const regionLetters = regionName.toUpperCase().split('').filter(char => char.trim() !== '');

  return (
    <div
      className={`mx-auto flex w-max max-w-full flex-col ${BRACKET_EDITOR_STAGE_MIN_HEIGHT_CLASS}`}
    >
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="flex items-center" style={{ width: 'fit-content' }}>
          {/* Region Name - Vertical Letters in separate container to the left */}
          <div className="flex flex-col items-center justify-center pr-4" style={{ height: '100%', minWidth: '2rem' }}>
            {regionLetters.map((letter, index) => (
              <div
                key={index}
                className="text-2xl font-bold text-gray-700"
                style={{
                  lineHeight: '1.2',
                  marginBottom: index < regionLetters.length - 1 ? '0.25rem' : '0',
                }}
              >
                {letter}
              </div>
            ))}
          </div>

          {/* Bracket Container */}
          <div className="flex flex-col border-2 border-gray-300 rounded-lg" style={{ width: 'fit-content' }}>
            {/* Bracket Columns */}
            <div className="flex items-start">
          {/* Round of 64 */}
          <div className="w-48">
            {roundOf64.map(game => renderGame(game))}
          </div>

          {/* Spacer */}
          <div className="w-8"></div>

          {/* Round of 32 */}
          <div className="w-48">
            {roundOf32.map((game, index) => (
              <div key={game.id} style={{ marginTop: index === 0 ? '2rem' : '4.25rem' }}>
                {renderGame(game)}
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div className="w-6"></div>

          {/* Sweet 16 */}
          <div className="w-48">
            {sweet16.map((game, index) => (
              <div key={game.id} style={{ marginTop: index === 0 ? '6rem' : '12.25rem' }}>
                {renderGame(game)}
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div className="w-4"></div>

          {/* Elite 8 (fourth column - same size as first three) */}
          <div className="w-48 flex-shrink-0">
            {/* Elite 8 Games */}
            <div>
              {elite8.map((game, index) => (
                <div key={game.id} style={{ marginTop: index === 0 ? '14rem' : '0' }}>
                  {renderGame(game)}
                </div>
              ))}
            </div>
          </div>

          {/* Fifth Column - large Next control (flow), aligned with Elite 8 */}
          <div className="w-24 flex-shrink-0 relative">
            {onNext && !readOnly && (
              <div
                className="absolute"
                style={{
                  top: 'calc(14rem - 3px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '76.5%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  aria-label="Next region"
                  data-testid="bracket-region-next-arrow"
                  onClick={isComplete ? onNext : undefined}
                  disabled={!isComplete || !canProceed}
                  className={`
                    flex aspect-square w-full max-w-[76.5%] items-center justify-center rounded-full transition-all
                    ${isComplete && canProceed
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
                      filter: isComplete && canProceed ? 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' : 'none',
                    }}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Sixth Column - Summary Panel (half width, right-aligned, can overlap) */}
          <div className="w-24 flex-shrink-0 relative">
            {/* Summary Panel: Entry Name, Region Name, Champion Info - right-aligned, top aligned with Game 1 */}
            <div className="absolute right-0" style={{ minWidth: 'max-content' }}>
              {/* Row 1: Entry Name - label and field on same row */}
              <div className="mb-4 flex items-center space-x-2 justify-end" style={{ paddingTop: '2px', paddingRight: '2px' }}>
                <label htmlFor="entryName" className="text-xs font-medium text-gray-700 whitespace-nowrap">
                  Entry Name:
                </label>
                {isLiveResultsMode ? (
                  <div className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-800 font-bold flex items-center space-x-2 min-w-[200px] justify-center">
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
                    className={`px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                      readOnly 
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                        : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black'
                    }`}
                    style={{ width: 'max-content', minWidth: '200px' }}
                    placeholder="Enter your bracket name"
                    data-testid="entry-name-input"
                  />
                )}
              </div>

              {/* Row 2: Region Name with checkmark on left (only when complete) */}
              <div className="mb-4">
                <div className="text-lg font-bold text-gray-800 flex items-center space-x-2 justify-end" style={{ paddingRight: '5px' }}>
                  {isComplete && (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  )}
                  <span>{regionName} Region</span>
                </div>
              </div>

              {/* Row 3: Regional Champion (only when complete) - seed, name, and logo on same line */}
              {isComplete && regionalChampion && (
                <div className="flex items-center space-x-2 justify-end" style={{ paddingRight: '5px' }}>
                  <span className="text-lg font-bold text-gray-600">#{regionalChampion.seed}</span>
                  <span className="text-lg font-semibold text-gray-800">{regionalChampion.name}</span>
                  {regionalChampion.logo && (
                    <Image src={regionalChampion.logo} alt={regionalChampion.name} width={32} height={32} className="w-8 h-8 object-contain flex-shrink-0" unoptimized />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar: step nav grouped left — Save / Cancel / Close (right) */}
        <div
          className="mt-4 flex w-full max-w-full flex-nowrap items-stretch justify-between gap-4"
          style={{ paddingLeft: '2px', paddingRight: '2px', paddingBottom: '2px' }}
        >
          <div className="flex min-w-0 shrink-0 items-center justify-start overflow-x-auto">
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

          <div className="flex shrink-0 items-center justify-end gap-1.5">
            {readOnly ? (
              onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{ width: `${stepButtonWidthCh}ch`, minWidth: `${stepButtonWidthCh}ch`, maxWidth: `${stepButtonWidthCh}ch` }}
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
                    style={{ width: `${stepButtonWidthCh}ch`, minWidth: `${stepButtonWidthCh}ch`, maxWidth: `${stepButtonWidthCh}ch` }}
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
                    style={{ width: `${stepButtonWidthCh}ch`, minWidth: `${stepButtonWidthCh}ch`, maxWidth: `${stepButtonWidthCh}ch` }}
                    className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} bg-red-500 text-white hover:bg-red-600 cursor-pointer`}
                  >
                    <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                    <span>Cancel</span>
                  </button>
                )}
                {onSubmitBracket && !isAdminMode && (
                  <button
                    type="button"
                    data-testid="submit-bracket-editor-button"
                    onClick={() => submitEnabled && onSubmitBracket()}
                    disabled={!submitEnabled}
                    title={submitDisabledMessage || undefined}
                    style={{ width: `${stepButtonWidthCh}ch`, minWidth: `${stepButtonWidthCh}ch`, maxWidth: `${stepButtonWidthCh}ch` }}
                    className={`${BRACKET_EDITOR_BAR_ACTION_CLASSES} ${
                      submitEnabled
                        ? 'cursor-pointer bg-blue-600 text-white hover:bg-blue-700'
                        : 'cursor-not-allowed bg-gray-300 text-gray-500'
                    }`}
                  >
                    <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>Submit</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
