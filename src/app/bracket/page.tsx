'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Suspense, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TournamentData, TournamentBracket, BracketSubmission } from '@/types/tournament';
import { loadTournamentData } from '@/lib/tournamentLoader';
import {
  applyDisplayNamesToTournamentData,
  buildTeamIdToDisplayNameMapFromApi,
} from '@/lib/teamDisplayName';
import { generate64TeamBracket } from '@/lib/bracketGenerator';
import { applyPickCascade } from '@/lib/fullBracket/fullBracketGeometry';
import FullBracketEditorShell from '@/components/bracket/FullBracketEditorShell';
import { SiteConfigData } from '@/lib/siteConfig';
import StepByStepBracket from '@/components/bracket/StepByStepBracket';
import MyPicksLanding, { type Bracket as MyPicksBracketRow } from '@/components/MyPicksLanding';
import BracketViewerModal from '@/components/bracket/BracketViewerModal';
import { useBracketMode } from '@/contexts/BracketModeContext';
import { Trophy } from 'lucide-react';
import { LoggedButton } from '@/components/LoggedButton';
import { useUsageLogger } from '@/hooks/useUsageLogger';
import { useCSRF } from '@/hooks/useCSRF';

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
 * Default entry name for a copied bracket (Microsoft-style: append `" - Copy"`).
 */
function defaultBracketCopyEntryName(sourceEntryName: string): string {
  const t = sourceEntryName.trim();
  return t ? `${t} - Copy` : 'Bracket - Copy';
}

