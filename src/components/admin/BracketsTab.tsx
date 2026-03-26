'use client';

import { Fragment, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  Download,
  RefreshCw,
  Search,
  LayoutGrid,
  CheckCircle,
  Clock,
  FunnelX,
  X,
} from 'lucide-react';
import { useBracketFilters } from '@/hooks/useBracketFilters';
import BracketTableRow from '@/components/admin/BracketTableRow';
import UserFilterCombobox from '@/components/admin/UserFilterCombobox';
import {
  BracketImportProvider,
  BracketImportSummary,
  BracketImportToolbarButton,
} from '@/components/admin/BracketImportPanel';

interface User {
  id: string;
  email: string;
  name: string;
}

interface Bracket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  entryName: string;
  tieBreaker?: number;
  status: string;
  source?: string;
  bracketNumber?: number;
  year?: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  picks: Record<string, string>;
  /** When true, row is the KEY bracket (excluded from normal admin list unless includeKey). */
  isKey?: boolean;
}

interface BracketsTabProps {
  users: User[];
  brackets: Bracket[];
  onReload: (options?: { silent?: boolean }) => Promise<void>;
}

interface EditForm {
  entryName?: string;
  tieBreaker?: number;
  status?: string;
  userId?: string;
}

interface EditFeedback {
  bracketId: string;
  type: 'success' | 'error';
  message: string;
}

