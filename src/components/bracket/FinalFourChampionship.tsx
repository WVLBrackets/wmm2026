'use client';

import { useEffect, useRef, RefObject } from 'react';
import Image from 'next/image';
import { TournamentGame } from '@/types/tournament';
import { SiteConfigData } from '@/lib/siteConfig';
import { CheckCircle, ChevronLeft, ChevronRight, Save, Trophy } from 'lucide-react';

interface FinalFourChampionshipProps {
  finalFourGames: TournamentGame[];
  championshipGame: TournamentGame;
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
  tieBreaker: string;
  onTieBreakerChange: (value: string) => void;
  readOnly?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  // Control buttons props
  onPrevious?: () => void;
  onSave?: () => void;
  onNext?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
  canProceed?: boolean;
  currentStep?: number;
  totalSteps?: number;
  nextButtonText?: string;
  // Progress dots props
  onStepClick?: (stepIndex: number) => void;
  isStepComplete?: (step: number) => boolean;
  // Entry name props
  entryName?: string;
  onEntryNameChange?: (value: string) => void;
  // Site config and validation props
  siteConfig?: SiteConfigData | null;
  existingBracketNames?: string[];
  currentBracketId?: string;
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
  onPrevious,
  onSave,
  onNext,
  onClose,
  onCancel,
  canProceed = false,
  currentStep = 4,
  totalSteps = 5,
  nextButtonText = 'Submit Bracket',
  onStepClick,
  isStepComplete,
  entryName,
  onEntryNameChange,
  siteConfig,
  existingBracketNames = [],
}: FinalFourChampionshipProps) {
  
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

    return (
      <div
        className={`
          flex items-center justify-between px-2 py-1 rounded border transition-all text-xs
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

      const renderGame = (game: TournamentGame, title: string) => {
        // Always render both team slots, even if teams are not yet determined
        return (
          <div className="border-2 border-gray-300 rounded-lg p-1 space-y-0.5 w-full">
            <div className="text-xs font-semibold text-gray-700 text-center mb-1">
              {title}
            </div>
            {renderTeam(game.team1 as unknown as Record<string, unknown> | undefined, game)}
            {renderTeam(game.team2 as unknown as Record<string, unknown> | undefined, game)}
          </div>
        );
      };

      const getSemifinalTitle = (game: TournamentGame, index: number) => {
        if (game.team1 && game.team2) {
          const region1 = game.team1.region;
          const region2 = game.team2.region;
          return `${region1} vs. ${region2}`;
        }
        return `Semifinal ${index + 1}`;
      };

  // Check if championship is complete and find the champion
  const isChampionshipComplete = () => {
    return picks[championshipGame.id];
  };

  const getChampion = () => {
    if (!isChampionshipComplete()) return null;
    
    const championId = picks[championshipGame.id];
    if (!championId) return null;
    
    // Verify that the selected champion ID actually matches one of the current teams in the championship game
    // This handles the case where semifinals change and invalidate a previously selected champion
    const team1Id = championshipGame.team1?.id;
    const team2Id = championshipGame.team2?.id;
    
    if (championId !== team1Id && championId !== team2Id) {
      // The selected champion is no longer valid (not in current championship teams)
      return null;
    }
    
    // Find the champion team
    const champion = championshipGame.team1?.id === championId ? championshipGame.team1 : championshipGame.team2;
    return champion;
  };

  const champion = getChampion();
  
  // Check if all three winners are selected (both semifinals + championship)
  // AND that the championship winner is valid (exists in current championship teams)
  const allWinnersSelected = () => {
    const allFinalFourSelected = finalFourGames.every(game => picks[game.id]);
    const championshipSelected = picks[championshipGame.id];
    
    if (!allFinalFourSelected || !championshipSelected) {
      return false;
    }
    
    // Verify that the selected champion ID actually matches one of the current teams in the championship game
    // This handles the case where semifinals change and invalidate a previously selected champion
    const championId = picks[championshipGame.id];
    const team1Id = championshipGame.team1?.id;
    const team2Id = championshipGame.team2?.id;
    
    // If the champion ID doesn't match either team, the selection is invalid
    if (championId !== team1Id && championId !== team2Id) {
      return false;
    }
    
    return true;
  };
  const isComplete = allWinnersSelected();

  // Validation logic for message bar

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
    // Check if name exists in submitted brackets (only submitted brackets count for duplicates)
    // Note: We're checking all submitted brackets, but should exclude current bracket if editing
    // For now, we check against all names - the API will handle the exclusion properly
    return existingBracketNames.some(name => name === trimmedName);
  };

  // Check if submission is disabled due to deadline or toggle
  const isSubmissionDisabled = () => {
    // Check stop_submit_toggle first
    if (siteConfig?.stopSubmitToggle === 'Yes') {
      return true;
    }
    
    // Check stop_submit_date_time
    if (siteConfig?.stopSubmitDateTime) {
      try {
        const deadline = new Date(siteConfig.stopSubmitDateTime);
        const now = new Date();
        if (now >= deadline) {
          return true;
        }
      } catch (e) {
        // Invalid date format - ignore
      }
    }
    
    return false;
  };

  // Get the reason submission is disabled
  const getSubmissionDisabledReason = () => {
    // Check stop_submit_toggle first
    if (siteConfig?.stopSubmitToggle === 'Yes') {
      return siteConfig?.finalMessageSubmitOff || 'Bracket submissions are currently disabled.';
    }
    
    // Check stop_submit_date_time
    if (siteConfig?.stopSubmitDateTime) {
      try {
        const deadline = new Date(siteConfig.stopSubmitDateTime);
        const now = new Date();
        if (now >= deadline) {
          return siteConfig?.finalMessageTooLate || 'Bracket submissions are closed. The deadline has passed.';
        }
      } catch (e) {
        // Invalid date format - ignore
      }
    }
    
    return null;
  };

  // Determine message state
  const getMessageState = () => {
    // Check submission disabled first (highest priority)
    const disabledReason = getSubmissionDisabledReason();
    if (disabledReason) {
      return {
        color: 'yellow',
        message: disabledReason
      };
    }
    
    if (!allWinnersSelected()) {
      return {
        color: 'yellow',
        message: siteConfig?.finalMessageTeamsMissing || 'Please select winners for all Final Four and Championship games.'
      };
    }
    
    if (!tieBreaker) {
      return {
        color: 'yellow',
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
        color: 'yellow',
        message
      };
    }
    
    if (isDuplicateName()) {
      return {
        color: 'yellow',
        message: siteConfig?.finalMessageDuplicateName || 'An entry with this name already exists for this year. Please choose a different name.'
      };
    }
    
    return {
      color: 'green',
      message: siteConfig?.finalMessageReadyToSubmit || 'Your bracket is complete and ready to submit!'
    };
  };

  const messageState = getMessageState();

  // Track scroll states to prevent repeated scrolling
  const hasScrolledToStartRef = useRef(false);
  const hasScrolledToChampionshipRef = useRef(false);
  const hasScrolledToEndRef = useRef(false);
  
  // Scroll to left when component mounts or step changes to Final Four
  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly) return;
    
    // Reset scroll tracking when step changes
    hasScrolledToStartRef.current = false;
    hasScrolledToChampionshipRef.current = false;
    hasScrolledToEndRef.current = false;
    
    // Scroll to the left to show Final Four games
    scrollContainerRef.current.scrollTo({
      left: 0,
      behavior: 'smooth'
    });
    
    hasScrolledToStartRef.current = true;
  }, [currentStep, scrollContainerRef, readOnly]);
  
  // Auto-scroll when both semifinals are complete (scroll right to show championship)
  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly || hasScrolledToChampionshipRef.current) return;
    
    // Check if both semifinal games have picks
    const bothSemifinalsComplete = finalFourGames.length === 2 && 
      finalFourGames.every(game => picks[game.id]);
    
    if (bothSemifinalsComplete) {
      // Scroll horizontally to bring championship into view
      // Final Four column (w-48 = 192px) + spacer (w-8 = 32px) = 224px
      // Scroll by ~200px to bring championship into view while keeping some of Final Four visible
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
      hasScrolledToChampionshipRef.current = true;
    }
  }, [finalFourGames, picks, scrollContainerRef, readOnly]);
  
  // Auto-scroll when championship winner is selected (scroll all the way right to show Tie Breaker and Submit)
  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly || hasScrolledToEndRef.current) return;
    
    const championshipPick = picks[championshipGame.id];
    if (championshipPick) {
      // Scroll all the way to the right to show Tie Breaker and Submit button
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: 'smooth'
      });
      hasScrolledToEndRef.current = true;
    }
  }, [championshipGame.id, picks, scrollContainerRef, readOnly]);


  return (
    <div className="flex flex-col mx-auto border-2 border-gray-300 rounded-lg" style={{ width: 'fit-content' }}>
      {/* Bracket Content */}
      <div className="flex items-start">
        {/* First Column - Header Title and Final Four Games */}
        <div className="w-48">
          {/* Header Title - First row, left-justified, can overlap into columns 2 and 3 */}
          <div className="flex-shrink-0" style={{ minWidth: '12rem', maxWidth: 'none', paddingTop: '2px', paddingLeft: 'calc(2px + 5px)', marginBottom: '1rem' }}>
            <h2 className="text-lg font-bold text-gray-800 whitespace-nowrap">
              {siteConfig?.finalFourHeaderMessage || ''}
            </h2>
          </div>
          {/* Final Four Games - stacked vertically */}
          {finalFourGames.map((game, index) => (
            <div key={game.id} style={{ marginTop: index === 0 ? '0' : '1rem' }}>
              {renderGame(game, getSemifinalTitle(game, index))}
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div className="w-8"></div>

        {/* Second Column - Championship Game */}
        <div className="w-48">
          <div style={{ marginTop: 'calc(4rem + 8px)' }}>
            {renderGame(championshipGame, 'Championship')}
          </div>
        </div>

        {/* Spacer */}
        <div className="w-6"></div>

        {/* Third Column - Empty (for spacing) */}
        <div className="w-48"></div>

        {/* Spacer */}
        <div className="w-4"></div>

        {/* Fourth Column - Empty (for spacing) */}
        <div className="w-48 flex-shrink-0"></div>

        {/* Fifth Column - Summary Panel (half width, right-aligned, same as region pages) */}
        <div className="w-24 flex-shrink-0 relative">
          {/* Summary Panel: Entry Name, Champion Info, Tie Breaker - right-aligned, top aligned */}
          <div className="absolute right-0" style={{ minWidth: 'max-content' }}>
            {/* Row 1: Entry Name - label and field on same row */}
            <div className="mb-4 flex items-center space-x-2 justify-end" style={{ paddingTop: '2px', paddingRight: '2px' }}>
              <label htmlFor="entryName" className="text-xs font-medium text-gray-700 whitespace-nowrap">
                Entry Name:
              </label>
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
              />
            </div>

            {/* Row 2: Final Four & Championship Title */}
            <div className="mb-4">
              <div className="text-lg font-bold text-gray-800 flex items-center space-x-2 justify-end" style={{ paddingRight: '5px' }}>
                {isComplete && (
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                )}
                <span>Final Four & Champ</span>
              </div>
            </div>

            {/* Row 3: Champion (always show, empty if not complete) */}
            <div className="flex items-center space-x-2 justify-end mb-4" style={{ paddingRight: '5px', minHeight: '2rem' }}>
              {isComplete && champion ? (
                <>
                  <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <span className="text-lg font-bold text-gray-600">#{champion.seed}</span>
                  <span className="text-lg font-semibold text-gray-800">{champion.name}</span>
                  {champion.logo && (
                    <Image src={champion.logo} alt={champion.name} width={32} height={32} className="w-8 h-8 object-contain flex-shrink-0" unoptimized />
                  )}
                </>
              ) : (
                <div style={{ height: '2rem' }}></div>
              )}
            </div>

            {/* Row 4: Tie Breaker Input */}
            <div className="flex items-center space-x-2 justify-end" style={{ paddingRight: '2px' }}>
              <label htmlFor="tieBreaker" className="text-xs font-medium text-gray-700 whitespace-nowrap">
                Tie Breaker:
              </label>
              <input
                type="number"
                id="tieBreaker"
                value={tieBreaker}
                onChange={(e) => onTieBreakerChange(e.target.value)}
                min="50"
                max="500"
                disabled={readOnly}
                className={`w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                  readOnly 
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                    : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder:text-gray-200'
                }`}
                placeholder="###"
                title="Total combined points scored in the championship game"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Message Bar */}
      {!readOnly && (
        <div className={`mt-4 rounded-lg border-2 ${
          messageState.color === 'yellow' 
            ? 'bg-yellow-50 border-yellow-400 text-yellow-800' 
            : 'bg-green-50 border-green-400 text-green-800'
        }`} style={{ width: 'calc(100% - 4px)', marginLeft: '2px', marginRight: '2px', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '12px', paddingRight: '10px' }}>
          <p className="text-sm font-medium text-right">{messageState.message}</p>
        </div>
      )}

      {/* Control Buttons at bottom */}
      <div className="flex items-center justify-between mt-4" style={{ width: '100%', maxWidth: '100%', paddingLeft: '2px', paddingRight: '2px', paddingBottom: '2px' }}>
        {/* Left: Previous Button */}
        <div className="flex-shrink-0">
          {onPrevious && (
            <button
              onClick={onPrevious}
              disabled={currentStep === 0}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors
                ${currentStep === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                }
              `}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
          )}
        </div>

        {/* Center: Progress Dots */}
        {onStepClick && isStepComplete && (
          <div className="flex items-center space-x-2 flex-1 justify-center">
            {Array.from({ length: totalSteps }, (_, i) => {
              const isFinalStep = i === totalSteps - 1;
              const allRegionsComplete = Array.from({ length: totalSteps - 1 }, (_, j) => isStepComplete(j)).every(Boolean);
              const isClickable = !isFinalStep || allRegionsComplete;

              return (
                <div key={i} className="flex items-center">
                  <button
                    onClick={() => onStepClick(i)}
                    disabled={!isClickable}
                    title={isFinalStep && !allRegionsComplete ? "Complete all four regions first" : ""}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                      ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}
                      ${i === currentStep ? 'bg-blue-600 text-white' :
                        isStepComplete(i) ? 'bg-green-600 text-white hover:bg-green-700' :
                        isClickable ? 'bg-gray-300 text-gray-600 hover:bg-gray-400' : 'bg-gray-200 text-gray-400'}
                    `}
                  >
                    {isStepComplete(i) ? <CheckCircle className="w-5 h-5" /> : i + 1}
                  </button>
                  {i < totalSteps - 1 && (
                    <div className={`w-6 h-0.5 ${isStepComplete(i) ? 'bg-green-600' : 'bg-gray-300'} transition-colors`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Right: Cancel, Save/Close and Next/Submit Buttons */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          {readOnly ? (
            <>
              {/* View mode: Close and Next buttons - Next on far right */}
              {/* Previous button is shown on the left side, not here */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                >
                  <span>Close</span>
                </button>
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  disabled={currentStep === (totalSteps ? totalSteps - 1 : 4)}
                  className={`
                    flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors
                    ${currentStep === (totalSteps ? totalSteps - 1 : 4)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                    }
                  `}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <>
              {onSave && (
                <button
                  onClick={onSave}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
              )}
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                >
                  <span>Cancel</span>
                </button>
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  disabled={!canProceed || isDuplicateName() || isSubmissionDisabled()}
                  className={`
                    flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors
                    ${canProceed && !isDuplicateName() && !isSubmissionDisabled()
                      ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  <span>{nextButtonText}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
