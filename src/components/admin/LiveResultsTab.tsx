'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Play, Loader2, Eye } from 'lucide-react';
import KeyBracketPreviewModal from '@/components/admin/KeyBracketPreviewModal';

interface BracketSummary {
  year?: number;
}

interface LiveResultsTabProps {
  brackets: BracketSummary[];
}

export default function LiveResultsTab({ brackets }: LiveResultsTabProps) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [opening, setOpening] = useState(false);
  const [showBracketPreview, setShowBracketPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tournamentYear, setTournamentYear] = useState<string>('');

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    brackets.forEach((bracket) => {
      if (typeof bracket.year === 'number') {
        years.add(bracket.year);
      }
    });
    if (tournamentYear && !isNaN(Number(tournamentYear))) {
      years.add(Number(tournamentYear));
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [brackets, tournamentYear]);

  useEffect(() => {
    const loadTournamentYear = async () => {
      try {
        const response = await fetch('/api/site-config');
        const data = await response.json();
        if (data.success && data.data?.tournamentYear) {
          const year = data.data.tournamentYear as string;
          setTournamentYear(year);
          setSelectedYear(year);
          return;
        }
      } catch (fetchError) {
        console.error('Error loading tournament year for live results:', fetchError);
      }

      if (availableYears.length > 0) {
        setSelectedYear(String(availableYears[0]));
      }
    };
    loadTournamentYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenLiveResults = async () => {
    if (!selectedYear) return;

    setOpening(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/live-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: Number(selectedYear) }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to open Live Results.');
        return;
      }

      const bracketId = result.data?.bracketId;
      if (!bracketId) {
        setError('Live Results session started, but no bracket ID was returned.');
        return;
      }

      router.push(`/bracket?edit=${bracketId}&admin=true&live=true&year=${selectedYear}`);
    } catch (requestError) {
      console.error('Error opening Live Results:', requestError);
      setError('Failed to open Live Results.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <KeyRound className="h-5 w-5 text-blue-600" />
        <h3 className="text-xl font-semibold text-gray-900">Key</h3>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Open and edit the KEY bracket for the selected tournament year. Only one admin can edit at a time.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tournament Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 min-w-[180px]"
          >
            {availableYears.length === 0 ? (
              <option value="">No years found</option>
            ) : (
              availableYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenLiveResults}
            disabled={opening || !selectedYear}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              opening || !selectedYear
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {opening ? 'Opening...' : 'Open Key'}
          </button>

          <button
            onClick={() => setShowBracketPreview(true)}
            disabled={!selectedYear}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !selectedYear
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            <Eye className="h-4 w-4" />
            Show Bracket
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <KeyBracketPreviewModal
        isOpen={showBracketPreview}
        year={selectedYear}
        onClose={() => setShowBracketPreview(false)}
      />
    </div>
  );
}
