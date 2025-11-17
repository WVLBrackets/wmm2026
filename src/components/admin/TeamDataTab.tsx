'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Trash2, Edit, Save, X, Plus, Download, AlertCircle, CheckCircle, Power, PowerOff, Zap } from 'lucide-react';

export default function TeamDataTab() {
  const router = useRouter();
  const [teamData, setTeamData] = useState<Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }>>({});
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingTeamData, setEditingTeamData] = useState<{ key: string; id: string; name: string; mascot?: string; logo: string; active?: boolean } | null>(null);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncTeamId, setSyncTeamId] = useState('');
  const [syncResult, setSyncResult] = useState<{ report: { id?: string; action?: string; dbName?: string; espnName?: string; mascot?: string; logoUrl?: string; message?: string; details?: string } | null; loading: boolean } | null>(null);
  const [newTeamData, setNewTeamData] = useState<{ key: string; id: string; name: string; mascot?: string; logo: string; active?: boolean }>({ key: '', id: '', name: '', mascot: '', logo: '', active: true });
  const [teamDataError, setTeamDataError] = useState('');
  const [teamFilters, setTeamFilters] = useState<{ key: string; id: string; name: string; mascot: string; logo: string }>({ key: '', id: '', name: '', mascot: '', logo: '' });
  const [teamSortColumn, setTeamSortColumn] = useState<'name' | 'mascot' | 'key' | 'id' | null>('name');
  const [teamSortOrder, setTeamSortOrder] = useState<'asc' | 'desc'>('asc');
  const [duplicateCheck, setDuplicateCheck] = useState<{ hasDuplicates: boolean; duplicateIds: string[] }>({ hasDuplicates: false, duplicateIds: [] });
  const [teamActiveFilter, setTeamActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [isLoading, setIsLoading] = useState(false);
  const loadTeamDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const loadTeamData = async () => {
    try {
      setTeamDataError('');
      setIsLoading(true);
      
      // Build URL with active filter
      let url = '/api/admin/team-data';
      if (teamActiveFilter === 'active') {
        url += '?activeOnly=true';
      } else if (teamActiveFilter === 'inactive') {
        // For inactive, we need all teams and filter client-side
        url += '';
      } else {
        // 'all' - get all teams
        url += '';
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.error || 'Failed to load team data';
        throw new Error(errorMessage);
      }
      
      // Type assertion for team data from API
      const loadedData = (data.data as Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }>) || {};
      
      // Filter by active status if needed
      let filteredData = loadedData;
      if (teamActiveFilter === 'inactive') {
        // Filter to show only teams where active is explicitly false
        const allEntries = Object.entries(loadedData);
        const inactiveEntries: Array<[string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }]> = [];
        
        allEntries.forEach(([key, team]) => {
          const activeValue = team.active;
          const isStrictFalse = activeValue === false;
          
          if (isStrictFalse) {
            inactiveEntries.push([key, team]);
          }
        });
        
        filteredData = Object.fromEntries(inactiveEntries);
      } else if (teamActiveFilter === 'active') {
        // Filter to show only teams where active is true (or undefined/null which should be treated as active)
        filteredData = Object.fromEntries(
          Object.entries(loadedData).filter(([, team]) => team.active === true)
        );
      }
      // 'all' filter doesn't need client-side filtering - show everything from API
      setTeamData(filteredData);
      setTeamDataError(''); // Clear any previous errors
      
      // Run duplicate check after loading data
      checkForDuplicates(filteredData);
    } catch (error) {
      console.error('Error loading team data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load team data';
      setTeamDataError(errorMessage);
      setTeamData({}); // Clear team data on error
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check for duplicate values in Team (name), Abbreviation (key), and ID columns
   */
  const checkForDuplicates = (data: Record<string, { id: string; name: string; logo: string }>) => {
    const nameCounts: Record<string, string[]> = {};
    const keyCounts: Record<string, string[]> = {};
    const idCounts: Record<string, string[]> = {};
    const duplicateIds: Set<string> = new Set();

    // Count occurrences of each value
    Object.entries(data).forEach(([key, team]) => {
      // Check for duplicate names
      if (team.name) {
        const nameKey = team.name.toLowerCase();
        if (!nameCounts[nameKey]) {
          nameCounts[nameKey] = [];
        }
        nameCounts[nameKey].push(key);
      }

      // Check for duplicate keys
      if (key) {
        const keyLower = key.toLowerCase();
        if (!keyCounts[keyLower]) {
          keyCounts[keyLower] = [];
        }
        keyCounts[keyLower].push(key);
      }

      // Check for duplicate IDs
      if (team.id) {
        const idKey = team.id.toLowerCase();
        if (!idCounts[idKey]) {
          idCounts[idKey] = [];
        }
        idCounts[idKey].push(key);
      }
    });

    // Find duplicates (values that appear more than once)
    Object.entries(nameCounts).forEach(([, keys]) => {
      if (keys.length > 1) {
        keys.forEach(k => duplicateIds.add(k));
      }
    });

    Object.entries(keyCounts).forEach(([, keys]) => {
      if (keys.length > 1) {
        keys.forEach(k => duplicateIds.add(k));
      }
    });

    Object.entries(idCounts).forEach(([, keys]) => {
      if (keys.length > 1) {
        keys.forEach(k => duplicateIds.add(k));
      }
    });

    // Get the IDs of teams with duplicates
    const duplicateIdList = Array.from(duplicateIds).map(key => {
      const team = data[key];
      return team ? team.id : key;
    });

    setDuplicateCheck({
      hasDuplicates: duplicateIds.size > 0,
      duplicateIds: duplicateIdList
    });
  };

  /**
   * Handle column sorting
   */
  const handleSort = (column: 'name' | 'mascot' | 'key' | 'id') => {
    if (teamSortColumn === column) {
      // Same column, toggle order
      setTeamSortOrder(teamSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setTeamSortColumn(column);
      setTeamSortOrder('asc');
    }
  };

  // Assign function to ref
  loadTeamDataRef.current = loadTeamData;

  // Load team data on mount and when filter changes
  useEffect(() => {
    loadTeamDataRef.current?.();
  }, [teamActiveFilter]);

  const handleEditTeam = (key: string) => {
    const team = teamData[key];
    setEditingTeam(key);
    setEditingTeamData({
      key,
      id: team.id,
      name: team.name,
      mascot: team.mascot,
      logo: team.logo,
      active: team.active ?? false,
    });
  };

  const handleCancelEditTeam = () => {
    setEditingTeam(null);
    setEditingTeamData(null);
  };

  const handleSaveTeam = async () => {
    if (!editingTeam || !editingTeamData) return;

    setTeamDataError('');

    // Validate
    if (!editingTeamData.key || !editingTeamData.id || !editingTeamData.name) {
      setTeamDataError('Key, ID, and Name are required');
      return;
    }

    // Check if new key conflicts with existing team (unless it's the same team)
    if (editingTeam !== editingTeamData.key && teamData[editingTeamData.key]) {
      setTeamDataError('Team with this key already exists');
      return;
    }

    try {
      const updatedTeamData = { ...teamData };
      
      // If key changed, remove old entry
      if (editingTeam !== editingTeamData.key) {
        delete updatedTeamData[editingTeam];
      }
      
      // Update/add the team
      updatedTeamData[editingTeamData.key] = {
        id: editingTeamData.id,
        name: editingTeamData.name,
        mascot: editingTeamData.mascot || undefined,
        logo: editingTeamData.logo,
        active: editingTeamData.active ?? false,
      };

      const response = await fetch('/api/admin/team-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: updatedTeamData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save team data');
      }

      // Reload team data to get sorted version
      await loadTeamData();
      setEditingTeam(null);
      setEditingTeamData(null);
      
      // Duplicate check will run in loadTeamData
    } catch (error) {
      console.error('Error saving team data:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to save team data');
    }
  };

  const handleDeleteTeam = async (key: string) => {
    if (!confirm(`Are you sure you want to delete team "${teamData[key]?.name || key}"? This action cannot be undone.`)) {
      return;
    }

    setTeamDataError('');

    try {
      const response = await fetch(`/api/admin/team-data?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete team');
      }

      // Reload team data
      await loadTeamData();
      
      // Duplicate check will run in loadTeamData
    } catch (error) {
      console.error('Error deleting team:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to delete team');
    }
  };

  const handleAddTeam = () => {
    setIsAddingTeam(true);
    setNewTeamData({ key: '', id: '', name: '', mascot: '', logo: '', active: true });
  };

  const handleCancelAddTeam = () => {
    setIsAddingTeam(false);
    setNewTeamData({ key: '', id: '', name: '', mascot: '', logo: '', active: true });
  };

  const handleSyncTeam = async (mode: 'report' | 'update') => {
    const teamId = parseInt(syncTeamId);
    if (!teamId || teamId < 1 || teamId > 9999) {
      setSyncResult({ report: { message: 'Invalid team ID. Must be a number between 1 and 9999' }, loading: false });
      return;
    }

    setSyncResult({ report: null, loading: true });

    try {
      const response = await fetch('/api/admin/sync-team-from-espn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teamId, mode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSyncResult({ report: data.report, loading: false });
        // If update mode and successful, reload team data
        if (mode === 'update') {
          await loadTeamData();
        }
      } else {
        setSyncResult({ report: { message: data.error || 'Failed to sync team', details: data.details }, loading: false });
      }
    } catch (error) {
      setSyncResult({ report: { message: 'Error syncing team', details: error instanceof Error ? error.message : 'Unknown error' }, loading: false });
    }
  };

  const handleSaveNewTeam = async () => {
    setTeamDataError('');

    // Validate
    if (!newTeamData.key || !newTeamData.id || !newTeamData.name) {
      setTeamDataError('Key, ID, and Name are required');
      return;
    }

    // Check if key already exists
    if (teamData[newTeamData.key]) {
      setTeamDataError('Team with this key already exists');
      return;
    }

    try {
      const updatedTeamData = {
        ...teamData,
        [newTeamData.key]: {
          id: newTeamData.id,
          name: newTeamData.name,
          mascot: newTeamData.mascot || undefined,
          logo: newTeamData.logo,
          active: newTeamData.active ?? true,
        },
      };

      const response = await fetch('/api/admin/team-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: updatedTeamData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save team data');
      }

      // Reload team data to get sorted version
      await loadTeamData();
      setIsAddingTeam(false);
      setNewTeamData({ key: '', id: '', name: '', mascot: '', logo: '', active: true });
      
      // Duplicate check will run in loadTeamData
    } catch (error) {
      console.error('Error saving new team:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to save new team');
    }
  };

  const handleExportTeamData = async () => {
    try {
      // Filter team data based on current view filters
      const filteredTeams = Object.entries(teamData)
        .filter(([key, team]) => {
          // Apply active filter
          if (teamActiveFilter === 'active') {
            if (!(team.active ?? false)) return false;
          } else if (teamActiveFilter === 'inactive') {
            if (team.active ?? false) return false;
          }
          // else 'all' - no active filter

          // Apply text filters (same logic as table display)
          const keyMatch = !teamFilters.key || key.toLowerCase().includes(teamFilters.key.toLowerCase());
          const idMatch = !teamFilters.id || team.id.toLowerCase().includes(teamFilters.id.toLowerCase());
          const nameMatch = !teamFilters.name || team.name.toLowerCase().includes(teamFilters.name.toLowerCase());
          const mascotMatch = !teamFilters.mascot || (team.mascot && team.mascot.toLowerCase().includes(teamFilters.mascot.toLowerCase()));
          
          return keyMatch && idMatch && nameMatch && mascotMatch;
        })
        .reduce((acc, [key, team]) => {
          acc[key] = {
            id: team.id,
            name: team.name,
            mascot: team.mascot || undefined,
            logo: team.logo,
            active: team.active ?? undefined,
          };
          return acc;
        }, {} as Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }>);

      // Create JSON blob from filtered data
      const jsonString = JSON.stringify(filteredTeams, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'team-mappings.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting team data:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to export team data');
    }
  };

  const handleToggleActive = async (key: string, currentActive: boolean) => {
    // Optimistically update the UI immediately
    const newActiveStatus = !currentActive;
    setTeamData(prev => {
      const updated = { ...prev };
      if (updated[key]) {
        updated[key] = { ...updated[key], active: newActiveStatus };
      }
      return updated;
    });

    try {
      setTeamDataError('');
      
      const response = await fetch('/api/admin/team-data', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          active: newActiveStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Revert the optimistic update on error
        setTeamData(prev => {
          const updated = { ...prev };
          if (updated[key]) {
            updated[key] = { ...updated[key], active: currentActive };
          }
          return updated;
        });
        throw new Error(data.error || 'Failed to update team active status');
      }

      // Reload team data from database to ensure we have the latest state
      // This is important because the filter view needs fresh data from DB
      if (loadTeamDataRef.current) {
        await loadTeamDataRef.current();
      }
    } catch (error) {
      console.error('Error toggling team active status:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to toggle team active status');
    }
  };

  // Helper function to get filtered teams based on current filters
  const getFilteredTeams = (): Array<[string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }]> => {
    return Object.entries(teamData).filter(([key, team]) => {
      const keyMatch = !teamFilters.key || key.toLowerCase().includes(teamFilters.key.toLowerCase());
      const idMatch = !teamFilters.id || team.id.toLowerCase().includes(teamFilters.id.toLowerCase());
      const nameMatch = !teamFilters.name || team.name.toLowerCase().includes(teamFilters.name.toLowerCase());
      const mascotMatch = !teamFilters.mascot || (team.mascot && team.mascot.toLowerCase().includes(teamFilters.mascot.toLowerCase()));
      return keyMatch && idMatch && nameMatch && mascotMatch;
    });
  };

  const handleDeleteFilteredTeams = async () => {
    const filteredTeams = getFilteredTeams();
    
    if (filteredTeams.length === 0) {
      setTeamDataError('No teams to delete');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${filteredTeams.length} team(s) from the database?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      setTeamDataError('');

      // Delete all filtered teams
      const deletePromises = filteredTeams.map(([key]) =>
        fetch(`/api/admin/team-data?key=${encodeURIComponent(key)}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(deletePromises);
      const dataResults = await Promise.all(results.map(r => r.json()));

      // Check for any failures
      const failures = dataResults.filter(d => !d.success);

      if (failures.length > 0) {
        setTeamDataError(`Failed to delete ${failures.length} team(s). ${dataResults.length - failures.length} team(s) deleted successfully.`);
      } else {
        setTeamDataError('');
      }

      // Reload team data
      if (loadTeamDataRef.current) {
        await loadTeamDataRef.current();
      }

      if (failures.length === 0) {
        alert(`Successfully deleted ${filteredTeams.length} team(s).`);
      }
    } catch (error) {
      console.error('Error deleting filtered teams:', error);
      setTeamDataError('Failed to delete teams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateFilteredTeams = async () => {
    const filteredTeams = getFilteredTeams();
    
    if (filteredTeams.length === 0) {
      setTeamDataError('No teams to activate');
      return;
    }

    try {
      setIsLoading(true);
      setTeamDataError('');

      // Activate all filtered teams
      const activatePromises = filteredTeams.map(([key]) =>
        fetch('/api/admin/team-data', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key,
            active: true,
          }),
        })
      );

      const results = await Promise.all(activatePromises);
      const dataResults = await Promise.all(results.map(r => r.json()));

      // Check for any failures
      const failures = dataResults.filter(d => !d.success);

      if (failures.length > 0) {
        setTeamDataError(`Failed to activate ${failures.length} team(s). ${dataResults.length - failures.length} team(s) activated successfully.`);
      } else {
        setTeamDataError('');
      }

      // Reload team data
      if (loadTeamDataRef.current) {
        await loadTeamDataRef.current();
      }

      if (failures.length === 0) {
        alert(`Successfully activated ${filteredTeams.length} team(s).`);
      }
    } catch (error) {
      console.error('Error activating filtered teams:', error);
      setTeamDataError('Failed to activate teams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateFilteredTeams = async () => {
    const filteredTeams = getFilteredTeams();
    
    if (filteredTeams.length === 0) {
      setTeamDataError('No teams to deactivate');
      return;
    }

    try {
      setIsLoading(true);
      setTeamDataError('');

      // Deactivate all filtered teams
      const deactivatePromises = filteredTeams.map(([key]) =>
        fetch('/api/admin/team-data', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key,
            active: false,
          }),
        })
      );

      const results = await Promise.all(deactivatePromises);
      const dataResults = await Promise.all(results.map(r => r.json()));

      // Check for any failures
      const failures = dataResults.filter(d => !d.success);

      if (failures.length > 0) {
        setTeamDataError(`Failed to deactivate ${failures.length} team(s). ${dataResults.length - failures.length} team(s) deactivated successfully.`);
      } else {
        setTeamDataError('');
      }

      // Reload team data
      if (loadTeamDataRef.current) {
        await loadTeamDataRef.current();
      }

      if (failures.length === 0) {
        alert(`Successfully deactivated ${filteredTeams.length} team(s).`);
      }
    } catch (error) {
      console.error('Error deactivating filtered teams:', error);
      setTeamDataError('Failed to deactivate teams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        {/* Header with title and first row of buttons */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">Team Reference Data</h2>
          {!isAddingTeam && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddTeam}
                className="flex items-center justify-center w-8 h-8 text-sm bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                title="Add Team"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setIsSyncModalOpen(true);
                  setSyncTeamId('');
                  setSyncResult(null);
                }}
                className="flex items-center justify-center w-8 h-8 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                title="Sync Team from ESPN"
              >
                <Zap className="h-4 w-4" />
              </button>
              <button
                onClick={handleActivateFilteredTeams}
                disabled={getFilteredTeams().length === 0}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Activate all ${getFilteredTeams().length} team(s) in current view`}
              >
                <Power className="h-4 w-4" />
                <span>Activate</span>
              </button>
              <button
                onClick={handleDeactivateFilteredTeams}
                disabled={getFilteredTeams().length === 0}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Deactivate all ${getFilteredTeams().length} team(s) in current view`}
              >
                <PowerOff className="h-4 w-4" />
                <span>Deactivate</span>
              </button>
              <button
                onClick={handleDeleteFilteredTeams}
                disabled={getFilteredTeams().length === 0}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={getFilteredTeams().length === 0 ? 'No teams to delete' : `Delete ${getFilteredTeams().length} filtered team(s)`}
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete All ({getFilteredTeams().length})</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Active Filter Toggles with second row of buttons */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Show:</span>
            <button
              onClick={() => setTeamActiveFilter('active')}
              className={`px-3 py-1 text-sm rounded ${
                teamActiveFilter === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setTeamActiveFilter('inactive')}
              className={`px-3 py-1 text-sm rounded ${
                teamActiveFilter === 'inactive'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Inactive
            </button>
            <button
              onClick={() => setTeamActiveFilter('all')}
              className={`px-3 py-1 text-sm rounded ${
                teamActiveFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
          </div>
          {!isAddingTeam && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => router.push('/admin/tournament-builder')}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                <span>New Bracket</span>
              </button>
              <button
                onClick={handleExportTeamData}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                title="Export team data to JSON file for git commit"
              >
                <Download className="h-4 w-4" />
                <span>Export JSON</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {teamDataError && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-sm text-red-800">{teamDataError}</p>
        </div>
      )}

      {/* Add Team Form */}
      {isAddingTeam && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Team</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key (Abbreviation) *
              </label>
              <input
                type="text"
                value={newTeamData.key}
                onChange={(e) => setNewTeamData({ ...newTeamData, key: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="e.g., UConn"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID *
              </label>
              <input
                type="text"
                value={newTeamData.id}
                onChange={(e) => setNewTeamData({ ...newTeamData, id: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="e.g., 41"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={newTeamData.name}
                onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="e.g., Connecticut"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mascot
              </label>
              <input
                type="text"
                value={newTeamData.mascot || ''}
                onChange={(e) => setNewTeamData({ ...newTeamData, mascot: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="e.g., Huskies"
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 mt-6">
                <input
                  type="checkbox"
                  checked={newTeamData.active ?? true}
                  onChange={(e) => setNewTeamData({ ...newTeamData, active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-3">
            <button
              onClick={handleCancelAddTeam}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNewTeam}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Sync Team from ESPN Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Sync Team from ESPN</h3>
              <button
                onClick={() => {
                  setIsSyncModalOpen(false);
                  setSyncTeamId('');
                  setSyncResult(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team ID (1-9999)
              </label>
              <input
                type="number"
                min="1"
                max="9999"
                value={syncTeamId}
                onChange={(e) => setSyncTeamId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Enter team ID"
                disabled={syncResult?.loading}
              />
            </div>

            {syncResult && (
              <div className={`mb-4 p-3 rounded ${
                syncResult.report?.action === 'match' 
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : syncResult.report?.action === 'error' || syncResult.report?.action === 'not_found'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : syncResult.report?.action === 'mismatch' || syncResult.report?.action === 'created'
                  ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  : 'bg-gray-50 text-gray-800 border border-gray-200'
              }`}>
                {syncResult.loading ? (
                  <p className="text-sm">Loading...</p>
                ) : (
                  <div className="text-sm">
                    <p className="font-semibold mb-2">
                      {syncResult.report?.action === 'match' && '✓ Match'}
                      {syncResult.report?.action === 'mismatch' && '⚠ Mismatch'}
                      {syncResult.report?.action === 'created' && '➕ New Team'}
                      {syncResult.report?.action === 'not_found' && '❌ Not Found'}
                      {syncResult.report?.action === 'error' && '❌ Error'}
                    </p>
                    {syncResult.report?.dbName && (
                      <p><strong>DB:</strong> {syncResult.report.dbName}</p>
                    )}
                    {syncResult.report?.espnName && (
                      <p><strong>ESPN:</strong> {syncResult.report.espnName}</p>
                    )}
                    {syncResult.report?.mascot && (
                      <p><strong>Mascot:</strong> {syncResult.report.mascot}</p>
                    )}
                    {syncResult.report?.message && (
                      <p className="mt-2">{syncResult.report.message}</p>
                    )}
                    {syncResult.report?.details && (
                      <p className="mt-2 text-xs">{syncResult.report.details}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsSyncModalOpen(false);
                  setSyncTeamId('');
                  setSyncResult(null);
                }}
                disabled={syncResult?.loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                onClick={() => handleSyncTeam('report')}
                disabled={syncResult?.loading || !syncTeamId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncResult?.loading ? 'Loading...' : 'Report'}
              </button>
              <button
                onClick={() => handleSyncTeam('update')}
                disabled={syncResult?.loading || !syncTeamId}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncResult?.loading ? 'Loading...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Check Indicator */}
      <div className="mb-4 bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-gray-700">Duplicate Check:</span>
          {duplicateCheck.hasDuplicates ? (
            <>
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-600 font-semibold">Failed</span>
              {duplicateCheck.duplicateIds.length > 0 && (
                <span className="text-sm text-red-600 ml-2">
                  (Duplicate IDs: {duplicateCheck.duplicateIds.join(', ')})
                </span>
              )}
            </>
          ) : (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-600 font-semibold">Passed</span>
            </>
          )}
        </div>
      </div>

      {/* Team Data Table */}
      <div className="overflow-x-auto">
        <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>School</span>
                    {teamSortColumn === 'name' && (
                      <span className="text-gray-400">
                        {teamSortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('mascot')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Mascot</span>
                    {teamSortColumn === 'mascot' && (
                      <span className="text-gray-400">
                        {teamSortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('key')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Abbreviation</span>
                    {teamSortColumn === 'key' && (
                      <span className="text-gray-400">
                        {teamSortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Index</span>
                    {teamSortColumn === 'id' && (
                      <span className="text-gray-400">
                        {teamSortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Logo
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Active
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Actions
                </th>
              </tr>
              <tr className="bg-gray-100 sticky top-[48px] z-10">
                <th className="px-3 py-2 bg-gray-100">
                  <input
                    type="text"
                    value={teamFilters.name}
                    onChange={(e) => setTeamFilters({ ...teamFilters, name: e.target.value })}
                    placeholder="Filter Team..."
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-3 py-2 bg-gray-100">
                  <input
                    type="text"
                    value={teamFilters.mascot}
                    onChange={(e) => setTeamFilters({ ...teamFilters, mascot: e.target.value })}
                    placeholder="Filter Mascot..."
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-3 py-2 bg-gray-100">
                  <input
                    type="text"
                    value={teamFilters.key}
                    onChange={(e) => setTeamFilters({ ...teamFilters, key: e.target.value })}
                    placeholder="Filter Abbreviation..."
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-3 py-2 bg-gray-100">
                  <input
                    type="text"
                    value={teamFilters.id}
                    onChange={(e) => setTeamFilters({ ...teamFilters, id: e.target.value })}
                    placeholder="Filter ID..."
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-3 py-2 bg-gray-100">
                  {/* Empty cell for logo image column filter */}
                </th>
                <th className="px-3 py-2 bg-gray-100">
                  {/* Empty cell for active column filter */}
                </th>
                <th className="px-3 py-2 bg-gray-100">
                  {/* Empty cell for actions column filter */}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamDataError ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center">
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                      <p className="text-sm font-medium text-red-800">Error loading team data</p>
                      <p className="text-sm text-red-700 mt-1">{teamDataError}</p>
                      <button
                        onClick={loadTeamData}
                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : Object.keys(teamData).length === 0 && isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Loading team data...
                  </td>
                </tr>
              ) : Object.keys(teamData).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No team data found. Click &quot;Add Team&quot; to add your first team.
                  </td>
                </tr>
              ) : (
                Object.entries(teamData)
                  .filter(([key, team]) => {
                    const keyMatch = !teamFilters.key || key.toLowerCase().includes(teamFilters.key.toLowerCase());
                    const idMatch = !teamFilters.id || team.id.toLowerCase().includes(teamFilters.id.toLowerCase());
                    const nameMatch = !teamFilters.name || team.name.toLowerCase().includes(teamFilters.name.toLowerCase());
                    const mascotMatch = !teamFilters.mascot || (team.mascot && team.mascot.toLowerCase().includes(teamFilters.mascot.toLowerCase()));
                    return keyMatch && idMatch && nameMatch && mascotMatch;
                  })
                  .sort((a, b) => {
                    if (teamSortColumn === 'name') {
                      const compareA = a[1].name.toLowerCase();
                      const compareB = b[1].name.toLowerCase();
                      if (teamSortOrder === 'asc') {
                        return compareA.localeCompare(compareB);
                      } else {
                        return compareB.localeCompare(compareA);
                      }
                    } else if (teamSortColumn === 'mascot') {
                      const mascotA = (a[1].mascot || '').toLowerCase();
                      const mascotB = (b[1].mascot || '').toLowerCase();
                      if (teamSortOrder === 'asc') {
                        return mascotA.localeCompare(mascotB);
                      } else {
                        return mascotB.localeCompare(mascotA);
                      }
                    } else if (teamSortColumn === 'key') {
                      const compareA = a[0].toLowerCase();
                      const compareB = b[0].toLowerCase();
                      if (teamSortOrder === 'asc') {
                        return compareA.localeCompare(compareB);
                      } else {
                        return compareB.localeCompare(compareA);
                      }
                    } else if (teamSortColumn === 'id') {
                      // Sort ID as numeric
                      const numA = parseInt(a[1].id) || 0;
                      const numB = parseInt(b[1].id) || 0;
                      if (teamSortOrder === 'asc') {
                        return numA - numB;
                      } else {
                        return numB - numA;
                      }
                    } else {
                      return 0;
                    }
                  })
                  .map(([key, team]) => (
                    <tr key={key}>
                      {editingTeam === key ? (
                        <>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingTeamData?.name || ''}
                              onChange={(e) => setEditingTeamData({ ...editingTeamData!, name: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingTeamData?.mascot || ''}
                              onChange={(e) => setEditingTeamData({ ...editingTeamData!, mascot: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingTeamData?.key || ''}
                              onChange={(e) => setEditingTeamData({ ...editingTeamData!, key: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingTeamData?.id || ''}
                              onChange={(e) => setEditingTeamData({ ...editingTeamData!, id: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            {editingTeamData?.logo ? (
                              <Image
                                src={editingTeamData.logo}
                                alt="Preview"
                                width={32}
                                height={32}
                                className="h-8 w-8 object-contain"
                                unoptimized
                              />
                            ) : (
                              <span className="text-gray-400 text-xs">No logo</span>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={editingTeamData?.active ?? false}
                                onChange={(e) => setEditingTeamData({ ...editingTeamData!, active: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </label>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={handleSaveTeam}
                                className="text-green-600 hover:text-green-900"
                                title="Save"
                              >
                                <Save className="w-5 h-5" />
                              </button>
                              <button
                                onClick={handleCancelEditTeam}
                                className="text-gray-600 hover:text-gray-900"
                                title="Cancel"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {team.name}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {team.mascot || <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {key}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {team.id}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            {team.logo ? (
                              <Image
                                src={team.logo}
                                alt={team.name}
                                width={32}
                                height={32}
                                className="h-8 w-8 object-contain"
                                unoptimized
                              />
                            ) : (
                              <span className="text-gray-400 text-xs">No logo</span>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={team.active ?? false}
                                onChange={() => handleToggleActive(key, team.active ?? false)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{team.active ? 'Active' : 'Inactive'}</span>
                            </label>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditTeam(key)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTeam(key)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

