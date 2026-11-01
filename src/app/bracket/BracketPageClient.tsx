'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Suspense, Fragment } from 'react';
import { flushSync } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TournamentData, TournamentBracket, BracketSubmission } from '@/types/tournament';
import { tryLoadTournamentData } from '@/lib/tournamentLoader';
import {
  applyDisplayNamesToTournamentData,
  buildTeamIdToDisplayNameMapFromApi,
} from '@/lib/teamDisplayName';
import { generate64TeamBracket } from '@/lib/bracketGenerator';
import { applyPickCascade } from '@/lib/fullBracket/fullBracketGeometry';
import dynamic from 'next/dynamic';
import { SiteConfigData } from '@/lib/siteConfig';
import MyPicksLanding, { type Bracket as MyPicksBracketRow } from '@/components/MyPicksLanding';
import LoadingBasketball from '@/components/vintage/feedback/LoadingBasketball';

const FullBracketEditorShell = dynamic(
  () => import('@/components/bracket/FullBracketEditorShell'),
  { loading: () => <LoadingBasketball message="" /> },
);
const StepByStepBracket = dynamic(
  () => import('@/components/bracket/StepByStepBracket'),
  { loading: () => <LoadingBasketball message="" /> },
);
const BracketViewerModal = dynamic(
  () => import('@/components/bracket/BracketViewerModal'),
  { ssr: false },
);
import { useUsageLogger } from '@/hooks/useUsageLogger';
import { useCSRF } from '@/hooks/useCSRF';
import {
  evaluateVintageActionLock,
  formatVintagePriorYearMessage,
  type VintageActionLockResult,
} from '@/lib/services/vintageActionLock';
import {
  buildYearScopedPath,
  isHistoricalYear,
  parseViewingYear,
} from '@/lib/services/tournamentYearHelpers';
import type { VintageContent } from '@/lib/vintage/content';
import {
  formatVintagePicksLabel,
  type VintagePicksContent,
} from '@/lib/vintage/picksContent';
import {
  formatEditorCopy,
  type VintageBracketEditorContent,
} from '@/lib/vintage/bracketEditorContent';
import type { VintagePdfDialogCopy } from '@/lib/vintage/emailsContent';
import type { VintageStandingsContent } from '@/lib/vintage/standingsContent';
import type { MyPicksBracketRow as MyPicksServerRow } from '@/lib/services/myPicksService';
import { useServerTime } from '@/hooks/useServerTime';
import VintageShell from '@/components/vintage/VintageShell';
import { BracketEditorCopyProvider } from '@/components/bracket/BracketEditorCopyContext';
import BusyOverlay from '@/components/vintage/feedback/BusyOverlay';
import ConfirmDialog from '@/components/vintage/feedback/ConfirmDialog';
import SiteErrorPanel from '@/components/vintage/feedback/SiteErrorPanel';
import { gamePickIsValid, updateBracketWithValidPicks } from '@/lib/bracketPickValidity';
import { adminBracketEditorReturnHref } from '@/lib/admin/bracketsListFilters';
import '@/components/vintage/picks/picks.css';
import '@/components/bracket/bracket-editor.css';

/**
 * Count valid picks across the live 63-game tree for editor progress chrome.
 */
function countOverallPickProgress(
  bracket: TournamentBracket,
  picks: Record<string, string>,
  tournamentData: TournamentData,
): { completed: number; total: number } {
  const live = updateBracketWithValidPicks(bracket, picks, tournamentData);
  let completed = 0;
  let total = 0;
  for (const regionGames of Object.values(live.regions)) {
    for (const game of regionGames) {
      total += 1;
      if (gamePickIsValid(game, picks)) completed += 1;
    }
  }
  for (const game of live.finalFour) {
    total += 1;
    if (gamePickIsValid(game, picks)) completed += 1;
  }
  total += 1;
  if (gamePickIsValid(live.championship, picks)) completed += 1;
  return { completed, total };
}

/**
 * My Picks table row for submit-from-landing (`entryName` may be unset until the user fills it).
 */
type MyPicksSubmitRow = Omit<BracketSubmission, 'entryName'> & { entryName?: string };

/** Step-by-step vs single full-bracket canvas (64-team layout for 1 Page). */
type MyBracketLayoutMode = '5p' | '1p';

const MY_BRACKET_LAYOUT_MODE_KEY = 'myBracketLayoutMode';

function parseStoredLayoutMode(raw: string | null): MyBracketLayoutMode {
  if (raw === '5p') return '5p';
  if (raw === '1p') return '1p';
  /** Legacy session values from the old 64/32 toggle → treat as one-page. */
  if (raw === '64' || raw === '32') return '1p';
  return '5p';
}

/**
 * Normalize save/update API payloads into the bracket list row shape.
 * `bracketNumber` is included when the API sends it (user routes); preserved from prior row on merge when missing.
 */
function bracketFromSaveApiResponse(
  raw: Record<string, unknown>,
  sessionUser: { name?: string | null; email?: string | null }
): BracketSubmission & { bracketNumber?: number } {
  const tie = raw.tieBreaker;
  const picks =
    typeof raw.picks === 'object' && raw.picks !== null && !Array.isArray(raw.picks)
      ? (raw.picks as Record<string, string>)
      : {};
  const status = raw.status;
  const safeStatus: BracketSubmission['status'] =
    status === 'submitted' || status === 'deleted' || status === 'in_progress' ? status : 'in_progress';

  const row: BracketSubmission & { bracketNumber?: number } = {
    id: String(raw.id),
    playerName: String(raw.playerName ?? sessionUser.name ?? ''),
    playerEmail: String(raw.playerEmail ?? sessionUser.email ?? ''),
    entryName: String(raw.entryName ?? ''),
    tieBreaker: tie !== undefined && tie !== null ? String(tie) : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    submittedAt: typeof raw.submittedAt === 'string' ? raw.submittedAt : undefined,
    lastSaved: typeof raw.lastSaved === 'string' ? raw.lastSaved : undefined,
    picks,
    totalPoints: typeof raw.totalPoints === 'number' ? raw.totalPoints : 0,
    status: safeStatus,
    year: typeof raw.year === 'number' ? raw.year : undefined,
  };
  if (typeof raw.bracketNumber === 'number') {
    row.bracketNumber = raw.bracketNumber;
  }
  return row;
}

/**
 * Default entry name for a copied bracket from My Picks CMS (`{entry}` token).
 *
 * @param template - `feedback.copyEntryName`
 * @param sourceEntryName - Entry being copied
 */
function defaultBracketCopyEntryName(template: string, sourceEntryName: string): string {
  return formatEditorCopy(template, { entry: sourceEntryName.trim() }).trim();
}

/** Server-rendered My Picks data (no client waterfall on first paint). */
export interface MyPicksInitialData {
  activeYear: number;
  viewingYear: number;
  availableYears: number[];
  brackets: MyPicksServerRow[];
  tournamentData: TournamentData | null;
}

/** Signed-in viewer (server session). */
export interface MyPicksViewer {
  name: string;
  email: string;
}

/**
 * Prefer API error text only for CMS-sourced gate / validation responses (400, 403);
 * everything else shows the CMS failure message.
 *
 * @param response - Fetch response
 * @param data - Parsed JSON body
 * @param fallback - CMS failure copy
 */
function apiFailureMessage(
  response: Response,
  data: { error?: unknown },
  fallback: string,
): string {
  if ((response.status === 400 || response.status === 403) && typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }
  return fallback;
}

