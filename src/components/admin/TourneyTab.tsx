'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Upload } from 'lucide-react';
import TourneyR1BracketPreview from '@/components/admin/TourneyR1BracketPreview';
import FirstFourResults from '@/components/admin/FirstFourResults';
import { getCSRFHeaders } from '@/hooks/useCSRF';
import { canonicalTournament, validateTournamentDefinition } from '@/lib/tournamentDefinition';
import type { TournamentData } from '@/types/tournament';

interface TournamentFilesResponse {
  success: boolean;
  files?: string[];
  error?: string;
}

/**
 * Admin tab for selecting, importing, and editing tournament bracket JSON by year.
 */
export default function TourneyTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [configuredYear, setConfiguredYear] = useState<string>('');
  const [previewKey, setPreviewKey] = useState(0);

  /**
   * After Tournament Builder publish, show confirmation and refresh the R1 preview.
   */
  useEffect(() => {
    if (!searchParams) return;
    const published = searchParams.get('published')?.trim() ?? '';
    if (!/^20\d{2}$/.test(published)) return;
    const env = searchParams.get('env')?.trim() || 'this environment';
    setStatusMessage(`Tournament ${published} published to ${env}.`);
    setSelectedYear(published);
    setPreviewKey((k) => k + 1);
    const next = new URLSearchParams(searchParams.toString());
    next.delete('published');
    next.delete('env');
    const qs = next.toString();
    router.replace(qs ? `/admin?${qs}` : '/admin?tab=tourney', { scroll: false });
  }, [searchParams, router]);

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
        const publishedYear = searchParams?.get('published')?.trim() ?? '';
        if (/^20\d{2}$/.test(publishedYear)) {
          setSelectedYear(publishedYear);
        } else if (configYear) {
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
    // Intentionally once on mount; published year is read from the URL at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Import a tournament JSON file into this environment’s workspace for the selected year.
   */
  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedYear) return;

    setImporting(true);
    setError(null);
    setStatusMessage(null);

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error('File is not valid JSON.');
      }
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid tournament JSON.');
      }

      const raw = parsed as TournamentData;
      if (raw.year && String(raw.year) !== selectedYear) {
        const proceed = window.confirm(
          `File year is ${raw.year}. Import into the selected year ${selectedYear}?`
        );
        if (!proceed) return;
      }

      const definition = { ...raw, year: selectedYear };
      const draftIssues = validateTournamentDefinition(definition, false);
      if (draftIssues.length) {
        throw new Error(draftIssues.join(' '));
      }

      const publishIssues = validateTournamentDefinition(definition, true);
      let action: 'draft' | 'publish' = 'draft';
      if (publishIssues.length === 0) {
        const publish = window.confirm(
          `Import and publish tournament ${selectedYear} to this environment?\n\nOK = publish\nCancel = save as draft only`
        );
        action = publish ? 'publish' : 'draft';
      } else {
        const saveDraft = window.confirm(
          `JSON is incomplete for publishing (${publishIssues[0]}).\n\nSave as draft for ${selectedYear}?`
        );
        if (!saveDraft) return;
      }

      const workspaceRes = await fetch(`/api/admin/tournament-builder?year=${selectedYear}`, {
        cache: 'no-store',
      });
      const workspace = await workspaceRes.json();
      if (!workspaceRes.ok) {
        throw new Error(workspace.error || 'Could not load tournament workspace.');
      }
      if (workspace.readOnly) {
        throw new Error(`Year ${selectedYear} is read-only and cannot be imported.`);
      }

      const canonical = canonicalTournament(definition);
      const saveRes = await fetch('/api/admin/tournament-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({
          action,
          definition: canonical,
          revision: workspace.revision,
        }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveJson.error || 'Import failed.');
      }

      setPreviewKey((key) => key + 1);
      setStatusMessage(
        action === 'publish'
          ? `Imported and published tournament ${selectedYear}.`
          : `Imported draft for ${selectedYear}. Open Edit Bracket to finish and publish.`
      );
    } catch (importError) {
      console.error('Tournament import failed:', importError);
      setError(importError instanceof Error ? importError.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
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
          Build and publish a tournament directly to this environment. Historical JSON remains unchanged.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
          {statusMessage}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Year</label>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 min-w-[200px]"
            data-testid="tourney-year-select"
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
          type="button"
          onClick={handleEditBracket}
          disabled={!selectedYear || importing}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !selectedYear || importing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
          data-testid="tourney-edit-bracket"
        >
          <Pencil className="h-4 w-4" />
          Edit Bracket
        </button>

        <button
          type="button"
          onClick={() => importFileInputRef.current?.click()}
          disabled={!selectedYear || importing}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !selectedYear || importing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
          title="Import tournament JSON into this environment’s workspace"
          data-testid="tourney-import-json"
        >
          <Upload className="h-4 w-4" />
          {importing ? 'Importing…' : 'Import'}
        </button>
        <input
          ref={importFileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => void handleImportJson(event)}
          data-testid="tourney-import-file-input"
        />
      </div>

      {selectedYear && (
        <p className={`mt-3 text-xs ${fileExists ? 'text-green-700' : 'text-amber-700'}`}>
          {fileExists
            ? `A definition or legacy JSON exists for ${selectedYear}.`
            : `Create a new tournament for ${selectedYear} in the builder, or Import a JSON file.`}
        </p>
      )}

      {selectedYear && <TourneyR1BracketPreview key={`${selectedYear}-${previewKey}`} year={selectedYear} />}
      {selectedYear && <FirstFourResults key={`ff-${selectedYear}-${previewKey}`} year={selectedYear} />}
    </div>
  );
}
