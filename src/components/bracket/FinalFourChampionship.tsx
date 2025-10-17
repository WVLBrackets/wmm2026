'use client';

import { TournamentGame } from '@/types/tournament';
import { CheckCircle } from 'lucide-react';

interface FinalFourChampionshipProps {
  finalFourGames: TournamentGame[];
  championshipGame: TournamentGame;
  picks: { [gameId: string]: string };
  onPick: (gameId: string, teamId: string) => void;
  tieBreaker: string;
  onTieBreakerChange: (value: string) => void;
  readOnly?: boolean;
}

export default function FinalFourChampionship({ 
  finalFourGames, 
  championshipGame, 
  picks, 
  onPick, 
  tieBreaker, 
  onTieBreakerChange,
  readOnly = false
}: FinalFourChampionshipProps) {
  
  const handleTeamClick = (game: TournamentGame, team: any) => {
    if (game.winner || readOnly) return;
    onPick(game.id, team.id);
  };

  const renderTeam = (team: any, game: TournamentGame, isTeam1: boolean) => {
    if (!team) return <div className="h-6 bg-gray-100 rounded"></div>;
    
    const isSelected = picks[game.id] === team.id;
    const isClickable = !game.winner && !readOnly;

    return (
      <div
        className={`
          flex items-center justify-between px-2 py-1 rounded border transition-all text-xs
          ${isSelected ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}
          ${isClickable ? 'cursor-pointer hover:border-gray-400 hover:bg-gray-50' : 'cursor-not-allowed opacity-50'}
        `}
        onClick={() => isClickable && handleTeamClick(game, team)}
      >
            <div className="flex items-center space-x-1 flex-1 min-w-0">
              <span className="text-xs font-bold text-gray-600">#{team.seed}</span>
              <img src={team.logo} alt={team.name} className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{team.name}</span>
            </div>
        {isSelected && (
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        )}
      </div>
    );
  };

      const renderGame = (game: TournamentGame, title: string) => {
        return (
          <div className="border-2 border-gray-300 rounded-lg p-1 space-y-0.5">
            <div className="text-xs font-semibold text-gray-700 text-center mb-1">
              {title}
            </div>
            {renderTeam(game.team1, game, true)}
            {renderTeam(game.team2, game, false)}
          </div>
        );
      };

      const getSemifinalTitle = (game: TournamentGame, index: number) => {
        if (game.team1 && game.team2) {
          const region1 = game.team1.region;
          const region2 = game.team2.region;
          return `${region1} vs. ${region2}`;
        }
        return `Semifinal ${index + 1}`;
      };

  // Check if championship is complete and find the champion
  const isChampionshipComplete = () => {
    return picks[championshipGame.id];
  };

  const getChampion = () => {
    if (!isChampionshipComplete()) return null;
    
    const championId = picks[championshipGame.id];
    if (!championId) return null;
    
    // Find the champion team
    const champion = championshipGame.team1?.id === championId ? championshipGame.team1 : championshipGame.team2;
    return champion;
  };

  const champion = getChampion();
  const isComplete = isChampionshipComplete();

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg p-6 relative">
      {/* Champion info on top right when complete */}
      {isComplete && champion && (
        <div className="absolute top-6 right-6">
          <div className="text-right">
            <h4 className="text-lg font-bold text-gray-800 mb-2">Your Champion:</h4>
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-sm font-bold text-gray-600">#{champion.seed}</span>
              <span className="text-base font-semibold text-gray-800">{champion.name}</span>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex justify-end">
              <img src={champion.logo} alt={champion.name} className="w-18 h-18" />
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col items-center space-y-8">
            {/* Final Four Games - Top Row */}
            <div className="flex justify-center space-x-8">
              {finalFourGames.map((game, index) => (
                <div key={game.id} className="w-48">
                  {renderGame(game, getSemifinalTitle(game, index))}
                </div>
              ))}
            </div>

        {/* Championship Game - Center */}
        <div className="w-48">
          {renderGame(championshipGame, 'Championship')}
        </div>

        {/* Tie Breaker Input */}
        <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <label htmlFor="tieBreaker" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Tie Breaker:
            </label>
                <input
                  type="number"
                  id="tieBreaker"
                  value={tieBreaker}
                  onChange={(e) => onTieBreakerChange(e.target.value)}
                  min="100"
                  max="300"
                  disabled={readOnly}
                  className={`w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                    readOnly 
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                      : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="150"
                  title="Total combined points scored in the championship game"
                />
          </div>
        </div>
      </div>
    </div>
  );
}