function BracketContent() {
  const { data: session, status } = useSession();
  useUsageLogger('Pick');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setInBracketMode } = useBracketMode();
  const { fetchWithCSRF } = useCSRF();
  
  // View states
  const [currentView, setCurrentView] = useState<'landing' | 'bracket'>('landing');
  const [editingBracket, setEditingBracket] = useState<unknown>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  // Tournament data
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [picks, setPicks] = useState<{ [gameId: string]: string }>({});
  const [entryName, setEntryName] = useState<string>('');
  const [tieBreaker, setTieBreaker] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [submittedBrackets, setSubmittedBrackets] = useState<BracketSubmission[]>([]);
  const [bracketResetKey, setBracketResetKey] = useState(0);
  const [deletingBracketId, setDeletingBracketId] = useState<string | null>(null);
  const [pendingDeleteBracketId, setPendingDeleteBracketId] = useState<string | null>(null);
  const [pendingPermanentDeleteBracketId, setPendingPermanentDeleteBracketId] = useState<string | null>(null);
  const [pendingReturnBracketId, setPendingReturnBracketId] = useState<string | null>(null);
  const [returningBracketId, setReturningBracketId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string>('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLiveResultsMode, setIsLiveResultsMode] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);
  const [pendingBracketData, setPendingBracketData] = useState<Record<string, unknown> | null>(null);
  const [killSwitchEnabled, setKillSwitchEnabled] = useState<boolean>(true);
  const [killSwitchMessage, setKillSwitchMessage] = useState<string>('Bracket actions are temporarily disabled by the administrator.');
  const [submittingBracketId, setSubmittingBracketId] = useState<string | null>(null);
  /** After a successful Copy API call: confirm name before opening the bracket editor. */
  const [copyNameDialog, setCopyNameDialog] = useState<{
    newBracket: Record<string, unknown>;
    draftEntryName: string;
  } | null>(null);
  const [copyNameDialogBusy, setCopyNameDialogBusy] = useState(false);
  const [layoutMode, setLayoutMode] = useState<MyBracketLayoutMode>(() => {
    if (typeof window === 'undefined') return '5p';
    return parseStoredLayoutMode(sessionStorage.getItem(MY_BRACKET_LAYOUT_MODE_KEY));
  });

  const [fullBracketModalOpen, setFullBracketModalOpen] = useState(false);
  const [fullBracketModalId, setFullBracketModalId] = useState<string | null>(null);
  const [fullBracketModalTitle, setFullBracketModalTitle] = useState('');
  const [fullBracketModalYear, setFullBracketModalYear] = useState(() => new Date().getFullYear());

  const submittedEntryNames = useMemo(
    () => submittedBrackets.filter((b) => b.status === 'submitted').map((b) => b.entryName),
    [submittedBrackets]
  );

  const loadTournamentRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const hasRestoredState = useRef(false);

  // Determine if My Picks page should be shown based on environment and feature flags
  const shouldShowMyPicksPage = () => {
    if (!siteConfig) return false;
    
    // Detect preview/staging by checking if we're on a Vercel preview URL
    // Vercel preview URLs follow the pattern: project-name-git-branch-owner-projects.vercel.app
    // Production is typically on a custom domain (wmm2026.com) or the main vercel.app domain
    const isPreview = typeof window !== 'undefined' && (
      window.location.hostname.includes('-git-') || 
      (window.location.hostname.includes('vercel.app') && 
       !window.location.hostname.startsWith('wmm2026') &&
       window.location.hostname.includes('.'))
    );
    
    // Use dev flag for preview/staging deployments
    if (isPreview) {
      return siteConfig.showPicksDev === 'Yes';
    }
    
    // Use prod flag for production deployments only
    return siteConfig.showPicksProd === 'Yes';
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

  // Set bracket mode when view changes
  useEffect(() => {
    setInBracketMode(currentView === 'bracket');
  }, [currentView, setInBracketMode]);

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


  // Set default entry name when user data is available
  useEffect(() => {
    if (session?.user?.name && !entryName) {
      setEntryName(session.user.name);
    }
  }, [session?.user?.name, entryName]);

  const loadKillSwitchState = useCallback(async () => {
    try {
      const response = await fetch('/api/kill-switch', { cache: 'no-store' });
      const result = await response.json();
      if (response.ok && result.success && result.data) {
        setKillSwitchEnabled(Boolean(result.data.enabled));
        if (result.data.message) {
          setKillSwitchMessage(String(result.data.message));
        }
      }
    } catch (error) {
      console.error('Error loading kill switch state:', error);
    }
  }, []);

  /**
   * Fetch latest kill switch state from server to avoid stale client state.
   */
  const getLatestKillSwitchState = async (): Promise<{ enabled: boolean; message: string }> => {
    try {
      const response = await fetch('/api/kill-switch', { cache: 'no-store' });
      const result = await response.json();
      if (response.ok && result.success && result.data) {
        const enabled = Boolean(result.data.enabled);
        const message = String(result.data.message || killSwitchMessage);
        setKillSwitchEnabled(enabled);
        setKillSwitchMessage(message);
        return { enabled, message };
      }
    } catch (error) {
      console.error('Error checking latest kill switch state:', error);
    }

    return { enabled: killSwitchEnabled, message: killSwitchMessage };
  };

  /**
   * Ensure bracket mutations are allowed (master kill switch).
   * Opening a bracket for **view** uses {@link handleEditBracket} instead (read-only when the switch is off).
   */
  const ensureKillSwitchEnabledForAction = async (): Promise<boolean> => {
    if (isAdminMode) return true;
    const state = await getLatestKillSwitchState();
    if (!state.enabled) {
      alert(state.message);
      return false;
    }
    return true;
  };

  // Assign function to ref after it's declared
  const loadTournament = async () => {
    try {
      setIsLoading(true);
      
      // Load site config first to get tournament year (via API route)
      const configResponse = await fetch('/api/site-config?fresh=true', { cache: 'no-store' });
      const configResult = await configResponse.json();
      const config = configResult.success ? configResult.data : null;
      setSiteConfig(config);
      await loadKillSwitchState();
      
      // Use tournament year from config (fallback to '2025' if not available)
      const tournamentYear = config?.tournamentYear || '2025';
      const data = await loadTournamentData(tournamentYear);
      let enriched = data;
      try {
        const refResponse = await fetch('/api/team-data?activeOnly=false', {
          cache: 'no-store',
        });
        const refJson = await refResponse.json();
        if (refJson.success && Array.isArray(refJson.data) && refJson.data.length > 0) {
          enriched = applyDisplayNamesToTournamentData(
            data,
            buildTeamIdToDisplayNameMapFromApi(refJson.data)
          );
        }
      } catch (refError) {
        console.warn('[Bracket] Could not apply team display names:', refError);
      }
      setTournamentData(enriched);
      
      const bracketData = generate64TeamBracket(enriched);
      setBracket(bracketData);
      
      // Load user's submitted brackets
      await loadSubmittedBrackets();
    } catch (error) {
      console.error('Error loading tournament:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Assign function to ref after it's declared
  loadTournamentRef.current = loadTournament;

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    
    // Don't load tournament if we're in admin edit mode - loadBracketForEdit will handle it
    if (searchParams?.get('edit') && searchParams?.get('admin') === 'true') {
      return;
    }
    
    loadTournamentRef.current?.();
  }, [status, router, searchParams]);

  useEffect(() => {
    if (currentView !== 'bracket') return;

    loadKillSwitchState();
    const intervalId = window.setInterval(() => {
      loadKillSwitchState();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [currentView, loadKillSwitchState]);

  const loadSubmittedBrackets = async () => {
    try {
      const response = await fetch('/api/tournament-bracket', { cache: 'no-store' });
      const data = await response.json();
      
      if (data.success) {
        // Filter brackets for the current user
        const userBrackets = data.data.filter((bracket: unknown) => 
          bracket && typeof bracket === 'object' && 'playerEmail' in bracket && 
          (bracket as { playerEmail: string }).playerEmail === session?.user?.email
        );
        setSubmittedBrackets(userBrackets);
      } else {
        console.error('Failed to load brackets:', data.error);
      }
    } catch (error) {
      console.error('Error loading submitted brackets:', error);
    }
  };

  const loadBracketForEdit = async (bracketId: string, adminMode = false) => {
    try {
      setIsLoading(true);
      
      // Load tournament data first if not already loaded
      if (!tournamentData || !bracket) {
        // Load site config first to get tournament year (via API route)
        const configResponse = await fetch('/api/site-config?fresh=true', { cache: 'no-store' });
        const configResult = await configResponse.json();
        const config = configResult.success ? configResult.data : null;
        setSiteConfig(config);
        await loadKillSwitchState();
        
        // Use tournament year from config (fallback to '2025' if not available)
        const tournamentYear = config?.tournamentYear || '2025';
        const rawTournament = await loadTournamentData(tournamentYear);
        let tournamentDataLoaded = rawTournament;
        try {
          const refResponse = await fetch('/api/team-data?activeOnly=false', {
          cache: 'no-store',
        });
          const refJson = await refResponse.json();
          if (refJson.success && Array.isArray(refJson.data) && refJson.data.length > 0) {
            tournamentDataLoaded = applyDisplayNamesToTournamentData(
              rawTournament,
              buildTeamIdToDisplayNameMapFromApi(refJson.data)
            );
          }
        } catch (refError) {
          console.warn('[Bracket] Could not apply team display names:', refError);
        }
        setTournamentData(tournamentDataLoaded);
        
        const bracketDataStructure = generate64TeamBracket(tournamentDataLoaded);
        setBracket(bracketDataStructure);
      }
      
      // Use admin endpoint if in admin mode
      const endpoint = adminMode 
        ? `/api/admin/brackets/${bracketId}`
        : `/api/tournament-bracket/${bracketId}`;
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.success && data.data) {
        const bracketData = data.data as Record<string, unknown>;
        setEditingBracket(bracketData);
        
        // Store bracket data to be applied once bracket structure is ready
        setPendingBracketData(bracketData);
      } else {
        console.error('Failed to load bracket:', data.error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading bracket for edit:', error);
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
    if (!killSwitchEnabled) {
      setSubmitError(killSwitchMessage);
      return;
    }

    if (!session?.user?.name || !session?.user?.email) {
      setSubmitError('User information not available');
      setTimeout(() => setSubmitError(''), 10000);
      return;
    }

    try {
      setSubmitError(''); // Clear any previous errors
      
      const submission = {
        playerName: session.user.name,
        playerEmail: session.user.email,
        entryName: entryName,
        tieBreaker: tieBreaker,
        picks,
        status: 'submitted'
      };

      let response;
      
      if (editingBracket) {
        // Update existing bracket and change status to submitted
        const bracket = editingBracket as Record<string, unknown>;
        const endpoint = isAdminMode 
          ? `/api/admin/brackets/${bracket.id}`
          : `/api/tournament-bracket/${bracket.id}`;
        
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
        
        // Return to landing page without popup (await so bracket list reload finishes)
        await handleBackToLanding();
      } else {
        // Show error message that fades after 10 seconds
        setSubmitError(data.error || 'Failed to submit bracket');
        setTimeout(() => setSubmitError(''), 10000);
      }
    } catch (error) {
      console.error('Error submitting bracket:', error);
      setSubmitError('Failed to submit bracket. Please try again.');
      setTimeout(() => setSubmitError(''), 10000);
    }
  };

  /**
   * Submit an in-progress bracket from My Picks (same payload as in-editor submit).
   */
  const handleSubmitFromLanding = async (row: MyPicksSubmitRow) => {
    if (!(await ensureKillSwitchEnabledForAction())) {
      return;
    }

    if (!session?.user?.name || !session?.user?.email) {
      alert('User information not available');
      return;
    }

    setSubmittingBracketId(row.id);
    try {
      const submission = {
        playerName: session.user.name,
        playerEmail: session.user.email,
        entryName: row.entryName || '',
        tieBreaker: row.tieBreaker || '',
        picks: row.picks,
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
        alert(data.error || 'Failed to submit bracket');
      }
    } catch (error) {
      console.error('Error submitting bracket from My Picks:', error);
      alert('Failed to submit bracket. Please try again.');
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
        typeof row.year === 'number' && !Number.isNaN(row.year)
          ? row.year
          : siteConfig?.tournamentYear
            ? parseInt(String(siteConfig.tournamentYear), 10)
            : new Date().getFullYear();
      setFullBracketModalYear(y);
      setFullBracketModalOpen(true);
    },
    [siteConfig?.tournamentYear]
  );

  // Landing page handlers
  const handleCreateNew = async () => {
    if (!(await ensureKillSwitchEnabledForAction())) {
      return;
    }

    // Log New Bracket immediately when button is clicked (no bracket ID yet)
    const { usageLogger } = await import('@/lib/usageLogger');
    usageLogger.log('Click', 'New Bracket', null);
    
    // Check with server if bracket creation is currently allowed (fresh config check)
    try {
      const response = await fetch('/api/bracket/check-creation');
      const data = await response.json();
      
      if (!data.success || !data.allowed) {
        // Bracket creation is not allowed - show error and don't proceed
        alert(data.reason || 'Bracket creation is currently disabled.');
        return;
      }
    } catch (error) {
      console.error('Error checking bracket creation status:', error);
      alert('Failed to verify bracket creation status. Please try again.');
      return;
    }
    
    // If we get here, creation is allowed - proceed with creating new bracket
    setEditingBracket(null);
    setPicks({});
    setEntryName(session?.user?.name || '');
    setTieBreaker('');
    setIsReadOnly(false);
    setCurrentView('bracket');
    setBracketResetKey(prev => prev + 1);
  };

  const handleEditBracket = async (bracketToEdit: unknown) => {
    const bracketData = bracketToEdit as Record<string, unknown>;

    if (bracketData.status === 'deleted') {
      return;
    }

    const state = isAdminMode ? { enabled: true } : await getLatestKillSwitchState();
    const bracketMutationsAllowed = isAdminMode || state.enabled;

    setEditingBracket(bracketToEdit);
    const bracketPicks = (bracketData.picks as Record<string, string>) || {};
    setPicks(bracketPicks);
    setEntryName((bracketData.entryName as string) || session?.user?.name || '');
    setTieBreaker((bracketData.tieBreaker as string) || '');
    /** Submitted brackets are always view-only; in-progress brackets become view-only when the kill switch blocks saves/submits. */
    setIsReadOnly(
      bracketData.status === 'submitted' ||
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

  const handleBackToLanding = async (options?: { skipBracketListReload?: boolean }) => {
    // Clear sessionStorage when leaving bracket view
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('bracketState');
      sessionStorage.removeItem('bracketCurrentStep');
    }
    
    // If in admin mode, redirect back to admin brackets tab
    if (isAdminMode) {
      router.push(isLiveResultsMode ? '/admin?tab=live-results' : '/admin?tab=brackets');
      return;
    }
    
    setCurrentView('landing');
    setEditingBracket(null);
    setPicks({});
    setIsReadOnly(false);
    if (!options?.skipBracketListReload) {
      await loadSubmittedBrackets();
    }
  };

  const handleCloseBracket = async () => {
    // Log Cancel button click with bracket ID if available
    let bracketNumber: number | undefined;
    if (editingBracket) {
      const bracket = editingBracket as Record<string, unknown>;
      bracketNumber = bracket.bracketNumber as number | undefined;
    }
    
    const { usageLogger } = await import('@/lib/usageLogger');
    usageLogger.log('Click', 'Cancel', bracketNumber ? String(bracketNumber).padStart(6, '0') : null);
    
    // If in admin mode, redirect back to admin brackets tab
    if (isAdminMode) {
      if (isLiveResultsMode && editingBracket) {
        const bracket = editingBracket as Record<string, unknown>;
        await fetch(`/api/admin/live-results/${bracket.id}?action=cancel`, {
          method: 'POST',
        });
        router.push('/admin?tab=live-results');
        return;
      }
      router.push('/admin?tab=brackets');
      return;
    }
    
    handleBackToLanding();
  };

  const handleCopyBracket = async (bracketToCopy: unknown) => {
    if (!(await ensureKillSwitchEnabledForAction())) {
      return;
    }

    if (!session?.user?.name || !session?.user?.email) {
      alert('User information not available');
      return;
    }

    try {
      const bracket = bracketToCopy as Record<string, unknown>;
      const copyEntryName = defaultBracketCopyEntryName(String(bracket.entryName ?? ''));
      const copiedBracket = {
        playerName: session.user.name,
        playerEmail: session.user.email,
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
        alert(data.error || 'Failed to copy bracket. Bracket creation may be disabled.');
      }
    } catch (error) {
      console.error('Error copying bracket:', error);
      alert('Failed to copy bracket. Please try again.');
    }
  };

  const handleCopyNameDialogStayOnMyPicks = () => {
    setCopyNameDialog(null);
  };

  const handleCopyNameDialogOpenBracket = async () => {
    if (!copyNameDialog || !session?.user?.name || !session?.user?.email) return;

    const trimmed = copyNameDialog.draftEntryName.trim();
    if (!trimmed) {
      alert('Please enter a name for the copied bracket.');
      return;
    }

    const b = copyNameDialog.newBracket;
    const id = String(b.id ?? '');
    if (!id) {
      alert('Invalid bracket copy.');
      setCopyNameDialog(null);
      return;
    }

    const currentName = String(b.entryName ?? '').trim();
    if (trimmed === currentName) {
      setCopyNameDialog(null);
      await handleEditBracket(b);
      return;
    }

    setCopyNameDialogBusy(true);
    try {
      const payload = {
        playerName: session.user.name,
        playerEmail: session.user.email,
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
        setCopyNameDialog(null);
        await handleEditBracket(data.data);
      } else {
        alert(data.error || 'Could not update the bracket name.');
      }
    } catch (error) {
      console.error('Error updating copied bracket name:', error);
      alert('Could not update the bracket name. Please try again.');
    } finally {
      setCopyNameDialogBusy(false);
    }
  };

  /**
   * Restore a soft-deleted bracket to in-progress so the user can edit or submit again.
   */
  const handleRestoreBracket = async (bracketId: string) => {
    if (!(await ensureKillSwitchEnabledForAction())) {
      return;
    }

    try {
      const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const data = await response.json();

      if (data.success) {
        await loadSubmittedBrackets();
      } else {
        alert(data.error || 'Failed to restore bracket.');
      }
    } catch (error) {
      console.error('Error restoring bracket:', error);
      alert('Failed to restore bracket. Please try again.');
    }
  };

  /**
   * Show inline permanent-delete confirmation for a deleted bracket.
   */
  const handlePermanentDeleteClick = async (bracketId: string) => {
    if (!(await ensureKillSwitchEnabledForAction())) {
      return;
    }
    setPendingPermanentDeleteBracketId(bracketId);
  };

  const handleCancelPermanentDelete = () => {
    setPendingPermanentDeleteBracketId(null);
  };

  /**
   * Hard-delete a bracket after the user confirms in the inline dialog.
   */
  const handleConfirmPermanentDelete = async (bracketId: string) => {
    if (!(await ensureKillSwitchEnabledForAction())) {
      setPendingPermanentDeleteBracketId(null);
      return;
    }

    setDeletingBracketId(bracketId);
    try {
      const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        setPendingPermanentDeleteBracketId(null);
        await loadSubmittedBrackets();
      } else {
        alert(data.error || 'Failed to permanently delete bracket.');
      }
    } catch (error) {
      console.error('Error permanently deleting bracket:', error);
      alert('Failed to permanently delete bracket. Please try again.');
    } finally {
      setDeletingBracketId(null);
    }
  };

  /**
   * Submitted bracket: show inline confirmation, then move back to In Progress (out of pool until resubmitted).
   */
  const handleReturnBracketClick = async (bracketId: string) => {
    if (!(await ensureKillSwitchEnabledForAction())) {
      return;
    }
    setPendingReturnBracketId(bracketId);
  };

  const handleCancelReturnBracket = () => {
    setPendingReturnBracketId(null);
  };

  const handleConfirmReturnBracket = async (bracketId: string) => {
    if (!(await ensureKillSwitchEnabledForAction())) {
      setPendingReturnBracketId(null);
      return;
    }

    setReturningBracketId(bracketId);
    try {
      const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const data = await response.json();

      if (data.success) {
        setPendingReturnBracketId(null);
        await loadSubmittedBrackets();
      } else {
        alert(data.error || 'Failed to return bracket to In Progress.');
      }
    } catch (error) {
      console.error('Error returning bracket:', error);
      alert('Failed to return bracket. Please try again.');
    } finally {
      setReturningBracketId(null);
    }
  };

  const handleSaveBracket = async () => {
    // Kill switch is enforced on the server (fast DB check). Skip extra /api/kill-switch round-trip before Save.

    if (!session?.user?.name || !session?.user?.email) {
      alert('User information not available');
      return;
    }

    try {
      const saveData = {
        playerName: session.user.name,
        playerEmail: session.user.email,
        entryName: entryName,
        tieBreaker: tieBreaker,
        picks
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
                      picks,
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
        
        // Log the save action (New Bracket was already logged when button was clicked)
        const { usageLogger } = await import('@/lib/usageLogger');
        usageLogger.log('Click', 'Save', bracketNumber ? String(bracketNumber).padStart(6, '0') : null);
        
        // If in admin mode, redirect back to admin brackets tab
        if (isAdminMode) {
          router.push(isLiveResultsMode ? '/admin?tab=live-results' : '/admin?tab=brackets');
          return;
        }

        // Merge API row into list — avoids slow GET /api/tournament-bracket (Sheets + DB) after every Save
        if (data.data && session?.user) {
          const payload = data.data as Record<string, unknown>;
          const updated = bracketFromSaveApiResponse(payload, session.user);
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
        // Show validation error from server
        alert(data.error || 'Failed to save bracket. Bracket creation may be disabled.');
      }
    } catch (error) {
      console.error('Error saving bracket:', error);
      alert('Failed to save bracket. Please try again.');
    }
  };

  const handleDeleteBracket = (bracketId: string) => {
    if (!killSwitchEnabled && !isAdminMode) {
      alert(killSwitchMessage);
      return;
    }

    // For in_progress brackets, show embedded confirmation
    // For submitted brackets, still use popup (hard delete is more serious)
    const bracketToDelete = submittedBrackets.find(b => b.id === bracketId);
    if (bracketToDelete && 'status' in bracketToDelete && bracketToDelete.status === 'deleted') {
      return;
    }
    const isInProgress = bracketToDelete && 'status' in bracketToDelete && bracketToDelete.status === 'in_progress';
    
    if (isInProgress) {
      // Show embedded confirmation for in_progress brackets
      setPendingDeleteBracketId(bracketId);
    } else {
      // For submitted brackets, still use popup confirmation
      const confirmMessage = 'Are you sure you want to delete this submitted bracket? This action cannot be undone.';
      if (confirm(confirmMessage)) {
        confirmDeleteBracket(bracketId);
      }
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
    
    setPendingDeleteBracketId(null);
    setDeletingBracketId(bracketId);

    try {
      if (isInProgress) {
        // Soft delete: Update status to 'deleted'
        const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'deleted' }),
        });
        const data = await response.json();

        if (data.success) {
          await loadSubmittedBrackets();
        } else {
          alert(`Error: ${data.error}`);
        }
      } else {
        // Hard delete: Actually remove the bracket
        const response = await fetchWithCSRF(`/api/tournament-bracket/${bracketId}`, {
          method: 'DELETE',
        });
        const data = await response.json();

        if (data.success) {
          await loadSubmittedBrackets();
        } else {
          alert(`Error: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('Error deleting bracket:', error);
      alert('Failed to delete bracket. Please try again.');
    } finally {
      setDeletingBracketId(null);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading tournament...</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if My Picks page should be available based on config
  if (siteConfig && !shouldShowMyPicksPage()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="bg-white rounded-lg shadow-lg p-12 max-w-md mx-auto">
              <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Page not Available
              </h2>
              <p className="text-gray-600">
                This page is currently not available.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="bg-white rounded-lg shadow-lg p-12 max-w-md mx-auto">
              <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                My Picks
              </h2>
              <p className="text-gray-600 mb-6">
                Sign in to view and submit your tournament picks.
              </p>
              <div className="space-y-3">
                <LoggedButton
                  onClick={() => router.push('/auth/signin')}
                  logLocation="Sign In"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Sign In
                </LoggedButton>
                <LoggedButton
                  onClick={() => router.push('/auth/signup')}
                  logLocation="Create Account"
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 cursor-pointer"
                >
                  Create Account
                </LoggedButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show landing page by default
  if (currentView === 'landing') {
    return (
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
        />
        <MyPicksLanding
          brackets={submittedBrackets}
          onCreateNew={handleCreateNew}
          onEditBracket={handleEditBracket}
          onDeleteBracket={handleDeleteBracket}
          pendingDeleteBracketId={pendingDeleteBracketId}
          onConfirmDelete={confirmDeleteBracket}
          onCancelDelete={() => setPendingDeleteBracketId(null)}
          onCopyBracket={handleCopyBracket}
          onSubmitBracket={handleSubmitFromLanding}
          submittingBracketId={submittingBracketId}
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
          killSwitchEnabled={killSwitchEnabled}
          killSwitchMessage={killSwitchMessage}
          onOpenFullBracketModal={handleOpenFullBracketModalFromMyPicks}
        />
        {copyNameDialog && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="copy-bracket-name-title"
            data-testid="copy-bracket-name-dialog"
          >
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 id="copy-bracket-name-title" className="text-lg font-semibold text-gray-900">
                Bracket copied
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Your bracket was copied successfully. You can change the entry name before opening it.
              </p>
              <label htmlFor="copy-bracket-entry-name" className="mt-4 block text-sm font-medium text-gray-700">
                Entry name
              </label>
              <input
                id="copy-bracket-entry-name"
                type="text"
                value={copyNameDialog.draftEntryName}
                onChange={(e) =>
                  setCopyNameDialog((prev) =>
                    prev ? { ...prev, draftEntryName: e.target.value } : null
                  )
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={copyNameDialogBusy}
                autoComplete="off"
                data-testid="copy-bracket-entry-name-input"
              />
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCopyNameDialogStayOnMyPicks}
                  disabled={copyNameDialogBusy}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  data-testid="copy-bracket-stay-on-my-picks"
                >
                  Stay on My Picks
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyNameDialogOpenBracket()}
                  disabled={copyNameDialogBusy}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  data-testid="copy-bracket-open-bracket"
                >
                  {copyNameDialogBusy ? 'Saving…' : 'Open bracket'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Fragment>
    );
  }

  if (!tournamentData || !bracket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="bg-white rounded-lg shadow-lg p-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Tournament Not Available
              </h2>
              <p className="text-gray-600">
                The tournament data could not be loaded. Please try again later.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-300">
      <div className="w-full">
        <div
          className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-2 border-b border-gray-400 bg-gray-200 px-3 py-2 shadow-sm"
          role="group"
          aria-label="Bracket layout"
        >
          <span className="text-xs font-semibold text-gray-700">Layout</span>
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setLayoutMode('5p')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                layoutMode === '5p' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
              data-testid="my-bracket-layout-5p"
            >
              5 Page
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('1p')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                layoutMode === '1p' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
              data-testid="my-bracket-layout-1p"
            >
              1 Page
            </button>
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
            bracketNumber={editingBracket ? (editingBracket as Record<string, unknown>).bracketNumber as number : undefined}
            year={editingBracket ? (editingBracket as Record<string, unknown>).year as number : undefined}
            siteConfig={siteConfig}
            existingBracketNames={submittedEntryNames}
            currentBracketId={editingBracket ? (editingBracket as Record<string, unknown>).id as string : undefined}
            isAdminMode={isAdminMode}
            isLiveResultsMode={isLiveResultsMode}
            disableSaveSubmit={!killSwitchEnabled && !isAdminMode}
            disableMessage={killSwitchMessage}
          />
        ) : (
          // 1 Page layout is always 64-team; 32 is not exposed in the UI (may revisit later).
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
            siteConfig={siteConfig}
            existingBracketNames={submittedEntryNames}
            isAdminMode={isAdminMode}
            isLiveResultsMode={isLiveResultsMode}
            disableSaveSubmit={!killSwitchEnabled && !isAdminMode}
            disableMessage={killSwitchMessage}
            onSave={handleSaveBracket}
            onClose={handleCloseBracket}
            onCancel={handleCloseBracket}
            onComplete={handleBracketComplete}
          />
        )}
      </div>
    </div>
  );
}

export default function BracketPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BracketContent />
    </Suspense>
  );
}