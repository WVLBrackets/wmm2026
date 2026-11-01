'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TournamentData, TournamentBracket } from '@/types/tournament';
import { updateBracketWithPicks } from '@/lib/bracketGenerator';
import {
  computeCanProceedToSubmit,
  getBracketSubmitReadinessHint,
  isSubmitDuplicateEntryName,
} from '@/lib/bracketSubmitReadiness';
import {
  gamePickIsValid,
  updateBracketWithValidPicks,
} from '@/lib/bracketPickValidity';
import { useBracketEditorCopy } from '@/components/bracket/BracketEditorCopyContext';
import { computeUniformStepNavWidthCh } from '@/lib/bracketStepNavMetrics';
import RegionBracketLayout from './RegionBracketLayout';
import FinalFourChampionship from './FinalFourChampionship';

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
  onCancel?: () => void;
  onEntryNameChange?: (entryName: string) => void;
  onTieBreakerChange?: (tieBreaker: string) => void;
  readOnly?: boolean;
  submitError?: string;
  bracketNumber?: number;
  year?: number;
  existingBracketNames?: string[];
  currentBracketId?: string;
  isAdminMode?: boolean;
  isLiveResultsMode?: boolean;
  disableSaveSubmit?: boolean;
  /** When set, overrides save-button disable independently of submit (Save WIP). */
  disableSave?: boolean;
  disableMessage?: string;
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
  onCancel,
  onEntryNameChange, 
  onTieBreakerChange,
  readOnly = false,
  submitError = '',
  bracketNumber,
  year,
  existingBracketNames = [],
  currentBracketId,
  isAdminMode = false,
  isLiveResultsMode = false,
  disableSaveSubmit = false,
  disableSave,
  disableMessage = ''
}: StepByStepBracketProps) {
  const copy = useBracketEditorCopy();
  const saveDisabled = disableSave ?? disableSaveSubmit;
  // Restore current step from sessionStorage on mount
  const getInitialStep = () => {
    if (typeof window === 'undefined') return 0;
    const savedStep = sessionStorage.getItem('bracketCurrentStep');
    return savedStep ? parseInt(savedStep, 10) : 0;
  };
  
  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Track if this is the initial mount
  const isInitialMount = useRef(true);
  
  // Initialize history state on mount and save step changes
  useEffect(() => {
    if (typeof window === 'undefined' || readOnly) return;
    
    // Save current step to sessionStorage
    sessionStorage.setItem('bracketCurrentStep', String(currentStep));
    
    if (isInitialMount.current) {
      // On initial mount, replace current history entry with step info
      window.history.replaceState({ step: currentStep }, '', window.location.href);
      isInitialMount.current = false;
    } else {
      // On subsequent step changes, push new history entry
      window.history.pushState({ step: currentStep }, '', window.location.href);
    }
  }, [currentStep, readOnly]);
  
  // Handle browser back button - navigate to previous step
  useEffect(() => {
    if (typeof window === 'undefined' || readOnly) return;
    
    const handlePopState = (event: PopStateEvent) => {
      const step = event.state?.step;
      if (step !== undefined && step >= 0 && step !== currentStep) {
        setCurrentStep(step);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentStep, readOnly]);
  
  const regions = tournamentData.regions;
  const totalSteps = regions.length + 1; // 4 regions + Final Four & Championship

  const stepNavLabels = useMemo(
    () => [...regions.map((r) => r.name), copy.finalFourTitle],
    [regions, copy.finalFourTitle],
  );

  const stepBarButtonWidthCh = useMemo(
    () => computeUniformStepNavWidthCh(stepNavLabels),
    [stepNavLabels],
  );

  const entryNameDuplicate = useMemo(
    () => isSubmitDuplicateEntryName(entryName, existingBracketNames),
    [entryName, existingBracketNames]
  );

  const updatedBracketForSubmit = useMemo(
    () => updateBracketWithPicks(bracket, picks, tournamentData),
    [bracket, picks, tournamentData],
  );

  const { submitEnabled, submitDisabledMessage } = useMemo(() => {
    if (readOnly || isAdminMode) {
      return { submitEnabled: false, submitDisabledMessage: '' };
    }
    if (disableSaveSubmit) {
      return {
        submitEnabled: false,
        submitDisabledMessage: disableMessage?.trim() || copy.actionsDisabledMessage,
      };
    }
    if (isSubmitDuplicateEntryName(entryName, existingBracketNames)) {
      return { submitEnabled: false, submitDisabledMessage: copy.duplicateNameMessage };
    }
    if (
      !computeCanProceedToSubmit(
        tournamentData,
        updatedBracketForSubmit,
        picks,
        entryName,
        tieBreaker,
        copy,
      )
    ) {
      return {
        submitEnabled: false,
        submitDisabledMessage: getBracketSubmitReadinessHint(
          tournamentData,
          updatedBracketForSubmit,
          picks,
          entryName,
          tieBreaker,
          copy,
        ),
      };
    }
    return { submitEnabled: true, submitDisabledMessage: copy.submitReadyTooltip };
  }, [
    readOnly,
    isAdminMode,
    disableSaveSubmit,
    disableMessage,
    copy,
    entryName,
    existingBracketNames,
    tournamentData,
    updatedBracketForSubmit,
    picks,
    tieBreaker,
  ]);

  const handleSubmitBracket = useCallback(() => {
    if (!submitEnabled) return;
    onComplete();
  }, [submitEnabled, onComplete]);

  const finalFourNavDisabledMessage = copy.finalFourDisabledMessage;

  const getStepProgress = (step: number) => {
    const live = updateBracketWithValidPicks(bracket, picks, tournamentData);
    if (step < regions.length) {
      const region = regions[step];
      const regionGames = live.regions[region.position] || [];
      const totalGames = 15; // 8 + 4 + 2 + 1 for each region
      const completedGames = regionGames.filter((game) =>
        gamePickIsValid(game, picks),
      ).length;
      return { completed: completedGames, total: totalGames };
    } else {
      // Final Four & Championship combined — orphan picks do not count
      const finalFourGames = live.finalFour;
      const finalFourCompleted = finalFourGames.filter((game) =>
        gamePickIsValid(game, picks),
      ).length;
      const championshipCompleted = gamePickIsValid(live.championship, picks) ? 1 : 0;
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
      return computeCanProceedToSubmit(tournamentData, bracket, picks, entryName, tieBreaker, copy);
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

  const handleStepClick = (stepIndex: number) => {
    // Allow navigation to any step
    setCurrentStep(stepIndex);
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
          onSave={handleSave}
          onClose={onClose}
          onCancel={onCancel}
          onNext={handleNext}
          canProceed={canProceed()}
          onSubmitBracket={handleSubmitBracket}
          submitEnabled={submitEnabled}
          submitDisabledMessage={submitDisabledMessage}
          isAdminMode={isAdminMode}
          currentStep={currentStep}
          totalSteps={totalSteps}
          bracketNumber={bracketNumber}
          year={year}
          onStepClick={handleStepClick}
          isStepComplete={isStepComplete}
          stepNavLabels={stepNavLabels}
          stepButtonWidthCh={stepBarButtonWidthCh}
          finalFourDisabledMessage={finalFourNavDisabledMessage}
          entryName={entryName}
          onEntryNameChange={onEntryNameChange}
          isLiveResultsMode={isLiveResultsMode}
          disableSave={saveDisabled}
          disableSaveMessage={disableMessage}
          bracketRegionalMessage={copy.regionalMessage.trim()}
          bracketRegionalMessageDone={copy.regionalMessageDone.trim()}
          entryNameDuplicate={entryNameDuplicate}
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
          tournamentData={tournamentData}
          readOnly={readOnly}
          scrollContainerRef={scrollContainerRef}
          onSave={handleSave}
          onSubmitBracket={handleSubmitBracket}
          submitEnabled={submitEnabled}
          submitDisabledMessage={submitDisabledMessage}
          onClose={onClose}
          onCancel={onCancel}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onStepClick={handleStepClick}
          isStepComplete={isStepComplete}
          stepNavLabels={stepNavLabels}
          stepButtonWidthCh={stepBarButtonWidthCh}
          finalFourDisabledMessage={finalFourNavDisabledMessage}
          entryName={entryName}
          onEntryNameChange={onEntryNameChange}
          existingBracketNames={existingBracketNames}
          currentBracketId={currentBracketId}
          isAdminMode={isAdminMode}
          isLiveResultsMode={isLiveResultsMode}
          disableSaveSubmit={disableSaveSubmit}
          disableSave={saveDisabled}
          disableSaveSubmitMessage={disableMessage}
          entryNameDuplicate={entryNameDuplicate}
        />
      );
    }
  };

  return (
    <div
      className="be-workspace-page w-full relative overflow-x-auto bg-gray-200 min-h-screen"
      ref={scrollContainerRef}
    >
      {/* Current Step Content — w-fit avoids extra horizontal whitespace wider than the bracket row */}
      <div className="be-workspace-card mx-auto w-fit max-w-full rounded-lg bg-white px-4 pb-3 pt-2 shadow-lg">
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
