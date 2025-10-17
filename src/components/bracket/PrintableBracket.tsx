'use client';

import { TournamentData, TournamentBracket } from '@/types/tournament';
import { updateBracketWithPicks } from '@/lib/bracketGenerator';

interface PrintableBracketProps {
  tournamentData: TournamentData;
  bracket: TournamentBracket;
  picks: { [gameId: string]: string };
  entryName: string;
  tieBreaker: string;
  playerName: string;
}

export default function PrintableBracket({
  tournamentData,
  bracket,
  picks,
  entryName,
  tieBreaker,
  playerName
}: PrintableBracketProps) {
  const updatedBracket = updateBracketWithPicks(bracket, picks, tournamentData);

  const renderTeam = (team: any, isSelected: boolean) => {
    if (!team) return (
      <div 
        style={{ 
          height: '16px', 
          backgroundColor: '#f3f4f6', 
          borderRadius: '1px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 3px',
          border: '1px solid #d1d5db'
        }}
      >
        <span style={{ fontSize: '7px', color: '#9ca3af' }}>TBD</span>
      </div>
    );

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 3px',
          borderRadius: '1px',
          border: isSelected ? '1px solid #3b82f6' : '1px solid #d1d5db',
          fontSize: '7px',
          height: '16px',
          backgroundColor: isSelected ? '#dbeafe' : '#ffffff',
          fontWeight: isSelected ? '600' : '400',
          minWidth: '110px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '7px', fontWeight: 'bold', color: '#4b5563' }}>#{team.seed}</span>
          <span style={{ fontSize: '7px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
        </div>
        {isSelected && (
          <span style={{ fontSize: '7px', fontWeight: 'bold', color: '#059669' }}>✓</span>
        )}
      </div>
    );
  };

  const renderGame = (game: any, round: string) => {
    const isTeam1Selected = picks[game.id] === game.team1?.id;
    const isTeam2Selected = picks[game.id] === game.team2?.id;

    return (
      <div 
        key={game.id} 
        style={{
          border: '1px solid #d1d5db',
          borderRadius: '1px',
          padding: '0px',
          backgroundColor: '#ffffff',
          minWidth: '110px'
        }}
      >
        <div>
          {renderTeam(game.team1, isTeam1Selected)}
        </div>
        {renderTeam(game.team2, isTeam2Selected)}
      </div>
    );
  };

  const getRegionDisplayName = (regionIndex: number) => {
    const regionNames = ['Top Left', 'Bottom Left', 'Top Right', 'Bottom Right'];
    return regionNames[regionIndex];
  };

  const getRegionAlignment = (regionIndex: number) => {
    // Top Left (0) and Bottom Left (1) align left
    // Top Right (2) and Bottom Right (3) align right
    return regionIndex < 2 ? 'left' : 'right';
  };

  const renderRegion = (region: any, regionIndex: number) => {
    const regionGames = updatedBracket.regions[region.name] || [];
    const roundOf64Games = regionGames.filter(g => g.round === 'Round of 64');
    const roundOf32Games = regionGames.filter(g => g.round === 'Round of 32');
    const sweet16Games = regionGames.filter(g => g.round === 'Sweet 16');
    const elite8Games = regionGames.filter(g => g.round === 'Elite 8');

    const alignment = getRegionAlignment(regionIndex);
    
    return (
      <div key={region.name} style={{ 
        display: 'flex', 
        flexDirection: 'row',
        alignItems: 'center',
        padding: '3px',
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
        backgroundColor: '#f9fafb',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Left side title for left regions, right side title for right regions */}
        {alignment === 'left' && (
          <div style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginRight: '5px',
            whiteSpace: 'nowrap'
          }}>
            {getRegionDisplayName(regionIndex)} ({region.name})
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'flex-start', 
          flex: 1,
          flexDirection: alignment === 'right' ? 'row-reverse' : 'row',
          height: '100%',
          width: '100%'
        }}>
          {/* Round of 64 */}
          <div style={{ minWidth: '120px', flex: '1 1 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
              {roundOf64Games.map((game) => (
                <div key={game.id}>
                  {renderGame(game, 'Round of 64')}
                </div>
              ))}
            </div>
          </div>
          
          {/* Round of 32 */}
          <div style={{ minWidth: '120px', flex: '1 1 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
              {roundOf32Games.map((game) => (
                <div key={game.id}>
                  {renderGame(game, 'Round of 32')}
                </div>
              ))}
            </div>
          </div>
          
          {/* Sweet 16 */}
          <div style={{ minWidth: '120px', flex: '1 1 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
              {sweet16Games.map((game) => (
                <div key={game.id}>
                  {renderGame(game, 'Sweet 16')}
                </div>
              ))}
            </div>
          </div>
          
          {/* Elite 8 */}
          <div style={{ minWidth: '120px', flex: '1 1 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
              {elite8Games.map((game) => (
                <div key={game.id}>
                  {renderGame(game, 'Elite 8')}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Right side title for right regions */}
        {alignment === 'right' && (
          <div style={{
            writingMode: 'vertical-lr',
            textOrientation: 'mixed',
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginLeft: '5px',
            whiteSpace: 'nowrap'
          }}>
            {getRegionDisplayName(regionIndex)} ({region.name})
          </div>
        )}
      </div>
    );
  };

  const renderFinalFour = () => {
    const finalFourGames = updatedBracket.finalFour || [];
    const championshipGame = updatedBracket.championship;
    
    return (
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        border: '3px solid #3b82f6',
        borderRadius: '12px',
        backgroundColor: '#eff6ff',
        gridColumn: '1 / -1', // Span full width
        marginTop: '20px'
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '20px',
          color: '#1e40af'
        }}>
          Final Four & Championship
        </h3>
        
        <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
          {/* Final Four Games */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {finalFourGames.map((game, index) => (
              <div key={game.id}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold', 
                  marginBottom: '6px', 
                  textAlign: 'center',
                  color: '#1e40af'
                }}>
                  {index === 0 ? 'Top Left vs Bottom Left' : 'Top Right vs Bottom Right'}
                </div>
                {renderGame(game, 'Final Four')}
              </div>
            ))}
          </div>
          
          {/* Championship Game */}
          <div>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 'bold', 
              marginBottom: '8px', 
              textAlign: 'center',
              color: '#1e40af'
            }}>
              Championship
            </div>
            {renderGame(championshipGame, 'Championship')}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="print-only"
      style={{
        width: '100%',
        height: '400px', // Smaller height for modal preview
        backgroundColor: '#ffffff',
        padding: '2px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        lineHeight: '1.4',
        margin: 0,
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* 4-Quadrant Layout - Full Page */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '5px',
        height: '100%',
        width: '100%'
      }}>
        {/* Top Left: East (index 0) */}
        {renderRegion(tournamentData.regions[0], 0)}
        {/* Top Right: South (index 2) */}
        {renderRegion(tournamentData.regions[2], 2)}
        {/* Bottom Left: West (index 1) */}
        {renderRegion(tournamentData.regions[1], 1)}
        {/* Bottom Right: Midwest (index 3) */}
        {renderRegion(tournamentData.regions[3], 3)}
      </div>
    </div>
  );
}