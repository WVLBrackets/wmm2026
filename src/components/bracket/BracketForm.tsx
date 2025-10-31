'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { BracketSubmission, Team, Game } from '@/types/bracket';
import { TOURNAMENT_CONFIG, generateBracketStructure } from '@/lib/bracketTypes';
import { validateBracketSubmission } from '@/lib/bracketValidation';
import { Trophy, Users, AlertCircle, CheckCircle } from 'lucide-react';

interface BracketFormProps {
  onSubmit: (submission: BracketSubmission) => void;
  isLoading?: boolean;
}

export default function BracketForm({ onSubmit, isLoading = false }: BracketFormProps) {
  const { data: session } = useSession();
  
  const [formData, setFormData] = useState<BracketSubmission>({
    playerName: session?.user?.name || '',
    playerEmail: session?.user?.email || '',
    games: []
  });
  
  const [validation, setValidation] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const [currentStep, setCurrentStep] = useState(2); // Start at step 2 since user is logged in
  const totalSteps = 2; // Only 2 steps now

  useEffect(() => {
    // Update form data with session info when available
    if (session?.user) {
      const user = session.user;
      setFormData(prev => ({
        ...prev,
        playerName: user?.name || '',
        playerEmail: user?.email || ''
      }));
    }
  }, [session]);

  useEffect(() => {
    // Initialize 16-team bracket structure (8 first round, 4 quarterfinals, 2 semifinals, 1 championship = 15 games)
    const games: Omit<Game, 'id' | 'completed'>[] = [
      // First Round (8 games)
      { round: 1, gameNumber: 1 },
      { round: 1, gameNumber: 2 },
      { round: 1, gameNumber: 3 },
      { round: 1, gameNumber: 4 },
      { round: 1, gameNumber: 5 },
      { round: 1, gameNumber: 6 },
      { round: 1, gameNumber: 7 },
      { round: 1, gameNumber: 8 },
      // Quarterfinals (4 games)
      { round: 2, gameNumber: 9 },
      { round: 2, gameNumber: 10 },
      { round: 2, gameNumber: 11 },
      { round: 2, gameNumber: 12 },
      // Semifinals (2 games)
      { round: 3, gameNumber: 13 },
      { round: 3, gameNumber: 14 },
      // Championship (1 game)
      { round: 4, gameNumber: 15 }
    ];
    
    setFormData(prev => ({
      ...prev,
      games: games
    }));
  }, []);

  const handleInputChange = (field: keyof BracketSubmission, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGameWinnerSelect = (gameIndex: number, winner: Team) => {
    setFormData(prev => ({
      ...prev,
      games: prev.games.map((game, index) => 
        index === gameIndex 
          ? { ...game, winner }
          : game
      )
    }));
  };

  const validateForm = () => {
    const result = validateBracketSubmission(formData);
    setValidation(result);
    return result.isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };


  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Tournament Rules
        </h3>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Important Rules:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Select winners for all 63 games</li>
                <li>Each correct pick earns points based on the round</li>
                <li>Final Four picks are worth 16 points each</li>
                <li>Championship pick is worth 32 points</li>
                <li>Brackets must be submitted before the tournament starts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    // Create 16 random teams for the bracket
    const teams = [
      { id: '1', name: 'UConn', seed: 1, region: 'East' as const },
      { id: '2', name: 'North Carolina', seed: 2, region: 'East' as const },
      { id: '3', name: 'Kentucky', seed: 3, region: 'East' as const },
      { id: '4', name: 'Kansas', seed: 4, region: 'East' as const },
      { id: '5', name: 'Duke', seed: 1, region: 'West' as const },
      { id: '6', name: 'Purdue', seed: 2, region: 'West' as const },
      { id: '7', name: 'Houston', seed: 3, region: 'West' as const },
      { id: '8', name: 'Creighton', seed: 4, region: 'West' as const },
      { id: '9', name: 'Iowa State', seed: 1, region: 'South' as const },
      { id: '10', name: 'Arizona', seed: 2, region: 'South' as const },
      { id: '11', name: 'Michigan State', seed: 3, region: 'South' as const },
      { id: '12', name: 'Florida', seed: 4, region: 'South' as const },
      { id: '13', name: 'Alabama', seed: 1, region: 'Midwest' as const },
      { id: '14', name: 'NC State', seed: 2, region: 'Midwest' as const },
      { id: '15', name: 'Gonzaga', seed: 3, region: 'Midwest' as const },
      { id: '16', name: 'Marquette', seed: 4, region: 'Midwest' as const }
    ];

    // Create bracket matchups
    const firstRound = [
      { game: 1, team1: teams[0], team2: teams[1] },
      { game: 2, team1: teams[2], team2: teams[3] },
      { game: 3, team1: teams[4], team2: teams[5] },
      { game: 4, team1: teams[6], team2: teams[7] },
      { game: 5, team1: teams[8], team2: teams[9] },
      { game: 6, team1: teams[10], team2: teams[11] },
      { game: 7, team1: teams[12], team2: teams[13] },
      { game: 8, team1: teams[14], team2: teams[15] }
    ];

    const secondRound = [
      { game: 9, team1: null, team2: null },
      { game: 10, team1: null, team2: null },
      { game: 11, team1: null, team2: null },
      { game: 12, team1: null, team2: null }
    ];

    const semifinals = [
      { game: 13, team1: null, team2: null },
      { game: 14, team1: null, team2: null }
    ];

    const championship = [
      { game: 15, team1: null, team2: null }
    ];

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Make Your Picks - 16 Team Bracket
          </h3>
          
          <div className="text-sm text-gray-600 mb-6">
            Select winners for each game. Click on a team to advance them to the next round.
          </div>
          
          {/* Bracket Visualization */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 overflow-x-auto">
            <div className="flex space-x-8 min-w-max">
              
              {/* First Round - 16 teams in single column */}
              <div className="flex flex-col space-y-1">
                <h4 className="font-semibold text-gray-900 text-center mb-4">First Round</h4>
                {firstRound.map((matchup, index) => (
                  <div key={index} className="relative">
                    {/* Game container */}
                    <div className="bg-gray-50 border border-gray-300 rounded p-2 w-48">
                      {/* Team 1 */}
                      <button
                        type="button"
                        onClick={() => handleGameWinnerSelect(
                          formData.games.findIndex(g => g.round === 1 && g.gameNumber === matchup.game),
                          matchup.team1
                        )}
                        className={`w-full text-left p-2 rounded text-sm border mb-1 ${
                          formData.games.find(g => g.round === 1 && g.gameNumber === matchup.game)?.winner?.id === matchup.team1.id
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : 'bg-white hover:bg-gray-50 border-gray-300'
                        }`}
                      >
                        <span className="font-bold">{matchup.team1.seed}</span> {matchup.team1.name}
                      </button>
                      
                      {/* Team 2 */}
                      <button
                        type="button"
                        onClick={() => handleGameWinnerSelect(
                          formData.games.findIndex(g => g.round === 1 && g.gameNumber === matchup.game),
                          matchup.team2
                        )}
                        className={`w-full text-left p-2 rounded text-sm border ${
                          formData.games.find(g => g.round === 1 && g.gameNumber === matchup.game)?.winner?.id === matchup.team2.id
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : 'bg-white hover:bg-gray-50 border-gray-300'
                        }`}
                      >
                        <span className="font-bold">{matchup.team2.seed}</span> {matchup.team2.name}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quarterfinals - 8 teams, centered between pairs */}
              <div className="flex flex-col justify-center">
                <h4 className="font-semibold text-gray-900 text-center mb-4">Quarterfinals</h4>
                <div className="space-y-8">
                  {secondRound.map((matchup, index) => {
                    const game1Winner = formData.games.find(g => g.round === 1 && g.gameNumber === index * 2 + 1)?.winner;
                    const game2Winner = formData.games.find(g => g.round === 1 && g.gameNumber === index * 2 + 2)?.winner;
                    const currentGame = formData.games.find(g => g.round === 2 && g.gameNumber === matchup.game);
                    
                    return (
                      <div key={index} className="relative">
                        <div className="bg-gray-50 border border-gray-300 rounded p-2 w-48">
                          {/* Team 1 */}
                          {game1Winner ? (
                            <button
                              type="button"
                              onClick={() => handleGameWinnerSelect(
                                formData.games.findIndex(g => g.round === 2 && g.gameNumber === matchup.game),
                                game1Winner
                              )}
                              className={`w-full text-left p-2 rounded text-sm border mb-1 ${
                                currentGame?.winner?.id === game1Winner.id
                                  ? 'bg-green-100 text-green-800 border-green-300'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'
                              }`}
                            >
                              <span className="font-bold">{game1Winner.seed}</span> {game1Winner.name}
                            </button>
                          ) : (
                            <div className="w-full text-left p-2 rounded text-sm border mb-1 bg-gray-100 text-gray-500 border-gray-300">
                              Winner of Game {index * 2 + 1}
                            </div>
                          )}
                          
                          {/* Team 2 */}
                          {game2Winner ? (
                            <button
                              type="button"
                              onClick={() => handleGameWinnerSelect(
                                formData.games.findIndex(g => g.round === 2 && g.gameNumber === matchup.game),
                                game2Winner
                              )}
                              className={`w-full text-left p-2 rounded text-sm border ${
                                currentGame?.winner?.id === game2Winner.id
                                  ? 'bg-green-100 text-green-800 border-green-300'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'
                              }`}
                            >
                              <span className="font-bold">{game2Winner.seed}</span> {game2Winner.name}
                            </button>
                          ) : (
                            <div className="w-full text-left p-2 rounded text-sm border bg-gray-100 text-gray-500 border-gray-300">
                              Winner of Game {index * 2 + 2}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Semifinals - 4 teams, centered between pairs */}
              <div className="flex flex-col justify-center">
                <h4 className="font-semibold text-gray-900 text-center mb-4">Semifinals</h4>
                <div className="space-y-16">
                  {semifinals.map((matchup, index) => {
                    const game1Winner = formData.games.find(g => g.round === 2 && g.gameNumber === index * 2 + 9)?.winner;
                    const game2Winner = formData.games.find(g => g.round === 2 && g.gameNumber === index * 2 + 10)?.winner;
                    const currentGame = formData.games.find(g => g.round === 3 && g.gameNumber === matchup.game);
                    
                    return (
                      <div key={index} className="relative">
                        <div className="bg-gray-50 border border-gray-300 rounded p-2 w-48">
                          {/* Team 1 */}
                          {game1Winner ? (
                            <button
                              type="button"
                              onClick={() => handleGameWinnerSelect(
                                formData.games.findIndex(g => g.round === 3 && g.gameNumber === matchup.game),
                                game1Winner
                              )}
                              className={`w-full text-left p-2 rounded text-sm border mb-1 ${
                                currentGame?.winner?.id === game1Winner.id
                                  ? 'bg-green-100 text-green-800 border-green-300'
                                  : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300'
                              }`}
                            >
                              <span className="font-bold">{game1Winner.seed}</span> {game1Winner.name}
                            </button>
                          ) : (
                            <div className="w-full text-left p-2 rounded text-sm border mb-1 bg-gray-100 text-gray-500 border-gray-300">
                              Winner of Game {index * 2 + 9}
                            </div>
                          )}
                          
                          {/* Team 2 */}
                          {game2Winner ? (
                            <button
                              type="button"
                              onClick={() => handleGameWinnerSelect(
                                formData.games.findIndex(g => g.round === 3 && g.gameNumber === matchup.game),
                                game2Winner
                              )}
                              className={`w-full text-left p-2 rounded text-sm border ${
                                currentGame?.winner?.id === game2Winner.id
                                  ? 'bg-green-100 text-green-800 border-green-300'
                                  : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300'
                              }`}
                            >
                              <span className="font-bold">{game2Winner.seed}</span> {game2Winner.name}
                            </button>
                          ) : (
                            <div className="w-full text-left p-2 rounded text-sm border bg-gray-100 text-gray-500 border-gray-300">
                              Winner of Game {index * 2 + 10}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Championship - 2 teams, centered */}
              <div className="flex flex-col justify-center">
                <h4 className="font-semibold text-gray-900 text-center mb-4">Championship</h4>
                <div className="space-y-32">
                  {championship.map((matchup, index) => {
                    const game1Winner = formData.games.find(g => g.round === 3 && g.gameNumber === 13)?.winner;
                    const game2Winner = formData.games.find(g => g.round === 3 && g.gameNumber === 14)?.winner;
                    const currentGame = formData.games.find(g => g.round === 4 && g.gameNumber === matchup.game);
                    
                    return (
                      <div key={index} className="relative">
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded p-2 w-48">
                          <div className="text-xs text-yellow-700 text-center mb-1 font-bold">🏆 Championship</div>
                          
                          {/* Team 1 */}
                          {game1Winner ? (
                            <button
                              type="button"
                              onClick={() => handleGameWinnerSelect(
                                formData.games.findIndex(g => g.round === 4 && g.gameNumber === matchup.game),
                                game1Winner
                              )}
                              className={`w-full text-left p-2 rounded text-sm border mb-1 ${
                                currentGame?.winner?.id === game1Winner.id
                                  ? 'bg-green-100 text-green-800 border-green-300'
                                  : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-400'
                              }`}
                            >
                              <span className="font-bold">{game1Winner.seed}</span> {game1Winner.name}
                            </button>
                          ) : (
                            <div className="w-full text-left p-2 rounded text-sm border mb-1 bg-gray-100 text-gray-500 border-gray-300">
                              Winner of Game 13
                            </div>
                          )}
                          
                          {/* Team 2 */}
                          {game2Winner ? (
                            <button
                              type="button"
                              onClick={() => handleGameWinnerSelect(
                                formData.games.findIndex(g => g.round === 4 && g.gameNumber === matchup.game),
                                game2Winner
                              )}
                              className={`w-full text-left p-2 rounded text-sm border ${
                                currentGame?.winner?.id === game2Winner.id
                                  ? 'bg-green-100 text-green-800 border-green-300'
                                  : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-400'
                              }`}
                            >
                              <span className="font-bold">{game2Winner.seed}</span> {game2Winner.name}
                            </button>
                          ) : (
                            <div className="w-full text-left p-2 rounded text-sm border bg-gray-100 text-gray-500 border-gray-300">
                              Winner of Game 14
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">Bracket Progress</span>
              <span className="text-sm text-blue-700">
                {formData.games.filter(g => g.winner).length} / 15 games completed
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(formData.games.filter(g => g.winner).length / 15) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Submit Your Bracket
            </h2>
            <span className="text-sm text-gray-600">
              Step {currentStep} of {totalSteps}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {currentStep === 1 && renderStep2()}
          {currentStep === 2 && renderStep3()}
        </div>

        {/* Validation Messages */}
        {validation && (
          <div className={`rounded-lg p-4 ${
            validation.isValid 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start">
              {validation.isValid ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
              )}
              <div>
                {validation.errors.length > 0 && (
                  <div className="text-red-800">
                    <p className="font-medium mb-2">Please fix the following errors:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.errors.map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="text-yellow-800 mt-2">
                    <p className="font-medium mb-2">Warnings:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.warnings.map((warning, index) => (
                        <li key={index} className="text-sm">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex space-x-3">
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    Submit Bracket
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
