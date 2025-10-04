import { getSiteConfig } from '@/config/site';
import { Star, Trophy, Crown, Calendar, Users, Medal, Shield } from 'lucide-react';
import { getHallOfFameData } from '@/lib/googleSheets';
import TeamLogo from './TeamLogo';

export default async function HallOfFamePage() {
  const siteConfig = await getSiteConfig();
  const hallOfFameData = await getHallOfFameData();
  
  // Calculate comprehensive podium finishers with winnings
  const podiumFinishers = new Map<string, { 
    name: string;
    firstPlace: number;
    secondPlace: number;
    thirdPlace: number;
    totalWinnings: number;
    finishes: { year: string; position: string; place: number; points: number; winnings: number }[] 
  }>();
  
  hallOfFameData.forEach(entry => {
    // Skip HIATUS years and special cases for podium calculation
    if (entry.firstPlace.name === 'HIATUS' || entry.year === '2020' || entry.year === '2016') {
      return;
    }
    
    // Process first place
    const firstPlaceName = entry.firstPlace.name;
    if (!podiumFinishers.has(firstPlaceName)) {
      podiumFinishers.set(firstPlaceName, {
        name: firstPlaceName,
        firstPlace: 0,
        secondPlace: 0,
        thirdPlace: 0,
        totalWinnings: 0,
        finishes: []
      });
    }
    const firstPlaceData = podiumFinishers.get(firstPlaceName)!;
    firstPlaceData.firstPlace++;
    // Calculate winnings: total players × $5 × 60% for 1st place
    const firstPlaceWinnings = entry.totalEntries * 5 * 0.60;
    firstPlaceData.totalWinnings += firstPlaceWinnings;
    firstPlaceData.finishes.push({ 
      year: entry.year, 
      position: '1st Place', 
      place: 1, 
      points: entry.firstPlace.score,
      winnings: firstPlaceWinnings
    });
    
    // Process second place
    const secondPlaceName = entry.secondPlace.name;
    if (!podiumFinishers.has(secondPlaceName)) {
      podiumFinishers.set(secondPlaceName, {
        name: secondPlaceName,
        firstPlace: 0,
        secondPlace: 0,
        thirdPlace: 0,
        totalWinnings: 0,
        finishes: []
      });
    }
    const secondPlaceData = podiumFinishers.get(secondPlaceName)!;
    secondPlaceData.secondPlace++;
    // Calculate winnings: total players × $5 × 30% for 2nd place
    const secondPlaceWinnings = entry.totalEntries * 5 * 0.30;
    secondPlaceData.totalWinnings += secondPlaceWinnings;
    secondPlaceData.finishes.push({ 
      year: entry.year, 
      position: '2nd Place', 
      place: 2, 
      points: entry.secondPlace.score,
      winnings: secondPlaceWinnings
    });
    
    // Process third place
    const thirdPlaceName = entry.thirdPlace.name;
    if (!podiumFinishers.has(thirdPlaceName)) {
      podiumFinishers.set(thirdPlaceName, {
        name: thirdPlaceName,
        firstPlace: 0,
        secondPlace: 0,
        thirdPlace: 0,
        totalWinnings: 0,
        finishes: []
      });
    }
    const thirdPlaceData = podiumFinishers.get(thirdPlaceName)!;
    thirdPlaceData.thirdPlace++;
    // Calculate winnings: total players × $5 × 10% for 3rd place
    const thirdPlaceWinnings = entry.totalEntries * 5 * 0.10;
    thirdPlaceData.totalWinnings += thirdPlaceWinnings;
    thirdPlaceData.finishes.push({ 
      year: entry.year, 
      position: '3rd Place', 
      place: 3, 
      points: entry.thirdPlace.score,
      winnings: thirdPlaceWinnings
    });
  });
  
  // Convert to array and sort by total winnings descending
  const sortedPodiumFinishers = Array.from(podiumFinishers.values())
    .sort((a, b) => b.totalWinnings - a.totalWinnings);
  
  // Calculate single season records (top 25 point totals)
  const singleSeasonRecords: { name: string; year: string; points: number; place: number }[] = [];
  
  hallOfFameData.forEach(entry => {
    // Skip HIATUS years and special cases
    if (entry.firstPlace.name === 'HIATUS' || entry.year === '2020' || entry.year === '2016') {
      return;
    }
    
    singleSeasonRecords.push({
      name: entry.firstPlace.name,
      year: entry.year,
      points: entry.firstPlace.score,
      place: 1
    });
    
    singleSeasonRecords.push({
      name: entry.secondPlace.name,
      year: entry.year,
      points: entry.secondPlace.score,
      place: 2
    });
    
    singleSeasonRecords.push({
      name: entry.thirdPlace.name,
      year: entry.year,
      points: entry.thirdPlace.score,
      place: 3
    });
  });
  
  // Sort by points descending and take top 25
  const top25SingleSeason = singleSeasonRecords
    .sort((a, b) => b.points - a.points)
    .slice(0, 25);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Current Champion Spotlight */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center text-white">
            <Crown className="h-16 w-16 mr-4 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-bold mb-1">Reigning Champion</h2>
              <p className="text-3xl font-bold">
                {siteConfig.lastYearWinner}
              </p>
            </div>
          </div>
        </div>

        {/* Tournament Statistics */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
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
                {new Set(hallOfFameData
                  .filter(entry => entry.firstPlace.name !== 'HIATUS')
                  .flatMap(entry => [entry.firstPlace.name, entry.secondPlace.name, entry.thirdPlace.name])
                ).size}
              </h3>
              <p className="text-sm text-gray-600">Unique Money Winners</p>
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
            
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <h3 className="text-2xl font-bold text-yellow-600 mb-1">
                ${hallOfFameData
                  .filter(entry => entry.firstPlace.name !== 'HIATUS')
                  .reduce((sum, entry) => sum + (entry.totalEntries * 5), 0)
                  .toLocaleString()}
              </h3>
              <p className="text-sm text-gray-600">Total Prize Dollars</p>
            </div>
          </div>
        </div>

        {/* Tournament History Timeline */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center mb-6">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Tournament History</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hallOfFameData.map((entry) => {
              const isHiatus = entry.firstPlace.name === 'HIATUS';
              const is2020 = entry.year === '2020';
              const is2016 = entry.year === '2016';
              
              return (
                <div key={entry.year} className={`relative rounded-lg border-l-4 ${
                  isHiatus || is2020 || is2016
                    ? 'bg-gray-100 border-gray-400' 
                    : 'bg-yellow-50 border-yellow-500'
                }`}>
                  {/* Year Tab - Design 3: Integrated left border */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isHiatus || is2020 || is2016
                      ? 'bg-gray-500' 
                      : 'bg-yellow-600'
                  }`}></div>
                  <div className={`absolute left-2 top-2 px-2 py-1 rounded text-xs font-bold ${
                    isHiatus || is2020 || is2016
                      ? 'bg-gray-500 text-white' 
                      : 'bg-yellow-600 text-white'
                  }`}>
                    {is2020 ? `${entry.year} - Tournament Cancelled` :
                     is2016 ? `${entry.year} - WMM Hiatus` :
                     isHiatus ? `${entry.year} - Tournament Not Held` :
                     entry.totalEntries === 0 ? (
                       <span>{entry.year} - <span className="italic">unknown</span></span>
                     ) :
                     `${entry.year} - ${entry.totalEntries} entries`}
                  </div>
                  {/* Logo in top right corner */}
                  <div className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center">
                    {is2020 ? (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-500">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                    ) : is2016 ? (
                      <TeamLogo teamName="Villanova" size={48} />
                    ) : isHiatus ? (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-400">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                    ) : (
                      <TeamLogo teamName={entry.firstPlace.team} size={48} />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="p-4 pl-6">
                    {is2020 ? (
                      <div></div>
                    ) : is2016 ? (
                      <p className="text-sm text-gray-600">
                        WMM Hiatus
                      </p>
                    ) : isHiatus ? (
                      <p className="text-gray-500 font-medium italic">
                        Tournament Not Held
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600">
                        {entry.totalEntries} entries
                      </p>
                    )}
                  </div>
                  
                  {/* Data rows for special cases and normal years */}
                  {is2020 && (
                    <div className="px-4 pb-4 pt-8 space-y-1">
                      {/* Row 2: Global Pandemic */}
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-red-500" />
                        <span className="font-medium text-gray-700">Global Pandemic</span>
                      </div>
                    </div>
                  )}
                  
                  {is2016 && (
                    <div className="px-4 pb-3 space-y-1">
                      {/* No additional rows for 2016 - just the top two lines */}
                    </div>
                  )}
                  
                  {/* Data rows for normal years */}
                  {!isHiatus && !is2020 && !is2016 && (
                    <div className="px-4 pb-3 space-y-1">
                      {/* Row 1: Gold Crown, Player, Points */}
                      <div className="flex items-center gap-3">
                        <Crown className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium text-yellow-700">{entry.firstPlace.name} - {entry.firstPlace.score}</span>
                      </div>
                      
                      {/* Row 2: Silver Trophy, Player, Points */}
                      <div className="flex items-center gap-3">
                        <Trophy className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-700">{entry.secondPlace.name} - {entry.secondPlace.score}</span>
                      </div>
                      
                      {/* Row 3: Bronze Medal, Player, Points */}
                      <div className="flex items-center gap-3">
                        <Medal className="h-5 w-5 text-amber-600" />
                        <span className="font-medium text-gray-700">{entry.thirdPlace.name} - {entry.thirdPlace.score}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* All Time Leaders */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-900">All Time Leaders</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Career Leaders */}
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200">
              <div className="text-center mb-6">
                <Crown className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-gray-900">Career</h3>
                <p className="text-sm text-gray-600">Top 25 highest total money winners</p>
              </div>
              
              <div className="space-y-2">
                {sortedPodiumFinishers.slice(0, 25).map((finisher, index) => (
                  <div key={`podium-finisher-${index}-${finisher.name}`} className={`rounded-lg p-3 border-l-4 ${
                    index < 10 
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-500 shadow-md' 
                      : 'bg-white border-gray-300'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index < 10 
                            ? 'bg-yellow-500 text-white' 
                            : 'bg-gray-400 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <h4 className={`text-sm font-bold ${index < 10 ? 'text-yellow-900' : 'text-gray-900'}`}>
                            {finisher.name}
                          </h4>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${index < 10 ? 'text-yellow-700' : 'text-gray-900'}`}>
                          ${finisher.totalWinnings.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-xs">
                      <div className="flex items-center gap-1 flex-wrap">
                        {finisher.finishes
                          .sort((a, b) => parseInt(b.year) - parseInt(a.year)) // Sort by year descending (most recent first)
                          .slice(0, 5) // Show up to 5 finishes
                          .map((finish, finishIndex) => (
                            <span key={finishIndex} className="flex items-center gap-1">
                              {finish.place === 1 && <Crown className="h-3 w-3 text-yellow-600" />}
                              {finish.place === 2 && <Trophy className="h-3 w-3 text-gray-400" />}
                              {finish.place === 3 && <Medal className="h-3 w-3 text-amber-600" />}
                              <span className="font-medium text-gray-700">{finish.year}</span>
                              {finishIndex < Math.min(finisher.finishes.length, 5) - 1 && (
                                <span className="text-gray-400 mx-1">-</span>
                              )}
                            </span>
                          ))}
                        {finisher.finishes.length > 5 && (
                          <span className="text-gray-500 ml-1">
                            +{finisher.finishes.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Single Season Leaders */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
              <div className="text-center mb-6">
                <Star className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-gray-900">Single Season</h3>
                <p className="text-sm text-gray-600">Top 25 highest point totals in any single year</p>
              </div>
              
              <div className="space-y-2">
                {top25SingleSeason.map((record, index) => (
                  <div key={`single-season-${index}-${record.name}-${record.year}`} className={`rounded-lg p-3 border-l-4 ${
                    index < 10 
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500 shadow-md' 
                      : 'bg-white border-gray-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index < 10 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-400 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${index < 10 ? 'text-blue-900' : 'text-gray-900'}`}>
                            {record.name}
                          </p>
                          <div className="flex items-center gap-1">
                            {record.place === 1 && <Crown className="h-3 w-3 text-yellow-600" />}
                            {record.place === 2 && <Trophy className="h-3 w-3 text-gray-400" />}
                            {record.place === 3 && <Medal className="h-3 w-3 text-amber-600" />}
                            <p className="text-xs text-gray-600">{record.year}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${index < 10 ? 'text-blue-600' : 'text-gray-600'}`}>
                          {record.points} pts
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
