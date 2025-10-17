'use client';

import { useState, useEffect } from 'react';
import { TournamentData, TournamentBracket, TournamentGame } from '@/types/tournament';
import { getRegionalGames, updateBracketWithPicks } from '@/lib/bracketGenerator';
import RegionBracketLayout from './RegionBracketLayout';
import FinalFourChampionship from './FinalFourChampionship';
import { ChevronLeft, ChevronRight, CheckCircle, Circle, Save } from 'lucide-react';

interface StepByStepBracketProps {
  tournamentData: TournamentData;
  bracket: TournamentBracket;
  picks: { [gameId: string]: string };
  entryName: string;
  tieBreaker: string;
  onPick: (gameId: string, teamId: string) => void;
  onComplete: () => void;
  onSave?: () => void;
  onClose?: () => void;
  onEntryNameChange?: (entryName: string) => void;
  onTieBreakerChange?: (tieBreaker: string) => void;
  readOnly?: boolean;
}

export default function StepByStepBracket({ 
  tournamentData, 
  bracket, 
  picks, 
  entryName, 
  tieBreaker, 
  onPick, 
  onComplete, 
  onSave, 
  onClose,
  onEntryNameChange, 
  onTieBreakerChange,
  readOnly = false
}: StepByStepBracketProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedRegions, setCompletedRegions] = useState<Set<string>>(new Set());
  
  const regions = tournamentData.regions;
  const totalSteps = regions.length + 1; // 4 regions + Final Four & Championship
  
  const getStepName = (step: number) => {
    if (step < regions.length) {
      return `${regions[step].name} Region`;
    } else {
      return 'Final Four & Championship';
    }
  };

  const getStepProgress = (step: number) => {
    if (step < regions.length) {
      const region = regions[step];
      const regionGames = bracket.regions[region.position];
      const totalGames = 15; // 8 + 4 + 2 + 1 for each region
      const completedGames = regionGames.filter(game => picks[game.id]).length;
      return { completed: completedGames, total: totalGames };
    } else {
      // Final Four & Championship combined
      const finalFourGames = bracket.finalFour;
      const finalFourCompleted = finalFourGames.filter(game => picks[game.id]).length;
      const championshipCompleted = picks[bracket.championship.id] ? 1 : 0;
      const totalGames = finalFourGames.length + 1; // 2 Final Four + 1 Championship
      const completedGames = finalFourCompleted + championshipCompleted;
      return { completed: completedGames, total: totalGames };
    }
  };

  const isStepComplete = (step: number) => {
    const progress = getStepProgress(step);
    return progress.completed === progress.total;
  };

  const canProceed = () => {
    if (currentStep < regions.length) {
      return isStepComplete(currentStep);
    } else if (currentStep === regions.length) {
      // Final Four & Championship - need all regions complete, all Final Four games picked, and tie breaker filled
      const allRegionsComplete = regions.every(region => isStepComplete(regions.indexOf(region)));
      const finalFourComplete = isStepComplete(regions.length);
      const tieBreakerValid = tieBreaker && !isNaN(Number(tieBreaker)) && Number(tieBreaker) >= 100 && Number(tieBreaker) <= 300;
      const entryNameValid = entryName.trim().length > 0;
      
      return allRegionsComplete && finalFourComplete && tieBreakerValid && entryNameValid;
    } else {
      // Championship - need Final Four complete
      return isStepComplete(regions.length);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow navigation to any step
    setCurrentStep(stepIndex);
  };

  const handleTeamClick = (game: TournamentGame, team: Record<string, unknown>) => {
    if (game.winner) return;
    onPick(game.id, team.id as string);
  };

  const renderTeam = (team: Record<string, unknown>, game: TournamentGame, isTeam1: boolean) => {
    if (!team) return <div className="h-6 bg-gray-100 rounded"></div>;
    
    const isSelected = picks[game.id] === (team.id as string);
    const isClickable = !game.winner;
    
    return (
      <div
        className={`
          flex items-center justify-between px-2 py-1 rounded border cursor-pointer transition-all text-xs
          ${isSelected ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300 hover:border-gray-400'}
          ${isClickable ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-50'}
        `}
        onClick={() => isClickable && handleTeamClick(game, team)}
      >
        <div className="flex items-center space-x-1">
          <span className="text-xs font-bold text-gray-600">#{team.seed as number}</span>
          <img src={team.logo as string} alt={team.name as string} className="w-3 h-3" />
          <span className="text-xs font-medium truncate">{team.name as string}</span>
        </div>
        {isSelected && (
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
        )}
      </div>
    );
  };



  const renderCurrentStep = () => {
    const updatedBracket = updateBracketWithPicks(bracket, picks, tournamentData);
    
    if (currentStep < regions.length) {
      return (
        <RegionBracketLayout
          regionName={regions[currentStep].name}
          games={updatedBracket.regions[regions[currentStep].position]}
          picks={picks}
          onPick={onPick}
          readOnly={readOnly}
        />
      );
    } else {
      return (
        <FinalFourChampionship
          finalFourGames={updatedBracket.finalFour}
          championshipGame={updatedBracket.championship}
          picks={picks}
          onPick={onPick}
          tieBreaker={tieBreaker}
          onTieBreakerChange={onTieBreakerChange || (() => {})}
          readOnly={readOnly}
        />
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto relative">
      {/* Current Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-8">
            {/* Entry Name Field - positioned in top white space */}
            <div className="mb-6">
              <div className="flex items-center">
                <div className="flex items-center space-x-3">
                  <label htmlFor="entryName" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Entry Name:
                  </label>
                  <input
                    type="text"
                    id="entryName"
                    value={entryName}
                    onChange={(e) => onEntryNameChange?.(e.target.value)}
                    disabled={readOnly}
                    className={`max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                      readOnly 
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                        : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    placeholder="Enter your bracket name"
                  />
                </div>
                
                {/* Progress Dots - Fixed position to the right of Entry Name */}
                <div className="flex items-center space-x-2 ml-8">
                  {Array.from({ length: totalSteps }, (_, i) => {
                    const isFinalStep = i === totalSteps - 1;
                    const allRegionsComplete = Array.from({ length: totalSteps - 1 }, (_, j) => isStepComplete(j)).every(Boolean);
                    const isClickable = !isFinalStep || allRegionsComplete;

                    return (
                      <div key={i} className="flex items-center">
                        <button
                          onClick={() => handleStepClick(i)}
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
                
                {/* Region name on the right - using flex-1 to push to far right */}
                <div className="flex-1 text-right">
                  <h3 className="text-2xl font-bold text-gray-800">
                    {getStepName(currentStep)}
                  </h3>
                </div>
              </div>
            </div>
        
        {renderCurrentStep()}
      </div>

      {/* Unified Control Bar */}
      <div className="mt-6 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {/* Left: Previous Button */}
          <div className="flex-shrink-0">
            <button
              onClick={handlePrevious}
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
          </div>

          {/* Center: Spacer (progress dots moved to top) */}
          <div className="flex-1"></div>

            {/* Right: Save/Close and Next/Submit Buttons */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              {readOnly ? (
                <button
                  onClick={onClose}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <span>Close</span>
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
              )}

              {!readOnly && (
                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className={`
                    flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors
                    ${canProceed()
                      ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  <span>{currentStep === totalSteps - 1 ? 'Submit Bracket' : 'Next'}</span>
                  {currentStep < totalSteps - 1 && <ChevronRight className="w-4 h-4" />}
                </button>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
