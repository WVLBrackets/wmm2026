'use client';

import { useState, useEffect, useRef } from 'react';
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
  submitError?: string;
  bracketNumber?: number;
  year?: number;
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
  readOnly = false,
  submitError = '',
  bracketNumber,
  year
}: StepByStepBracketProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedRegions, setCompletedRegions] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
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

  const canProceed = (): boolean => {
    if (currentStep < regions.length) {
      return isStepComplete(currentStep);
    } else if (currentStep === regions.length) {
      // Final Four & Championship - need all regions complete, all Final Four games picked, and tie breaker filled
      const allRegionsComplete = regions.every(region => isStepComplete(regions.indexOf(region)));
      const finalFourComplete = isStepComplete(regions.length);
      const tieBreakerValid = Boolean(tieBreaker && !isNaN(Number(tieBreaker)) && Number(tieBreaker) >= 100 && Number(tieBreaker) <= 300);
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
          scrollContainerRef={scrollContainerRef}
          onPrevious={handlePrevious}
          onSave={handleSave}
          onNext={handleNext}
          canProceed={canProceed()}
          currentStep={currentStep}
          totalSteps={totalSteps}
          bracketNumber={bracketNumber}
          year={year}
          nextButtonText={currentStep === totalSteps - 1 ? 'Submit Bracket' : 'Next'}
          onStepClick={handleStepClick}
          isStepComplete={isStepComplete}
          entryName={entryName}
          onEntryNameChange={onEntryNameChange}
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
    <div className="w-full relative overflow-x-auto" ref={scrollContainerRef}>
      {/* Current Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-8 min-w-max">
        {renderCurrentStep()}
      </div>

      {/* Error Message */}
      {submitError && (
        <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-lg animate-fade-in">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{submitError}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
