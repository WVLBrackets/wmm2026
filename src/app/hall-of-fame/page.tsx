import { siteConfig } from '@/config/site';
import { Star, Trophy, Crown, Award, Calendar, Target, Zap, Users, Medal } from 'lucide-react';
import { getHallOfFameData, HallOfFameEntry } from '@/lib/googleSheets';

export default async function HallOfFamePage() {
  const hallOfFameData = await getHallOfFameData();
  
  // Calculate multiple top 3 finishers
  const top3Counts = new Map<string, { 
    count: number; 
    finishes: { year: string; position: string; place: number }[] 
  }>();
  
  hallOfFameData.forEach(entry => {
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
    .filter(([_, data]) => data.count > 1)
    .sort(([_, a], [__, b]) => b.count - a.count);
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
          
          <div className="space-y-6">
            {hallOfFameData.map((entry, index) => (
              <div key={entry.year} className="flex items-center p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                <div className="flex-shrink-0 w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mr-4">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold text-gray-900">{entry.year} Champion</h3>
                  <p className="text-yellow-700 font-medium">
                    {entry.firstPlace.name} ({entry.firstPlace.score} pts)
                  </p>
                  <p className="text-sm text-gray-600">
                    {entry.firstPlace.team} • {entry.totalEntries} entries
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    <p>2nd: {entry.secondPlace.name} ({entry.secondPlace.score})</p>
                    <p>3rd: {entry.thirdPlace.name} ({entry.thirdPlace.score})</p>
                  </div>
                </div>
              </div>
            ))}
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
            
            <div className="space-y-4">
              {hallOfFameData.map((entry, index) => (
                <div key={entry.year} className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{entry.firstPlace.name}</p>
                      <p className="text-sm text-gray-600">{entry.year} Champion • {entry.firstPlace.score} pts</p>
                      <p className="text-xs text-gray-500">{entry.firstPlace.team}</p>
                    </div>
                    <Trophy className="h-6 w-6 text-yellow-500" />
                  </div>
                </div>
              ))}
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
              <h3 className="text-2xl font-bold text-blue-600 mb-1">{hallOfFameData.length}</h3>
              <p className="text-sm text-gray-600">Tournaments Completed</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <h3 className="text-2xl font-bold text-green-600 mb-1">{hallOfFameData.length}</h3>
              <p className="text-sm text-gray-600">Champions Crowned</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <h3 className="text-2xl font-bold text-purple-600 mb-1">
                {hallOfFameData.reduce((sum, entry) => sum + entry.totalEntries, 0)}
              </h3>
              <p className="text-sm text-gray-600">Total Entries</p>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <h3 className="text-2xl font-bold text-orange-600 mb-1">
                {Math.round(hallOfFameData.reduce((sum, entry) => sum + entry.totalEntries, 0) / hallOfFameData.length)}
              </h3>
              <p className="text-sm text-gray-600">Avg Entries/Tournament</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
