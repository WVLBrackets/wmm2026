'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Trash2, Edit, Save, X, Users, Trophy, CheckCircle, Key, Edit3 } from 'lucide-react';
import { useBracketMode } from '@/contexts/BracketModeContext';

interface User {
  id: string;
  email: string;
  name: string;
  emailConfirmed: boolean;
  createdAt: string;
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
  const [activeTab, setActiveTab] = useState<'brackets' | 'users'>('brackets');
  const [editingBracket, setEditingBracket] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Bracket>>({});
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [changingPasswordUserId, setChangingPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  // Ensure bracket mode is disabled when admin page loads
  useEffect(() => {
    setInBracketMode(false);
  }, [setInBracketMode]);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    
    loadData();
  }, [status, router]);

  useEffect(() => {
    // Filter brackets when filters change
    let filtered = brackets;
    
    if (filterUser !== 'all') {
      filtered = filtered.filter(b => b.userId === filterUser);
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === filterStatus);
    }
    
    setFilteredBrackets(filtered);
  }, [brackets, filterUser, filterStatus]);

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
            <div className="text-right">
              <p className="text-sm text-gray-600">Logged in as</p>
              <p className="font-semibold text-gray-900">{session?.user?.email}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
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
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span 
                              title="Submitted / In Progress / Deleted"
                              className="font-mono"
                            >
                              {user.bracketCounts?.submitted ?? 0} / {user.bracketCounts?.inProgress ?? 0} / {user.bracketCounts?.deleted ?? 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center space-x-2">
                              {!user.emailConfirmed && (
                                <button
                                  onClick={() => handleConfirmUser(user.id)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                  title="Manually confirm this user"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Confirm
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenPasswordChange(user.id)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                title="Change user password"
                              >
                                <Key className="h-4 w-4 mr-1" />
                                Password
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
                                className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
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
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
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
    </div>
  );
}

