'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import TourneyR1BracketPreview from '@/components/admin/TourneyR1BracketPreview';

interface TournamentFilesResponse {
  success: boolean;
  files?: string[];
  error?: string;
}

/**
 * Admin tab for selecting and editing tournament bracket JSON by year.
 */
export default function TourneyTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [configuredYear, setConfiguredYear] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [filesRes, configRes] = await Promise.all([
          fetch('/api/admin/tournament-files'),
          fetch('/api/site-config'),
        ]);

        const filesData = (await filesRes.json()) as TournamentFilesResponse;
        const configData = await configRes.json();

        if (!filesRes.ok || !filesData.success) {
          throw new Error(filesData.error || 'Failed to load tournament files');
        }

        const files = filesData.files ?? [];
        setAvailableFiles(files);

        const configYear = String(configData?.data?.tournamentYear || '').trim();
        setConfiguredYear(configYear);

        const yearsFromFiles = files
          .map((file) => file.match(/^tournament-(\d{4})\.json$/)?.[1] ?? '')
          .filter((year) => year !== '');

        const uniqueYears = Array.from(new Set(yearsFromFiles)).sort((a, b) => Number(b) - Number(a));
        if (configYear) {
          setSelectedYear(configYear);
        } else if (uniqueYears.length > 0) {
          setSelectedYear(uniqueYears[0]);
        }
      } catch (loadError) {
        console.error('Error loading tournament tab data:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load tournament data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const years = useMemo(() => {
    const fromFiles = availableFiles
      .map((file) => file.match(/^tournament-(\d{4})\.json$/)?.[1] ?? '')
      .filter((year) => year !== '');
    const allYears = configuredYear ? [...fromFiles, configuredYear] : fromFiles;
    return Array.from(new Set(allYears)).sort((a, b) => Number(b) - Number(a));
  }, [availableFiles, configuredYear]);

  const selectedFile = selectedYear ? `tournament-${selectedYear}.json` : '';
  const fileExists = selectedFile ? availableFiles.includes(selectedFile) : false;

  const handleEditBracket = () => {
    if (!selectedYear) return;
    const params = new URLSearchParams({
      year: selectedYear,
      file: selectedFile,
    });
    router.push(`/admin/tournament-builder?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <p className="text-sm text-gray-600">Loading tournament JSON tools...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-900">Tourney</h3>
        <p className="text-sm text-gray-600 mt-1">
          Select a tournament year and edit its bracket JSON in Tournament Builder.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Year</label>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 min-w-[200px]"
          >
            {years.length === 0 ? (
              <option value="">No years found</option>
            ) : (
              years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))
            )}
          </select>
        </div>

        <button
          onClick={handleEditBracket}
          disabled={!selectedYear}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !selectedYear ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          <Pencil className="h-4 w-4" />
          Edit Bracket
        </button>
      </div>

      {selectedYear && (
        <p className={`mt-3 text-xs ${fileExists ? 'text-green-700' : 'text-amber-700'}`}>
          {fileExists
            ? `Editing existing file: ${selectedFile}`
            : `${selectedFile} not found yet. Builder will open with year ${selectedYear} to create/update it.`}
        </p>
      )}

      {selectedYear && <TourneyR1BracketPreview year={selectedYear} />}
    </div>
  );
}

