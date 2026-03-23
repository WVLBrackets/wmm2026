'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { getCSRFHeaders } from '@/hooks/useCSRF';

export interface ImportPreviewData {
  totalRows: number;
  successRows: number;
  failedRows: number;
  failures: Array<{ rowNumber: number; bracketId: string; uuid: string; reason: string }>;
}

interface BracketImportContextValue {
  isImporting: boolean;
  importYear: string;
  setImportYear: React.Dispatch<React.SetStateAction<string>>;
  importFile: File | null;
  previewImportYear: string | null;
  importPreview: ImportPreviewData | null;
  importMessage: string | null;
  handleFileSelected: (file: File) => void;
  handlePreviewImport: (file: File) => Promise<void>;
  handleCommitImport: () => Promise<void>;
  handleClearImport: () => void;
}

const BracketImportContext = createContext<BracketImportContextValue | null>(null);

function useBracketImportContext(): BracketImportContextValue {
  const ctx = useContext(BracketImportContext);
  if (!ctx) {
    throw new Error('Bracket import components must be used within BracketImportProvider');
  }
  return ctx;
}

interface BracketImportProviderProps {
  children: React.ReactNode;
  tournamentYear: string;
  onReload: (options?: { silent?: boolean }) => Promise<void>;
}

/**
 * Download the import error report CSV when failures exist.
 */
function downloadImportErrorReport(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Provides bracket CSV import state and actions for toolbar + summary UI.
 */
export function BracketImportProvider({ children, tournamentYear, onReload }: BracketImportProviderProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importYear, setImportYear] = useState<string>(() => new Date().getFullYear().toString());
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewImportYear, setPreviewImportYear] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    if (tournamentYear) {
      setImportYear(tournamentYear);
    }
  }, [tournamentYear]);

  const handlePreviewImport = useCallback(async (file: File) => {
    setIsImporting(true);
    setImportMessage(null);
    setImportPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', 'true');
      formData.append('importYear', importYear);
      const csrfHeaders = await getCSRFHeaders();

      const response = await fetch('/api/admin/brackets/import', {
        method: 'POST',
        headers: csrfHeaders,
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to preview import');
      }

      setImportPreview(result.data);
      setPreviewImportYear(importYear);
      setImportMessage(
        `Preview complete for ${importYear}: ${result.data.successRows} rows ready to import, ${result.data.failedRows} rows will fail.`
      );
    } catch (error) {
      console.error('Error previewing bracket import:', error);
      setImportMessage(error instanceof Error ? error.message : 'Failed to preview import');
    } finally {
      setIsImporting(false);
    }
  }, [importYear]);

  const handleCommitImport = useCallback(async () => {
    if (!importFile) return;
    if (previewImportYear !== importYear) {
      setImportMessage('Import Year changed after preview. Re-run preview before confirming import.');
      return;
    }
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('dryRun', 'false');
      formData.append('importYear', importYear);
      const csrfHeaders = await getCSRFHeaders();

      const response = await fetch('/api/admin/brackets/import', {
        method: 'POST',
        headers: csrfHeaders,
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to import brackets');
      }

      setImportPreview(result.data);
      setPreviewImportYear(importYear);
      setImportMessage(
        `Import complete for ${importYear}: ${result.data.successRows} imported, ${result.data.failedRows} failed.`
      );

      if (result.data.errorReportCsv && result.data.failedRows > 0) {
        downloadImportErrorReport(
          result.data.errorReportCsv,
          result.data.errorReportFilename || 'brackets-import-errors.csv'
        );
      }

      await onReload();
    } catch (error) {
      console.error('Error importing brackets:', error);
      setImportMessage(error instanceof Error ? error.message : 'Failed to import brackets');
    } finally {
      setIsImporting(false);
    }
  }, [importFile, previewImportYear, importYear, onReload]);

  const handleClearImport = useCallback(() => {
    setImportFile(null);
    setImportPreview(null);
    setImportMessage(null);
    setPreviewImportYear(null);
  }, []);

  const handleFileSelected = useCallback(
    (file: File) => {
      setImportFile(file);
      setPreviewImportYear(null);
      void handlePreviewImport(file);
    },
    [handlePreviewImport]
  );

  const value = useMemo<BracketImportContextValue>(
    () => ({
      isImporting,
      importYear,
      setImportYear,
      importFile,
      previewImportYear,
      importPreview,
      importMessage,
      handleFileSelected,
      handlePreviewImport,
      handleCommitImport,
      handleClearImport,
    }),
    [
      isImporting,
      importYear,
      importFile,
      previewImportYear,
      importPreview,
      importMessage,
      handleFileSelected,
      handlePreviewImport,
      handleCommitImport,
      handleClearImport,
    ]
  );

  return <BracketImportContext.Provider value={value}>{children}</BracketImportContext.Provider>;
}

