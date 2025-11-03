'use client';

import { useEffect, useRef, RefObject } from 'react';
import { TournamentGame } from '@/types/tournament';
import { CheckCircle } from 'lucide-react';

interface RegionBracketLayoutProps {
  regionName: string;
  games: TournamentGame[];
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
  readOnly?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement>;
}

export default function RegionBracketLayout({ 
  regionName, 
  games, 
  picks, 
  onPick,
  readOnly = false,
  scrollContainerRef
}: RegionBracketLayoutProps) {
  const hasScrolledRef = useRef(false);
  
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
          <span className="text-xs font-medium truncate">{team.name as string}</span>
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

  // Auto-scroll when Round of 64 is complete
  useEffect(() => {
    if (!scrollContainerRef?.current || readOnly || hasScrolledRef.current) return;
    
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
      hasScrolledRef.current = true;
    }
  }, [roundOf64, picks, scrollContainerRef, readOnly]);

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
    <div className="relative">
      {/* Champion info on top right when complete */}
      {isComplete && regionalChampion && (
        <div className="absolute top-0 right-0">
          <div className="text-right">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-sm font-bold text-gray-600">#{regionalChampion.seed}</span>
              <span className="text-base font-semibold text-gray-800">{regionalChampion.name}</span>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex justify-end">
              <img src={regionalChampion.logo} alt={regionalChampion.name} className="w-18 h-18" />
            </div>
          </div>
        </div>
      )}

      {/* Bracket Layout */}
      <div className="flex items-start mt-8 min-w-max">
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

        {/* Elite 8 */}
        <div className="w-48">
          {elite8.map((game, index) => (
            <div key={game.id} style={{ marginTop: index === 0 ? '14rem' : '0' }}>
              {renderGame(game, 'Elite 8')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
