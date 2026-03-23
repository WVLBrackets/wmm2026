'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Trophy, Medal, RefreshCw } from 'lucide-react';

export interface LiveStandingsApiEntry {
  bracketId: string;
  entryName: string;
  userName: string;
  userEmail: string;
  points: number;
  rank: number;
}

interface LiveStandingsPanelProps {
  standingsYear: number;
}

/**
 * Renders cached live standings from `/api/live-standings` (recomputed when KEY is saved).
 */
export default function LiveStandingsPanel({ standingsYear }: LiveStandingsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [entries, setEntries] = useState<LiveStandingsApiEntry[]>([]);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/live-standings?year=${standingsYear}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to load');
      }
      setAvailable(Boolean(json.available));
      setEntries(Array.isArray(json.entries) ? json.entries : []);
      setComputedAt(typeof json.computedAt === 'string' ? json.computedAt : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load live standings');
      setAvailable(false);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [standingsYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (row) =>
        row.entryName.toLowerCase().includes(q) ||
        row.userName.toLowerCase().includes(q) ||
        row.userEmail.toLowerCase().includes(q)
    );
  }, [entries, searchTerm]);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" aria-hidden />;
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" aria-hidden />;
    if (rank === 3) return <Medal className="h-4 w-4 text-orange-500" aria-hidden />;
    return <span className="text-xs font-medium text-gray-600">{rank}</span>;
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center border-t border-gray-100 px-6 py-12">
        <RefreshCw className="mb-3 h-8 w-8 animate-spin text-blue-600" aria-hidden />
        <p className="text-sm text-gray-600">Loading live standings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-gray-100 px-6 py-12 text-center text-red-600">
        <p className="font-medium">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!available) {
    return (
      <div
        className="flex min-h-[40vh] flex-col items-center justify-center border-t border-gray-100 px-6 py-16 text-center"
        data-testid="live-standings-unavailable"
      >
        <p className="text-lg font-semibold text-gray-800">Live Standings Not Available</p>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-gray-200 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:max-w-xs sm:ml-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search entry, name, or email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="w-14 px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Entry
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Player
              </th>
              <th className="w-24 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Pts
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                  No entries match your search.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.bracketId} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-2 py-3">
                    <div className="flex items-center justify-center">{rankIcon(row.rank)}</div>
                  </td>
                  <td className="max-w-[10rem] px-4 py-3 text-sm font-medium text-gray-900 break-words">
                    {row.entryName}
                  </td>
                  <td className="min-w-0 px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{row.userName}</div>
                    <div className="truncate text-xs text-gray-500" title={row.userEmail}>
                      {row.userEmail}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-blue-600">
                    {row.points}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-500">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {computedAt ? (
              <>Snapshot computed: {new Date(computedAt).toLocaleString()}</>
            ) : (
              <>Live standings</>
            )}
          </span>
          <span>
            Showing {filtered.length} of {entries.length} entries
          </span>
        </div>
      </div>
    </>
  );
}