/**
 * File picker control for the Brackets tab toolbar (Import Brackets).
 */
export function BracketImportToolbarButton() {
  const { isImporting, handleFileSelected } = useBracketImportContext();

  return (
    <label
      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer ${
        isImporting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
      }`}
      title="Import brackets from exported CSV format"
    >
      <Upload className="w-4 h-4" />
      Import Brackets
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={isImporting}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          handleFileSelected(file);
          event.target.value = '';
        }}
      />
    </label>
  );
}

/**
 * Preview / commit / clear UI shown below the toolbar when an import is active.
 */
export function BracketImportSummary() {
  const {
    isImporting,
    importYear,
    setImportYear,
    importFile,
    previewImportYear,
    importPreview,
    importMessage,
    handlePreviewImport,
    handleCommitImport,
    handleClearImport,
  } = useBracketImportContext();

  const showPanel = isImporting || importMessage || importPreview || importFile;
  const showSpinner = isImporting || (importFile && !importPreview && !importMessage);
  if (!showPanel) {
    return null;
  }

  return (
    <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
      {showSpinner && (
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" aria-hidden />
            <span>{importPreview && isImporting ? 'Importing...' : 'Evaluating import...'}</span>
          </div>
          {showSpinner && !importPreview && (
            <button
              type="button"
              onClick={handleClearImport}
              disabled={isImporting}
              className="px-3 py-1.5 rounded text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cancel"
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {importMessage && !isImporting && <p className="text-sm text-gray-800 mb-2">{importMessage}</p>}
      {importPreview && (
        <>
          <p className="text-sm text-gray-700">
            Total rows: <span className="font-semibold">{importPreview.totalRows}</span> | Ready/Imported:{' '}
            <span className="font-semibold text-green-700">{importPreview.successRows}</span> | Failed:{' '}
            <span className="font-semibold text-red-700">{importPreview.failedRows}</span>
          </p>
          {importPreview.failures.length > 0 && (
            <div className="mt-3 max-h-40 overflow-auto bg-white border border-gray-200 rounded p-2 text-xs text-gray-700">
              {importPreview.failures.slice(0, 25).map((failure) => (
                <div key={`${failure.rowNumber}-${failure.uuid}`} className="py-0.5">
                  Row {failure.rowNumber} ({failure.bracketId || failure.uuid}): {failure.reason}
                </div>
              ))}
              {importPreview.failures.length > 25 && (
                <div className="pt-1 text-gray-500">...and {importPreview.failures.length - 25} more</div>
              )}
            </div>
          )}
          {importFile && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-2 border border-gray-300 rounded px-2 py-1 bg-white">
                <span className="text-xs text-gray-600">Import Year</span>
                <button
                  type="button"
                  onClick={() =>
                    setImportYear((previous) =>
                      String(Math.max(2000, Number(previous || new Date().getFullYear()) - 1))
                    )
                  }
                  disabled={isImporting}
                  className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  title="Previous year"
                >
                  -
                </button>
                <span className="text-sm font-semibold text-gray-900 min-w-[52px] text-center">{importYear}</span>
                <button
                  type="button"
                  onClick={() =>
                    setImportYear((previous) =>
                      String(Math.min(9999, Number(previous || new Date().getFullYear()) + 1))
                    )
                  }
                  disabled={isImporting}
                  className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  title="Next year"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => importFile && void handlePreviewImport(importFile)}
                disabled={isImporting || !importFile}
                className="px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Re-run preview for selected year"
              >
                Re-run Preview
              </button>
              <button
                type="button"
                onClick={() => void handleCommitImport()}
                disabled={isImporting || importPreview.successRows === 0 || previewImportYear !== importYear}
                className={`px-3 py-1.5 rounded text-sm font-medium ${
                  isImporting || importPreview.successRows === 0 || previewImportYear !== importYear
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isImporting ? 'Importing...' : 'Confirm Import'}
              </button>
              <button
                type="button"
                onClick={handleClearImport}
                disabled={isImporting}
                className="px-3 py-1.5 rounded text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                title="Cancel and close import"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
