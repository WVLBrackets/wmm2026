'use client';

import { useState } from 'react';
import { TournamentGame, TournamentTeam } from '@/types/tournament';
import { getRegionalGames } from '@/lib/bracketGenerator';

interface RegionBracketProps {
  regionName: string;
  games: TournamentGame[];
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
}

export default function RegionBracket({ regionName, games, picks, onPick }: RegionBracketProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const rounds = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8'];
  
  const handleTeamClick = (game: TournamentGame, team: TournamentTeam) => {
    if (game.winner) return; // Game already decided
    
    setSelectedTeam(team.id);
    onPick(game.id, team.id);
  };

  const renderTeam = (team: TournamentTeam | undefined, game: TournamentGame, isTeam1: boolean) => {
    if (!team) return <div className="h-12"></div>;
    
    const isSelected = picks[game.id] === team.id;
    const isClickable = !game.winner;
    
    return (
      <div
        className={`
          flex items-center justify-between p-2 rounded border cursor-pointer transition-all
          ${isSelected ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300 hover:border-gray-400'}
          ${isClickable ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-50'}
        `}
        onClick={() => isClickable && handleTeamClick(game, team)}
      >
        <div className="flex items-center space-x-2">
          <span className="text-sm font-bold text-gray-600">#{team.seed}</span>
          <img src={team.logo} alt={team.name} className="w-6 h-6" />
          <span className="text-sm font-medium">{team.name}</span>
        </div>
        {isSelected && (
          <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
        )}
      </div>
    );
  };

  const renderGame = (game: TournamentGame) => {
    return (
      <div key={game.id} className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          {game.round}
        </div>
        <div className="space-y-2">
          {renderTeam(game.team1, game, true)}
          <div className="text-center text-xs text-gray-400">vs</div>
          {renderTeam(game.team2, game, false)}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">
        {regionName} Region
      </h3>
      
      <div className="space-y-6">
        {rounds.map(round => {
          const roundGames = games.filter(game => game.round === round);
          return (
            <div key={round} className="space-y-4">
              <div className="text-sm font-semibold text-gray-700 border-b pb-1">
                {round}
              </div>
              <div className="grid grid-cols-1 gap-4">
                {roundGames.map(renderGame)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

