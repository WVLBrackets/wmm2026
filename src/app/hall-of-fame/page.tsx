import { getSiteConfig } from '@/config/site';
import { Star, Trophy, Crown, Calendar, Users, Medal, Shield } from 'lucide-react';
import { getHallOfFameData } from '@/lib/googleSheets';
import TeamLogo from './TeamLogo';

export default async function HallOfFamePage() {
  const siteConfig = await getSiteConfig();
  const hallOfFameData = await getHallOfFameData();
  
  // Calculate multiple top 3 finishers
  const top3Counts = new Map<string, { 
    count: number; 
    finishes: { year: string; position: string; place: number }[] 
  }>();
  
  hallOfFameData.forEach(entry => {
    // Skip HIATUS years for multiple winners calculation
    if (entry.firstPlace.name === 'HIATUS') {
      return;
    }
    
    // Check first place
    const firstPlaceName = entry.firstPlace.name;
    if (top3Counts.has(firstPlaceName)) {
      const existing = top3Counts.get(firstPlaceName)!;
      existing.count++;
      existing.finishes.push({ year: entry.year, position: '1st Place', place: 1 });
    } else {
      top3Counts.set(firstPlaceName, {
        count: 1,
        finishes: [{ year: entry.year, position: '1st Place', place: 1 }]
      });
    }
    
    // Check second place
    const secondPlaceName = entry.secondPlace.name;
    if (top3Counts.has(secondPlaceName)) {
      const existing = top3Counts.get(secondPlaceName)!;
      existing.count++;
      existing.finishes.push({ year: entry.year, position: '2nd Place', place: 2 });
    } else {
      top3Counts.set(secondPlaceName, {
        count: 1,
        finishes: [{ year: entry.year, position: '2nd Place', place: 2 }]
      });
    }
    
    // Check third place
    const thirdPlaceName = entry.thirdPlace.name;
    if (top3Counts.has(thirdPlaceName)) {
      const existing = top3Counts.get(thirdPlaceName)!;
      existing.count++;
      existing.finishes.push({ year: entry.year, position: '3rd Place', place: 3 });
    } else {
      top3Counts.set(thirdPlaceName, {
        count: 1,
        finishes: [{ year: entry.year, position: '3rd Place', place: 3 }]
      });
    }
  });
  
  const multipleWinners = Array.from(top3Counts.entries())
    .filter(([, data]) => data.count > 1)
    .sort(([, a], [, b]) => b.count - a.count);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Current Champion Spotlight */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center text-white">
            <Crown className="h-20 w-20 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Current Champion</h2>
            <p className="text-4xl font-bold mb-2">
              {siteConfig.lastYearWinner}
            </p>
            <p className="text-lg opacity-90">
              {siteConfig.lastYearChampionship} Tournament Winner
            </p>
          </div>
        </div>

        {/* Tournament History Timeline */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center mb-6">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Tournament History</h2>
          </div>
          
          <div className="space-y-3">
            {hallOfFameData.map((entry) => {
              const isHiatus = entry.firstPlace.name === 'HIATUS';
              
              return (
                <div key={entry.year} className={`rounded-lg border-l-4 ${
                  isHiatus 
                    ? 'bg-gray-100 border-gray-400' 
                    : 'bg-yellow-50 border-yellow-500'
                }`}>
                  {/* Main team logo header - fills row with no padding */}
                  <div className={`flex items-center ${isHiatus ? 'p-4' : 'p-0'}`}>
                    {isHiatus ? (
                      <div className="flex items-center p-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-4 bg-gray-400">
                          <Shield className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-600">
                            {entry.year} Tournament
                          </h3>
                          <p className="text-gray-500 font-medium italic">
                            Tournament Not Held
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Large team logo that fills the row */}
                        <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                          <TeamLogo teamName={entry.firstPlace.team} size={80} />
                        </div>
                        <div className="flex-grow p-4">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {entry.year} Champion
                          </h3>
                          <p className="text-sm text-gray-600">
                            {entry.totalEntries} entries
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Data rows for non-hiatus years */}
                  {!isHiatus && (
                    <div className="px-4 pb-4 space-y-2">
                      {/* Row 1: Gold Crown, Player, Points */}
                      <div className="flex items-center gap-3">
                        <Crown className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium text-yellow-700">{entry.firstPlace.name}</span>
                        <span className="text-sm text-gray-600">({entry.firstPlace.score} pts)</span>
                      </div>
                      
                      {/* Row 2: Silver Trophy, Player, Points */}
                      <div className="flex items-center gap-3">
                        <Trophy className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-700">{entry.secondPlace.name}</span>
                        <span className="text-sm text-gray-600">({entry.secondPlace.score} pts)</span>
                      </div>
                      
                      {/* Row 3: Bronze Medal, Player, Points */}
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Medal className="h-5 w-5 text-amber-600" />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-800" style={{ fontSize: '8px', lineHeight: '1' }}>
                            3
                          </span>
                        </div>
                        <span className="font-medium text-gray-700">{entry.thirdPlace.name}</span>
                        <span className="text-sm text-gray-600">({entry.thirdPlace.score} pts)</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hall of Fame Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* All-Time Champions */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-gray-900">All-Time Champions</h3>
            </div>
            
            <div className="space-y-3">
              {hallOfFameData.map((entry) => {
                const isHiatus = entry.firstPlace.name === 'HIATUS';
                
                return (
                  <div key={entry.year} className={`rounded-lg border-l-4 ${
                    isHiatus 
                      ? 'bg-gray-100 border-gray-400' 
                      : 'bg-yellow-50 border-yellow-500'
                  }`}>
                    {/* Main team logo header */}
                    <div className={`flex items-center ${isHiatus ? 'p-4' : 'p-0'}`}>
                      {isHiatus ? (
                        <div className="flex items-center p-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-4 bg-gray-400">
                            <Shield className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-600 italic">Tournament Not Held</p>
                            <p className="text-sm text-gray-500">{entry.year} Tournament</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Large team logo */}
                          <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center">
                            <TeamLogo teamName={entry.firstPlace.team} size={64} />
                          </div>
                          <div className="flex-grow p-4">
                            <p className="font-semibold text-gray-900">{entry.firstPlace.name}</p>
                            <p className="text-sm text-gray-600">{entry.year} Champion • {entry.firstPlace.score} pts</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Multiple Winners */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <Star className="h-12 w-12 text-blue-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-gray-900">Multiple Winners</h3>
            </div>
            
            <div className="space-y-4">
              {multipleWinners.length > 0 ? (
                multipleWinners.map(([playerName, data]) => (
                  <div key={playerName} className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                      <div className="flex-grow">
                        <p className="font-semibold text-gray-900">{playerName}</p>
                        <p className="text-sm text-gray-600 mb-2">
                          {data.count} Top 3 Finish{data.count > 1 ? 'es' : ''}
                        </p>
                        <div className="space-y-1">
                          {data.finishes
                            .sort((a, b) => parseInt(b.year) - parseInt(a.year)) // Sort by year, newest first
                            .map((finish, index) => (
                            <div key={index} className="flex items-center text-xs">
                              <Medal className={`h-4 w-4 mr-2 ${
                                finish.place === 1 ? 'text-yellow-500' : 
                                finish.place === 2 ? 'text-gray-400' : 'text-orange-500'
                              }`} />
                              <span className="text-gray-700">
                                {finish.year}: {finish.position}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <Star className="h-6 w-6 text-blue-500" />
                        <p className="text-xs text-blue-600 font-medium">{data.count}x Top 3</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">No Multiple Top 3 Finishers Yet</p>
                      <p className="text-sm text-gray-600">Players with multiple top 3 finishes will appear here</p>
                    </div>
                    <Star className="h-6 w-6 text-gray-400" />
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Tournament Statistics */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center mb-6">
            <Users className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Tournament Statistics</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {hallOfFameData.filter(entry => entry.firstPlace.name !== 'HIATUS').length}
              </h3>
              <p className="text-sm text-gray-600">Tournaments Completed</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <h3 className="text-2xl font-bold text-green-600 mb-1">
                {hallOfFameData.filter(entry => entry.firstPlace.name !== 'HIATUS').length}
              </h3>
              <p className="text-sm text-gray-600">Champions Crowned</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <h3 className="text-2xl font-bold text-purple-600 mb-1">
                {hallOfFameData
                  .filter(entry => entry.firstPlace.name !== 'HIATUS')
                  .reduce((sum, entry) => sum + entry.totalEntries, 0)
                }
              </h3>
              <p className="text-sm text-gray-600">Total Entries</p>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <h3 className="text-2xl font-bold text-orange-600 mb-1">
                {(() => {
                  const activeTournaments = hallOfFameData.filter(entry => entry.firstPlace.name !== 'HIATUS');
                  const totalEntries = activeTournaments.reduce((sum, entry) => sum + entry.totalEntries, 0);
                  return activeTournaments.length > 0 ? Math.round(totalEntries / activeTournaments.length) : 0;
                })()}
              </h3>
              <p className="text-sm text-gray-600">Avg Entries/Tournament</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
