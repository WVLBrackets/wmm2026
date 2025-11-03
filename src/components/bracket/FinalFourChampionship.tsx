'use client';

import { TournamentGame } from '@/types/tournament';
import { CheckCircle, ChevronLeft, ChevronRight, Save } from 'lucide-react';

interface FinalFourChampionshipProps {
  finalFourGames: TournamentGame[];
  championshipGame: TournamentGame;
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
  tieBreaker: string;
  onTieBreakerChange: (value: string) => void;
  readOnly?: boolean;
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
}

export default function FinalFourChampionship({ 
  finalFourGames, 
  championshipGame, 
  picks, 
  onPick, 
  tieBreaker, 
  onTieBreakerChange,
  readOnly = false,
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
  isStepComplete
}: FinalFourChampionshipProps) {
  
  const handleTeamClick = (game: TournamentGame, team: Record<string, unknown>) => {
    if (game.winner || readOnly) return;
    onPick(game.id, team.id as string);
  };

  const renderTeam = (team: Record<string, unknown> | undefined, game: TournamentGame, isTeam1: boolean) => {
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
              <img src={team.logo as string} alt={team.name as string} className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{team.name as string}</span>
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
            {renderTeam(game.team1 as unknown as Record<string, unknown> | undefined, game, true)}
            {renderTeam(game.team2 as unknown as Record<string, unknown> | undefined, game, false)}
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
    
    // Find the champion team
    const champion = championshipGame.team1?.id === championId ? championshipGame.team1 : championshipGame.team2;
    return champion;
  };

  const champion = getChampion();
  const isComplete = isChampionshipComplete();

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg p-6 relative">
      {/* Champion info on top right when complete */}
      {isComplete && champion && (
        <div className="absolute top-6 right-6">
          <div className="text-right">
            <h4 className="text-lg font-bold text-gray-800 mb-2">Your Champion:</h4>
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-sm font-bold text-gray-600">#{champion.seed}</span>
              <span className="text-base font-semibold text-gray-800">{champion.name}</span>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex justify-end">
              <img src={champion.logo} alt={champion.name} className="w-18 h-18" />
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col items-center space-y-8">
            {/* Final Four Games - Top Row */}
            <div className="flex justify-center space-x-8">
              {finalFourGames.map((game, index) => (
                <div key={game.id} className="w-48">
                  {renderGame(game, getSemifinalTitle(game, index))}
                </div>
              ))}
            </div>

        {/* Championship Game - Center */}
        <div className="w-48">
          {renderGame(championshipGame, 'Championship')}
        </div>

        {/* Tie Breaker Input */}
        <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <label htmlFor="tieBreaker" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Tie Breaker:
            </label>
                <input
                  type="number"
                  id="tieBreaker"
                  value={tieBreaker}
                  onChange={(e) => onTieBreakerChange(e.target.value)}
                  min="100"
                  max="300"
                  disabled={readOnly}
                  className={`w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                    readOnly 
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                      : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="150"
                  title="Total combined points scored in the championship game"
                />
          </div>
        </div>
      </div>

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
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <span>{nextButtonText}</span>
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
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
