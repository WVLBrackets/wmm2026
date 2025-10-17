'use client';

import { useState, useEffect } from 'react';
import { Bracket, Game, Team } from '@/types/bracket';
import { TOURNAMENT_CONFIG } from '@/lib/bracketTypes';
import { Trophy, Users, Calendar, Award } from 'lucide-react';
import Image from 'next/image';

interface BracketVisualizationProps {
  bracket: Bracket;
  isEditable?: boolean;
  onGameUpdate?: (gameId: string, winner: Team) => void;
}

export default function BracketVisualization({ 
  bracket, 
  isEditable = false, 
  onGameUpdate 
}: BracketVisualizationProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const handleGameClick = (game: Game) => {
    if (isEditable && !game.completed) {
      setSelectedGame(game.id);
    }
  };

  const handleWinnerSelect = (game: Game, winner: Team) => {
    if (onGameUpdate) {
      onGameUpdate(game.id, winner);
    }
    setSelectedGame(null);
  };

  const renderGame = (game: Game) => {
    const isSelected = selectedGame === game.id;
    const canEdit = isEditable && !game.completed;
    
    return (
      <div
        key={game.id}
        className={`bg-white border-2 rounded-lg p-3 cursor-pointer transition-all ${
          isSelected 
            ? 'border-blue-500 shadow-lg' 
            : canEdit 
              ? 'border-gray-300 hover:border-blue-300 hover:shadow-md' 
              : 'border-gray-200'
        }`}
        onClick={() => handleGameClick(game)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">
              Round {game.round} - Game {game.gameNumber}
            </div>
            
            {/* Team 1 */}
            <div className="flex items-center space-x-2 mb-2">
              {game.team1 && (
                <>
                  <Image
                    src={game.team1.logoUrl || '/logos/teams/default.png'}
                    alt={game.team1.name}
                    width={20}
                    height={20}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">
                    {game.team1.seed} {game.team1.name}
                  </span>
                </>
              )}
            </div>
            
            {/* Team 2 */}
            <div className="flex items-center space-x-2">
              {game.team2 && (
                <>
                  <Image
                    src={game.team2.logoUrl || '/logos/teams/default.png'}
                    alt={game.team2.name}
                    width={20}
                    height={20}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">
                    {game.team2.seed} {game.team2.name}
                  </span>
                </>
              )}
            </div>
          </div>
          
          {/* Winner indicator */}
          {game.winner && (
            <div className="flex items-center text-green-600">
              <Trophy className="h-4 w-4" />
            </div>
          )}
        </div>
        
        {/* Winner selection for editable brackets */}
        {isSelected && canEdit && game.team1 && game.team2 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600 mb-2">Select winner:</div>
            <div className="space-y-2">
              <button
                onClick={() => handleWinnerSelect(game, game.team1!)}
                className="w-full text-left p-2 bg-blue-50 hover:bg-blue-100 rounded text-sm"
              >
                {game.team1.seed} {game.team1.name}
              </button>
              <button
                onClick={() => handleWinnerSelect(game, game.team2!)}
                className="w-full text-left p-2 bg-blue-50 hover:bg-blue-100 rounded text-sm"
              >
                {game.team2.seed} {game.team2.name}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRegion = (region: string, games: Game[]) => {
    return (
      <div key={region} className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">
          {region} Region
        </h3>
        <div className="space-y-3">
          {games.map(renderGame)}
        </div>
      </div>
    );
  };

  const renderFinalFour = (games: Game[]) => {
    return (
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-6 text-white">
        <h3 className="text-lg font-bold mb-4 text-center">
          Final Four & Championship
        </h3>
        <div className="space-y-3">
          {games.map(renderGame)}
        </div>
      </div>
    );
  };

  // Group games by region and round
  const gamesByRegion = TOURNAMENT_CONFIG.regions.map(region => {
    const regionGames = bracket.games.filter(game => 
      game.team1?.region === region || game.team2?.region === region
    );
    return { region, games: regionGames };
  });

  const finalFourGames = bracket.games.filter(game => game.round >= 5);

  return (
    <div className="space-y-8">
      {/* Bracket Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {bracket.playerName}'s Bracket
            </h2>
            <p className="text-gray-600">
              Submitted: {new Date(bracket.submittedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center text-green-600 mb-2">
              <Award className="h-5 w-5 mr-2" />
              <span className="text-lg font-bold">{bracket.totalPoints} Points</span>
            </div>
            <div className="text-sm text-gray-500">
              {bracket.isComplete ? 'Complete' : 'Incomplete'}
            </div>
          </div>
        </div>
      </div>

      {/* Regional Brackets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {gamesByRegion.map(({ region, games }) => 
          renderRegion(region, games)
        )}
      </div>

      {/* Final Four */}
      {finalFourGames.length > 0 && (
        <div className="max-w-2xl mx-auto">
          {renderFinalFour(finalFourGames)}
        </div>
      )}
    </div>
  );
}

