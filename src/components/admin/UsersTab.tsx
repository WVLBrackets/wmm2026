'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Trash2, CheckCircle, Key } from 'lucide-react';

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

export default function UsersTab({ users, onReload }: UsersTabProps) {
  const { data: session } = useSession();
  const [changingPasswordUserId, setChangingPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [error, setError] = useState('');

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
        // Reload data to reflect changes
        await onReload();
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('An error occurred. Please try again.');
    }
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
        await onReload();
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
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
                      {changingPasswordUserId === user.id ? (
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

