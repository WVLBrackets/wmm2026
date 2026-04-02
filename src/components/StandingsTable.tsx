'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  StandingsEntry,
  StandingsData,
  formatStandingsTieBreakerDisplay,
  getRegionalChampionSquareShade,
  getFinalistBorderTone,
  getChampionDisplayColors,
  type RegionalChampionKeyRow,
} from '@/lib/standingsData';
import { getTeamInfo, getLogoUrlSync } from '@/lib/teamLogos';
import { getTeamRefData } from '@/lib/teamRefData';
import { getSiteConfig } from '@/config/site';
import { Trophy, Medal, Search, RefreshCw, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import BracketViewerModal from '@/components/bracket/BracketViewerModal';

// TeamLogo component to handle async team info loading with fallback
function TeamLogo({
  teamName,
  size,
  className,
  teamCache,
  backgroundColor,
  borderColor,
  heavyRing = false,
  teamIndex,
}: {
  teamName: string;
  size: number;
  className?: string;
  teamCache?: Map<string, { id: string; name: string }>;
  backgroundColor?: 'correct' | 'incorrect' | 'neutral';
  borderColor?: 'correct' | 'incorrect' | 'neutral' | undefined;
  /** Emphasized ring (ring-2) for finalist / champ picks. */
  heavyRing?: boolean;
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
      bgClass = 'bg-white';
    }

    if (borderColor === 'correct') borderClass = 'ring-2 ring-green-600';
    else if (borderColor === 'incorrect') borderClass = 'ring-2 ring-red-600';
    else if (borderColor === 'neutral' && heavyRing) borderClass = 'ring-2 ring-gray-900';
    else if (borderColor === 'neutral' && !heavyRing) borderClass = 'ring-1 ring-gray-900';

    return `${bgClass} ${borderClass}`.trim();
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

/** Human-readable label for sheet day keys (e.g. Day8 → Day 8). */
function formatStandingsDayLabel(day: string): string {
  return day === 'Final' ? 'Final' : day.replace(/^Day(\d+)$/, 'Day $1');
}

/**
 * Dropdown for standings day; uses an anchored panel instead of a native select so the list
 * stays aligned with the control (native popups can render in the wrong place with grid/layout + Chromium).
 */
function StandingsDayPicker({
  value,
  days,
  onChange,
  disabled,
  buttonClassName,
  'data-testid': testId,
}: {
  value: string;
  days: string[];
  onChange: (day: string) => void;
  disabled?: boolean;
  buttonClassName?: string;
  'data-testid'?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const updateMenuRect = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 4;
    setMenuRect({ top: r.bottom + gap, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuRect();
    const onScrollOrResize = () => updateMenuRect();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updateMenuRect]);

  useEffect(() => {
    if (!open) return;
    const onDocMouse = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = value ? formatStandingsDayLabel(value) : 'Select day';

  const menuList =
    open && days.length > 0 && menuRect ? (
      <ul
        ref={menuRef}
        className="fixed z-[200] max-h-60 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width }}
        role="listbox"
      >
        {days.map((day) => {
          const itemLabel = formatStandingsDayLabel(day);
          const selected = day === value;
          return (
            <li key={day} role="none">
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={`w-full px-3 py-2 text-left text-sm ${
                  selected ? 'bg-blue-100 font-medium text-blue-900' : 'text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => {
                  onChange(day);
                  setOpen(false);
                }}
              >
                {itemLabel}
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div className="relative inline-block text-left" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || days.length === 0}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex w-full min-w-[7rem] items-center justify-between gap-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 ${buttonClassName ?? ''}`}
        aria-label="Standings day"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={testId}
      >
        <span className="truncate tabular-nums">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {menuList ? createPortal(menuList, document.body) : null}
    </div>
  );
}

interface StandingsTableProps {
  /** Daily/Live mode control rendered in the header row with the title and day selector. */
  viewModeToggle?: ReactNode;
  /**
   * `daily` — Google Sheet tabs + CSV (`/api/standings`).
   * `live` — same table UI; KEY-sourced metadata + scoring (`/api/live-standings`).
   */
  variant?: 'daily' | 'live';
}

export default function StandingsTable({ viewModeToggle, variant = 'daily' }: StandingsTableProps) {
  const [standingsData, setStandingsData] = useState<StandingsData | null>(null);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [displayDay, setDisplayDay] = useState<string>(''); // Separate state for immediate dropdown update
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [standingsYear, setStandingsYear] = useState<string>('2026'); // Default fallback
  const [teamCache, setTeamCache] = useState<Map<string, { id: string; name: string }>>(globalTeamCache);
  const [bracketViewerOpen, setBracketViewerOpen] = useState(false);
  const [bracketViewerId, setBracketViewerId] = useState<string | null>(null);
  const [bracketViewerTitle, setBracketViewerTitle] = useState('');
  const [resolvingBracketFor, setResolvingBracketFor] = useState<string | null>(null);
  const [liveAvailable, setLiveAvailable] = useState(true);

  const standingsYearNum = useMemo(() => {
    const n = parseInt(standingsYear, 10);
    return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : 2026;
  }, [standingsYear]);

  /** Pts behind the leader (all entries tied on max points show "-"). */
  const calculatePointsBack = (entry: StandingsEntry, allEntries: StandingsEntry[]): string => {
    if (allEntries.length === 0) return '-';
    const maxPoints = Math.max(...allEntries.map((e) => e.points));
    if (entry.points >= maxPoints) return '-';
    return `-${maxPoints - entry.points}`;
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
      } catch {
        // Error loading standings year - keep default fallback
        // Keep the default fallback value
      }
    };
    loadStandingsYear();
  }, []);

  // Load available days on component mount (daily only)
  useEffect(() => {
    if (variant !== 'daily') return;
    const loadDays = async () => {
      try {
        const response = await fetch('/api/standings/days', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to load standings day options');
        }
        const days = result.data as string[];
        setAvailableDays(days);
        // Set default to the most recent day (first in the array)
        if (days.length > 0 && !selectedDay) {
          setSelectedDay(days[0]);
          setDisplayDay(days[0]); // Also set display day
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load standings configuration';
        setError(message);
        setLoading(false);
      }
    };
    loadDays();
  }, [variant, selectedDay]);

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

  // Load standings data when selectedDay changes (daily only)
  useEffect(() => {
    if (variant !== 'daily' || !selectedDay) return;

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
        const response = await fetch(`/api/standings?day=${encodeURIComponent(selectedDay)}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to load standings data');
        }
        const data = result.data as StandingsData;
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
  }, [variant, selectedDay]); // Run whenever selectedDay changes

  // Optimized preload function that uses pre-fetched team reference data
  const preloadTeamDataWithRef = (data: StandingsData, teamRefData: { abbr: string; id: string }[]) => {
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

  // Live standings: full StandingsData from KEY snapshot (live only)
  useEffect(() => {
    if (variant !== 'live') return;
    let cancelled = false;
    const loadLive = async () => {
      setLoading(true);
      setError(null);
      setLiveAvailable(true);
      setStandingsData(null);
      try {
        let teamRefData: { abbr: string; id: string }[] = [];
        try {
          teamRefData = await getTeamRefData();
        } catch {
          /* non-fatal */
        }
        const response = await fetch(`/api/live-standings?year=${standingsYearNum}`, { cache: 'no-store' });
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to load live standings');
        }
        if (!result.available) {
          setLiveAvailable(false);
          setStandingsData(null);
          setLoading(false);
          return;
        }
        const data = result.standingsData as StandingsData;
        if (teamRefData.length > 0) {
          preloadTeamDataWithRef(data, teamRefData);
        }
        setStandingsData(data);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Failed to load live standings');
          setStandingsData(null);
          setLoading(false);
        }
      }
    };
    void loadLive();
    return () => {
      cancelled = true;
    };
  }, [variant, standingsYearNum]);

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

  /** Sheet columns E–H = TL, BL, TR, BR; grid reads TL, TR / BL, BR. */
  const FINAL_FOUR_GRID_SHEET_INDICES = [0, 2, 1, 3] as const;

  const renderFinalFour = (finalFour: string[], finals: string[], standingsData: StandingsData) => {
    const keyRow: RegionalChampionKeyRow = standingsData.regionalChampionKey ?? ['', '', '', ''];
    const eliminated = standingsData.eliminatedTeams || [];
    const iKey = standingsData.semifinalKey?.[0]?.trim() ?? '';
    const jKey = standingsData.semifinalKey?.[1]?.trim() ?? '';
    const finalsLeft = finals[0]?.trim() ?? '';
    const finalsRight = finals[1]?.trim() ?? '';

    return (
      <div
        className="grid w-fit grid-cols-2 gap-1 rounded border border-gray-200 bg-gray-50 p-1"
        data-testid={variant === 'live' ? 'standings-live-final-four-grid' : 'standings-daily-final-four-grid'}
      >
        {FINAL_FOUR_GRID_SHEET_INDICES.map((sheetIndex, displayIndex) => {
          const team = finalFour[sheetIndex]?.trim() ?? '';
          const actualRegional = keyRow[sheetIndex] ?? '';
          const shade = getRegionalChampionSquareShade(team, actualRegional, eliminated);
          const isFinalistPick =
            team !== '' && (team === finalsLeft || team === finalsRight);
          const keyCellForFinalist = team === finalsLeft ? iKey : jKey;
          const borderTone = isFinalistPick
            ? getFinalistBorderTone(team, keyCellForFinalist, eliminated)
            : undefined;

          if (!team) {
            return (
              <div
                key={`ff-empty-${displayIndex}`}
                className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-gray-200 bg-white"
                aria-hidden
              />
            );
          }

          return (
            <div key={`${team}-${sheetIndex}`} title={team} className="cursor-help">
              <TeamLogo
                teamName={team}
                size={24}
                teamCache={teamCache}
                backgroundColor={shade}
                borderColor={isFinalistPick ? borderTone : undefined}
                heavyRing={isFinalistPick}
                className="relative"
                teamIndex={sheetIndex + 1}
              />
            </div>
          );
        })}
      </div>
    );
  };


  const renderChampion = (champion: string, standingsData: StandingsData) => {
    const { shade, borderTone } = getChampionDisplayColors(
      champion,
      standingsData.finalWinner || '',
      standingsData.eliminatedTeams || []
    );

    return (
      <div className="flex flex-col items-center" title={champion}>
        <div className="cursor-help">
          <TeamLogo
            teamName={champion}
            size={60}
            teamCache={teamCache}
            backgroundColor={shade}
            borderColor={borderTone}
            heavyRing={borderTone !== undefined}
            className="rounded"
            teamIndex={undefined}
          />
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

  const openBracketForPlayerLabel = async (playerLabel: string) => {
    const q = playerLabel.trim();
    if (!q) return;

    if (variant === 'live' && standingsData) {
      const row = standingsData.entries.find((e) => e.player === q);
      if (row?.bracketId) {
        setBracketViewerId(row.bracketId);
        setBracketViewerTitle(q);
        setBracketViewerOpen(true);
        return;
      }
    }

    setResolvingBracketFor(q);
    try {
      const res = await fetch(
        `/api/standings/resolve-bracket?year=${standingsYearNum}&q=${encodeURIComponent(q)}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!res.ok || !json.success || !json.data?.bracketId) {
        alert(json.error || 'Could not open a unique bracket for this row.');
        return;
      }
      setBracketViewerId(String(json.data.bracketId));
      setBracketViewerTitle(q);
      setBracketViewerOpen(true);
    } catch {
      alert('Could not load bracket.');
    } finally {
      setResolvingBracketFor(null);
    }
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

  if (variant === 'live' && !liveAvailable) {
    return (
      <div
        className="flex min-h-[40vh] flex-col items-center justify-center border-t border-gray-100 bg-white px-6 py-16 text-center shadow-lg"
        data-testid="live-standings-unavailable"
      >
        <p className="text-lg font-semibold text-gray-800">Live Standings Not Available</p>
      </div>
    );
  }

  return (
    <>
    <BracketViewerModal
      isOpen={bracketViewerOpen}
      onClose={() => {
        setBracketViewerOpen(false);
        setBracketViewerId(null);
        setBracketViewerTitle('');
      }}
      bracketId={bracketViewerId}
      year={standingsYearNum}
      title={bracketViewerTitle || undefined}
    />
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header with controls */}
      <div className="border-b border-gray-200 p-6">
        <h2 className="sr-only">
          {standingsYear} {variant === 'live' ? 'live' : 'daily'} standings
        </h2>
        {/* Mobile: row1 = year + day + toggle; row2 = search */}
        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-gray-900 tabular-nums">{standingsYear}</span>
              <div className="flex items-center gap-2">
                {variant === 'daily' ? (
                  <StandingsDayPicker
                    value={displayDay}
                    days={availableDays}
                    onChange={handleDayChange}
                    buttonClassName="max-w-[10rem] sm:max-w-none"
                    data-testid="standings-daily-day-picker-mobile"
                  />
                ) : null}
                {loading ? (
                  <div className="flex items-center text-blue-600">
                    <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    <span className="ml-1 text-xs sm:text-sm">Refreshing…</span>
                  </div>
                ) : null}
              </div>
            </div>
            {viewModeToggle ? <div className="flex shrink-0 items-center">{viewModeToggle}</div> : null}
          </div>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {/* Desktop: left search | centered year + day | right toggle */}
        <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
          <div className="relative max-w-md justify-self-start">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-center gap-3 justify-self-center">
            <span className="text-lg font-semibold text-gray-900 tabular-nums">{standingsYear}</span>
            <div className="flex items-center gap-2">
              {variant === 'daily' ? (
                <StandingsDayPicker
                  value={displayDay}
                  days={availableDays}
                  onChange={handleDayChange}
                  data-testid="standings-daily-day-picker-desktop"
                />
              ) : null}
              {loading ? (
                <div className="flex items-center text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                  <span className="ml-1 text-sm">Refreshing…</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="justify-self-end">{viewModeToggle ? <div className="flex justify-end">{viewModeToggle}</div> : null}</div>
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
              <th
                className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300"
                style={{ minWidth: '56px', width: '56px' }}
              >
                <div className="flex flex-col items-center gap-0.5 leading-tight">
                  <span>Pts</span>
                  <span className="text-[10px] font-normal normal-case italic tracking-normal text-gray-500">
                    back
                  </span>
                  <span className="text-[10px] font-normal normal-case italic tracking-normal text-gray-500">
                    TB
                  </span>
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
                    <button
                      type="button"
                      onClick={() => void openBracketForPlayerLabel(entry.player)}
                      disabled={resolvingBracketFor === entry.player}
                      className="cursor-pointer text-left text-xs font-medium leading-tight text-blue-700 break-words underline decoration-blue-400 underline-offset-2 hover:text-blue-900 disabled:cursor-wait disabled:opacity-60 sm:text-sm md:text-base"
                      style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                      title="View submitted bracket"
                      data-testid={`standings-daily-player-bracket-link-${index}`}
                    >
                      {entry.player}
                    </button>
                    {entry.paid && (
                      <div className="flex items-center">
                        <span className="text-green-600 font-bold text-sm">$</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 border-r border-gray-300 align-top" style={{ minWidth: '56px', width: '56px' }}>
                  <div className="flex flex-col items-center gap-0.5 text-center leading-tight">
                    <div className="whitespace-nowrap text-sm font-bold text-blue-600 tabular-nums">{entry.points}</div>
                    <div className="whitespace-nowrap text-xs text-gray-500 tabular-nums">
                      {calculatePointsBack(entry, standingsData.entries)}
                    </div>
                    <div
                      className="whitespace-nowrap text-xs text-gray-600 tabular-nums"
                      data-testid={`standings-daily-tb-row-${index}`}
                    >
                      {formatStandingsTieBreakerDisplay(entry, standingsData)}
                    </div>
                  </div>
                </td>
                <td
                  className="align-top px-2 py-1 border-r border-gray-300"
                  style={{ width: '80px', minWidth: '80px' }}
                >
                  {renderFinalFour(entry.finalFour, entry.finals, standingsData)}
                </td>
                <td className="align-top px-3 py-1 w-18">
                  {renderChampion(entry.champion, standingsData)}
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
    </>
  );
}
