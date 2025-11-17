'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TournamentData, TournamentBracket, BracketSubmission } from '@/types/tournament';
import { loadTournamentData } from '@/lib/tournamentLoader';
import { generate64TeamBracket } from '@/lib/bracketGenerator';
import { SiteConfigData } from '@/lib/siteConfig';
import StepByStepBracket from '@/components/bracket/StepByStepBracket';
import MyPicksLanding from '@/components/MyPicksLanding';
import { useBracketMode } from '@/contexts/BracketModeContext';
import { Trophy } from 'lucide-react';
import { LoggedButton } from '@/components/LoggedButton';
import { useUsageLogger } from '@/hooks/useUsageLogger';

function BracketContent() {
  const { data: session, status } = useSession();
  useUsageLogger('Pick');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setInBracketMode } = useBracketMode();
  
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
  const [submitError, setSubmitError] = useState<string>('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);

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
    
    if (editId && adminMode) {
      setIsAdminMode(true);
      // Load the bracket to edit with admin mode flag
      loadBracketForEdit(editId, true);
    }
  }, [searchParams]);

  // Set bracket mode when view changes
  useEffect(() => {
    setInBracketMode(currentView === 'bracket');
  }, [currentView, setInBracketMode]);

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
    
    const savedState = sessionStorage.getItem('bracketState');
    const savedStep = sessionStorage.getItem('bracketCurrentStep');
    
    if (savedState && savedStep) {
      try {
        const state = JSON.parse(savedState);
        const currentStep = parseInt(savedStep, 10);
        
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
        
        // If we were editing a bracket, try to restore it
        if (state.editingBracketId) {
          // Load the bracket data, then restore filtered picks (clear current step)
          loadBracketForEdit(state.editingBracketId, state.isAdminMode).then(() => {
            // Restore filtered picks (excluding current step) and other state
            setPicks(filteredPicks);
            setEntryName(state.entryName || '');
            setTieBreaker(restoredTieBreaker);
          });
        } else {
          // New bracket - restore filtered picks and go to bracket view
          setPicks(filteredPicks);
          setEntryName(state.entryName || '');
          setTieBreaker(restoredTieBreaker);
          setIsReadOnly(false);
          setCurrentView('bracket');
        }
      } catch (error) {
        console.error('Error restoring bracket state:', error);
        sessionStorage.removeItem('bracketState');
        sessionStorage.removeItem('bracketCurrentStep');
      }
    }
  }, [isLoading, bracket, tournamentData]); // Run when loading completes and bracket/tournament data is available


  // Set default entry name when user data is available
  useEffect(() => {
    if (session?.user?.name && !entryName) {
      setEntryName(session.user.name);
    }
  }, [session?.user?.name, entryName]);

  // Assign function to ref after it's declared
  const loadTournament = async () => {
    try {
      setIsLoading(true);
      
      // Load site config first to get tournament year (via API route)
      const configResponse = await fetch('/api/site-config');
      const configResult = await configResponse.json();
      const config = configResult.success ? configResult.data : null;
      setSiteConfig(config);
      
      // Use tournament year from config (fallback to '2025' if not available)
      const tournamentYear = config?.tournamentYear || '2025';
      const data = await loadTournamentData(tournamentYear);
      setTournamentData(data);
      
      const bracketData = generate64TeamBracket(data);
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
    
    loadTournamentRef.current?.();
  }, [status, router]);

  const loadSubmittedBrackets = async () => {
    try {
      const response = await fetch('/api/tournament-bracket');
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
      // Use admin endpoint if in admin mode
      const endpoint = adminMode 
        ? `/api/admin/brackets/${bracketId}`
        : `/api/tournament-bracket/${bracketId}`;
      
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.success && data.data) {
        const bracketData = data.data as Record<string, unknown>;
        setEditingBracket(bracketData);
        setPicks(bracketData.picks as { [gameId: string]: string } || {});
        setEntryName(bracketData.entryName as string || '');
        setTieBreaker(bracketData.tieBreaker?.toString() || '');
        setCurrentView('bracket');
      } else {
        console.error('Failed to load bracket:', data.error);
      }
    } catch (error) {
      console.error('Error loading bracket for edit:', error);
    }
  };

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
        
        response = await fetch(endpoint, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submission),
        });
      } else {
        // Create new submitted bracket (not applicable in admin mode)
        response = await fetch('/api/tournament-bracket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
        
        // Return to landing page without popup
        handleBackToLanding();
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

  const handleBracketComplete = () => {
    handleSubmitBracket();
  };

  // Landing page handlers
  const handleCreateNew = async () => {
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

  const handleEditBracket = (bracketToEdit: unknown) => {
    setEditingBracket(bracketToEdit);
    const bracketData = bracketToEdit as Record<string, unknown>;
    const bracketPicks = (bracketData.picks as Record<string, string>) || {};
    setPicks(bracketPicks);
    setEntryName((bracketData.entryName as string) || session?.user?.name || '');
    setTieBreaker((bracketData.tieBreaker as string) || '');
    setIsReadOnly(bracketData.status === 'submitted');
    
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

  const handleBackToLanding = async () => {
    // Clear sessionStorage when leaving bracket view
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('bracketState');
      sessionStorage.removeItem('bracketCurrentStep');
    }
    
    // If in admin mode, redirect back to admin panel
    if (isAdminMode) {
      router.push('/admin');
      return;
    }
    
    setCurrentView('landing');
    setEditingBracket(null);
    setPicks({});
    setIsReadOnly(false);
    await loadSubmittedBrackets(); // Reload brackets to show the newly submitted one
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
    
    handleBackToLanding();
  };

  const handleCopyBracket = async (bracketToCopy: unknown) => {
    if (!session?.user?.name || !session?.user?.email) {
      alert('User information not available');
      return;
    }

    try {
      // Create a copy with the same entry name (allowed for in-progress brackets)
      const bracket = bracketToCopy as Record<string, unknown>;
      const copiedBracket = {
        playerName: session.user.name,
        playerEmail: session.user.email,
        entryName: bracket.entryName,
        tieBreaker: bracket.tieBreaker || '',
        picks: bracket.picks || {},
        status: 'in_progress'
      };

      const response = await fetch('/api/tournament-bracket', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(copiedBracket),
      });

      const data = await response.json();

      if (data.success) {
        // Reload brackets to show the new copy
        await loadSubmittedBrackets();
        // Navigate to edit the copied bracket
        handleEditBracket(data.data);
      } else {
        // Show validation error from server
        alert(data.error || 'Failed to copy bracket. Bracket creation may be disabled.');
      }
    } catch (error) {
      console.error('Error copying bracket:', error);
      alert('Failed to copy bracket. Please try again.');
    }
  };

  const handleSaveBracket = async () => {
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
        const endpoint = isAdminMode 
          ? `/api/admin/brackets/${bracket.id}`
          : `/api/tournament-bracket/${bracket.id}`;
        
        response = await fetch(endpoint, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(saveData),
        });
      } else {
        // Create new bracket (not applicable in admin mode)
        response = await fetch('/api/tournament-bracket', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
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
        
        // Reload brackets to show the updated bracket
        await loadSubmittedBrackets();
        handleBackToLanding();
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
    // For in_progress brackets, show embedded confirmation
    // For submitted brackets, still use popup (hard delete is more serious)
    const bracketToDelete = submittedBrackets.find(b => b.id === bracketId);
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
    // Find the bracket to check its status
    const bracketToDelete = submittedBrackets.find(b => b.id === bracketId);
    
    // For in_progress brackets, soft delete (change status to 'deleted')
    // For submitted brackets, hard delete (actual removal)
    const isInProgress = bracketToDelete && 'status' in bracketToDelete && bracketToDelete.status === 'in_progress';
    
    setPendingDeleteBracketId(null);
    setDeletingBracketId(bracketId);

    try {
      if (isInProgress) {
        // Soft delete: Update status to 'deleted'
        const response = await fetch(`/api/tournament-bracket/${bracketId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch(`/api/tournament-bracket/${bracketId}`, {
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
          <MyPicksLanding
            brackets={submittedBrackets}
            onCreateNew={handleCreateNew}
            onEditBracket={handleEditBracket}
              onDeleteBracket={handleDeleteBracket}
              pendingDeleteBracketId={pendingDeleteBracketId}
              onConfirmDelete={confirmDeleteBracket}
              onCancelDelete={() => setPendingDeleteBracketId(null)}
            onCopyBracket={handleCopyBracket}
            deletingBracketId={deletingBracketId}
            tournamentData={tournamentData}
            bracket={bracket}
            siteConfig={siteConfig}
          />
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
      {/* Full-screen bracket mode - no header, no toolbar */}
      <div className="w-full">
        {/* Full-screen Step-by-Step Bracket - no padding, no header */}
        <StepByStepBracket
          key={bracketResetKey} // Force remount only when explicitly reset
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
          onEntryNameChange={setEntryName}
          onTieBreakerChange={setTieBreaker}
          readOnly={isReadOnly}
          submitError={submitError}
          bracketNumber={editingBracket ? (editingBracket as Record<string, unknown>).bracketNumber as number : undefined}
          year={editingBracket ? (editingBracket as Record<string, unknown>).year as number : undefined}
          siteConfig={siteConfig}
          existingBracketNames={submittedBrackets.filter(b => b.status === 'submitted').map(b => b.entryName)}
          currentBracketId={editingBracket ? (editingBracket as Record<string, unknown>).id as string : undefined}
        />
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