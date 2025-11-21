'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Trash2, CheckCircle, Key, Edit2, X, Search, Disc } from 'lucide-react';

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

interface UsersTabProps {
  users: User[];
  onReload: () => Promise<void>;
}

/**
 * Truncate text to max length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export default function UsersTab({ users, onReload }: UsersTabProps) {
  const { data: session } = useSession();
  const [changingPasswordUserId, setChangingPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculate counts
  const totalUsers = users.length;
  const totalConfirmed = users.filter(u => u.emailConfirmed).length;
  const totalPending = users.filter(u => !u.emailConfirmed).length;

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(user => {
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.emailConfirmed ? 'confirmed' : 'pending').includes(query) ||
        (session?.user?.email?.toLowerCase() === user.email.toLowerCase() ? 'admin' : 'user').includes(query) ||
        new Date(user.createdAt).toLocaleDateString().toLowerCase().includes(query) ||
        (user.lastLogin ? new Date(user.lastLogin).toLocaleString().toLowerCase() : 'never').includes(query) ||
        `${user.bracketCounts?.submitted ?? 0}/${user.bracketCounts?.inProgress ?? 0}/${user.bracketCounts?.deleted ?? 0}`.includes(query)
      );
    });
  }, [users, searchQuery, session]);

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
        await onReload();
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
    setEditingUserId(null); // Close edit mode if open
  };

  const handleCancelPasswordChange = () => {
    setChangingPasswordUserId(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleChangePassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordError('');

    try {
      const response = await fetch(`/api/admin/users/${userId}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setChangingPasswordUserId(null);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
        await onReload();
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('An error occurred. Please try again.');
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditError('');
    setChangingPasswordUserId(null); // Close password change if open
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditName('');
    setEditEmail('');
    setEditError('');
  };

  const handleSaveEdit = async (userId: string) => {
    if (!editName.trim()) {
      setEditError('Name is required');
      return;
    }

    if (!editEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
      setEditError('Valid email is required');
      return;
    }

    setEditError('');

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setEditingUserId(null);
        setEditName('');
        setEditEmail('');
        setEditError('');
        await onReload();
      } else {
        setEditError(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setEditError('An error occurred. Please try again.');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, bracketCounts?: { submitted: number; inProgress: number; deleted: number }) => {
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

        await onReload();
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
      }
    }
  };

  const handleBulkDelete = async () => {
    // Get users that can be deleted (no bracket counts)
    const deletableUsers = filteredUsers.filter(user => {
      const counts = user.bracketCounts;
      return !counts || (counts.submitted === 0 && counts.inProgress === 0 && counts.deleted === 0);
    });

    if (deletableUsers.length === 0) {
      alert('No users can be deleted. All users in the current view have brackets.');
      return;
    }

    const skippedCount = filteredUsers.length - deletableUsers.length;
    const message = `This will delete ${deletableUsers.length} user(s) from the current view.\n\n${skippedCount > 0 ? `${skippedCount} user(s) will be skipped because they have brackets.\n\n` : ''}This action cannot be undone. Are you sure you want to continue?`;

    if (!confirm(message)) {
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      const userIds = deletableUsers.map(u => u.id);
      const response = await fetch('/api/admin/users/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userIds }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully deleted ${data.deleted} user(s).${data.skipped > 0 ? ` ${data.skipped} user(s) were skipped.` : ''}`);
        await onReload();
      } else {
        setError(data.error || 'Failed to bulk delete users');
      }
    } catch (error) {
      console.error('Error bulk deleting users:', error);
      setError('Failed to bulk delete users');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Counts at the top */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-600">Total Users</div>
          <div className="text-2xl font-bold text-blue-900">{totalUsers}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm font-medium text-green-600">Total Confirmed</div>
          <div className="text-2xl font-bold text-green-900">{totalConfirmed}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm font-medium text-yellow-600">Total Pending</div>
          <div className="text-2xl font-bold text-yellow-900">{totalPending}</div>
        </div>
      </div>

      {/* Search and Bulk Delete */}
      <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by any field..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={handleBulkDelete}
          disabled={isDeleting || filteredUsers.length === 0}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
        >
          {isDeleting ? 'Deleting...' : 'Bulk Delete'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

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
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  {searchQuery ? 'No users match your search' : 'No users found'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isUserAdmin = session?.user?.email?.toLowerCase() === user.email.toLowerCase();
                const isEditing = editingUserId === user.id;
                const isChangingPassword = changingPasswordUserId === user.id;

                return (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Name"
                        />
                      ) : (
                        <div 
                          className="text-sm font-medium text-gray-900 cursor-help"
                          title={user.name.length > 15 ? user.name : undefined}
                          onClick={() => {
                            // On mobile, show full text on click
                            if (window.innerWidth < 768 && user.name.length > 15) {
                              alert(user.name);
                            }
                          }}
                        >
                          {truncateText(user.name, 15)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Email"
                        />
                      ) : (
                        <div 
                          className="text-sm text-gray-900 cursor-help"
                          title={user.email.length > 15 ? user.email : undefined}
                          onClick={() => {
                            // On mobile, show full text on click
                            if (window.innerWidth < 768 && user.email.length > 15) {
                              alert(user.email);
                            }
                          }}
                        >
                          {truncateText(user.email, 15)}
                        </div>
                      )}
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
                      {isEditing ? (
                        <div className="space-y-1">
                          {editError && (
                            <div className="text-xs text-red-600 mb-1">{editError}</div>
                          )}
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleSaveEdit(user.id)}
                              className="p-1.5 rounded border border-transparent bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors"
                              title="Save changes"
                            >
                              <Disc className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1.5 rounded border border-transparent bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition-colors"
                              title="Cancel editing"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : isChangingPassword ? (
                        <div className="space-y-2 min-w-[300px]">
                          <div className="flex flex-col space-y-2">
                            <input
                              type="password"
                              placeholder="New password (min 6 characters)"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                              minLength={6}
                            />
                            <input
                              type="password"
                              placeholder="Confirm password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                              minLength={6}
                            />
                          </div>
                          {passwordError && (
                            <div className="text-xs text-red-600">{passwordError}</div>
                          )}
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleChangePassword(user.id)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelPasswordChange}
                              className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 rounded border border-transparent bg-purple-600 hover:bg-purple-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-500 transition-colors"
                            title="Edit user name and email"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
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
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
