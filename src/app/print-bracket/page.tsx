'use client';

import { useState, useEffect } from 'react';
import { useBracketMode } from '@/contexts/BracketModeContext';
import { generate64TeamBracket, updateBracketWithPicks } from '@/lib/bracketGenerator';
import { loadTournamentData } from '@/lib/tournamentLoader';
import { getTeamInfo } from '@/lib/teamLogos';
import { TournamentTeam, TournamentData } from '@/types/tournament';
import Image from 'next/image';

export default function PrintBracketPage() {
  const [bracketData, setBracketData] = useState<Record<string, unknown> | null>(null);
  const [bracket, setBracket] = useState<Record<string, unknown> | null>(null);
  const [tournamentData, setTournamentData] = useState<Record<string, unknown> | null>(null);
  const [championTeam, setChampionTeam] = useState<TournamentTeam | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setInPrintMode } = useBracketMode();

  useEffect(() => {
    setInPrintMode(true);
    
    const loadBracketData = async () => {
      try {
        // Load tournament data first
        const tournamentData = await loadTournamentData('2025');
        setTournamentData(tournamentData as unknown as Record<string, unknown>);
        
        const storedBracketData = sessionStorage.getItem('printBracketData');
        if (storedBracketData) {
          const parsedData = JSON.parse(storedBracketData);
          setBracketData(parsedData);
          
          // Generate bracket and update with picks
          const generatedBracket = generate64TeamBracket(tournamentData);
          const updatedBracket = updateBracketWithPicks(generatedBracket, parsedData.picks, tournamentData);
          setBracket(updatedBracket as unknown as Record<string, unknown>);
          
          // Load champion team info
          const championshipPick = parsedData.picks['championship'];
          if (championshipPick) {
            const champion = tournamentData.regions.flatMap(r => r.teams).find(t => t.id === championshipPick);
            if (champion) {
              try {
                const teamInfo = await getTeamInfo(champion.name);
                setChampionTeam({ ...champion, ...teamInfo });
              } catch (error) {
                console.error('Error loading champion team info:', error);
                setChampionTeam(champion);
              }
            }
          }
          
          // Clear the stored data after use
          sessionStorage.removeItem('printBracketData');
        } else {
          throw new Error('No bracket data available');
        }
      } catch (error) {
        console.error('Error loading bracket data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBracketData();

    return () => {
      setInPrintMode(false);
    };
  }, [setInPrintMode]);

  const handleBack = () => {
    window.close();
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper function to get the winner from a game
  const getWinnerFromGame = (game: Record<string, unknown>, pickedWinner: string | null) => {
    if (!pickedWinner || !game?.team1 || !game?.team2) return null;
    const team1 = game.team1 as TournamentTeam;
    const team2 = game.team2 as TournamentTeam;
    return pickedWinner === team1.id ? team1 : team2;
  };

  // Helper function to render Final Four section
  const renderFinalFourSection = () => {
    if (!bracketData) return null;
    
    // Get Final Four picks
    const picks = bracketData.picks as Record<string, string>;
    const semifinal1Pick = picks['final-four-1'];
    const semifinal2Pick = picks['final-four-2'];
    const championshipPick = picks['championship'];

    // Get the two finalists (winners of semifinals)
    const tournament = tournamentData as unknown as TournamentData;
    const finalist1 = semifinal1Pick && tournament ? tournament.regions.flatMap(r => r.teams).find(t => t.id === semifinal1Pick) : null;
    const finalist2 = semifinal2Pick && tournament ? tournament.regions.flatMap(r => r.teams).find(t => t.id === semifinal2Pick) : null;
    const champion = championshipPick && tournament ? tournament.regions.flatMap(r => r.teams).find(t => t.id === championshipPick) : null;

    return (
      <div style={{ 
        width: '100%',
        display: 'flex', 
        flexDirection: 'row', 
        gap: '5px',
        padding: '3px',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: '#f9fafb',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Finalist 1 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', paddingRight: '10px' }}>
          <div style={{
            padding: '4px 8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            backgroundColor: '#ffffff',
            fontSize: '13px',
            minHeight: '30px',
            width: '50%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {finalist1 ? (
              <>
                <span style={{ fontWeight: 'bold', marginRight: '4px' }}>#{finalist1.seed}</span>
                <span>{finalist1.name}</span>
              </>
            ) : (
              <span style={{ color: '#9ca3af' }}>Finalist 1</span>
            )}
          </div>
        </div>

        {/* VS */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>VS</div>
        </div>

        {/* Finalist 2 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', paddingLeft: '10px' }}>
          <div style={{
            padding: '4px 8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            backgroundColor: '#ffffff',
            fontSize: '13px',
            minHeight: '30px',
            width: '50%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {finalist2 ? (
              <>
                <span style={{ fontWeight: 'bold', marginRight: '4px' }}>#{finalist2.seed}</span>
                <span>{finalist2.name}</span>
              </>
            ) : (
              <span style={{ color: '#9ca3af' }}>Finalist 2</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render columns in correct order (left-to-right or right-to-left)
  const renderRegionColumns = (regionKey: string, regionIndex: number) => {
    if (!tournamentData || !bracket || !bracketData) return null;
    
    const tournament = tournamentData as unknown as TournamentData;
    const bracketDataTyped = bracketData as Record<string, unknown>;
    const bracketTyped = bracket as Record<string, unknown>;
    const isRightSide = regionIndex >= 2; // Top Right (2) and Bottom Right (3) are right side
    const columnOrder = isRightSide 
      ? ['Final Four', 'Elite 8', 'Sweet 16', 'Round of 32', 'Round of 64']
      : ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four'];
    
    return columnOrder.map((round, index) => {
      if (round === 'Round of 64') {
        return (
          <div key={round} style={{ minWidth: '90px', flex: '1 1 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', flex: 1 }}>
              {tournament.regions[regionIndex].teams.map((team, teamIndex) => {
                const gameIndex = Math.floor(teamIndex / 2);
                const isFirstTeam = teamIndex % 2 === 0;
                const game = (bracketTyped.regions as Record<string, unknown[]>)[regionKey]?.find(g => (g as Record<string, unknown>).round === 'Round of 64' && (g as Record<string, unknown>).gameNumber === gameIndex + 1);
                const pickedWinner = game ? (bracketDataTyped.picks as Record<string, string>)[(game as Record<string, unknown>).id as string] : null;
                const isWinner = pickedWinner === team.id;
                
                return (
                  <div key={team.id} style={{ 
                    height: '6%', 
                    border: '1px solid #d1d5db', 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '2px 4px',
                    fontSize: '8px',
                    backgroundColor: '#ffffff'
                  }}>
                    <span style={{ fontWeight: 'bold', marginRight: '2px' }}>#{team.seed}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {team.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      } else if (round === 'Round of 32') {
        return (
          <div key={round} style={{ minWidth: '90px', flex: '1 1 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', flex: 1 }}>
              {Array.from({ length: 8 }, (_, gameIndex) => {
                const roundOf64Game = (bracketTyped.regions as Record<string, unknown[]>)[regionKey]?.find(g => (g as Record<string, unknown>).round === 'Round of 64' && (g as Record<string, unknown>).gameNumber === gameIndex + 1);
                const winner = roundOf64Game ? getWinnerFromGame(roundOf64Game as Record<string, unknown>, (bracketDataTyped.picks as Record<string, string>)[(roundOf64Game as Record<string, unknown>).id as string]) : null;
                
                return (
                  <div key={gameIndex} style={{ 
                    height: '12%', 
                    border: '1px solid #d1d5db', 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '2px 4px',
                    fontSize: '8px',
                    backgroundColor: '#ffffff'
                  }}>
                    {winner ? (
                      <>
                        <span style={{ fontWeight: 'bold', marginRight: '2px' }}>#{winner.seed}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {winner.name}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>Winner</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      } else if (round === 'Sweet 16') {
        return (
          <div key={round} style={{ minWidth: '90px', flex: '1 1 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', flex: 1 }}>
                    {/* 6% top gap */}
                    <div style={{ height: '6%' }}></div>

                    {/* Game 1 */}
                    <div style={{ height: '12%' }}>
                {(() => {
                  const roundOf32Game = (bracketTyped.regions as Record<string, unknown[]>)[regionKey]?.find(g => (g as Record<string, unknown>).round === 'Round of 32' && (g as Record<string, unknown>).gameNumber === 1);
                  const winner = roundOf32Game ? getWinnerFromGame(roundOf32Game as Record<string, unknown>, (bracketDataTyped.picks as Record<string, string>)[(roundOf32Game as Record<string, unknown>).id as string]) : null;
                  
                  return (
                    <div style={{ 
                      height: '100%', 
                      border: '1px solid #d1d5db', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '2px 4px',
                      fontSize: '8px',
                      backgroundColor: '#ffffff'
                    }}>
                      {winner ? (
                        <>
                          <span style={{ fontWeight: 'bold', marginRight: '2px' }}>#{winner.seed}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winner.name}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Winner</span>
                      )}
                    </div>
                  );
                })()}
              </div>
              
                    {/* 12% gap */}
                    <div style={{ height: '12%' }}></div>

                    {/* Game 2 */}
                    <div style={{ height: '12%' }}>
                {(() => {
                  const roundOf32Game = (bracketTyped.regions as Record<string, unknown[]>)[regionKey]?.find(g => (g as Record<string, unknown>).round === 'Round of 32' && (g as Record<string, unknown>).gameNumber === 2);
                  const winner = roundOf32Game ? getWinnerFromGame(roundOf32Game as Record<string, unknown>, (bracketDataTyped.picks as Record<string, string>)[(roundOf32Game as Record<string, unknown>).id as string]) : null;
                  
                  return (
                    <div style={{ 
                      height: '100%', 
                      border: '1px solid #d1d5db', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '2px 4px',
                      fontSize: '8px',
                      backgroundColor: '#ffffff'
                    }}>
                      {winner ? (
                        <>
                          <span style={{ fontWeight: 'bold', marginRight: '2px' }}>#{winner.seed}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winner.name}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Winner</span>
                      )}
                    </div>
                  );
                })()}
              </div>
              
                    {/* 12% gap */}
                    <div style={{ height: '12%' }}></div>

                    {/* Game 3 */}
                    <div style={{ height: '12%' }}>
                {(() => {
                  const roundOf32Game = (bracketTyped.regions as Record<string, unknown[]>)[regionKey]?.find(g => (g as Record<string, unknown>).round === 'Round of 32' && (g as Record<string, unknown>).gameNumber === 3);
                  const winner = roundOf32Game ? getWinnerFromGame(roundOf32Game as Record<string, unknown>, (bracketDataTyped.picks as Record<string, string>)[(roundOf32Game as Record<string, unknown>).id as string]) : null;
                  
                  return (
                    <div style={{ 
                      height: '100%', 
                      border: '1px solid #d1d5db', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '2px 4px',
                      fontSize: '8px',
                      backgroundColor: '#ffffff'
                    }}>
                      {winner ? (
                        <>
                          <span style={{ fontWeight: 'bold', marginRight: '2px' }}>#{winner.seed}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winner.name}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Winner</span>
                      )}
                    </div>
                  );
                })()}
              </div>
              
                    {/* 12% gap */}
                    <div style={{ height: '12%' }}></div>

                    {/* Game 4 */}
                    <div style={{ height: '12%' }}>
                {(() => {
                  const roundOf32Game = (bracketTyped.regions as Record<string, unknown[]>)[regionKey]?.find(g => (g as Record<string, unknown>).round === 'Round of 32' && (g as Record<string, unknown>).gameNumber === 4);
                  const winner = roundOf32Game ? getWinnerFromGame(roundOf32Game as Record<string, unknown>, (bracketDataTyped.picks as Record<string, string>)[(roundOf32Game as Record<string, unknown>).id as string]) : null;
                  
                  return (
                    <div style={{ 
                      height: '100%', 
                      border: '1px solid #d1d5db', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '2px 4px',
                      fontSize: '8px',
                      backgroundColor: '#ffffff'
                    }}>
                      {winner ? (
                        <>
                          <span style={{ fontWeight: 'bold', marginRight: '2px' }}>#{winner.seed}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winner.name}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Winner</span>
                      )}
                    </div>
                  );
                })()}
              </div>
              
                    {/* 6% bottom gap */}
                    <div style={{ height: '6%' }}></div>
            </div>
          </div>
        );
      } else if (round === 'Elite 8') {
        return (
          <div key={round} style={{ minWidth: '90px', flex: '1 1 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', flex: 1 }}>
                    {/* 12% top gap */}
                    <div style={{ height: '12%' }}></div>

                    {/* Game 1 */}
                    <div style={{ height: '24%' }}>
                {(() => {
                  const sweet16Game = (bracketTyped.regions as Record<string, unknown[]>)[regionKey]?.find(g => (g as Record<string, unknown>).round === 'Sweet 16' && (g as Record<string, unknown>).gameNumber === 1);
                  const winner = sweet16Game ? getWinnerFromGame(sweet16Game as Record<string, unknown>, (bracketDataTyped.picks as Record<string, string>)[(sweet16Game as Record<string, unknown>).id as string]) : null;
                  
                  return (
                    <div style={{ 
                      height: '100%', 
                      border: '1px solid #d1d5db', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '2px 4px',
                      fontSize: '8px',
                      backgroundColor: '#ffffff'
                    }}>
                      {winner ? (
                        <>
                          <span style={{ fontWeight: 'bold', marginRight: '2px' }}>#{winner.seed}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winner.name}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Winner</span>
                      )}
                    </div>
                  );
                })()}
              </div>
              
                    {/* 24% gap */}
                    <div style={{ height: '24%' }}></div>

                    {/* Game 2 */}
                    <div style={{ height: '24%' }}>
                {(() => {
                  const sweet16Game = (bracketTyped.regions as Record<string, unknown[]>)[regionKey]?.find(g => (g as Record<string, unknown>).round === 'Sweet 16' && (g as Record<string, unknown>).gameNumber === 2);
                  const winner = sweet16Game ? getWinnerFromGame(sweet16Game as Record<string, unknown>, (bracketDataTyped.picks as Record<string, string>)[(sweet16Game as Record<string, unknown>).id as string]) : null;
                  
                  return (
                    <div style={{ 
                      height: '100%', 
                      border: '1px solid #d1d5db', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '2px 4px',
                      fontSize: '8px',
                      backgroundColor: '#ffffff'
                    }}>
                      {winner ? (
                        <>
                          <span style={{ fontWeight: 'bold', marginRight: '2px' }}>#{winner.seed}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winner.name}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Winner</span>
                      )}
                    </div>
                  );
                })()}
              </div>
              
                    {/* 12% bottom gap */}
                    <div style={{ height: '12%' }}></div>
            </div>
          </div>
        );
      } else if (round === 'Final Four') {
        return (
          <div key={round} style={{ minWidth: '90px', flex: '1 1 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', flex: 1 }}>
                    {/* 36% top gap */}
                    <div style={{ height: '36%' }}></div>

                    {/* Regional Champion */}
                    <div style={{ height: '24%' }}>
                {(() => {
                  const elite8Game = (bracketTyped.regions as Record<string, unknown[]>)[regionKey]?.find(g => (g as Record<string, unknown>).round === 'Elite 8' && (g as Record<string, unknown>).gameNumber === 1);
                  const winner = elite8Game ? getWinnerFromGame(elite8Game as Record<string, unknown>, (bracketDataTyped.picks as Record<string, string>)[(elite8Game as Record<string, unknown>).id as string]) : null;
                  
                  return (
                    <div style={{ 
                      height: '100%', 
                      border: '1px solid #d1d5db', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '2px 4px',
                      fontSize: '8px',
                      backgroundColor: '#ffffff'
                    }}>
                      {winner ? (
                        <>
                          <span style={{ fontWeight: 'bold', marginRight: '2px' }}>#{winner.seed}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winner.name}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Winner</span>
                      )}
                    </div>
                  );
                })()}
              </div>
              
                    {/* 36% bottom gap */}
                    <div style={{ height: '36%' }}></div>
            </div>
          </div>
        );
      }
      return null;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-700">Loading bracket...</div>
        </div>
      </div>
    );
  }

        if (!bracketData || !bracket || !tournamentData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-700">No bracket data available</div>
          <button 
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Title Bar */}
      <div style={{ 
        padding: '5px 0px', 
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        minHeight: '60px'
      }}>
        {/* Left spacer to balance the buttons */}
        <div style={{ width: '120px' }}></div>
        
        {/* Centered gold box */}
        <div style={{ 
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '1px', 
          padding: '4px 8px', 
          backgroundColor: '#fef3c7', 
          borderRadius: '4px', 
          border: '1px solid #f59e0b',
          minWidth: '400px'
        }}>
          {/* Top Row: Entry Name - Champion Logo Seed Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '18px', fontWeight: 'bold', color: '#92400e' }}>
            <span>{bracketData.entryName as string}</span>
            <span>-</span>
            {championTeam && championTeam.logo && (
              <Image
                src={championTeam.logo}
                alt={`${championTeam.name} logo`}
                width={24} 
                height={24} 
                style={{ objectFit: 'contain' }}
              />
            )}
            {championTeam && (
              <span>#{championTeam.seed} {championTeam.name}</span>
            )}
          </div>
          
          {/* Bottom Row: Tie Breaker */}
          <div style={{ fontSize: '12px', color: '#92400e' }}>
            Tie Breaker - {(bracketData.tieBreaker as string) || 'N/A'}
          </div>
        </div>
        
        {/* Right side buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handlePrint}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Print
          </button>
          <button 
            onClick={handleBack}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Bracket Content */}
      <div style={{ padding: '10px' }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Top Row - Top Left and Top Right Regions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* East Region */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', background: '#f9fafb', padding: '3px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', padding: '2px 0', fontSize: '10px', fontWeight: 'bold', color: '#374151', borderBottom: '1px solid #d1d5db', marginBottom: '2px' }}>
                East
              </div>
              <div style={{ display: 'flex', gap: '0px' }}>
                {renderRegionColumns('Top Left', 0)}
              </div>
            </div>
            
            {/* South Region */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', background: '#f9fafb', padding: '3px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', padding: '2px 0', fontSize: '10px', fontWeight: 'bold', color: '#374151', borderBottom: '1px solid #d1d5db', marginBottom: '2px' }}>
                South
              </div>
              <div style={{ display: 'flex', gap: '0px' }}>
                {renderRegionColumns('Top Right', 2)}
              </div>
            </div>
          </div>
          
          {/* Final Four Section - Middle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderFinalFourSection()}
          </div>
          
          {/* Bottom Row - Bottom Left and Bottom Right Regions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* West Region */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', background: '#f9fafb', padding: '3px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', padding: '2px 0', fontSize: '10px', fontWeight: 'bold', color: '#374151', borderBottom: '1px solid #d1d5db', marginBottom: '2px' }}>
                West
              </div>
              <div style={{ display: 'flex', gap: '0px' }}>
                {renderRegionColumns('Bottom Left', 1)}
              </div>
            </div>
            
            {/* Midwest Region */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', background: '#f9fafb', padding: '3px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', padding: '2px 0', fontSize: '10px', fontWeight: 'bold', color: '#374151', borderBottom: '1px solid #d1d5db', marginBottom: '2px' }}>
                Midwest
              </div>
              <div style={{ display: 'flex', gap: '0px' }}>
                {renderRegionColumns('Bottom Right', 3)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          
          .min-h-screen {
            min-height: auto !important;
          }
          
          button {
            display: none !important;
          }
          
          /* Hide footer on print */
          footer {
            display: none !important;
          }
          
          /* Remove any page breaks */
          * {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}