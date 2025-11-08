'use client';

import { useState, useEffect } from 'react';
import { getStandingsData, getAvailableDays, StandingsEntry, StandingsData, getQuarterfinalColor, getSemifinalColor, getFinalColor } from '@/lib/standingsData';
import { getTeamInfo, getLogoUrlSync } from '@/lib/teamLogos';
import { getTeamRefData } from '@/lib/teamRefData';
import { getSiteConfig } from '@/config/site';
import { Trophy, Medal, Search, RefreshCw } from 'lucide-react';
import Image from 'next/image';

// TeamLogo component to handle async team info loading with fallback
function TeamLogo({ 
  teamName, 
  size, 
  className, 
  teamCache,
  backgroundColor,
  borderColor,
  teamIndex
}: { 
  teamName: string; 
  size: number; 
  className?: string;
  teamCache?: Map<string, { id: string; name: string }>;
  backgroundColor?: 'correct' | 'incorrect' | 'neutral';
  borderColor?: 'correct' | 'incorrect' | 'neutral' | undefined;
  teamIndex?: number;
}) {
  const [teamInfo, setTeamInfo] = useState<{ id: string; name: string; logoUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeamInfo = async () => {
      try {
        // Check cache first for instant loading
        if (teamCache && teamCache.has(teamName)) {
          const cachedInfo = teamCache.get(teamName)!;
          const logoUrl = getLogoUrlSync(cachedInfo.id);
          setTeamInfo({ ...cachedInfo, logoUrl });
          setLoading(false);
          return;
        }

        // Fallback to async lookup if not in cache
        const info = await getTeamInfo(teamName, size);
        setTeamInfo(info);
        setTeamError(null); // Clear any previous errors
      } catch (error: unknown) {
        // Error logging handled in teamLogos.ts
        const errorMessage = error instanceof Error ? error.message : 'Team not found';
        setTeamError(errorMessage);
        // Don't set placeholder - show error in UI instead
        setTeamInfo(null);
      } finally {
        setLoading(false);
      }
    };
    loadTeamInfo();
  }, [teamName, size, teamCache]);

  if (loading) {
    return (
      <div className={`w-${size/4} h-${size/4} bg-gray-200 rounded flex items-center justify-center ${className}`}>
        <div className="text-xs">...</div>
      </div>
    );
  }

  // Color coding based on tournament results
  const getColorClasses = () => {
    let bgClass = '';
    let borderClass = '';
    
    // Background color logic with enhanced visibility and gradients
    if (backgroundColor === 'correct') {
      bgClass = 'bg-gradient-to-br from-green-100 to-green-200 shadow-sm';
    } else if (backgroundColor === 'incorrect') {
      bgClass = 'bg-gradient-to-br from-red-100 to-red-200 shadow-sm';
    } else {
      bgClass = 'bg-gradient-to-br from-gray-50 to-gray-100';
    }
    
           // Border color logic - only apply if borderColor is defined
           if (borderColor === 'correct') borderClass = 'ring-2 ring-green-500';
           else if (borderColor === 'incorrect') borderClass = 'ring-2 ring-red-500';
           else if (borderColor === 'neutral') borderClass = 'ring-1 ring-black';
           // If borderColor is undefined, no border class is applied
    
    return `${bgClass} ${borderClass}`;
  };

  // Show error if team not found in database
  if (teamError) {
    return (
      <div className={`${className} ${getColorClasses()}`}>
        <div 
          className="relative flex flex-col items-center justify-center rounded border-2 border-red-300 bg-red-50"
          style={{ width: size, height: size }}
          title={`Error: ${teamError}`}
        >
          <div className="text-red-600 text-xs font-bold text-center px-1" style={{ fontSize: '8px' }}>
            {teamName.substring(0, 6)}
          </div>
          <div className="text-red-500 text-xs" style={{ fontSize: '6px' }}>
            ❌
          </div>
        </div>
      </div>
    );
  }

  // If we have a team info but no logo URL, or if the image failed to load, show fallback
  const shouldShowFallback = !teamInfo || !teamInfo.logoUrl || imageError;

  if (shouldShowFallback) {
    return (
      <div className={`${className} ${getColorClasses()}`}>
        <div 
          className="relative flex items-center justify-center rounded"
          style={{ width: size, height: size }}
        >
          {/* Basketball background */}
          <Image
            src="/images/basketball icon.png"
            alt="Basketball fallback"
            width={size}
            height={size}
            className="object-contain rounded"
            quality={85}
            style={{ 
              imageRendering: 'auto',
              backgroundColor: 'transparent',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          />
          
          {/* Overlay text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-white font-bold text-center leading-none" style={{ fontSize: '6px' }}>
              {teamName.substring(0, 3).toUpperCase()}
            </div>
            {teamIndex !== undefined ? (
              <div className="text-white font-bold text-center leading-none mt-0.5" style={{ fontSize: '6px' }}>
                {teamIndex}
              </div>
            ) : (
              <div className="text-white font-bold text-center leading-none mt-0.5" style={{ fontSize: '6px' }}>
                ?
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} ${getColorClasses()}`}>
      <Image
        src={teamInfo.logoUrl || '/images/basketball icon.png'}
        alt={teamName}
        width={size}
        height={size}
        className="rounded"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          imageRendering: 'auto' // Use auto for better quality with local files
        }}
        quality={85} // Good balance of quality vs file size
        priority={size > 50} // Prioritize loading for larger logos
        sizes={`${size}px`} // Specify exact size for better optimization
        onError={() => {
          setImageError(true);
        }}
      />
    </div>
  );
}

// Global team cache that persists across day changes
const globalTeamCache = new Map<string, { id: string; name: string }>();

export default function StandingsTable() {
  const [standingsData, setStandingsData] = useState<StandingsData | null>(null);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [displayDay, setDisplayDay] = useState<string>(''); // Separate state for immediate dropdown update
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [standingsYear, setStandingsYear] = useState<string>('2026'); // Default fallback
  const [teamCache, setTeamCache] = useState<Map<string, { id: string; name: string }>>(globalTeamCache);

  // Function to calculate points back
  const calculatePointsBack = (entry: StandingsEntry, allEntries: StandingsEntry[]): string => {
    if (entry.rank === 1) {
      return '-';
    }
    
    // Find the highest points (first place)
    const firstPlacePoints = allEntries.find(e => e.rank === 1)?.points || 0;
    const pointsBack = firstPlacePoints - entry.points;
    
    return `-${pointsBack}`;
  };

  // Initialize logo cache on component mount
  useEffect(() => {
    // Logo cache is now handled automatically by the local file system
  }, []);

  // Load standings year from site config
  useEffect(() => {
    const loadStandingsYear = async () => {
      try {
        const siteConfig = await getSiteConfig();
        if (siteConfig.standingsYear) {
          setStandingsYear(siteConfig.standingsYear);
        }
      } catch (error) {
        // Error loading standings year - keep default fallback
        // Keep the default fallback value
      }
    };
    loadStandingsYear();
  }, []);

  // Load available days on component mount
  useEffect(() => {
    const loadDays = async () => {
      try {
        const days = await getAvailableDays();
        setAvailableDays(days);
        // Set default to the most recent day (first in the array)
        if (days.length > 0 && !selectedDay) {
          setSelectedDay(days[0]);
          setDisplayDay(days[0]); // Also set display day
        }
      } catch (error) {
        // Error loading days - will retry on next render
      }
    };
    loadDays();
  }, [selectedDay]);

  // Handle day selection with immediate UI update
  const handleDayChange = (day: string) => {
    // Update both display and selected day immediately
    setDisplayDay(day);
    setSelectedDay(day);
    setLoading(true);
    setError(null);
    // Clear standings data immediately to show loading state
    setStandingsData(null);
  };

  // Load standings data when selectedDay changes
  useEffect(() => {
    if (!selectedDay) return; // Don't load if no day is selected
    
    const loadStandings = async () => {
      const pageLoadStart = performance.now();
      setLoading(true);
      setError(null);
      
      try {
        // Preload team data FIRST, before loading standings
        // This ensures the cache is populated before any TeamLogo components mount
        const teamDataStart = performance.now();
        let teamRefData: { abbr: string; id: string }[] = [];
        try {
          teamRefData = await getTeamRefData();
          const teamDataTime = performance.now() - teamDataStart;
          console.log(`[Performance] Team data fetch: ${teamDataTime.toFixed(2)}ms`);
        } catch (error) {
          console.error('[Standings] Team data preload failed:', error);
          // Continue anyway - individual logos will handle errors
        }
        
        // Now load standings data
        const standingsStart = performance.now();
        const data = await getStandingsData(selectedDay);
        const standingsTime = performance.now() - standingsStart;
        console.log(`[Performance] Standings data fetch: ${standingsTime.toFixed(2)}ms`);
        
        // Populate cache with teams from standings
        const preloadStart = performance.now();
        if (teamRefData.length > 0) {
          preloadTeamDataWithRef(data, teamRefData);
        }
        const preloadTime = performance.now() - preloadStart;
        console.log(`[Performance] Team cache preload: ${preloadTime.toFixed(2)}ms`);
        
        setStandingsData(data);
        setLoading(false);
        
        const totalTime = performance.now() - pageLoadStart;
        console.log(`[Performance] Total page load: ${totalTime.toFixed(2)}ms (${data.entries.length} entries)`);
      } catch (error) {
        setError('Failed to load standings data');
        console.error('[Standings] Error loading standings:', error);
        setLoading(false);
      }
    };
    loadStandings();
  }, [selectedDay]); // Run whenever selectedDay changes

  // Optimized preload function that uses pre-fetched team reference data
  const preloadTeamDataWithRef = (data: StandingsData, teamRefData: { abbr: string; id: string }[]) => {
    const preloadStart = performance.now();
    
    const uniqueTeams = new Set<string>();
    
    // Collect all unique team names from standings
    data.entries.forEach(entry => {
      // Add champion
      if (entry.champion) uniqueTeams.add(entry.champion);
      
      // Add final four teams
      if (entry.finalFour) {
        entry.finalFour.forEach(team => uniqueTeams.add(team));
      }
      
      // Add finals teams
      if (entry.finals) {
        entry.finals.forEach(team => uniqueTeams.add(team));
      }
    });

    // Check if we already have all teams in global cache
    const missingTeams = Array.from(uniqueTeams).filter(team => !globalTeamCache.has(team));
    
    if (missingTeams.length === 0) {
      // All teams already cached, no need to reload
      return;
    }

    // Add missing teams to global cache synchronously
    // Only cache teams that are found - let unknown teams use async lookup with proper fallback
    missingTeams.forEach(teamName => {
      const teamRef = teamRefData.find(t => t.abbr === teamName);
      if (teamRef) {
        globalTeamCache.set(teamName, { id: teamRef.id, name: teamName });
      }
      // Don't cache unknown teams - let getTeamInfo() handle them with proper fallback to basketball icon
    });
    
    // Update local state with global cache
    setTeamCache(new Map(globalTeamCache));
  };

  // Legacy preload function (kept for compatibility)

  // Filter and search standings
  const filteredEntries = standingsData?.entries.filter(entry => {
    const matchesSearch = entry.player.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];


  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-orange-500" />;
    return <span className="text-gray-600 font-medium text-xs">{rank}</span>;
  };

  const renderFinalFour = (finalFour: string[], finals: string[], standingsData: StandingsData) => {
    return (
      <div className="grid grid-cols-2 gap-1 p-1 bg-gray-50 rounded border border-gray-200 w-fit">
        {finalFour.map((team, index) => {
          const isFinalsTeam = finals.includes(team);
          
          // Quarterfinals color for background
          const quarterfinalColor = getQuarterfinalColor(
            team, 
            standingsData.quarterfinalWinners || [], 
            standingsData.eliminatedTeams || []
          );
          
          // Semifinals color for border - ONLY for finalist teams
          const semifinalColor = isFinalsTeam ? getSemifinalColor(
            team, 
            standingsData.semifinalWinners || [], 
            standingsData.semifinalKey || [],
            standingsData.eliminatedTeams || []
          ) : undefined;
          
          return (
            <TeamLogo
              key={index}
              teamName={team}
              size={24}
              teamCache={teamCache}
              backgroundColor={quarterfinalColor}
              borderColor={semifinalColor}
              className="relative"
              teamIndex={index + 1}
            />
          );
        })}
      </div>
    );
  };


  const renderChampion = (champion: string, tb: number, standingsData: StandingsData) => {
    // Finals color for both background and border
    const finalColor = getFinalColor(
      champion, 
      standingsData.finalWinner || '', 
      standingsData.eliminatedTeams || []
    );
    
    return (
      <div className="flex flex-col items-center gap-0.5">
        <TeamLogo
          teamName={champion}
          size={60}
          teamCache={teamCache}
          backgroundColor={finalColor}
          borderColor={finalColor}
          className="rounded"
          teamIndex={undefined}
        />
        <div className="text-xs text-gray-600 font-medium">
          TB: {tb}
        </div>
      </div>
    );
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-50 border-yellow-200';
    if (rank === 2) return 'bg-gray-50 border-gray-200';
    if (rank === 3) return 'bg-orange-50 border-orange-200';
    return 'bg-white border-gray-200';
  };

  if (loading && !standingsData) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mr-3" />
          <span className="text-lg text-gray-600">Loading standings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold mb-2">Error Loading Standings</p>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header with controls */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">{standingsYear} Standings</h2>
            {/* Day selector moved next to title */}
            <div className="flex items-center gap-2">
              <select
                value={displayDay}
                onChange={(e) => handleDayChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableDays.map(day => (
                  <option key={day} value={day}>
                    {day === 'Final' ? 'Final' : day.replace(/^Day(\d+)$/, 'Day $1')}
                  </option>
                ))}
              </select>
              {loading && (
                <div className="flex items-center text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="ml-1 text-sm">Refreshing...</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-row gap-3 items-center">
            
            {/* Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
            
          </div>
        </div>
      </div>

      {/* Standings table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border border-gray-300">
            <tr>
              <th className="px-1 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10 border-r border-gray-300">
                Rank
              </th>
              <th className="px-1 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300" style={{maxWidth: '80px'}}>
                <div className="flex flex-col items-start">
                  <span>Player</span>
                  <span className="text-xs font-normal text-gray-400 italic"><span className="text-green-600">$</span> = paid</span>
                </div>
              </th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300" style={{width: '40px', minWidth: '40px'}}>
                <div className="flex flex-col items-center">
                  <span>Pts</span>
                  <span className="text-xs italic font-normal">back</span>
                </div>
              </th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300" style={{width: '80px', minWidth: '80px'}}>
                Final Four
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-18">
                Champ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {!standingsData ? (
              // Loading state - show when standingsData is null
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                    <div className="text-lg font-medium text-gray-900">Loading standings...</div>
                    <div className="text-sm text-gray-500">Please wait while we fetch the latest data</div>
                  </div>
                </td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              // No results state
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="text-lg font-medium text-gray-900">No players found</div>
                  <div className="text-sm text-gray-500">Try adjusting your search terms</div>
                </td>
              </tr>
            ) : (
              // Normal data display
              filteredEntries.map((entry, index) => (
              <tr key={`${entry.player}-${index}`} className={`hover:bg-gray-50 transition-colors ${getRankColor(entry.rank)}`}>
                <td className="px-1 py-2 whitespace-nowrap w-10 border-r border-gray-300">
                  <div className="flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>
                </td>
                <td className={`px-1 py-1 border-r border-gray-300 ${entry.paid ? 'bg-green-50' : ''}`} style={{maxWidth: '80px', minWidth: '80px'}}>
                  <div className="flex flex-col items-start gap-0.5">
                    <div className="text-xs sm:text-sm md:text-base font-medium text-gray-900 leading-tight break-words" style={{wordBreak: 'break-word', overflowWrap: 'break-word'}}>
                      {entry.player}
                    </div>
                    {entry.paid && (
                      <div className="flex items-center">
                        <span className="text-green-600 font-bold text-sm">$</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 whitespace-nowrap border-r border-gray-300" style={{width: '40px', minWidth: '40px'}}>
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-bold text-blue-600">
                      {entry.points}
                    </div>
                    <div className="text-xs text-gray-500">
                      {calculatePointsBack(entry, standingsData.entries)}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 border-r border-gray-300" style={{width: '80px', minWidth: '80px'}}>
                  {renderFinalFour(entry.finalFour, entry.finals, standingsData)}
                </td>
                <td className="px-3 py-2 w-18">
                  {renderChampion(entry.champion, entry.tb, standingsData)}
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with last updated */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {standingsData ? (
              <>Last updated: {new Date(standingsData.sheetLastModified || standingsData.lastUpdated).toLocaleString()}</>
            ) : (
              <>Loading latest data...</>
            )}
          </span>
          <span>
            {standingsData ? (
              <>Showing {filteredEntries.length} of {standingsData.entries.length} players</>
            ) : (
              <>Please wait...</>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
