'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TournamentData, TournamentBracket, BracketSubmission } from '@/types/tournament';
import { loadTournamentData, generateTournamentBracket } from '@/lib/tournamentLoader';
import { generate64TeamBracket } from '@/lib/bracketGenerator';
import { getSiteConfigFromGoogleSheets, SiteConfigData } from '@/lib/siteConfig';
import StepByStepBracket from '@/components/bracket/StepByStepBracket';
import MyPicksLanding from '@/components/MyPicksLanding';
import { useBracketMode } from '@/contexts/BracketModeContext';
import { Trophy, Users, Calendar, Plus, Eye, LogOut, Save, CheckCircle, ArrowLeft } from 'lucide-react';
import { signOut } from 'next-auth/react';

function BracketContent() {
  const { data: session, status } = useSession();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submittedBrackets, setSubmittedBrackets] = useState<BracketSubmission[]>([]);
  const [bracketResetKey, setBracketResetKey] = useState(0);
  const [deletingBracketId, setDeletingBracketId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string>('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    
    loadTournament();
  }, [status, router]);

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

  // Set default entry name when user data is available
  useEffect(() => {
    if (session?.user?.name && !entryName) {
      setEntryName(session.user.name);
    }
  }, [session?.user?.name, entryName]);

  const loadTournament = async () => {
    try {
      setIsLoading(true);
      const data = await loadTournamentData('2025');
      setTournamentData(data);
      
      const bracketData = generate64TeamBracket(data);
      setBracket(bracketData);
      
      // Load site config
      const config = await getSiteConfigFromGoogleSheets();
      setSiteConfig(config);
      
      // Load user's submitted brackets
      await loadSubmittedBrackets();
    } catch (error) {
      console.error('Error loading tournament:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
      
      console.log('Loading bracket - Admin mode:', adminMode, 'Endpoint:', endpoint);
      
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
      setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBracketComplete = () => {
    handleSubmitBracket();
  };

  // Landing page handlers
  const handleCreateNew = () => {
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
    const bracket = bracketToEdit as Record<string, unknown>;
    setPicks((bracket.picks as Record<string, string>) || {});
    setEntryName((bracket.entryName as string) || session?.user?.name || '');
    setTieBreaker((bracket.tieBreaker as string) || '');
    setIsReadOnly(bracket.status === 'submitted');
    setCurrentView('bracket');
    setBracketResetKey(prev => prev + 1);
  };

  const handleBackToLanding = async () => {
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

  const handleCloseBracket = () => {
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
        alert(`Error: ${data.error}`);
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
      
      if (editingBracket) {
        // Update existing bracket
        const bracket = editingBracket as Record<string, unknown>;
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
        // Reload brackets to show the updated bracket
        await loadSubmittedBrackets();
        handleBackToLanding();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving bracket:', error);
      alert('Failed to save bracket. Please try again.');
    }
  };

  const handleDeleteBracket = async (bracketId: string) => {
    if (!confirm('Are you sure you want to delete this bracket? This action cannot be undone.')) {
      return;
    }

    setDeletingBracketId(bracketId);

    try {
      const response = await fetch(`/api/tournament-bracket/${bracketId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        // Reload brackets to show updated list (no popup)
        await loadSubmittedBrackets();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting bracket:', error);
      alert('Failed to delete bracket. Please try again.');
    } finally {
      setDeletingBracketId(null);
    }
  };

  const getTotalPicks = () => {
    return Object.keys(picks).length;
  };

  const getTotalPossiblePicks = () => {
    if (!bracket) return 0;
    let total = 0;
    
    // Regional games: 4 regions × 15 games each = 60
    Object.values(bracket.regions).forEach(regionGames => {
      total += regionGames.length;
    });
    
    // Final Four: 2 games
    total += bracket.finalFour.length;
    
    // Championship: 1 game
    total += 1;
    
    return total;
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
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => router.push('/auth/signup')}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 cursor-pointer"
                >
                  Create Account
                </button>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
          onEntryNameChange={setEntryName}
          onTieBreakerChange={setTieBreaker}
          readOnly={isReadOnly}
          submitError={submitError}
          bracketNumber={editingBracket ? (editingBracket as Record<string, unknown>).bracketNumber as number : undefined}
          year={editingBracket ? (editingBracket as Record<string, unknown>).year as number : undefined}
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