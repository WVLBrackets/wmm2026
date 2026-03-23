'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TournamentData, TournamentBracket } from '@/types/tournament';
import { updateBracketWithPicks } from '@/lib/bracketGenerator';
import {
  computeCanProceedToSubmit,
  getBracketSubmitReadinessHint,
  getBracketSubmissionClosedMessage,
  isBracketSubmissionClosed,
  isSubmitDuplicateEntryName,
} from '@/lib/bracketSubmitReadiness';
import { SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
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
  siteConfig?: SiteConfigData | null;
  existingBracketNames?: string[];
  currentBracketId?: string;
  isAdminMode?: boolean;
  isLiveResultsMode?: boolean;
  disableSaveSubmit?: boolean;
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
  siteConfig,
  existingBracketNames = [],
  currentBracketId,
  isAdminMode = false,
  isLiveResultsMode = false,
  disableSaveSubmit = false,
  disableMessage = ''
}: StepByStepBracketProps) {
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
    () => [...regions.map((r) => r.name), 'Final Four'],
    [regions],
  );

  const stepBarButtonWidthCh = useMemo(
    () => computeUniformStepNavWidthCh(stepNavLabels),
    [stepNavLabels],
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
        updatedBracketForSubmit,
        picks,
        entryName,
        tieBreaker,
        siteConfig,
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
          siteConfig,
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
    updatedBracketForSubmit,
    picks,
    tieBreaker,
  ]);

  const handleSubmitBracket = useCallback(() => {
    if (!submitEnabled) return;
    onComplete();
  }, [submitEnabled, onComplete]);

  const finalFourNavDisabledMessage =
    siteConfig?.finalFourDisabledMessage?.trim() ||
    FALLBACK_CONFIG.finalFourDisabledMessage ||
    'Complete all four regions before you can work on the Final Four and championship.';

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
      return computeCanProceedToSubmit(tournamentData, bracket, picks, entryName, tieBreaker, siteConfig);
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
          disableSave={disableSaveSubmit}
          disableSaveMessage={disableMessage}
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
          siteConfig={siteConfig as SiteConfigData | null}
          existingBracketNames={existingBracketNames}
          currentBracketId={currentBracketId}
          isAdminMode={isAdminMode}
          isLiveResultsMode={isLiveResultsMode}
          disableSaveSubmit={disableSaveSubmit}
          disableSaveSubmitMessage={disableMessage}
        />
      );
    }
  };

  return (
    <div className="w-full relative overflow-x-auto bg-gray-200 min-h-screen" ref={scrollContainerRef}>
      {/* Current Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-4 min-w-max">
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
