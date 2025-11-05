'use client';

import { useEffect, useRef, RefObject } from 'react';
import { TournamentGame } from '@/types/tournament';
import { CheckCircle, ChevronLeft, ChevronRight, Save, ArrowRight } from 'lucide-react';

interface RegionBracketLayoutProps {
  regionName: string;
  games: TournamentGame[];
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
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
  bracketNumber?: number;
  year?: number;
  nextButtonText?: string;
  // Progress dots props
  onStepClick?: (stepIndex: number) => void;
  isStepComplete?: (step: number) => boolean;
  // Entry name and region info props
  entryName?: string;
  onEntryNameChange?: (value: string) => void;
}

export default function RegionBracketLayout({ 
  regionName, 
  games, 
  picks, 
  onPick,
  readOnly = false,
  scrollContainerRef,
  onPrevious,
  onSave,
  onNext,
  onClose,
  onCancel,
  canProceed = false,
  currentStep = 0,
  totalSteps = 5,
  bracketNumber,
  year,
  nextButtonText = 'Next',
  onStepClick,
  isStepComplete,
  entryName = '',
  onEntryNameChange
}: RegionBracketLayoutProps) {
  const hasScrolledRoundOf64Ref = useRef(false);
  const hasScrolledRoundOf32Ref = useRef(false);
  const hasScrolledSweet16Ref = useRef(false);
  
  const handleTeamClick = (game: TournamentGame, team: Record<string, unknown>) => {
    if (game.winner || readOnly) return;
    onPick(game.id, team.id as string);
  };

  const renderTeam = (team: Record<string, unknown> | undefined, game: TournamentGame, isTeam1: boolean, round: string) => {
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
          <img src={team.logo as string} alt={team.name as string} className="w-3 h-3 flex-shrink-0" />
          <span className="text-xs font-medium truncate text-black">{team.name as string}</span>
        </div>
        {isSelected && (
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        )}
      </div>
    );
  };

  const renderGame = (game: TournamentGame, round: string) => {
    // Always render both team slots, even if teams are not yet determined
    return (
      <div key={game.id} className="border border-gray-300 rounded p-1 space-y-0.5 mb-1 w-full">
        {renderTeam(game.team1 as unknown as Record<string, unknown> | undefined, game, true, round)}
        {renderTeam(game.team2 as unknown as Record<string, unknown> | undefined, game, false, round)}
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

  return (
    <div className="flex flex-col mx-auto border-2 border-gray-300 rounded-lg" style={{ width: 'fit-content' }}>
        {/* Bracket Columns */}
        <div className="flex items-start">
          {/* Round of 64 */}
          <div className="w-48">
            {roundOf64.map(game => renderGame(game, 'Round of 64'))}
          </div>

          {/* Spacer */}
          <div className="w-8"></div>

          {/* Round of 32 */}
          <div className="w-48">
            {roundOf32.map((game, index) => (
              <div key={game.id} style={{ marginTop: index === 0 ? '2rem' : '4.25rem' }}>
                {renderGame(game, 'Round of 32')}
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div className="w-6"></div>

          {/* Sweet 16 */}
          <div className="w-48">
            {sweet16.map((game, index) => (
              <div key={game.id} style={{ marginTop: index === 0 ? '6rem' : '12.25rem' }}>
                {renderGame(game, 'Sweet 16')}
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
                  {renderGame(game, 'Elite 8')}
                </div>
              ))}
            </div>
          </div>

          {/* Fifth Column - Summary Panel (half width, right-aligned, can overlap) */}
          <div className="w-24 flex-shrink-0 relative">
            {/* Arrow button - aligned with Elite 8 matchup */}
            {onNext && !readOnly && (
              <div 
                className="absolute" 
                style={{ 
                  top: 'calc(14rem - 3px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '76.5%', // 90% * 0.85 = 76.5%
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <button
                  onClick={isComplete ? onNext : undefined}
                  disabled={!isComplete || !canProceed}
                  className={`
                    w-full aspect-square rounded-full flex items-center justify-center transition-all
                    ${isComplete && canProceed
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 cursor-pointer shadow-lg hover:shadow-xl active:shadow-md'
                      : 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-500 cursor-not-allowed shadow'
                    }
                  `}
                  style={{ 
                    maxWidth: '76.5%',
                    boxShadow: isComplete && canProceed 
                      ? '0 4px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.2)'
                      : '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <ArrowRight className="w-7 h-7" style={{ filter: isComplete && canProceed ? 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' : 'none' }} />
                </button>
              </div>
            )}
            {/* Summary Panel: Entry Name, Region Name, Champion Info - right-aligned, top aligned with Game 1 */}
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
                    <img src={regionalChampion.logo} alt={regionalChampion.name} className="w-8 h-8 object-contain flex-shrink-0" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Control Buttons at bottom of bracket */}
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
              {/* View mode: Next (disabled on last page), and Close on all pages */}
              {/* Previous button is shown on the left side, not here */}
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
              {onClose && (
                <button
                  onClick={onClose}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                >
                  <span>Close</span>
                </button>
              )}
            </>
          ) : (
            <>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                >
                  <span>Cancel</span>
                </button>
              )}
              {onSave && (
                <button
                  onClick={onSave}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  disabled={!canProceed}
                  className={`
                    flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors
                    ${canProceed
                      ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  <span>{nextButtonText}</span>
                  {currentStep < totalSteps - 1 && <ChevronRight className="w-4 h-4" />}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
