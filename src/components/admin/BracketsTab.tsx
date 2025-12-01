'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Edit, Save, X, Edit3, Download, RefreshCw, Search } from 'lucide-react';

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
  bracketNumber?: number;
  year?: number;
  createdAt: string;
  updatedAt: string;
  picks: Record<string, string>;
}

interface BracketsTabProps {
  users: User[];
  brackets: Bracket[];
  onReload: () => Promise<void>;
}

interface EditForm {
  entryName?: string;
  tieBreaker?: number;
  status?: string;
  userId?: string;
}

export default function BracketsTab({ users, brackets, onReload }: BracketsTabProps) {
  const router = useRouter();
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterCreatedDate, setFilterCreatedDate] = useState<string>('');
  const [filterUpdatedDate, setFilterUpdatedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredBrackets, setFilteredBrackets] = useState<Bracket[]>([]);
  const [editingBracket, setEditingBracket] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({});
  const [isExporting, setIsExporting] = useState(false);
  const [protectSubmitted, setProtectSubmitted] = useState<boolean>(true);
  const [pendingDeleteBracketId, setPendingDeleteBracketId] = useState<string | null>(null);
  const [deletingBracketId, setDeletingBracketId] = useState<string | null>(null);
  const [tournamentYear, setTournamentYear] = useState<string>('');

  // Calculate totals
  const totalBrackets = brackets.length;
  const totalSubmitted = brackets.filter(b => b.status === 'submitted').length;
  const totalInProgress = brackets.filter(b => b.status === 'in_progress').length;
  const totalDeleted = brackets.filter(b => b.status === 'deleted').length;

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
        if (data.success && data.data?.tournamentYear) {
          const year = data.data.tournamentYear;
          setTournamentYear(year);
          // Set default filter year to tournament year if available in brackets
          const yearNum = parseInt(year);
          if (availableYears.includes(yearNum)) {
            setFilterYear(year);
          }
        }
      } catch (error) {
        console.error('Error loading tournament year:', error);
      }
    };
    loadTournamentYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter brackets when filters or brackets change
  useEffect(() => {
    let filtered = brackets;
    
    if (filterUser !== 'all') {
      filtered = filtered.filter(b => b.userId === filterUser);
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === filterStatus);
    }
    
    if (filterYear !== 'all') {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(b => b.year === yearNum);
    }
    
    // Filter by entry name search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.entryName.toLowerCase().includes(query)
      );
    }
    
    // Filter by created date (match date only, ignore time)
    if (filterCreatedDate) {
      const [year, month, day] = filterCreatedDate.split('-').map(Number);
      const filterDateStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      
      filtered = filtered.filter(b => {
        const createdDate = new Date(b.createdAt);
        const createdDateStr = createdDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
        const filterDateStr = filterDateStart.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
        return createdDateStr === filterDateStr;
      });
    }
    
    // Filter by updated date (match date only, ignore time)
    if (filterUpdatedDate) {
      const [year, month, day] = filterUpdatedDate.split('-').map(Number);
      const filterDateStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      
      filtered = filtered.filter(b => {
        const updatedDate = new Date(b.updatedAt);
        const updatedDateStr = updatedDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
        const filterDateStr = filterDateStart.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
        return updatedDateStr === filterDateStr;
      });
    }
    
    setFilteredBrackets(filtered);
  }, [brackets, filterUser, filterStatus, filterYear, filterCreatedDate, filterUpdatedDate, searchQuery]);

  const handleEdit = (bracket: Bracket) => {
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

  const handleCancelEdit = () => {
    setEditingBracket(null);
    setEditForm({});
  };

  const handleSaveEdit = async (bracketId: string) => {
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
        await onReload();
        setEditingBracket(null);
        setEditForm({});
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error updating bracket:', error);
      alert('Failed to update bracket');
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
    setDeletingBracketId(bracketId);
    setPendingDeleteBracketId(null);
    
    try {
      const response = await fetch(`/api/admin/brackets/${bracketId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        await onReload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting bracket:', error);
      alert('Failed to delete bracket');
    } finally {
      setDeletingBracketId(null);
    }
  };

  const handleExportBrackets = async () => {
    if (filteredBrackets.length === 0) {
      alert('No brackets to export');
      return;
    }
    
    try {
      setIsExporting(true);
      
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
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
      
      const csvContent = await response.text();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

  const handleDeleteAllFiltered = async () => {
    if (filteredBrackets.length === 0) {
      return;
    }

    // Filter out submitted brackets if protection is enabled
    let bracketsToDelete = filteredBrackets;
    let protectedCount = 0;
    
    if (protectSubmitted) {
      const submittedBrackets = bracketsToDelete.filter(b => b.status === 'submitted');
      protectedCount = submittedBrackets.length;
      bracketsToDelete = bracketsToDelete.filter(b => b.status !== 'submitted');
    }

    if (bracketsToDelete.length === 0) {
      if (protectedCount > 0) {
        alert(`Cannot delete brackets: ${protectedCount} submitted bracket(s) are protected. Turn off "Protect Submitted" to delete them.`);
      } else {
        alert('No brackets to delete.');
      }
      return;
    }

    const protectedMessage = protectedCount > 0 
      ? `\n\nNote: ${protectedCount} submitted bracket(s) will be protected and not deleted.`
      : '';
    
    const confirmMessage = `Are you sure you want to delete ${bracketsToDelete.length} bracket(s)?${protectedMessage}\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const deletePromises = bracketsToDelete.map(bracket => 
        fetch(`/api/admin/brackets/${bracket.id}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(deletePromises);
      const dataResults = await Promise.all(results.map(r => r.json()));
      
      const failures = dataResults.filter(d => !d.success);
      
      if (failures.length > 0) {
        alert(`Failed to delete ${failures.length} bracket(s). ${dataResults.length - failures.length} bracket(s) deleted successfully.${protectedCount > 0 ? ` ${protectedCount} submitted bracket(s) were protected.` : ''}`);
      }

      await onReload();
      
      if (failures.length === 0) {
        const successMessage = protectedCount > 0
          ? `Successfully deleted ${bracketsToDelete.length} bracket(s). ${protectedCount} submitted bracket(s) were protected.`
          : `Successfully deleted ${bracketsToDelete.length} bracket(s).`;
        alert(successMessage);
      }
    } catch (error) {
      console.error('Error deleting filtered brackets:', error);
      alert('Failed to delete brackets. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Totals at the top */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-600">Total Brackets</div>
          <div className="text-2xl font-bold text-blue-900">{totalBrackets}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm font-medium text-green-600">Total Submitted</div>
          <div className="text-2xl font-bold text-green-900">{totalSubmitted}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm font-medium text-yellow-600">Total In Progress</div>
          <div className="text-2xl font-bold text-yellow-900">{totalInProgress}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm font-medium text-red-600">Total Deleted</div>
          <div className="text-2xl font-bold text-red-900">{totalDeleted}</div>
        </div>
      </div>

      {/* Filters - Second row */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Year
            </label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="in_progress">In Progress</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by User
            </label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              style={{ width: '40ch' }}
            >
              <option value="all">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Created Date
            </label>
            <input
              type="date"
              value={filterCreatedDate}
              onChange={(e) => setFilterCreatedDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Updated Date
            </label>
            <input
              type="date"
              value={filterUpdatedDate}
              onChange={(e) => setFilterUpdatedDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          
          <div className="ml-auto">
            <button
              onClick={() => {
                setFilterUser('all');
                setFilterStatus('all');
                setFilterYear(tournamentYear || 'all');
                setFilterCreatedDate('');
                setFilterUpdatedDate('');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-600 text-white hover:bg-gray-700"
              title="Clear all filters"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>
        
      {/* Action buttons - Third row */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="protectSubmitted"
              checked={protectSubmitted}
              onChange={(e) => setProtectSubmitted(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="protectSubmitted" className="text-sm font-medium text-gray-700">
              Protect Submitted
            </label>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Entry Name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReload}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center gap-2"
            title="Refresh bracket list"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleExportBrackets}
            disabled={filteredBrackets.length === 0 || isExporting}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              filteredBrackets.length === 0 || isExporting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            title={filteredBrackets.length === 0 ? 'No brackets to export' : `Export ${filteredBrackets.length} filtered bracket(s) to CSV`}
          >
            {isExporting ? (
              <>
                <span className="animate-spin inline-block">⏳</span>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Extract ({filteredBrackets.length})
              </>
            )}
          </button>
          <button
            onClick={handleDeleteAllFiltered}
            disabled={filteredBrackets.length === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              filteredBrackets.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
            title={filteredBrackets.length === 0 ? 'No brackets to delete' : `Delete ${filteredBrackets.length} filtered bracket(s)`}
          >
            <Trash2 className="w-4 h-4" />
            Bulk Delete ({filteredBrackets.length})
          </button>
        </div>
      </div>

      {/* Brackets Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bracket ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entry Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tie Breaker
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Updated
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredBrackets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  No brackets found
                </td>
              </tr>
            ) : (
              filteredBrackets.map((bracket) => (
                <tr key={bracket.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-600">
                      {bracket.year || new Date().getFullYear()}-{String(bracket.bracketNumber || '?').padStart(6, '0')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingBracket === bracket.id ? (
                      <select
                        value={editForm.userId || ''}
                        onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-gray-900">{bracket.userName}</div>
                        <div className="text-sm text-gray-500">{bracket.userEmail}</div>
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingBracket === bracket.id ? (
                      <input
                        type="text"
                        value={editForm.entryName || ''}
                        onChange={(e) => setEditForm({ ...editForm, entryName: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{bracket.entryName}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingBracket === bracket.id ? (
                      <input
                        type="number"
                        min="100"
                        max="300"
                        value={editForm.tieBreaker || ''}
                        onChange={(e) => setEditForm({ ...editForm, tieBreaker: parseInt(e.target.value) })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{bracket.tieBreaker || 'N/A'}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingBracket === bracket.id ? (
                      <select
                        value={editForm.status || ''}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="submitted">Submitted</option>
                        <option value="deleted">Deleted</option>
                      </select>
                    ) : (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        bracket.status === 'submitted'
                          ? 'bg-green-100 text-green-800'
                          : bracket.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-800'
                          : bracket.status === 'deleted'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {bracket.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(bracket.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(bracket.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" style={{ overflow: 'visible' }}>
                    {editingBracket === bracket.id ? (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleSaveEdit(bracket.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Save"
                        >
                          <Save className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-600 hover:text-gray-900"
                          title="Cancel"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : pendingDeleteBracketId === bracket.id ? (
                      <div className="relative flex items-center justify-end" style={{ minWidth: '200px' }}>
                        <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded px-2 py-1" style={{ position: 'absolute', right: 0, zIndex: 10, whiteSpace: 'nowrap' }}>
                          <span className="text-xs text-red-700 font-medium whitespace-nowrap">Delete?</span>
                          <button
                            onClick={() => handleConfirmDelete(bracket.id)}
                            disabled={deletingBracketId === bracket.id}
                            className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Yes
                          </button>
                          <button
                            onClick={handleCancelDelete}
                            disabled={deletingBracketId === bracket.id}
                            className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditPicks(bracket.id)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Edit Picks"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(bracket)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit Details"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(bracket.id)}
                          disabled={deletingBracketId === bracket.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