export default function BracketsTab({ users, brackets, onReload }: BracketsTabProps) {
  const router = useRouter();
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterCreatedDate, setFilterCreatedDate] = useState<string>('');
  const [filterUpdatedDate, setFilterUpdatedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingBracket, setEditingBracket] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({});
  const [editFeedback, setEditFeedback] = useState<EditFeedback | null>(null);
  const [optimisticBracketUpdates, setOptimisticBracketUpdates] = useState<Record<string, Partial<Bracket>>>({});
  const [syncingBracketIds, setSyncingBracketIds] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [protectSubmitted, setProtectSubmitted] = useState<boolean>(true);
  const [pendingDeleteBracketId, setPendingDeleteBracketId] = useState<string | null>(null);
  const [deletingBracketId, setDeletingBracketId] = useState<string | null>(null);
  const [tournamentYear, setTournamentYear] = useState<string>('');
  const [permDeleteMessage, setPermDeleteMessage] = useState<string>(
    'Permanently delete this bracket? This cannot be undone.||Are you sure you want to continue?'
  );

  /** Bulk permanent delete: staged IDs after filters + optional protected submitted count */
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{
    bracketIds: string[];
    protectedSkipped: number;
  } | null>(null);
  const [bulkDeleteRunning, setBulkDeleteRunning] = useState(false);

  /** KEY scoring detail modal */
  const [liveScoreOpenForId, setLiveScoreOpenForId] = useState<string | null>(null);
  const [liveScoreLoading, setLiveScoreLoading] = useState(false);
  const [liveScoreError, setLiveScoreError] = useState<string | null>(null);
  const [liveScoreLines, setLiveScoreLines] = useState<string[]>([]);
  const [liveScoreTotal, setLiveScoreTotal] = useState<number | null>(null);
  const [liveScoreTitle, setLiveScoreTitle] = useState<string>('');

  // DB-level totals (all loaded brackets, ignoring UI filters)
  const dbTotalBrackets = brackets.length;
  const dbTotalSubmitted = brackets.filter((b) => b.status === 'submitted').length;
  const dbTotalInProgress = brackets.filter((b) => b.status === 'in_progress').length;
  const dbTotalDeleted = brackets.filter((b) => b.status === 'deleted').length;

  // Get available years from bracket data
  const availableYears = Array.from(
    new Set(brackets.map(b => b.year).filter(y => y !== undefined && y !== null))
  ).sort((a, b) => (b || 0) - (a || 0));

  // Load tournament year from config on mount
  useEffect(() => {
    const loadTournamentYear = async () => {
      try {
        const response = await fetch('/api/site-config');
        const data = await response.json();
        if (data.success && data.data) {
          const year = data.data.tournamentYear;
          if (year) {
            setTournamentYear(year);
            const yearNum = parseInt(year);
            if (availableYears.includes(yearNum)) {
              setFilterYear(year);
            }
          }
          if (typeof data.data.permDeleteMessage === 'string' && data.data.permDeleteMessage.trim()) {
            setPermDeleteMessage(data.data.permDeleteMessage.trim());
          }
        }
      } catch (error) {
        console.error('Error loading tournament year:', error);
      }
    };
    loadTournamentYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredBrackets = useBracketFilters({
    brackets,
    optimisticUpdates: optimisticBracketUpdates,
    filterUser,
    filterStatus,
    filterYear,
    filterCreatedDate,
    filterUpdatedDate,
    searchQuery,
  });

  /** Totals matching current filters (first number in each summary card). */
  const filteredTotalBrackets = filteredBrackets.length;
  const filteredSubmitted = filteredBrackets.filter((b) => b.status === 'submitted').length;
  const filteredInProgress = filteredBrackets.filter((b) => b.status === 'in_progress').length;
  const filteredDeleted = filteredBrackets.filter((b) => b.status === 'deleted').length;

  // Clear optimistic patches once server data catches up.
  useEffect(() => {
    setOptimisticBracketUpdates((previous) => {
      let changed = false;
      const next = { ...previous };

      Object.entries(previous).forEach(([bracketId, patch]) => {
        const serverBracket = brackets.find((bracket) => bracket.id === bracketId);
        if (!serverBracket) return;
        const isSynced = Object.entries(patch).every(([key, value]) => {
          return (serverBracket as unknown as Record<string, unknown>)[key] === value;
        });
        if (isSynced) {
          delete next[bracketId];
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [brackets]);

  const handleEdit = (bracket: Bracket) => {
    setEditFeedback(null);
    setEditingBracket(bracket.id);
    setEditForm({
      entryName: bracket.entryName,
      tieBreaker: bracket.tieBreaker,
      status: bracket.status,
      userId: bracket.userId,
    });
  };

  const handleEditPicks = (bracketId: string) => {
    router.push(`/bracket?edit=${bracketId}&admin=true`);
  };

  const handleOpenLiveScore = async (bracket: Bracket) => {
    if (bracket.isKey) return;
    setLiveScoreOpenForId(bracket.id);
    setLiveScoreTitle(bracket.entryName || 'Bracket');
    setLiveScoreLoading(true);
    setLiveScoreError(null);
    setLiveScoreLines([]);
    setLiveScoreTotal(null);
    try {
      const response = await fetch(`/api/admin/brackets/${bracket.id}/live-score-detail`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setLiveScoreError(data.error || 'Failed to load live score detail.');
        return;
      }
      setLiveScoreLines(data.data?.lines ?? []);
      setLiveScoreTotal(typeof data.data?.total === 'number' ? data.data.total : 0);
    } catch (e) {
      console.error('Live score detail fetch failed:', e);
      setLiveScoreError('Failed to load live score detail.');
    } finally {
      setLiveScoreLoading(false);
    }
  };

  const handleCloseLiveScore = () => {
    setLiveScoreOpenForId(null);
    setLiveScoreError(null);
    setLiveScoreLines([]);
    setLiveScoreTotal(null);
    setLiveScoreTitle('');
  };

  const handleCancelEdit = () => {
    setEditFeedback(null);
    setEditingBracket(null);
    setEditForm({});
  };

  const handleSaveEdit = async (bracketId: string) => {
    const originalBracket = brackets.find((bracket) => bracket.id === bracketId);
    try {
      const response = await fetch(`/api/admin/brackets/${bracketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();
      
      if (data.success) {
        const optimisticUpdate: Partial<Bracket> = {};
        if (typeof editForm.entryName === 'string') optimisticUpdate.entryName = editForm.entryName.trim();
        if (typeof editForm.status === 'string') optimisticUpdate.status = editForm.status;
        if (typeof editForm.userId === 'string') optimisticUpdate.userId = editForm.userId;
        if (typeof editForm.tieBreaker === 'number') optimisticUpdate.tieBreaker = editForm.tieBreaker;
        setOptimisticBracketUpdates((previous) => ({
          ...previous,
          [bracketId]: {
            ...(previous[bracketId] || {}),
            ...optimisticUpdate,
          },
        }));
        setSyncingBracketIds((previous) => ({ ...previous, [bracketId]: true }));

        // Exit edit mode immediately so row returns to normal action buttons.
        setEditingBracket(null);
        setEditForm({});
        setEditFeedback({
          bracketId,
          type: 'success',
          message: 'Entry updated successfully.',
        });
        await onReload({ silent: true });
        setSyncingBracketIds((previous) => {
          const next = { ...previous };
          delete next[bracketId];
          return next;
        });
        setEditFeedback((previous) => (
          previous?.type === 'success' && previous.bracketId === bracketId ? null : previous
        ));
      } else {
        setSyncingBracketIds((previous) => {
          const next = { ...previous };
          delete next[bracketId];
          return next;
        });
        // Keep user in edit mode and restore original entry name after failed save.
        setEditingBracket(bracketId);
        if (originalBracket) {
          setEditForm((previous) => ({
            ...previous,
            entryName: originalBracket.entryName,
          }));
        }
        setEditFeedback({
          bracketId,
          type: 'error',
          message: data.error || 'Failed to update entry.',
        });
      }
    } catch (error) {
      console.error('Error updating bracket:', error);
      setSyncingBracketIds((previous) => {
        const next = { ...previous };
        delete next[bracketId];
        return next;
      });
      setEditingBracket(bracketId);
      if (originalBracket) {
        setEditForm((previous) => ({
          ...previous,
          entryName: originalBracket.entryName,
        }));
      }
      setEditFeedback({
        bracketId,
        type: 'error',
        message: 'Failed to update bracket.',
      });
    }
  };

  const handleDelete = (bracketId: string) => {
    // Show inline confirmation
    setPendingDeleteBracketId(bracketId);
  };

  const handleCancelDelete = () => {
    setPendingDeleteBracketId(null);
  };

  const handleConfirmDelete = async (bracketId: string) => {
    const target = brackets.find((b) => b.id === bracketId);
    const isPermanentRemove = target?.status === 'deleted';

    setDeletingBracketId(bracketId);
    setPendingDeleteBracketId(null);

    try {
      if (isPermanentRemove) {
        const response = await fetch(`/api/admin/brackets/${bracketId}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (data.success) {
          await onReload();
        } else {
          alert(`Error: ${data.error}`);
        }
      } else {
        const response = await fetch(`/api/admin/brackets/${bracketId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'deleted' }),
        });
        const data = await response.json();
        if (data.success) {
          setOptimisticBracketUpdates((previous) => ({
            ...previous,
            [bracketId]: {
              ...(previous[bracketId] || {}),
              status: 'deleted',
            },
          }));
          await onReload({ silent: true });
        } else {
          alert(`Error: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('Error deleting bracket:', error);
      alert(isPermanentRemove ? 'Failed to permanently delete bracket' : 'Failed to update bracket');
    } finally {
      setDeletingBracketId(null);
    }
  };

  const handleExportBrackets = async () => {
    try {
      setIsExporting(true);
      
      // Export all brackets (status filter is intentionally not passed)
      // Only user and year filters are applied
      const params = new URLSearchParams();
      if (filterUser && filterUser !== 'all') {
        params.append('userId', filterUser);
      }
      if (filterYear && filterYear !== 'all') {
        params.append('year', filterYear);
      }
      
      const response = await fetch(`/api/admin/brackets/export?${params.toString()}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export brackets');
      }
      
      // Preserve UTF-8 BOM: response.text() strips U+FEFF per fetch spec, which breaks Excel encoding.
      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'brackets-export.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting brackets:', error);
      alert(error instanceof Error ? error.message : 'Failed to export brackets');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Compute which filtered brackets would be permanently removed and show inline confirmation.
   */
  const requestBulkDelete = () => {
    if (filteredBrackets.length === 0) {
      return;
    }

    let bracketsToDelete = filteredBrackets;
    let protectedCount = 0;

    if (protectSubmitted) {
      const submittedBrackets = bracketsToDelete.filter((b) => b.status === 'submitted');
      protectedCount = submittedBrackets.length;
      bracketsToDelete = bracketsToDelete.filter((b) => b.status !== 'submitted');
    }

    if (bracketsToDelete.length === 0) {
      if (protectedCount > 0) {
        alert(
          `Cannot delete brackets: ${protectedCount} submitted bracket(s) are protected. Turn off "Protect Submitted" to delete them.`
        );
      } else {
        alert('No brackets to delete.');
      }
      return;
    }

    setBulkDeleteConfirm({
      bracketIds: bracketsToDelete.map((b) => b.id),
      protectedSkipped: protectedCount,
    });
  };

  const cancelBulkDelete = () => {
    if (bulkDeleteRunning) return;
    setBulkDeleteConfirm(null);
  };

  /**
   * Permanently delete all staged bracket IDs (same as row-level permanent delete).
   */
  const executeBulkDelete = async () => {
    if (!bulkDeleteConfirm) return;
    const { bracketIds, protectedSkipped } = bulkDeleteConfirm;
    setBulkDeleteRunning(true);
    try {
      const deletePromises = bracketIds.map((id) =>
        fetch(`/api/admin/brackets/${id}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(deletePromises);
      const dataResults = await Promise.all(results.map((r) => r.json()));

      const failures = dataResults.filter((d) => !d.success);

      await onReload();
      setBulkDeleteConfirm(null);

      if (failures.length > 0) {
        alert(
          `Failed to delete ${failures.length} bracket(s). ${dataResults.length - failures.length} bracket(s) deleted successfully.${protectedSkipped > 0 ? ` ${protectedSkipped} submitted bracket(s) were protected.` : ''}`
        );
      } else {
        const successMessage =
          protectedSkipped > 0
            ? `Successfully deleted ${bracketIds.length} bracket(s). ${protectedSkipped} submitted bracket(s) were protected.`
            : `Successfully deleted ${bracketIds.length} bracket(s).`;
        alert(successMessage);
      }
    } catch (error) {
      console.error('Error deleting filtered brackets:', error);
      alert('Failed to delete brackets. Please try again.');
    } finally {
      setBulkDeleteRunning(false);
    }
  };

  return (
    <BracketImportProvider tournamentYear={tournamentYear} onReload={onReload}>
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Totals — mobile: icon + count only */}
      <div className="mb-4 grid grid-cols-4 gap-2 lg:hidden">
        <div className="flex flex-col items-center justify-center rounded-lg border border-blue-200 bg-blue-50 py-3">
          <LayoutGrid className="mb-1 h-6 w-6 text-blue-600" aria-hidden />
          <span className="sr-only">
            Total brackets: {filteredTotalBrackets} matching filters, {dbTotalBrackets} in database
          </span>
          <div
            className="text-xl font-bold text-blue-900"
            title={`${filteredTotalBrackets} matching current filters / ${dbTotalBrackets} in database`}
          >
            {filteredTotalBrackets} / {dbTotalBrackets}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-green-200 bg-green-50 py-3">
          <CheckCircle className="mb-1 h-6 w-6 text-green-600" aria-hidden />
          <span className="sr-only">
            Submitted: {filteredSubmitted} matching filters, {dbTotalSubmitted} in database
          </span>
          <div
            className="text-xl font-bold text-green-900"
            title={`${filteredSubmitted} matching current filters / ${dbTotalSubmitted} in database`}
          >
            {filteredSubmitted} / {dbTotalSubmitted}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-yellow-200 bg-yellow-50 py-3">
          <Clock className="mb-1 h-6 w-6 text-yellow-600" aria-hidden />
          <span className="sr-only">
            In progress: {filteredInProgress} matching filters, {dbTotalInProgress} in database
          </span>
          <div
            className="text-xl font-bold text-yellow-900"
            title={`${filteredInProgress} matching current filters / ${dbTotalInProgress} in database`}
          >
            {filteredInProgress} / {dbTotalInProgress}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-3">
          <Trash2 className="mb-1 h-6 w-6 text-red-600" aria-hidden />
          <span className="sr-only">
            Deleted: {filteredDeleted} matching filters, {dbTotalDeleted} in database
          </span>
          <div
            className="text-xl font-bold text-red-900"
            title={`${filteredDeleted} matching current filters / ${dbTotalDeleted} in database`}
          >
            {filteredDeleted} / {dbTotalDeleted}
          </div>
        </div>
      </div>

      {/* Totals — desktop */}
      <div className="mb-6 hidden grid-cols-4 gap-4 lg:grid">
        <div
          className="rounded-lg border border-blue-200 bg-blue-50 p-4"
          title={`${filteredTotalBrackets} matching current filters / ${dbTotalBrackets} in database`}
        >
          <div className="text-sm font-medium text-blue-600">Total Brackets</div>
          <div className="text-2xl font-bold text-blue-900" aria-label={`${filteredTotalBrackets} matching filters, ${dbTotalBrackets} in database`}>
            {filteredTotalBrackets} / {dbTotalBrackets}
          </div>
        </div>
        <div
          className="rounded-lg border border-green-200 bg-green-50 p-4"
          title={`${filteredSubmitted} matching current filters / ${dbTotalSubmitted} in database`}
        >
          <div className="text-sm font-medium text-green-600">Total Submitted</div>
          <div className="text-2xl font-bold text-green-900" aria-label={`${filteredSubmitted} matching filters, ${dbTotalSubmitted} in database`}>
            {filteredSubmitted} / {dbTotalSubmitted}
          </div>
        </div>
        <div
          className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"
          title={`${filteredInProgress} matching current filters / ${dbTotalInProgress} in database`}
        >
          <div className="text-sm font-medium text-yellow-600">Total In Progress</div>
          <div className="text-2xl font-bold text-yellow-900" aria-label={`${filteredInProgress} matching filters, ${dbTotalInProgress} in database`}>
            {filteredInProgress} / {dbTotalInProgress}
          </div>
        </div>
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4"
          title={`${filteredDeleted} matching current filters / ${dbTotalDeleted} in database`}
        >
          <div className="text-sm font-medium text-red-600">Total Deleted</div>
          <div className="text-2xl font-bold text-red-900" aria-label={`${filteredDeleted} matching filters, ${dbTotalDeleted} in database`}>
            {filteredDeleted} / {dbTotalDeleted}
          </div>
        </div>
      </div>

      {/* Filters - Second row */}
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Year
            </label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="all">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="in_progress">In Progress</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          
          <div className="min-w-[12rem] max-w-[40ch]">
            <label htmlFor="filter-by-user-combobox" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by User
            </label>
            <UserFilterCombobox
              id="filter-by-user-combobox"
              users={users}
              value={filterUser}
              onChange={setFilterUser}
            />
          </div>

          <div className="hidden items-end gap-4 lg:flex">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Filter by Created Date
              </label>
              <input
                type="date"
                value={filterCreatedDate}
                onChange={(e) => setFilterCreatedDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Filter by Updated Date
              </label>
              <input
                type="date"
                value={filterUpdatedDate}
                onChange={(e) => setFilterUpdatedDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => {
                setFilterUser('all');
                setFilterStatus('all');
                setFilterYear(tournamentYear || 'all');
                setFilterCreatedDate('');
                setFilterUpdatedDate('');
                setSearchQuery('');
              }}
              className="flex items-center justify-center rounded-lg bg-gray-600 p-2 text-sm font-medium text-white hover:bg-gray-700 lg:gap-2 lg:px-4 lg:py-2"
              title="Clear all filters"
            >
              <FunnelX className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" aria-hidden />
              <span className="hidden lg:inline">Clear Filters</span>
              <span className="sr-only lg:hidden">Clear filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons - Third row */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="protectSubmitted"
              checked={protectSubmitted}
              onChange={(e) => setProtectSubmitted(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="protectSubmitted" className="text-sm font-medium text-gray-700">
              Protect Submitted
            </label>
          </div>
          <div className="min-w-0 max-w-md flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onReload()}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 p-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:px-4 lg:py-2"
            title="Refresh bracket list"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline">Refresh</span>
            <span className="sr-only lg:hidden">Refresh</span>
          </button>
          <div className="hidden lg:contents">
            <button
              type="button"
              onClick={handleExportBrackets}
              disabled={brackets.length === 0 || isExporting}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                brackets.length === 0 || isExporting
                  ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title={
                brackets.length === 0
                  ? 'No brackets to export'
                  : 'Export all brackets to CSV (sorted by status: Submitted, In Progress, Deleted)'
              }
            >
              {isExporting ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export All
                </>
              )}
            </button>
            <BracketImportToolbarButton />
          </div>
          <button
            type="button"
            onClick={requestBulkDelete}
            disabled={filteredBrackets.length === 0}
            className={`flex items-center justify-center gap-2 rounded-lg p-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-800 lg:px-4 lg:py-2 ${
              filteredBrackets.length === 0
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : 'bg-red-900 text-white hover:bg-red-950'
            }`}
            title={
              filteredBrackets.length === 0
                ? 'No brackets to delete'
                : `Bulk delete ${filteredBrackets.length} filtered bracket(s) (permanent)`
            }
            data-testid="admin-bulk-delete-button"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline">Bulk Delete ({filteredBrackets.length})</span>
            <span className="sr-only lg:hidden">Bulk delete {filteredBrackets.length}</span>
          </button>
        </div>
      </div>

      {bulkDeleteConfirm && (
        <div
          className="mb-6 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-gray-900 shadow-sm"
          role="alert"
          data-testid="admin-bulk-delete-confirm"
        >
          <div className="mb-3 text-gray-800">
            {permDeleteMessage.split('||').map((part, index, parts) => (
              <Fragment key={index}>
                {part.trim()}
                {index < parts.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </div>
          <p className="mb-3 font-semibold text-red-950">
            {bulkDeleteConfirm.bracketIds.length === 1
              ? '1 Bracket Selected'
              : `${bulkDeleteConfirm.bracketIds.length} Brackets Selected`}
          </p>
          {bulkDeleteConfirm.protectedSkipped > 0 && (
            <p className="mb-3 text-amber-900">
              Note: {bulkDeleteConfirm.protectedSkipped} submitted bracket(s) are protected and will not be deleted.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void executeBulkDelete()}
              disabled={bulkDeleteRunning}
              className="rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-950 focus:outline-none focus:ring-2 focus:ring-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="admin-bulk-delete-confirm-yes"
            >
              {bulkDeleteRunning ? 'Deleting…' : 'Yes, delete permanently'}
            </button>
            <button
              type="button"
              onClick={cancelBulkDelete}
              disabled={bulkDeleteRunning}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="admin-bulk-delete-confirm-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <BracketImportSummary />

      {/* Mobile brackets table */}
      <div className="max-w-full overflow-x-auto lg:hidden">
        <table className="w-full min-w-0 divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Entry / User
              </th>
              <th className="w-[96px] min-w-[96px] px-2 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredBrackets.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-center text-gray-500">
                  No brackets found
                </td>
              </tr>
            ) : (
              filteredBrackets.map((bracket) => (
                <BracketTableRow
                  key={bracket.id}
                  bracket={bracket}
                  users={users}
                  isMobileLayout
                  isEditing={editingBracket === bracket.id}
                  editForm={editForm}
                  onEditFormChange={(updates) => setEditForm((previous) => ({ ...previous, ...updates }))}
                  onSave={() => handleSaveEdit(bracket.id)}
                  onCancel={handleCancelEdit}
                  onEditPicks={() => handleEditPicks(bracket.id)}
                  onEditDetails={() => handleEdit(bracket)}
                  onLiveScore={() => handleOpenLiveScore(bracket)}
                  showLiveScoreButton={!bracket.isKey}
                  onDelete={() => handleDelete(bracket.id)}
                  pendingDelete={pendingDeleteBracketId === bracket.id}
                  deleting={deletingBracketId === bracket.id}
                  onConfirmDelete={() => handleConfirmDelete(bracket.id)}
                  onCancelDelete={handleCancelDelete}
                  feedback={editFeedback && editFeedback.bracketId === bracket.id ? editFeedback : null}
                  isSyncing={Boolean(syncingBracketIds[bracket.id])}
                  permanentDeleteMessage={permDeleteMessage}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Desktop brackets table — table-fixed + colgroup keeps width stable in edit mode */}
      <div className="hidden max-w-full overflow-x-auto lg:block">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '7.5rem' }} />
            <col style={{ width: '6.5rem' }} />
            <col style={{ width: '6.25rem' }} />
            <col style={{ width: '6.25rem' }} />
            <col style={{ width: '6.25rem' }} />
            <col style={{ width: '7.75rem' }} />
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="min-w-0 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Entry Name
              </th>
              <th className="min-w-0 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Bracket ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Updated
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Submitted
              </th>
              <th className="sticky right-0 z-20 border-l border-gray-200 bg-gray-50 px-2 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 shadow-[-6px_0_12px_-8px_rgba(0,0,0,0.15)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredBrackets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                  No brackets found
                </td>
              </tr>
            ) : (
              filteredBrackets.map((bracket) => (
                <BracketTableRow
                  key={bracket.id}
                  bracket={bracket}
                  users={users}
                  isEditing={editingBracket === bracket.id}
                  editForm={editForm}
                  onEditFormChange={(updates) => setEditForm((previous) => ({ ...previous, ...updates }))}
                  onSave={() => handleSaveEdit(bracket.id)}
                  onCancel={handleCancelEdit}
                  onEditPicks={() => handleEditPicks(bracket.id)}
                  onEditDetails={() => handleEdit(bracket)}
                  onLiveScore={() => handleOpenLiveScore(bracket)}
                  showLiveScoreButton={!bracket.isKey}
                  onDelete={() => handleDelete(bracket.id)}
                  pendingDelete={pendingDeleteBracketId === bracket.id}
                  deleting={deletingBracketId === bracket.id}
                  onConfirmDelete={() => handleConfirmDelete(bracket.id)}
                  onCancelDelete={handleCancelDelete}
                  feedback={editFeedback && editFeedback.bracketId === bracket.id ? editFeedback : null}
                  isSyncing={Boolean(syncingBracketIds[bracket.id])}
                  permanentDeleteMessage={permDeleteMessage}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {liveScoreOpenForId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="live-score-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseLiveScore();
          }}
        >
          <div
            className="flex max-h-[min(85vh,720px)] w-[min(96vw,72rem)] max-w-none flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-2.5">
              <div className="min-w-0">
                <h2 id="live-score-modal-title" className="text-base font-semibold text-gray-900">
                  KEY scoring
                </h2>
                <p className="mt-0.5 truncate text-xs text-gray-600" title={liveScoreTitle}>
                  {liveScoreTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseLiveScore}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-3 py-2">
              {liveScoreLoading && (
                <p className="text-xs text-gray-600">Loading…</p>
              )}
              {!liveScoreLoading && liveScoreError && (
                <p className="text-xs text-red-600">{liveScoreError}</p>
              )}
              {!liveScoreLoading && !liveScoreError && liveScoreLines.length === 0 && (
                <p className="text-xs text-gray-600">
                  No KEY results yet. Rows show when KEY marks winners.
                </p>
              )}
              {!liveScoreLoading && !liveScoreError && liveScoreLines.length > 0 && (
                <ul className="list-none space-y-1 text-xs leading-tight text-gray-800">
                  {liveScoreLines.map((line, index) => (
                    <li
                      key={index}
                      className="whitespace-nowrap border-b border-gray-100 pb-1 font-mono last:border-0"
                      title={line}
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!liveScoreLoading && !liveScoreError && liveScoreTotal !== null && liveScoreLines.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">
                  Total {liveScoreTotal} pts
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </BracketImportProvider>
  );
}

