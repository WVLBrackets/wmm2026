'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Pencil } from 'lucide-react';
import KeyBracketPreviewModal from '@/components/admin/KeyBracketPreviewModal';

interface BracketSummary {
  year?: number;
}

interface LiveResultsTabProps {
  brackets: BracketSummary[];
}

export default function LiveResultsTab({ brackets }: LiveResultsTabProps) {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [showBracketPreview, setShowBracketPreview] = useState(false);
  const [tournamentYear, setTournamentYear] = useState<string>('');
  /** Bump to remount embedded read-only preview after closing the edit modal so picks stay in sync. */
  const [embeddedPreviewKey, setEmbeddedPreviewKey] = useState(0);

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

  const handleCloseEditModal = () => {
    setShowBracketPreview(false);
    setEmbeddedPreviewKey((k) => k + 1);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <KeyRound className="h-5 w-5 text-blue-600" />
        <h3 className="text-xl font-semibold text-gray-900">Key</h3>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Edit the KEY bracket in the full-canvas modal. Changes auto-save. The preview below updates when you close the
        modal.
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

        <button
          type="button"
          onClick={() => setShowBracketPreview(true)}
          disabled={!selectedYear}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !selectedYear
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
          data-testid="key-live-results-edit-button"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </button>
      </div>

      {selectedYear && (
        <KeyBracketPreviewModal
          key={`embedded-${selectedYear}-${embeddedPreviewKey}`}
          isOpen
          year={selectedYear}
          onClose={() => {}}
          embedded
          readOnly
        />
      )}

      <KeyBracketPreviewModal
        isOpen={showBracketPreview}
        year={selectedYear}
        onClose={handleCloseEditModal}
      />
    </div>
  );
}
