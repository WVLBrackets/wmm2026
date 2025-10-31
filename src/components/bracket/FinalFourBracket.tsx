'use client';

import { TournamentGame, TournamentTeam } from '@/types/tournament';

interface FinalFourBracketProps {
  games: TournamentGame[];
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
}

export default function FinalFourBracket({ games, picks, onPick }: FinalFourBracketProps) {
  const handleTeamClick = (game: TournamentGame, team: TournamentTeam) => {
    if (game.winner) return; // Game already decided
    onPick(game.id, team.id);
  };

  const renderTeam = (team: TournamentTeam | undefined, game: TournamentGame, isTeam1: boolean) => {
    if (!team) return <div className="h-12"></div>;
    
    const isSelected = picks[game.id] === team.id;
    const isClickable = !game.winner;
    
    return (
      <div
        className={`
          flex items-center justify-between p-3 rounded border cursor-pointer transition-all
          ${isSelected ? 'bg-purple-100 border-purple-500' : 'bg-white border-gray-300 hover:border-gray-400'}
          ${isClickable ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-50'}
        `}
        onClick={() => isClickable && handleTeamClick(game, team)}
      >
        <div className="flex items-center space-x-3">
          <span className="text-sm font-bold text-gray-600">#{team.seed}</span>
          <img src={team.logo} alt={team.name} className="w-8 h-8" />
          <span className="text-sm font-medium">{team.name}</span>
        </div>
        {isSelected && (
          <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
        )}
      </div>
    );
  };

  const renderGame = (game: TournamentGame) => {
    return (
      <div key={game.id} className="mb-6">
        <div className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
          {game.round}
        </div>
        <div className="space-y-3">
          {renderTeam(game.team1, game, true)}
          <div className="text-center text-sm text-gray-400 font-medium">vs</div>
          {renderTeam(game.team2, game, false)}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-800 mb-8 text-center">
        🏆 Final Four
      </h3>
      
      <div className="space-y-8">
        {games.map(renderGame)}
      </div>
    </div>
  );
}