function BracketContent({
  vintageAdmin = false,
  vintageHome,
  picksCopy,
  bracketEditorCopy,
  pdfDialogCopy,
  standingsChrome,
  siteConfig,
  viewer,
  initial,
}: BracketPageClientProps) {
  const { status } = useSession();
  const feedback = picksCopy.feedback;
  useUsageLogger('Pick');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchWithCSRF } = useCSRF();
  
  // View states
  const [currentView, setCurrentView] = useState<'landing' | 'bracket'>('landing');
  const [editingBracket, setEditingBracket] = useState<unknown>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  // Tournament data
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(initial.tournamentData);
  const [bracket, setBracket] = useState<TournamentBracket | null>(() =>
    initial.tournamentData ? generate64TeamBracket(initial.tournamentData) : null,
  );
  const [picks, setPicks] = useState<{ [gameId: string]: string }>({});
  const [entryName, setEntryName] = useState<string>('');
  const [tieBreaker, setTieBreaker] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [submittedBrackets, setSubmittedBrackets] = useState<BracketSubmission[]>(
    initial.brackets as unknown as BracketSubmission[],
  );
  const [bracketResetKey, setBracketResetKey] = useState(0);
  const [deletingBracketId, setDeletingBracketId] = useState<string | null>(null);
  const [pendingDeleteBracketId, setPendingDeleteBracketId] = useState<string | null>(null);
  const [pendingPermanentDeleteBracketId, setPendingPermanentDeleteBracketId] = useState<string | null>(null);
  const [pendingReturnBracketId, setPendingReturnBracketId] = useState<string | null>(null);
  const [returningBracketId, setReturningBracketId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string>('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLiveResultsMode, setIsLiveResultsMode] = useState(false);
  const [pendingBracketData, setPendingBracketData] = useState<Record<string, unknown> | null>(null);
  /** CMS notice popup (replaces window.alert). */
  const [notice, setNotice] = useState<string | null>(null);
  const [submittingBracketId, setSubmittingBracketId] = useState<string | null>(null);
  /**
   * Full-page spinner while leaving the editor so My Picks never paints a stale list
   * (e.g. after Submit → reload brackets → then show landing).
   */
  const [viewTransitionMessage, setViewTransitionMessage] = useState<string | null>(null);
  /** Copy in flight — set synchronously so the button disables before network work. */
  const [copyingBracketId, setCopyingBracketId] = useState<string | null>(null);
  /** Restore in flight — set synchronously so the button disables before network work. */
  const [restoringBracketId, setRestoringBracketId] = useState<string | null>(null);
  /** New Bracket in flight — disables create + row mutations until navigation/list settles. */
  const [creatingBracketBusy, setCreatingBracketBusy] = useState(false);
  /** After a successful Copy API call: confirm name before opening the bracket editor. */
  const [copyNameDialog, setCopyNameDialog] = useState<{
    newBracket: Record<string, unknown>;
    draftEntryName: string;
  } | null>(null);
  const [copyNameDialogBusy, setCopyNameDialogBusy] = useState(false);
  const [copyNameError, setCopyNameError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<MyBracketLayoutMode>(() => {
    if (typeof window === 'undefined') return '5p';
    return parseStoredLayoutMode(sessionStorage.getItem(MY_BRACKET_LAYOUT_MODE_KEY));
  });

  const [fullBracketModalOpen, setFullBracketModalOpen] = useState(false);
  const [fullBracketModalId, setFullBracketModalId] = useState<string | null>(null);
  const [fullBracketModalTitle, setFullBracketModalTitle] = useState('');
  const [fullBracketModalYear, setFullBracketModalYear] = useState(initial.activeYear);
  const [activeYear, setActiveYear] = useState<number>(initial.activeYear);
  const [viewingYear, setViewingYear] = useState<number>(initial.viewingYear);
  const [availableYears, setAvailableYears] = useState<number[]>(initial.availableYears);
  /** Soft year switch in progress (keeps landing mounted; no full-page spinner). */
  const [isYearSwitching, setIsYearSwitching] = useState(false);

  const submittedEntryNames = useMemo(
    () => submittedBrackets.filter((b) => b.status === 'submitted').map((b) => b.entryName),
    [submittedBrackets]
  );

  const viewingHistorical = isHistoricalYear(viewingYear, activeYear);
  const { getServerNowMs } = useServerTime();

  const softSwitchYearRef = useRef<((nextYear: number) => Promise<void>) | undefined>(undefined);
  const hasRestoredState = useRef(false);
  /** Year already handled by an in-flight soft switch (avoids double-fetch with URL sync). */
  const softSwitchTargetRef = useRef<number | null>(null);
  /** Monotonic id so rapid year changes discard stale field/bracket responses. */
  const yearSwitchGenRef = useRef(0);

  /**
   * Load and enrich tournament field JSON for a year (null when file is absent).
   */
  const loadFieldDataForYear = async (year: string): Promise<TournamentData | null> => {
    const data = await tryLoadTournamentData(year);
    if (!data) return null;
    try {
      const refResponse = await fetch('/api/team-data?activeOnly=false', { cache: 'no-store' });
      const refJson = await refResponse.json();
      if (refJson.success && Array.isArray(refJson.data) && refJson.data.length > 0) {
        return applyDisplayNamesToTournamentData(
          data,
          buildTeamIdToDisplayNameMapFromApi(refJson.data)
        );
      }
    } catch (refError) {
      console.warn('[Bracket] Could not apply team display names:', refError);
    }
    return data;
  };

  // Check for admin mode and edit parameter
  useEffect(() => {
    if (!searchParams) return;
    
    const editId = searchParams.get('edit');
    const adminMode = searchParams.get('admin') === 'true';
    const liveMode = searchParams.get('live') === 'true';
    
    if (editId && adminMode) {
      setIsAdminMode(true);
      setIsLiveResultsMode(liveMode);
      
      // Clear sessionStorage when editing a different bracket to prevent stale state
      if (typeof window !== 'undefined') {
        const savedState = sessionStorage.getItem('bracketState');
        if (savedState) {
          try {
            const state = JSON.parse(savedState);
            // If the edit ID in URL is different from saved state, clear it
            if (state.editingBracketId && state.editingBracketId !== editId) {
              sessionStorage.removeItem('bracketState');
              sessionStorage.removeItem('bracketCurrentStep');
              hasRestoredState.current = false; // Reset restoration flag
            }
          } catch {
            // If parsing fails, clear it anyway
            sessionStorage.removeItem('bracketState');
            sessionStorage.removeItem('bracketCurrentStep');
            hasRestoredState.current = false;
          }
        }
      }
      
      // Load the bracket to edit with admin mode flag
      loadBracketForEdit(editId, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /**
   * Always open the editor at the top of the page.
   * My Picks list scroll is otherwise preserved across the client-side view swap,
   * which leaves the sticky brand strip mid-page.
   */
  useEffect(() => {
    if (currentView !== 'bracket' || typeof window === 'undefined') return;

    const scrollEditorToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollEditorToTop();
    // Re-assert after paint: hiding site nav + mounting sticky chrome can shift layout.
    const frameId = window.requestAnimationFrame(() => {
      scrollEditorToTop();
      window.requestAnimationFrame(scrollEditorToTop);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [currentView, bracketResetKey]);

  useEffect(() => {
    if (currentView !== 'bracket' || typeof window === 'undefined') return;
    sessionStorage.setItem(MY_BRACKET_LAYOUT_MODE_KEY, layoutMode);
  }, [layoutMode, currentView]);

  // Save bracket state to sessionStorage whenever it changes
  useEffect(() => {
    // Don't save/clear during initial restoration
    if (hasRestoredState.current === false && typeof window !== 'undefined') {
      const savedState = sessionStorage.getItem('bracketState');
      if (savedState) {
        // Don't clear during initial load - wait for restoration to complete
        return;
      }
    }
    
    if (currentView === 'bracket' && !isReadOnly) {
      const bracketState = {
        picks,
        entryName,
        tieBreaker,
        editingBracketId: editingBracket ? (editingBracket as Record<string, unknown>).id as string : null,
        editingBracketStatus: editingBracket ? (editingBracket as Record<string, unknown>).status as string : null,
        isAdminMode
      };
      sessionStorage.setItem('bracketState', JSON.stringify(bracketState));
    } else if (currentView === 'landing' && hasRestoredState.current) {
      // Only clear state when explicitly leaving bracket view (not during initial load)
      // Clear state when not in bracket view or in read-only mode
      sessionStorage.removeItem('bracketState');
      sessionStorage.removeItem('bracketCurrentStep');
    }
  }, [picks, entryName, tieBreaker, currentView, editingBracket, isReadOnly, isAdminMode]);

  // Restore bracket state from sessionStorage on mount (only once)
  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || hasRestoredState.current || !bracket || !tournamentData) {
      return;
    }
    
    // Check for URL parameters
    const editId = searchParams?.get('edit');
    const adminMode = searchParams?.get('admin') === 'true';
    
    // If we're navigating to /bracket with no URL params, clear stale sessionStorage
    // This ensures a fresh start when visiting "My Picks"
    if (!editId) {
      // No edit parameter - this is a fresh navigation to the bracket page
      // Clear any stale sessionStorage to prevent unwanted state restoration
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('bracketState');
        sessionStorage.removeItem('bracketCurrentStep');
        hasRestoredState.current = true; // Mark as processed so we don't try again
      }
      return;
    }
    
    // If we have an edit parameter but it's admin mode, let the other useEffect handle it
    if (editId && adminMode) {
      // URL-based edit is being handled by the other useEffect, skip restoration
      return;
    }
    
    // Only restore if we have an edit parameter (non-admin edit)
    // This handles the case where user was editing a bracket and refreshed
    const savedState = sessionStorage.getItem('bracketState');
    const savedStep = sessionStorage.getItem('bracketCurrentStep');
    
    if (savedState && savedStep && editId) {
      try {
        const state = JSON.parse(savedState);
        const currentStep = parseInt(savedStep, 10);
        
        // Only restore if the saved state matches the URL edit parameter
        if (state.editingBracketId === editId) {
          // Always restore if we have saved state and step (even if no picks yet)
          hasRestoredState.current = true;
          setIsAdminMode(state.isAdminMode || false);
          
          // Identify games for the current step to clear their picks
          const gamesToClear: string[] = [];
          
          if (currentStep < tournamentData.regions.length) {
            // Region step - get all games for this region
            const region = tournamentData.regions[currentStep];
            const regionGames = bracket.regions[region.position] || [];
            regionGames.forEach(game => {
              gamesToClear.push(game.id);
            });
          } else if (currentStep === tournamentData.regions.length) {
            // Final Four & Championship step
            bracket.finalFour.forEach(game => {
              gamesToClear.push(game.id);
            });
            gamesToClear.push(bracket.championship.id);
          }
          
          // Filter picks to exclude games for the current step (if picks exist)
          const filteredPicks: { [gameId: string]: string } = {};
          if (state.picks && typeof state.picks === 'object') {
            Object.entries(state.picks).forEach(([gameId, teamId]) => {
              if (!gamesToClear.includes(gameId)) {
                filteredPicks[gameId] = teamId as string;
              }
            });
          }
          
          // Clear tieBreaker if refreshing on Final Four step
          const restoredTieBreaker = (currentStep === tournamentData.regions.length) ? '' : (state.tieBreaker || '');
          
          // Load the bracket data, then restore filtered picks (clear current step)
          loadBracketForEdit(editId, false).then(() => {
            // Restore filtered picks (excluding current step) and other state
            setPicks(filteredPicks);
            setEntryName(state.entryName || '');
            setTieBreaker(restoredTieBreaker);
          });
        } else {
          // Saved state doesn't match URL - clear it
          sessionStorage.removeItem('bracketState');
          sessionStorage.removeItem('bracketCurrentStep');
          hasRestoredState.current = true;
        }
      } catch (error) {
        console.error('Error restoring bracket state:', error);
        sessionStorage.removeItem('bracketState');
        sessionStorage.removeItem('bracketCurrentStep');
        hasRestoredState.current = true;
      }
    } else {
      // No saved state or no edit parameter - mark as processed
      hasRestoredState.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, bracket, tournamentData, searchParams]); // Run when loading completes and bracket/tournament data is available


  // Set default entry name from the signed-in viewer
  useEffect(() => {
    if (viewer.name && !entryName) {
      setEntryName(viewer.name);
    }
  }, [viewer.name, entryName]);

  /** Active Tourney Year (server-resolved from homepage Key Data). */
  const vintageActiveYear = activeYear;

  /**
   * Resolve Changing-action access from the CMS Action Lock master reference.
   */
  const resolvePicksAccess = useCallback(
    (jsonPresent: boolean, yearForLock: number): VintageActionLockResult =>
      evaluateVintageActionLock({
        action: 'changing',
        bracketYear: yearForLock,
        activeYear: vintageActiveYear,
        picksCopy,
        tipoffAt: vintageHome.tournament.tipoffAt ?? '',
        bracketsReadyAt: vintageHome.tournament.bracketsReadyAt,
        tournamentJsonPresent: jsonPresent,
        nowMs: getServerNowMs(),
      }),
    [
      picksCopy,
      vintageHome.tournament.bracketsReadyAt,
      vintageHome.tournament.tipoffAt,
      vintageActiveYear,
      getServerNowMs,
    ],
  );

  /**
   * Client-side Changing lock (server re-checks on mutate).
   */
  const picksAccess = useMemo(
    () => resolvePicksAccess(Boolean(tournamentData), viewingYear),
    [resolvePicksAccess, tournamentData, viewingYear],
  );

  /** Must stay above early returns — used by vintage editor chrome progress. */
  const overallPickProgress = useMemo(() => {
    if (!bracket || !tournamentData) return { completed: 0, total: 63 };
    return countOverallPickProgress(bracket, picks, tournamentData);
  }, [bracket, picks, tournamentData]);

  const mutationsBlockMessage =
    picksAccess.message ||
    formatVintagePicksLabel(picksCopy.masterLockMessage, {
      year: vintageActiveYear,
    });

  /**
   * Editor gates: tipoff / master lock block Submit but allow Save WIP.
   * Admin Edit Picks may Save historical brackets (admin API bypasses user gates).
   */
  const editorDisableSubmit =
    !isAdminMode && (picksAccess.blocked || viewingHistorical);
  const editorDisableSave = isAdminMode
    ? false
    : viewingHistorical ||
      (picksAccess.blocked &&
        !(
          picksAccess.reasonCode === 'tourney_active' ||
          picksAccess.reasonCode === 'master_lock'
        ));

  /**
   * Sync gate for opening confirms / starting busy UI (no network).
   * Server still re-checks on the actual mutate via {@link ensureMutationsAllowed}.
   */
  const ensureClientMayMutateSync = (): boolean => {
    if (viewingHistorical) {
      setNotice(formatVintagePriorYearMessage(picksCopy, viewingYear, activeYear));
      return false;
    }
    return true;
  };

  /**
   * Ensure Changing mutations are allowed (fresh server check-creation).
   * Opening a bracket for **view** uses {@link handleEditBracket} (read-only when blocked).
   * Prefer {@link ensureClientMayMutateSync} first so busy/confirm UI can paint immediately.
   */
  const ensureMutationsAllowed = async (): Promise<boolean> => {
    if (!ensureClientMayMutateSync()) return false;
    try {
      const response = await fetch('/api/bracket/check-creation', { cache: 'no-store' });
      const data = await response.json();
      if (!data.success || !data.allowed) {
        setNotice(data.reason || mutationsBlockMessage);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error verifying bracket mutation access:', error);
      setNotice(feedback.verifyAccessFailed);
      return false;
    }
  };

  /**
   * Load brackets for a viewing year and refresh year-switcher metadata.
   */
  const loadSubmittedBrackets = async (yearForList?: number) => {
    try {
      const year = yearForList ?? viewingYear;
      const response = await fetch(`/api/tournament-bracket?year=${year}`, { cache: 'no-store' });
      const data = await response.json();

      if (data.success) {
        if (typeof data.activeYear === 'number') {
          setActiveYear(data.activeYear);
        }
        if (typeof data.viewingYear === 'number') {
          setViewingYear(data.viewingYear);
        }
        if (Array.isArray(data.availableYears)) {
          setAvailableYears(data.availableYears);
        }
        setSubmittedBrackets(Array.isArray(data.data) ? data.data : []);
      } else {
        console.error('Failed to load brackets:', data.error);
        setNotice(feedback.loadFailed);
      }
    } catch (error) {
      console.error('Error loading submitted brackets:', error);
      setNotice(feedback.loadFailed);
    }
  };

  /**
   * Switch viewing year without tearing down the landing page.
   * Reloads field JSON + bracket list only (no fresh site-config / full-page spinner).
   * Uses a generation counter so rapid year changes discard stale responses.
   */
  const softSwitchYear = async (nextYear: number) => {
    if (nextYear === viewingYear && softSwitchTargetRef.current == null) return;
    const gen = ++yearSwitchGenRef.current;
    softSwitchTargetRef.current = nextYear;
    setCurrentView('landing');
    setEditingBracket(null);
    setViewingYear(nextYear);
    setIsYearSwitching(true);
    try {
      const [enriched, bracketsResponse] = await Promise.all([
        loadFieldDataForYear(String(nextYear)),
        fetch(`/api/tournament-bracket?year=${nextYear}`, { cache: 'no-store' }),
      ]);
      if (gen !== yearSwitchGenRef.current) return;

      if (!enriched) {
        setTournamentData(null);
        setBracket(null);
      } else {
        setTournamentData(enriched);
        setBracket(generate64TeamBracket(enriched));
      }

      const data = await bracketsResponse.json();
      if (gen !== yearSwitchGenRef.current) return;
      if (data.success) {
        if (typeof data.activeYear === 'number') {
          setActiveYear(data.activeYear);
        }
        if (Array.isArray(data.availableYears)) {
          setAvailableYears(data.availableYears);
        }
        setSubmittedBrackets(Array.isArray(data.data) ? data.data : []);
      } else {
        console.error('Failed to load brackets during year switch:', data.error);
        setNotice(feedback.loadFailed);
      }
    } catch (error) {
      console.error('Error switching tournament year:', error);
      setNotice(feedback.loadFailed);
    } finally {
      if (gen === yearSwitchGenRef.current) {
        softSwitchTargetRef.current = null;
        setIsYearSwitching(false);
      }
    }
  };

  softSwitchYearRef.current = softSwitchYear;

  /**
   * Keep `?year=` in the address bar without an App Router navigation.
   * `router.replace` remounts this force-dynamic page (full refresh + lag); history does not.
   */
  const syncYearInUrl = (nextYear: number) => {
    if (typeof window === 'undefined') return;
    const nextPath = buildYearScopedPath('/bracket', nextYear, activeYear);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === nextPath) return;
    window.history.replaceState(window.history.state, '', nextPath);
  };

  /**
   * Switch My Picks viewing year via URL (`?year=` omitted for the active year).
   */
  const handleViewingYearChange = (nextYear: number) => {
    if (nextYear === viewingYear) return;
    syncYearInUrl(nextYear);
    void softSwitchYear(nextYear);
  };

  // Unauthenticated sessions are redirected server-side; guard client sign-outs too.
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // Browser back/forward after history.replaceState year sync → soft switch.
  useEffect(() => {
    const onPopState = () => {
      if (status === 'unauthenticated') return;
      const params = new URLSearchParams(window.location.search);
      const next = parseViewingYear(params.get('year'), activeYear);
      if (next === viewingYear) return;
      if (softSwitchTargetRef.current === next) return;
      void softSwitchYearRef.current?.(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [status, activeYear, viewingYear]);

  /**
   * Load a bracket for edit/view (including Bracket Admin `?edit=&admin=true`).
   * Field JSON must match the bracket's year — never paint historical picks onto
   * the active-year SSR field (same rule as {@link handleEditBracket}).
   */
  const loadBracketForEdit = async (bracketId: string, adminMode = false) => {
    try {
      setIsLoading(true);

      // Use admin endpoint if in admin mode
      const endpoint = adminMode
        ? `/api/admin/brackets/${bracketId}`
        : `/api/tournament-bracket/${bracketId}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (!data.success || !data.data) {
        console.error('Failed to load bracket:', data.error);
        setNotice(feedback.loadFailed);
        setIsLoading(false);
        return;
      }

      const bracketData = data.data as Record<string, unknown>;
      const bracketYear =
        typeof bracketData.year === 'number' ? bracketData.year : activeYear;
      const loadedFieldYear = tournamentData?.year
        ? Number.parseInt(String(tournamentData.year), 10)
        : null;
      const fieldMatchesBracket =
        Boolean(tournamentData) &&
        Boolean(bracket) &&
        loadedFieldYear === bracketYear;

      // Always align tournament field to the bracket year (My Picks edit path).
      if (!fieldMatchesBracket) {
        const tournamentDataLoaded = await loadFieldDataForYear(String(bracketYear));
        if (!tournamentDataLoaded) {
          setTournamentData(null);
          setBracket(null);
          setIsLoading(false);
          setNotice(feedback.loadFailed);
          return;
        }
        setTournamentData(tournamentDataLoaded);
        setBracket(generate64TeamBracket(tournamentDataLoaded));
      }

      setEditingBracket(bracketData);
      // Applied once bracket structure for this year is ready (see effect below).
      setPendingBracketData(bracketData);
    } catch (error) {
      console.error('Error loading bracket for edit:', error);
      setNotice(feedback.loadFailed);
      setIsLoading(false);
    }
  };

  // Apply pending bracket data once bracket structure is ready
  useEffect(() => {
    if (pendingBracketData && bracket && tournamentData) {
      setPicks(pendingBracketData.picks as { [gameId: string]: string } || {});
      setEntryName(isLiveResultsMode ? 'KEY' : (pendingBracketData.entryName as string || ''));
      setTieBreaker(pendingBracketData.tieBreaker?.toString() || '');
      setCurrentView('bracket');
      setIsLoading(false);
      setPendingBracketData(null); // Clear pending data
    }
  }, [pendingBracketData, bracket, tournamentData, isLiveResultsMode]);

  const handleFullBracketPick = useCallback((gameId: string, teamId: string) => {
    setPicks((prev) => applyPickCascade(prev, gameId, teamId));
  }, []);

  const handlePick = (gameId: string, teamId: string) => {
    setPicks(prev => {
      const newPicks = { ...prev };
      
      // Get the current pick for this game
      const currentPick = prev[gameId];
      
      // If this is a different pick than before, we need to clear downstream picks
      if (currentPick && currentPick !== teamId) {
        // Find all games that could be affected by this change
        const gamesToClear = findDownstreamGames(gameId, currentPick, prev, tournamentData);
        
        // Clear the picks for all downstream games
        gamesToClear.forEach(gameIdToClear => {
          delete newPicks[gameIdToClear];
        });
      }
      
      // Set the new pick
      newPicks[gameId] = teamId;
      
      return newPicks;
    });
  };

  // Helper function to find all games that should be cleared when a pick changes
  const findDownstreamGames = (changedGameId: string, previousWinnerId: string, currentPicks: { [gameId: string]: string }, tournamentData: TournamentData | null): string[] => {
    if (!tournamentData || !bracket) return [];
    
    const gamesToClear: string[] = [];

    // Final Four / championship are not in regional maps — clear the title game
    // when a semifinal winner changes so an orphan champ pick cannot linger.
    if (changedGameId === 'final-four-1' || changedGameId === 'final-four-2') {
      const championshipPick = currentPicks[bracket.championship.id];
      if (championshipPick === previousWinnerId) {
        gamesToClear.push(bracket.championship.id);
      }
      return gamesToClear;
    }
    if (changedGameId === bracket.championship.id) {
      return [];
    }
    
    // Find which region this game is in
    let gameRegion = '';
    Object.entries(bracket.regions).forEach(([regionName, regionGames]) => {
      if (regionGames.some(game => game.id === changedGameId)) {
        gameRegion = regionName;
      }
    });
    
    if (!gameRegion) return [];
    
    // Get the region games
    const regionGames = bracket.regions[gameRegion];
    const regionRounds = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8'];
    
    // Find the changed game and its round
    const changedGame = regionGames.find(game => game.id === changedGameId);
    if (!changedGame) return [];
    
    const currentRoundIndex = regionRounds.indexOf(changedGame.round);
    
    // Check all rounds after the current one in this region
    for (let i = currentRoundIndex + 1; i < regionRounds.length; i++) {
      const laterRoundGames = regionGames.filter(game => game.round === regionRounds[i]);
      
      laterRoundGames.forEach(game => {
        // Check if this game has a pick and if that pick was the previous winner
        const gamePick = currentPicks[game.id];
        if (gamePick === previousWinnerId) {
          gamesToClear.push(game.id);
        }
      });
    }
    
    // Also check if the previous winner was selected as the regional champion
    // (this would be in the Elite 8 game)
    const elite8Game = regionGames.find(game => game.round === 'Elite 8');
    if (elite8Game && currentPicks[elite8Game.id] === previousWinnerId) {
      gamesToClear.push(elite8Game.id);
    }
    
    // Check Final Four games - if the previous winner was a regional champion
    bracket.finalFour.forEach(game => {
      const gamePick = currentPicks[game.id];
      if (gamePick === previousWinnerId) {
        gamesToClear.push(game.id);
      }
    });
    
    // Check Championship game
    const championshipPick = currentPicks[bracket.championship.id];
    if (championshipPick === previousWinnerId) {
      gamesToClear.push(bracket.championship.id);
    }
    
    return gamesToClear;
  };

  const handleSubmitBracket = async () => {
    if (editorDisableSubmit) {
      setSubmitError(
        viewingHistorical
          ? formatVintagePriorYearMessage(picksCopy, viewingYear, activeYear)
          : mutationsBlockMessage
      );
      return;
    }

    // Show spinner immediately — do not wait for the submit API to finish
    flushSync(() => {
      setSubmitError('');
      setViewTransitionMessage(feedback.submittingMessage);
    });

    try {
      const { pruneInvalidPicks } = await import('@/lib/bracketPickValidity');
      const picksToSubmit =
        bracket && tournamentData
          ? pruneInvalidPicks(bracket, picks, tournamentData)
          : picks;
      if (picksToSubmit !== picks) {
        setPicks(picksToSubmit);
      }

      const submission = {
        playerName: viewer.name,
        playerEmail: viewer.email,
        entryName: entryName,
        tieBreaker: tieBreaker,
        picks: picksToSubmit,
        status: 'submitted'
      };

      let response;
      
      if (editingBracket) {
        // Update existing bracket and change status to submitted
        const editing = editingBracket as Record<string, unknown>;
        const endpoint = isAdminMode 
          ? `/api/admin/brackets/${editing.id}`
          : `/api/tournament-bracket/${editing.id}`;
        
        // Admin endpoints don't require CSRF, user endpoints do
        response = isAdminMode 
          ? await fetch(endpoint, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(submission),
            })
          : await fetchWithCSRF(endpoint, {
              method: 'PUT',
              body: JSON.stringify(submission),
            });
      } else {
        // Create new submitted bracket (not applicable in admin mode)
        response = await fetchWithCSRF('/api/tournament-bracket', {
          method: 'POST',
          body: JSON.stringify(submission),
        });
      }

      const data = await response.json();
      
      if (data.success) {
        // Get bracket number for logging
        let bracketNumber: number | undefined;
        if (editingBracket) {
          const bracket = editingBracket as Record<string, unknown>;
          bracketNumber = bracket.bracketNumber as number | undefined;
        } else if (data.data) {
          const newBracket = data.data as Record<string, unknown>;
          bracketNumber = newBracket.bracketNumber as number | undefined;
        }
        
        // Log the submit action
        const { usageLogger } = await import('@/lib/usageLogger');
        usageLogger.log('Click', 'Submit', bracketNumber ? String(bracketNumber).padStart(6, '0') : null);
        
        // Spinner already visible — reload list, then land on My Picks
        await handleBackToLanding({ transitionMessage: feedback.submittingMessage });
      } else {
        setViewTransitionMessage(null);
        setSubmitError(apiFailureMessage(response, data, feedback.submitFailed));
        setTimeout(() => setSubmitError(''), 10000);
      }
    } catch (error) {
      console.error('Error submitting bracket:', error);
      setViewTransitionMessage(null);
      setSubmitError(feedback.submitFailed);
      setTimeout(() => setSubmitError(''), 10000);
    }
  };

  /**
   * Submit an in-progress bracket from My Picks (same payload as in-editor submit).
   */
  const handleSubmitFromLanding = async (row: MyPicksSubmitRow) => {
    if (!ensureClientMayMutateSync()) return;

    setSubmittingBracketId(row.id);
    try {
      if (!(await ensureMutationsAllowed())) {
        return;
      }

      const { pruneInvalidPicks } = await import('@/lib/bracketPickValidity');
      const rowPicks = row.picks || {};
      const picksToSubmit =
        tournamentData && bracket
          ? pruneInvalidPicks(bracket, rowPicks, tournamentData)
          : rowPicks;

      const submission = {
        playerName: viewer.name,
        playerEmail: viewer.email,
        entryName: row.entryName || '',
        tieBreaker: row.tieBreaker || '',
        picks: picksToSubmit,
        status: 'submitted' as const,
      };

      let response: Response;
      if (isAdminMode) {
        response = await fetch(`/api/admin/brackets/${row.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submission),
        });
      } else {
        response = await fetchWithCSRF(`/api/tournament-bracket/${row.id}`, {
          method: 'PUT',
          body: JSON.stringify(submission),
        });
      }

      const data = await response.json();
      if (data.success) {
        const bracketNumber = row.bracketNumber;
        const { usageLogger } = await import('@/lib/usageLogger');
        usageLogger.log('Click', 'Submit', bracketNumber ? String(bracketNumber).padStart(6, '0') : null);
        await loadSubmittedBrackets();
      } else {
        setNotice(apiFailureMessage(response, data, feedback.submitFailed));
      }
    } catch (error) {
      console.error('Error submitting bracket from My Picks:', error);
      setNotice(feedback.submitFailed);
    } finally {
      setSubmittingBracketId(null);
    }
  };

  const handleBracketComplete = () => {
    handleSubmitBracket();
  };

  const handleOpenFullBracketModalFromMyPicks = useCallback(
    (row: MyPicksBracketRow) => {
      setFullBracketModalId(row.id);
      setFullBracketModalTitle(row.entryName?.trim() || '');
      const y =
        typeof row.year === 'number' && !Number.isNaN(row.year) ? row.year : activeYear;
      setFullBracketModalYear(y);
      setFullBracketModalOpen(true);
    },
    [activeYear]
  );

  // Landing page handlers
  const handleCreateNew = async () => {
    if (viewingHistorical) {
      handleViewingYearChange(activeYear);
      setNotice(formatEditorCopy(feedback.switchedYearMessage, { year: activeYear }));
      return;
    }

    if (creatingBracketBusy) return;
    setCreatingBracketBusy(true);
    try {
      if (!(await ensureMutationsAllowed())) {
        return;
      }

      if (!tournamentData || !bracket) {
        setNotice(
          formatVintagePicksLabel(picksCopy.bracketsMissingErrorMessage, {
            year: vintageActiveYear,
          })
        );
        return;
      }

      // Log New Bracket immediately when button is clicked (no bracket ID yet)
      const { usageLogger } = await import('@/lib/usageLogger');
      usageLogger.log('Click', 'New Bracket', null);

      // If we get here, creation is allowed - proceed with creating new bracket
      setEditingBracket(null);
      setPicks({});
      setEntryName(viewer.name);
      setTieBreaker('');
      setIsReadOnly(false);
      setCurrentView('bracket');
      setBracketResetKey((prev) => prev + 1);
    } finally {
      setCreatingBracketBusy(false);
    }
  };

  const handleEditBracket = async (bracketToEdit: unknown) => {
    const bracketData = bracketToEdit as Record<string, unknown>;

    if (bracketData.status === 'deleted') {
      return;
    }

    const bracketYear =
      typeof bracketData.year === 'number' ? bracketData.year : vintageActiveYear;
    const freshAccess = resolvePicksAccess(Boolean(tournamentData), bracketYear);
    const isPriorYear = isHistoricalYear(bracketYear, vintageActiveYear);
    const bracketMutationsAllowed = !isPriorYear && !freshAccess.blocked;

    // Ensure field JSON matches the bracket year when opening a prior-year entry
    if (isPriorYear || bracketYear !== viewingYear) {
      const fieldForBracket = await loadFieldDataForYear(String(bracketYear));
      if (fieldForBracket) {
        setTournamentData(fieldForBracket);
        setBracket(generate64TeamBracket(fieldForBracket));
      }
    }

    setEditingBracket(bracketToEdit);
    const bracketPicks = (bracketData.picks as Record<string, string>) || {};
    setPicks(bracketPicks);
    setEntryName((bracketData.entryName as string) || viewer.name);
    setTieBreaker((bracketData.tieBreaker as string) || '');
    /** Submitted / prior-year / picks-access blocked → view-only. */
    setIsReadOnly(
      bracketData.status === 'submitted' ||
        isPriorYear ||
        (bracketData.status === 'in_progress' && !bracketMutationsAllowed)
    );
    
    // Calculate first incomplete step for in-progress brackets
    if (bracketData.status === 'in_progress' && bracket && tournamentData) {
      const regions = tournamentData.regions;
      
      // Check each region step (0-3)
      for (let step = 0; step < regions.length; step++) {
        const region = regions[step];
        const regionGames = bracket.regions[region.position];
        
        if (regionGames && regionGames.length > 0) {
          // Check if all games in this region have picks
          const allGamesHavePicks = regionGames.every(game => bracketPicks[game.id]);
          
          if (!allGamesHavePicks) {
            // This region is incomplete, start here
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('bracketCurrentStep', String(step));
            }
            setCurrentView('bracket');
            setBracketResetKey(prev => prev + 1);
            return;
          }
        }
      }
      
      // All regions are complete, go to Final Four step (step 4)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bracketCurrentStep', String(regions.length));
      }
    } else {
      // For new brackets or submitted brackets, start at step 0
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bracketCurrentStep', '0');
      }
    }
    
    setCurrentView('bracket');
    setBracketResetKey(prev => prev + 1);
  };

  /**
   * Leave Admin Edit Picks / Live Results editor and return to the admin list.
   * Uses a full navigation so the editor always unmounts after Save or Cancel.
   * Brackets tab filters are restored from sessionStorage by {@link BracketsTab}.
   */
  const leaveAdminBracketEditor = (liveResults = isLiveResultsMode) => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('bracketState');
      sessionStorage.removeItem('bracketCurrentStep');
      window.location.assign(adminBracketEditorReturnHref(liveResults));
      return;
    }
    router.replace(adminBracketEditorReturnHref(liveResults));
  };

  /**
   * Leave the bracket editor for My Picks.
   * When {@link transitionMessage} is set, show the full-page spinner first, reload the
   * bracket list (unless skipped), then paint landing — so the list never flashes stale rows.
   */
  const handleBackToLanding = async (options?: {
    skipBracketListReload?: boolean;
    transitionMessage?: string;
  }) => {
    // Clear sessionStorage when leaving bracket view
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('bracketState');
      sessionStorage.removeItem('bracketCurrentStep');
    }

    // If in admin mode, redirect back to admin brackets tab
    if (isAdminMode || searchParams?.get('admin') === 'true') {
      leaveAdminBracketEditor(
        isLiveResultsMode || searchParams?.get('live') === 'true',
      );
      return;
    }

    const transitionMessage = options?.transitionMessage?.trim() || null;
    if (transitionMessage) {
      setViewTransitionMessage(transitionMessage);
      // Let React paint the spinner before the list fetch
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }

    try {
      if (!options?.skipBracketListReload) {
        await loadSubmittedBrackets();
      }
      setCurrentView('landing');
      setEditingBracket(null);
      setPicks({});
      setIsReadOnly(false);
    } finally {
      if (transitionMessage) {
        setViewTransitionMessage(null);
      }
    }
  };

  const handleCloseBracket = async () => {
    // Log Cancel button click with bracket ID if available
    let bracketNumber: number | undefined;
    if (editingBracket) {
      const bracket = editingBracket as Record<string, unknown>;
      bracketNumber = bracket.bracketNumber as number | undefined;
    }
    
    try {
      const { usageLogger } = await import('@/lib/usageLogger');
      usageLogger.log('Click', 'Cancel', bracketNumber ? String(bracketNumber).padStart(6, '0') : null);
    } catch {
      // Logging must not block leaving the editor.
    }
    
    // If in admin mode, redirect back to admin brackets tab (preserve list filters).
    if (isAdminMode || searchParams?.get('admin') === 'true') {
      const live =
        isLiveResultsMode || searchParams?.get('live') === 'true';
      if (live && editingBracket) {
        const bracket = editingBracket as Record<string, unknown>;
        try {
          await fetch(`/api/admin/live-results/${bracket.id}?action=cancel`, {
            method: 'POST',
          });
        } catch (error) {
          console.error('Error cancelling live-results edit:', error);
        }
        leaveAdminBracketEditor(true);
        return;
      }
      leaveAdminBracketEditor(false);
      return;
    }
    
    handleBackToLanding();
  };

  const handleCopyBracket = async (bracketToCopy: unknown) => {
    if (!ensureClientMayMutateSync()) return;

    const bracket = bracketToCopy as Record<string, unknown>;
    const sourceId = typeof bracket.id === 'string' ? bracket.id : null;
    if (!sourceId || copyingBracketId) return;

    setCopyingBracketId(sourceId);
    try {
      if (!(await ensureMutationsAllowed())) {
        return;
      }

      const copyEntryName = defaultBracketCopyEntryName(
        feedback.copyEntryName,
        String(bracket.entryName ?? ''),
      );
      const copiedBracket = {
        playerName: viewer.name,
        playerEmail: viewer.email,
        entryName: copyEntryName,
        tieBreaker: bracket.tieBreaker || '',
        picks: bracket.picks || {},
        status: 'in_progress',
      };

      const response = await fetchWithCSRF('/api/tournament-bracket', {
        method: 'PUT',
        body: JSON.stringify(copiedBracket),
      });

      const data = await response.json();

      if (data.success && data.data) {
        await loadSubmittedBrackets();
        const created = data.data as Record<string, unknown>;
        setCopyNameDialog({
          newBracket: created,
          draftEntryName: String(created.entryName ?? copyEntryName),
        });
      } else {
        setNotice(apiFailureMessage(response, data, feedback.copyFailed));
      }
    } catch (error) {
      console.error('Error copying bracket:', error);
      setNotice(feedback.copyFailed);
    } finally {
      setCopyingBracketId(null);
    }
  };

  /**
   * Save the copy-dialog entry name when it differs from the created bracket.
   * Shared by "Stay on My Picks" and "Open bracket" so rename persists either way.
   * @returns Updated bracket (or original when unchanged), or null on validation/API failure
   */
  const persistCopyDialogEntryName = async (): Promise<Record<string, unknown> | null> => {
    if (!copyNameDialog) return null;

    const trimmed = copyNameDialog.draftEntryName.trim();
    if (!trimmed) {
      setCopyNameError(feedback.copyNameRequired);
      return null;
    }

    const b = copyNameDialog.newBracket;
    const id = String(b.id ?? '');
    if (!id) {
      setCopyNameDialog(null);
      setCopyNameError(null);
      setNotice(feedback.copyFailed);
      return null;
    }

    const currentName = String(b.entryName ?? '').trim();
    if (trimmed === currentName) {
      return b;
    }

    setCopyNameDialogBusy(true);
    try {
      const payload = {
        playerName: viewer.name,
        playerEmail: viewer.email,
        entryName: trimmed,
        tieBreaker: String(b.tieBreaker ?? ''),
        picks: (b.picks as Record<string, string>) || {},
      };
      const response = await fetchWithCSRF(`/api/tournament-bracket/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.success && data.data) {
        await loadSubmittedBrackets();
        return data.data as Record<string, unknown>;
      }
      setCopyNameError(apiFailureMessage(response, data, feedback.renameFailed));
      return null;
    } catch (error) {
      console.error('Error updating copied bracket name:', error);
      setCopyNameError(feedback.renameFailed);
      return null;
    } finally {
      setCopyNameDialogBusy(false);
    }
  };

  const handleCopyNameDialogStayOnMyPicks = async () => {
    const saved = await persistCopyDialogEntryName();
    if (!saved) return;
    setCopyNameDialog(null);
    setCopyNameError(null);
  };

  const handleCopyNameDialogOpenBracket = async () => {
    const saved = await persistCopyDialogEntryName();
    if (!saved) return;
    setCopyNameDialog(null);
    setCopyNameError(null);
    await handleEditBracket(saved);
  };

  /**
   * Restore a soft-deleted bracket to in-progress so the user can edit or submit again.
   */
  const handleRestoreBracket = async (bracketId: string) => {
    if (!ensureClientMayMutateSync()) return;
    if (restoringBracketId) return;

    setRestoringBracketId(bracketId);
    try {
      if (!(await ensureMutationsAllowed())) {
        return;
      }

      const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const data = await response.json();

      if (data.success) {
        await loadSubmittedBrackets();
      } else {
        setNotice(apiFailureMessage(response, data, feedback.restoreFailed));
      }
    } catch (error) {
      console.error('Error restoring bracket:', error);
      setNotice(feedback.restoreFailed);
    } finally {
      setRestoringBracketId(null);
    }
  };

  /**
   * Open permanent-delete confirmation immediately (server check runs on confirm).
   */
  const handlePermanentDeleteClick = (bracketId: string) => {
    if (!ensureClientMayMutateSync()) return;
    setPendingPermanentDeleteBracketId(bracketId);
  };

  const handleCancelPermanentDelete = () => {
    setPendingPermanentDeleteBracketId(null);
  };

  /**
   * Hard-delete a bracket after the user confirms in the inline dialog.
   */
  const handleConfirmPermanentDelete = async (bracketId: string) => {
    if (!ensureClientMayMutateSync()) {
      setPendingPermanentDeleteBracketId(null);
      return;
    }

    setDeletingBracketId(bracketId);
    try {
      if (!(await ensureMutationsAllowed())) {
        setPendingPermanentDeleteBracketId(null);
        return;
      }

      const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        setPendingPermanentDeleteBracketId(null);
        await loadSubmittedBrackets();
      } else {
        setNotice(apiFailureMessage(response, data, feedback.permanentDeleteFailed));
      }
    } catch (error) {
      console.error('Error permanently deleting bracket:', error);
      setNotice(feedback.permanentDeleteFailed);
    } finally {
      setDeletingBracketId(null);
    }
  };

  /**
   * Open return confirmation immediately (server check runs on confirm).
   */
  const handleReturnBracketClick = (bracketId: string) => {
    if (!ensureClientMayMutateSync()) return;
    setPendingReturnBracketId(bracketId);
  };

  const handleCancelReturnBracket = () => {
    setPendingReturnBracketId(null);
  };

  const handleConfirmReturnBracket = async (bracketId: string) => {
    if (!ensureClientMayMutateSync()) {
      setPendingReturnBracketId(null);
      return;
    }

    setReturningBracketId(bracketId);
    try {
      if (!(await ensureMutationsAllowed())) {
        setPendingReturnBracketId(null);
        return;
      }

      const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const data = await response.json();

      if (data.success) {
        setPendingReturnBracketId(null);
        await loadSubmittedBrackets();
      } else {
        setNotice(apiFailureMessage(response, data, feedback.returnFailed));
      }
    } catch (error) {
      console.error('Error returning bracket:', error);
      setNotice(feedback.returnFailed);
    } finally {
      setReturningBracketId(null);
    }
  };

  const handleSaveBracket = async () => {
    // Master lock is enforced on the server on every mutate.
    flushSync(() => setViewTransitionMessage(feedback.savingMessage));
    try {
      const { pruneInvalidPicks } = await import('@/lib/bracketPickValidity');
      const picksToSave =
        bracket && tournamentData
          ? pruneInvalidPicks(bracket, picks, tournamentData)
          : picks;
      if (picksToSave !== picks) {
        setPicks(picksToSave);
      }

      const saveData = {
        playerName: viewer.name,
        playerEmail: viewer.email,
        entryName: entryName,
        tieBreaker: tieBreaker,
        picks: picksToSave,
      };

      let response;
      let bracketNumber: number | undefined;
      
      if (editingBracket) {
        // Update existing bracket
        const bracket = editingBracket as Record<string, unknown>;
        bracketNumber = bracket.bracketNumber as number | undefined;
        const endpoint = isLiveResultsMode
          ? `/api/admin/live-results/${bracket.id}`
          : isAdminMode 
          ? `/api/admin/brackets/${bracket.id}`
          : `/api/tournament-bracket/${bracket.id}`;
        
        // Admin endpoints don't require CSRF, user endpoints do
        response = isAdminMode
          ? await fetch(endpoint, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(
                isLiveResultsMode
                  ? {
                      picks: picksToSave,
                      tieBreaker,
                    }
                  : saveData
              ),
            })
          : await fetchWithCSRF(endpoint, {
              method: 'PUT',
              body: JSON.stringify(saveData),
            });
      } else {
        // Create new bracket (not applicable in admin mode)
        response = await fetchWithCSRF('/api/tournament-bracket', {
          method: 'PUT',
          body: JSON.stringify(saveData),
        });
      }

      const data = await response.json();
      
      if (data.success) {
        // Get bracket number from response if creating new bracket
        if (!editingBracket && data.data) {
          const newBracket = data.data as Record<string, unknown>;
          bracketNumber = newBracket.bracketNumber as number | undefined;
        }

        // Admin Edit Picks: leave immediately after a successful save (no extra Cancel).
        if (isAdminMode || searchParams?.get('admin') === 'true') {
          try {
            const { usageLogger } = await import('@/lib/usageLogger');
            usageLogger.log(
              'Click',
              'Save',
              bracketNumber ? String(bracketNumber).padStart(6, '0') : null,
            );
          } catch {
            // Logging must not block closing the editor.
          }
          leaveAdminBracketEditor(
            isLiveResultsMode || searchParams?.get('live') === 'true',
          );
          return;
        }
        
        // Log the save action (New Bracket was already logged when button was clicked)
        const { usageLogger } = await import('@/lib/usageLogger');
        usageLogger.log('Click', 'Save', bracketNumber ? String(bracketNumber).padStart(6, '0') : null);

        // Merge API row into list — avoids a list refetch after every Save
        if (data.data) {
          const payload = data.data as Record<string, unknown>;
          const updated = bracketFromSaveApiResponse(payload, viewer);
          setSubmittedBrackets((prev) => {
            const idx = prev.findIndex((b) => b.id === updated.id);
            if (idx >= 0) {
              const prevRow = prev[idx] as BracketSubmission & { bracketNumber?: number };
              const merged: BracketSubmission & { bracketNumber?: number } = {
                ...prevRow,
                ...updated,
                year: updated.year ?? prevRow.year,
                bracketNumber: updated.bracketNumber ?? prevRow.bracketNumber,
              };
              const copy = [...prev];
              copy[idx] = merged as BracketSubmission;
              return copy;
            }
            return [...prev, updated as BracketSubmission];
          });
          await handleBackToLanding({ skipBracketListReload: true });
        } else {
          await handleBackToLanding();
        }
      } else {
        setNotice(apiFailureMessage(response, data, feedback.saveFailed));
      }
    } catch (error) {
      console.error('Error saving bracket:', error);
      setNotice(feedback.saveFailed);
    } finally {
      setViewTransitionMessage(null);
    }
  };

  const handleDeleteBracket = (bracketId: string) => {
    if (editorDisableSubmit) {
      setNotice(
        viewingHistorical
          ? formatVintagePriorYearMessage(picksCopy, viewingYear, activeYear)
          : mutationsBlockMessage
      );
      return;
    }

    const bracketToDelete = submittedBrackets.find(b => b.id === bracketId);
    if (bracketToDelete && 'status' in bracketToDelete && bracketToDelete.status === 'deleted') {
      return;
    }
    // In-progress → soft delete; submitted → hard delete. Both confirm via the CMS popup.
    if (bracketToDelete && 'status' in bracketToDelete && bracketToDelete.status === 'submitted') {
      setPendingPermanentDeleteBracketId(bracketId);
    } else {
      setPendingDeleteBracketId(bracketId);
    }
  };

  const confirmDeleteBracket = async (bracketId: string) => {
    const bracketToDelete = submittedBrackets.find(b => b.id === bracketId);

    if (bracketToDelete && 'status' in bracketToDelete && bracketToDelete.status === 'deleted') {
      setPendingDeleteBracketId(null);
      return;
    }

    // For in_progress brackets, soft delete (change status to 'deleted')
    // For submitted brackets, hard delete (actual removal)
    const isInProgress = bracketToDelete && 'status' in bracketToDelete && bracketToDelete.status === 'in_progress';
    
    setDeletingBracketId(bracketId);

    try {
      if (!(await ensureMutationsAllowed())) {
        setPendingDeleteBracketId(null);
        return;
      }

      if (isInProgress) {
        // Soft delete: Update status to 'deleted'
        const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'deleted' }),
        });
        const data = await response.json();

        if (data.success) {
          setPendingDeleteBracketId(null);
          await loadSubmittedBrackets();
        } else {
          setNotice(apiFailureMessage(response, data, feedback.deleteFailed));
        }
      } else {
        // Hard delete: Actually remove the bracket
        const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
          method: 'DELETE',
        });
        const data = await response.json();

        if (data.success) {
          setPendingDeleteBracketId(null);
          await loadSubmittedBrackets();
        } else {
          setNotice(apiFailureMessage(response, data, feedback.deleteFailed));
        }
      }
    } catch (error) {
      console.error('Error deleting bracket:', error);
      setNotice(feedback.deleteFailed);
    } finally {
      setDeletingBracketId(null);
    }
  };

  const noticeDialog = (
    <ConfirmDialog
      open={Boolean(notice)}
      title={feedback.noticeTitle}
      message={notice ?? ''}
      confirmLabel={feedback.noticeOkLabel}
      cancelLabel=""
      tone="neutral"
      testId="picks-notice"
      onConfirm={() => setNotice(null)}
      onCancel={() => setNotice(null)}
    />
  );

  if (status === 'unauthenticated' || isLoading || viewTransitionMessage) {
    return (
      <VintageShell
        content={vintageHome}
        testId={viewTransitionMessage ? 'vintage-picks-transition' : 'vintage-picks-loading'}
      >
        <div
          className="v-picks v-picks--loading"
          data-testid={viewTransitionMessage ? 'bracket-view-transition' : 'bracket-loading'}
          aria-busy="true"
        >
          <LoadingBasketball
            message={viewTransitionMessage || feedback.loadingMessage}
            testId="bracket-loading-indicator"
          />
        </div>
        {noticeDialog}
      </VintageShell>
    );
  }

  // Show landing page by default
  if (currentView === 'landing') {
    /** Row actions without their own confirm popup show a busy overlay while in flight. */
    const landingBusyMessage = creatingBracketBusy
      ? feedback.creatingMessage
      : copyingBracketId
        ? feedback.copyingMessage
        : restoringBracketId
          ? feedback.restoringMessage
          : submittingBracketId
            ? feedback.submittingMessage
            : null;
    const landing = (
      <Fragment>
        <BracketViewerModal
          isOpen={fullBracketModalOpen}
          onClose={() => {
            setFullBracketModalOpen(false);
            setFullBracketModalId(null);
            setFullBracketModalTitle('');
          }}
          bracketId={fullBracketModalId}
          year={fullBracketModalYear}
          title={fullBracketModalTitle || undefined}
          bracketFetchMode="owner"
          copy={bracketEditorCopy}
        />
        <MyPicksLanding
          picksCopy={picksCopy}
          standingsChrome={standingsChrome}
          bracketEditorCopy={bracketEditorCopy}
          pdfDialogCopy={pdfDialogCopy}
          tipoffAt={vintageHome.tournament.tipoffAt ?? ''}
          bracketsReadyAt={vintageHome.tournament.bracketsReadyAt ?? ''}
          liveTourneyMessage={formatVintagePicksLabel(
            vintageHome.tournament.liveTourneyMessage ?? '',
            { year: vintageActiveYear },
          )}
          admin={vintageAdmin}
          brackets={submittedBrackets}
          viewingYear={viewingYear}
          activeYear={vintageActiveYear}
          onCreateNew={handleCreateNew}
          onEditBracket={handleEditBracket}
          onDeleteBracket={handleDeleteBracket}
          pendingDeleteBracketId={pendingDeleteBracketId}
          onConfirmDelete={confirmDeleteBracket}
          onCancelDelete={() => setPendingDeleteBracketId(null)}
          onCopyBracket={handleCopyBracket}
          onSubmitBracket={handleSubmitFromLanding}
          submittingBracketId={submittingBracketId}
          copyingBracketId={copyingBracketId}
          restoringBracketId={restoringBracketId}
          creatingBracketBusy={creatingBracketBusy}
          onRestoreBracket={handleRestoreBracket}
          onPermanentDeleteClick={handlePermanentDeleteClick}
          pendingPermanentDeleteBracketId={pendingPermanentDeleteBracketId}
          onConfirmPermanentDelete={handleConfirmPermanentDelete}
          onCancelPermanentDelete={handleCancelPermanentDelete}
          pendingReturnBracketId={pendingReturnBracketId}
          onReturnBracketClick={handleReturnBracketClick}
          onConfirmReturnBracket={handleConfirmReturnBracket}
          onCancelReturnBracket={handleCancelReturnBracket}
          returningBracketId={returningBracketId}
          deletingBracketId={deletingBracketId}
          tournamentData={tournamentData}
          bracket={bracket}
          siteConfig={siteConfig}
          availableYears={availableYears.length > 0 ? availableYears : [vintageActiveYear]}
          onViewingYearChange={handleViewingYearChange}
          isYearSwitching={isYearSwitching}
          onOpenFullBracketModal={handleOpenFullBracketModalFromMyPicks}
          onPaymentCreated={() => loadSubmittedBrackets(viewingYear)}
        />
        <ConfirmDialog
          open={Boolean(copyNameDialog)}
          title={feedback.copyNameTitle}
          message={feedback.copyNameMessage}
          confirmLabel={feedback.copyNameOpenLabel}
          cancelLabel={feedback.copyNameStayLabel}
          tone="neutral"
          busy={copyNameDialogBusy}
          busyMessage={feedback.savingMessage}
          errorMessage={copyNameError}
          testId="copy-bracket-name-dialog"
          onConfirm={() => void handleCopyNameDialogOpenBracket()}
          onCancel={() => void handleCopyNameDialogStayOnMyPicks()}
        >
          {feedback.copyNameLabel ? (
            <label htmlFor="copy-bracket-entry-name" className="v-confirm__label">
              {feedback.copyNameLabel}
            </label>
          ) : null}
          <input
            id="copy-bracket-entry-name"
            type="text"
            className="v-confirm__input"
            value={copyNameDialog?.draftEntryName ?? ''}
            onChange={(e) => {
              setCopyNameError(null);
              setCopyNameDialog((prev) =>
                prev ? { ...prev, draftEntryName: e.target.value } : null
              );
            }}
            disabled={copyNameDialogBusy}
            autoComplete="off"
            aria-label={feedback.copyNameLabel || undefined}
            data-testid="copy-bracket-entry-name-input"
          />
        </ConfirmDialog>
        <BusyOverlay
          open={Boolean(landingBusyMessage)}
          message={landingBusyMessage ?? ''}
          testId="picks-busy-overlay"
        />
        {noticeDialog}
      </Fragment>
    );

    return (
      <VintageShell content={vintageHome} testId="vintage-picks-page">
        {landing}
      </VintageShell>
    );
  }

  if (!tournamentData || !bracket) {
    return (
      <VintageShell content={vintageHome} testId="vintage-picks-page">
        <SiteErrorPanel
          message={formatVintagePicksLabel(picksCopy.bracketsMissingErrorMessage, {
            year: vintageActiveYear,
          })}
          testId="bracket-tournament-unavailable"
        />
      </VintageShell>
    );
  }

  const editorYear =
    (editingBracket
      ? (editingBracket as Record<string, unknown>).year
      : undefined) ?? viewingYear ?? activeYear;
  const siteLabel = vintageHome.keyData.siteName?.trim() ?? '';

  const editorDisableMessage = viewingHistorical
    ? formatVintagePriorYearMessage(picksCopy, viewingYear, activeYear)
    : mutationsBlockMessage;

  const progressPct =
    overallPickProgress.total > 0
      ? Math.min(
          100,
          (100 * overallPickProgress.completed) / overallPickProgress.total,
        )
      : 0;

  const editorCopy = bracketEditorCopy;

  const editorMeta = [
    String(editorYear),
    editorCopy.brandStripLabel.trim(),
  ].filter(Boolean).join(' · ');
  const progressLabel = formatEditorCopy(editorCopy.progressLabel, {
    completed: overallPickProgress.completed,
    total: overallPickProgress.total,
  });

  /** Regions / Full layout toggle (embedded in the brand strip). */
  const layoutToggle = (
    <div
      className="be-layout-toggle inline-flex border p-0.5"
      role="group"
      aria-label={editorCopy.layoutLabel || undefined}
    >
      <button
        type="button"
        onClick={() => setLayoutMode('5p')}
        className={`be-layout-toggle__btn ${
          layoutMode === '5p' ? 'be-layout-toggle__btn--on' : 'be-layout-toggle__btn--off'
        }`}
        aria-pressed={layoutMode === '5p'}
        data-testid="my-bracket-layout-5p"
      >
        {editorCopy.layoutRegionsLabel}
      </button>
      <button
        type="button"
        onClick={() => setLayoutMode('1p')}
        className={`be-layout-toggle__btn ${
          layoutMode === '1p' ? 'be-layout-toggle__btn--on' : 'be-layout-toggle__btn--off'
        }`}
        aria-pressed={layoutMode === '1p'}
        data-testid="my-bracket-layout-1p"
      >
        {editorCopy.layoutFullLabel}
      </button>
    </div>
  );

  return (
    <BracketEditorCopyProvider copy={editorCopy}>
      <div
        className="be-editor min-h-screen be-workspace-page"
        data-testid="bracket-editor-workspace"
      >
        <div className="w-full">
          <div
            className="be-brand-strip be-brand-strip--chrome sticky top-0 z-40"
            data-testid="bracket-editor-brand-strip"
          >
            <div className="be-brand-strip__identity">
              {siteLabel ? <p className="be-brand-strip__title">{siteLabel}</p> : null}
              <p className="be-brand-strip__meta">{editorMeta}</p>
            </div>
            <div className="be-brand-strip__progress" data-testid="bracket-editor-progress">
              {progressLabel ? <p className="be-progress__label">{progressLabel}</p> : null}
              <div
                className="be-progress__track"
                role="progressbar"
                aria-valuenow={overallPickProgress.completed}
                aria-valuemin={0}
                aria-valuemax={overallPickProgress.total}
                aria-label={progressLabel || undefined}
              >
                <div className="be-progress__fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <div className="be-brand-strip__layout">
              {editorCopy.layoutLabel ? (
                <span className="be-layout-bar__label">{editorCopy.layoutLabel}</span>
              ) : null}
              {layoutToggle}
            </div>
          </div>

          {layoutMode === '5p' ? (
            <StepByStepBracket
              key={bracketResetKey}
              tournamentData={tournamentData}
              bracket={bracket}
              picks={picks}
              entryName={entryName}
              tieBreaker={tieBreaker}
              onPick={handlePick}
              onComplete={handleBracketComplete}
              onSave={handleSaveBracket}
              onClose={handleCloseBracket}
              onCancel={handleCloseBracket}
              onEntryNameChange={isLiveResultsMode ? () => {} : setEntryName}
              onTieBreakerChange={setTieBreaker}
              readOnly={isReadOnly}
              submitError={submitError}
              bracketNumber={
                editingBracket
                  ? ((editingBracket as Record<string, unknown>)
                      .bracketNumber as number)
                  : undefined
              }
              year={
                editingBracket
                  ? ((editingBracket as Record<string, unknown>).year as number)
                  : undefined
              }
              existingBracketNames={submittedEntryNames}
              currentBracketId={
                editingBracket
                  ? ((editingBracket as Record<string, unknown>).id as string)
                  : undefined
              }
              isAdminMode={isAdminMode}
              isLiveResultsMode={isLiveResultsMode}
              disableSaveSubmit={editorDisableSubmit}
              disableSave={editorDisableSave}
              disableMessage={editorDisableMessage}
            />
          ) : (
            <FullBracketEditorShell
              key={bracketResetKey}
              tournamentData={tournamentData}
              bracket={bracket}
              bracketSize="64"
              picks={picks}
              onPick={handleFullBracketPick}
              entryName={entryName}
              tieBreaker={tieBreaker}
              onEntryNameChange={isLiveResultsMode ? () => {} : setEntryName}
              onTieBreakerChange={setTieBreaker}
              readOnly={isReadOnly}
              submitError={submitError}
              existingBracketNames={submittedEntryNames}
              isAdminMode={isAdminMode}
              isLiveResultsMode={isLiveResultsMode}
              disableSaveSubmit={editorDisableSubmit}
              disableSave={editorDisableSave}
              disableMessage={editorDisableMessage}
              onSave={handleSaveBracket}
              onClose={handleCloseBracket}
              onCancel={handleCloseBracket}
              onComplete={handleBracketComplete}
            />
          )}
        </div>
        {noticeDialog}
      </div>
    </BracketEditorCopyProvider>
  );
}

export interface BracketPageClientProps {
  /** Site admin — CMS edit gear only. */
  vintageAdmin?: boolean;
  vintageHome: VintageContent;
  picksCopy: VintagePicksContent;
  bracketEditorCopy: VintageBracketEditorContent;
  pdfDialogCopy: VintagePdfDialogCopy;
  /** Published Standings CMS — FF/Champ result chrome colors + sizes. */
  standingsChrome: VintageStandingsContent;
  /** Payment provider settings from published Key Data. */
  siteConfig: SiteConfigData;
  viewer: MyPicksViewer;
  initial: MyPicksInitialData;
}

/**
 * Client My Picks / bracket workspace. Vintage shell wraps the landing only.
 * First paint uses server-loaded list + field data (no client waterfall).
 */
export default function BracketPageClient(props: BracketPageClientProps) {
  return (
    <Suspense
      fallback={
        <LoadingBasketball
          variant="screen"
          message={props.picksCopy.feedback.loadingMessage}
          testId="bracket-suspense-loading"
        />
      }
    >
      <BracketContent {...props} />
    </Suspense>
  );
}