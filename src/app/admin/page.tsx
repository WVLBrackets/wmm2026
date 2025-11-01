'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Trash2, Edit, Save, X, Users, Trophy, CheckCircle, Key, Edit3, LogOut, Link2, Table, Plus, Download, AlertCircle } from 'lucide-react';
import { useBracketMode } from '@/contexts/BracketModeContext';

interface User {
  id: string;
  email: string;
  name: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastLogin?: string | null;
  environment: string;
  bracketCounts?: {
    submitted: number;
    inProgress: number;
    deleted: number;
  };
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

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { setInBracketMode } = useBracketMode();
  
  const [users, setUsers] = useState<User[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [filteredBrackets, setFilteredBrackets] = useState<Bracket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'brackets' | 'users' | 'data'>('users');
  const [editingBracket, setEditingBracket] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Bracket>>({});
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [changingPasswordUserId, setChangingPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [teamData, setTeamData] = useState<Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }>>({});
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingTeamData, setEditingTeamData] = useState<{ key: string; id: string; name: string; mascot?: string; logo: string; active?: boolean } | null>(null);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamData, setNewTeamData] = useState<{ key: string; id: string; name: string; mascot?: string; logo: string; active?: boolean }>({ key: '', id: '', name: '', mascot: '', logo: '', active: true });
  const [teamDataError, setTeamDataError] = useState('');
  const [teamFilters, setTeamFilters] = useState<{ key: string; id: string; name: string; mascot: string; logo: string }>({ key: '', id: '', name: '', mascot: '', logo: '' });
  const [teamSortColumn, setTeamSortColumn] = useState<'name' | 'mascot' | 'key' | 'id' | null>('name');
  const [teamSortOrder, setTeamSortOrder] = useState<'asc' | 'desc'>('asc');
  const [duplicateCheck, setDuplicateCheck] = useState<{ hasDuplicates: boolean; duplicateIds: string[] }>({ hasDuplicates: false, duplicateIds: [] });
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [teamActiveFilter, setTeamActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Ensure bracket mode is disabled when admin page loads
  useEffect(() => {
    setInBracketMode(false);
  }, [setInBracketMode]);

  const loadDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    // Filter brackets when filters change
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
    
    setFilteredBrackets(filtered);
  }, [brackets, filterUser, filterStatus, filterYear]);

  const loadTeamDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const [usersRes, bracketsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/brackets')
      ]);
      
      const usersData = await usersRes.json();
      const bracketsData = await bracketsRes.json();
      
      if (!usersRes.ok || !bracketsRes.ok) {
        if (usersRes.status === 403 || bracketsRes.status === 403) {
          setError('Unauthorized: Admin access required');
          setTimeout(() => router.push('/'), 2000);
          return;
        }
        throw new Error('Failed to load data');
      }
      
      setUsers(usersData.users || usersData.data || []);
      setBrackets(bracketsData.data || []);
      setFilteredBrackets(bracketsData.data || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

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
        filteredData = Object.fromEntries(
          Object.entries(loadedData).filter(([_, team]) => !team.active)
        );
      } else if (teamActiveFilter === 'active') {
        filteredData = Object.fromEntries(
          Object.entries(loadedData).filter(([_, team]) => team.active !== false)
        );
      }
      
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
    Object.entries(nameCounts).forEach(([name, keys]) => {
      if (keys.length > 1) {
        keys.forEach(k => duplicateIds.add(k));
      }
    });

    Object.entries(keyCounts).forEach(([key, keys]) => {
      if (keys.length > 1) {
        keys.forEach(k => duplicateIds.add(k));
      }
    });

    Object.entries(idCounts).forEach(([id, keys]) => {
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

  // Assign functions to refs after they're declared
  loadDataRef.current = loadData;
  loadTeamDataRef.current = loadTeamData;

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    
    // Check if we're in development (hide Team Data tab)
    const hostname = window.location.hostname;
    setIsDevelopment(hostname === 'localhost' || hostname === '127.0.0.1');
    
    loadDataRef.current?.();
  }, [status, router]);

  useEffect(() => {
    // Load team data when Data tab is active
    if (activeTab === 'data') {
      loadTeamDataRef.current?.();
    }
  }, [activeTab]);

  // Reload team data when filter changes
  useEffect(() => {
    if (activeTab === 'data' && loadTeamDataRef.current) {
      loadTeamDataRef.current();
    }
  }, [teamActiveFilter, activeTab]);

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

      // If we're filtering by active status, the team may disappear/appear
      // Let the existing filter logic handle it based on teamActiveFilter
      // Re-run duplicate check on updated data
      setTeamData(prev => {
        checkForDuplicates(prev);
        return prev;
      });
    } catch (error) {
      console.error('Error toggling team active status:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to toggle team active status');
    }
  };

  const handleConfirmUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to manually confirm this user? This will allow them to login.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/confirm`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        // Reload data to reflect changes
        loadData();
      } else {
        setError(data.error || 'Failed to confirm user');
      }
    } catch (error) {
      console.error('Error confirming user:', error);
      setError('Failed to confirm user');
    }
  };

  const handleOpenPasswordChange = (userId: string) => {
    setChangingPasswordUserId(userId);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleCancelPasswordChange = () => {
    setChangingPasswordUserId(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleDeleteUser = async (userId: string, userName: string, bracketCounts?: { submitted: number; inProgress: number; deleted: number }) => {
    // Check if user has any brackets
    if (bracketCounts && (bracketCounts.submitted > 0 || bracketCounts.inProgress > 0 || bracketCounts.deleted > 0)) {
      alert(`Cannot delete user "${userName}". User has brackets: ${bracketCounts.submitted} submitted, ${bracketCounts.inProgress} in progress, ${bracketCounts.deleted} deleted.`);
      return;
    }

    if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to delete user');
          return;
        }

        // Reload data after successful deletion
        await loadData();
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
      }
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${changingPasswordUserId}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        // Reset form and reload data
        handleCancelPasswordChange();
        loadData();
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('Failed to change password');
    }
  };

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
    // Redirect to bracket editing page with admin mode
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
        await loadData();
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

  const handleDelete = async (bracketId: string, entryName: string) => {
    if (!confirm(`Are you sure you want to delete the bracket "${entryName}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/brackets/${bracketId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        await loadData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting bracket:', error);
      alert('Failed to delete bracket');
    }
  };

  const handleDeleteAllFiltered = async () => {
    if (filteredBrackets.length === 0) {
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${filteredBrackets.length} bracket(s)?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // Delete all filtered brackets
      const deletePromises = filteredBrackets.map(bracket => 
        fetch(`/api/admin/brackets/${bracket.id}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(deletePromises);
      const dataResults = await Promise.all(results.map(r => r.json()));
      
      // Check for any failures
      const failures = dataResults.filter(d => !d.success);
      
      if (failures.length > 0) {
        alert(`Failed to delete ${failures.length} bracket(s). ${dataResults.length - failures.length} bracket(s) deleted successfully.`);
      }

      // Reload data
      await loadData();
      
      if (failures.length === 0) {
        alert(`Successfully deleted ${filteredBrackets.length} bracket(s).`);
      }
    } catch (error) {
      console.error('Error deleting filtered brackets:', error);
      alert('Failed to delete brackets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-red-600 text-center">
            <p className="text-xl font-bold mb-2">Error</p>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600 mt-1">Manage users and brackets</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Logged in as</p>
                <p className="font-semibold text-gray-900">{session?.user?.email}</p>
              </div>
              <button
                onClick={() => setShowEndpoints(!showEndpoints)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center space-x-2"
              >
                <Link2 className="h-4 w-4" />
                <span>Endpoints</span>
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Endpoints Modal */}
        {showEndpoints && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">API Endpoints</h2>
              <button
                onClick={() => setShowEndpoints(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Get all users with bracket counts and last login info (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/admin/users"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users/[id]
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">DELETE</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Delete a user (only if all bracket counts are 0) (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      Requires ID parameter
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users/[id]/confirm
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">POST</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Manually confirm a user&apos;s email address (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      Requires ID parameter
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users/[id]/change-password
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">POST</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Change a user&apos;s password and auto-confirm their account (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      Requires ID parameter
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/brackets
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Get all brackets with user information (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/admin/brackets"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/brackets/[id]
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">PUT</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Update bracket details including ownership (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      Requires ID parameter
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users-across-environments
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      View users from both preview and production environments (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/admin/users-across-environments"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/init-database
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET/POST</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Initialize database tables and schema (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/init-database"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/email-status
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET/POST</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Check email service status and send test emails (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/email-status"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/check-admin
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Check if current user is an admin (Public, returns boolean)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/check-admin"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Users ({users.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('brackets')}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'brackets'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Trophy className="w-5 h-5" />
                <span>Brackets ({brackets.length})</span>
              </button>
              {!isDevelopment && (
                <button
                  onClick={() => setActiveTab('data')}
                  className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                    activeTab === 'data'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Table className="w-5 h-5" />
                  <span>Team Data ({Object.keys(teamData).length})</span>
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Brackets Tab */}
        {activeTab === 'brackets' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Filters */}
            <div className="mb-6 flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by User
                </label>
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                  Filter by Year
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Years</option>
                  {Array.from(new Set(brackets.map(b => b.year).filter(y => y !== undefined && y !== null)))
                    .sort((a, b) => (b || 0) - (a || 0))
                    .map(year => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                </select>
              </div>
              
              <div className="ml-auto">
                <button
                  onClick={handleDeleteAllFiltered}
                  disabled={filteredBrackets.length === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    filteredBrackets.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                  title={filteredBrackets.length === 0 ? 'No brackets to delete' : `Delete ${filteredBrackets.length} filtered bracket(s)`}
                >
                  <Trash2 className="w-4 h-4 inline mr-2" />
                  Delete All Filtered ({filteredBrackets.length})
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
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
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
                          {new Date(bracket.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                                onClick={() => handleDelete(bracket.id, bracket.entryName)}
                                className="text-red-600 hover:text-red-900"
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
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-help"
                      title="Bracket counts: Submitted / In Progress / Deleted"
                    >
                      Brackets
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      // Check if this user is the admin (matches session email)
                      const isUserAdmin = session?.user?.email?.toLowerCase() === user.email.toLowerCase();
                      return (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{user.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.emailConfirmed
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {user.emailConfirmed ? 'Confirmed' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              isUserAdmin
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {isUserAdmin ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.lastLogin 
                              ? new Date(user.lastLogin).toLocaleString()
                              : <span className="text-gray-400 italic">Never</span>
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span 
                              title="Submitted / In Progress / Deleted"
                              className="font-mono"
                            >
                              {user.bracketCounts?.submitted ?? 0} / {user.bracketCounts?.inProgress ?? 0} / {user.bracketCounts?.deleted ?? 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center space-x-1">
                              {!user.emailConfirmed && (
                                <button
                                  onClick={() => handleConfirmUser(user.id)}
                                  className="p-1.5 rounded border border-transparent bg-green-600 hover:bg-green-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 transition-colors"
                                  title="Manually confirm this user"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenPasswordChange(user.id)}
                                className="p-1.5 rounded border border-transparent bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors"
                                title="Change user password"
                              >
                                <Key className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.name, user.bracketCounts)}
                                disabled={
                                  user.bracketCounts && (
                                    (user.bracketCounts.submitted > 0) || 
                                    (user.bracketCounts.inProgress > 0) || 
                                    (user.bracketCounts.deleted > 0)
                                  )
                                }
                                className={`p-1.5 rounded border border-transparent focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${
                                  (user.bracketCounts && (
                                    (user.bracketCounts.submitted > 0) || 
                                    (user.bracketCounts.inProgress > 0) || 
                                    (user.bracketCounts.deleted > 0)
                                  ))
                                    ? 'bg-gray-400 text-white cursor-not-allowed opacity-50'
                                    : 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
                                }`}
                                title={
                                  (user.bracketCounts && (
                                    (user.bracketCounts.submitted > 0) || 
                                    (user.bracketCounts.inProgress > 0) || 
                                    (user.bracketCounts.deleted > 0)
                                  ))
                                    ? 'Cannot delete user with existing brackets'
                                    : 'Delete User'
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {changingPasswordUserId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Change User Password</h3>
                <button
                  onClick={handleCancelPasswordChange}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm new password"
                  />
                </div>

                {passwordError && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                    <p className="text-sm text-red-800">{passwordError}</p>
                  </div>
                )}

                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                  <p className="text-sm text-yellow-800">
                    This will change the user&apos;s password, confirm their account, and allow them to login immediately.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={handleCancelPasswordChange}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Tab */}
      {activeTab === 'data' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Team Reference Data</h2>
              <div className="flex items-center space-x-3">
                {!isAddingTeam && (
                  <>
                    <button
                      onClick={() => router.push('/admin/tournament-builder')}
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>New Bracket</span>
                    </button>
                    <button
                      onClick={handleExportTeamData}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      title="Export team data to JSON file for git commit"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      onClick={handleAddTeam}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Team</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Active Filter Toggles */}
            <div className="flex items-center space-x-2 mb-4">
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
                              <img
                                src={editingTeamData.logo}
                                alt="Preview"
                                className="h-8 w-8 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
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
                              <img
                                src={team.logo}
                                alt={team.name}
                                className="h-8 w-8 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
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
      )}
    </div>
  );
}

