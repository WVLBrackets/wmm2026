'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Trash2,
  CheckCircle,
  Key,
  Edit2,
  X,
  Search,
  Save,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';

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

type UserModalState = { mode: 'details' | 'edit'; user: User } | null;

/** Tailwind `lg` (1024px): desktop table layout vs mobile compact layout. */
function useIsLgUp(): boolean {
  // Start false for SSR/client hydration match; `useEffect` sets real value immediately after mount.
  const [isLgUp, setIsLgUp] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isLgUp;
}

/**
 * Read-only fields shown in mobile “Show more” and below the form in “Edit” modal.
 */
function UserModalExtraFields({
  user,
  isUserAdmin,
}: {
  user: User;
  isUserAdmin: boolean;
}) {
  return (
    <div className="space-y-3 border-t border-gray-200 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Account</p>
      <div>
        <div className="text-sm font-medium text-gray-700">Email confirmed</div>
        <div className="mt-0.5 text-sm text-gray-900">{user.emailConfirmed ? 'Yes' : 'No'}</div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-700">Role</div>
        <div className="mt-0.5">
          <span
            className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
              isUserAdmin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {isUserAdmin ? 'Admin' : 'User'}
          </span>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-700">Environment</div>
        <div className="mt-0.5 text-sm text-gray-900">{user.environment}</div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-700">Created</div>
        <div className="mt-0.5 text-sm text-gray-900">{new Date(user.createdAt).toLocaleString()}</div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-700">Last login</div>
        <div className="mt-0.5 text-sm text-gray-900">
          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : <span className="italic text-gray-400">Never</span>}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-700" title="Submitted / In progress / Deleted">
          Brackets
        </div>
        <div className="mt-0.5 font-mono text-sm text-gray-900">
          {user.bracketCounts?.submitted ?? 0} / {user.bracketCounts?.inProgress ?? 0} /{' '}
          {user.bracketCounts?.deleted ?? 0}
        </div>
      </div>
    </div>
  );
}

export default function UsersTab({ users, onReload }: UsersTabProps) {
  const { data: session } = useSession();
  const isLgUp = useIsLgUp();
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
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [pendingConfirmUserId, setPendingConfirmUserId] = useState<string | null>(null);
  const [confirmingUserId, setConfirmingUserId] = useState<string | null>(null);
  const [protectConfirmed, setProtectConfirmed] = useState<boolean>(true);
  /** Mobile: read-only “Show more” or edit form in a modal (desktop uses inline table edit). */
  const [userModal, setUserModal] = useState<UserModalState>(null);

  const closeUserModal = useCallback(() => {
    setUserModal(null);
    setEditError('');
  }, []);

  useEffect(() => {
    if (!userModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [userModal]);

  useEffect(() => {
    if (!userModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeUserModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userModal, closeUserModal]);
  /** When true, the table lists only users with unconfirmed email. */
  const [unconfirmedOnly, setUnconfirmedOnly] = useState(false);

  // Calculate counts
  const totalUsers = users.length;
  const totalConfirmed = users.filter(u => u.emailConfirmed).length;
  const totalPending = users.filter(u => !u.emailConfirmed).length;

  // Filter by unconfirmed toggle, then search query
  const filteredUsers = useMemo(() => {
    const base = unconfirmedOnly ? users.filter(u => !u.emailConfirmed) : users;
    if (!searchQuery.trim()) return base;

    const query = searchQuery.toLowerCase();
    return base.filter(user => {
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
  }, [users, searchQuery, session, unconfirmedOnly]);

  /** First step: show inline Confirm? Yes/No (same pattern as delete). */
  const handleRequestConfirmUser = (userId: string) => {
    setPendingConfirmUserId(userId);
    setPendingDeleteUserId(null);
    setEditingUserId(null);
    setChangingPasswordUserId(null);
    setUserModal(null);
  };

  const handleCancelConfirmUser = () => {
    setPendingConfirmUserId(null);
  };

  /** Completes manual email confirmation after inline approval. */
  const handleConfirmUserSubmit = async (userId: string) => {
    setConfirmingUserId(userId);
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${userId}/confirm`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setPendingConfirmUserId(null);
        await onReload();
      } else {
        setError(data.error || 'Failed to confirm user');
      }
    } catch (error) {
      console.error('Error confirming user:', error);
      setError('Failed to confirm user');
    } finally {
      setConfirmingUserId(null);
    }
  };

  const handleOpenPasswordChange = (userId: string) => {
    setChangingPasswordUserId(userId);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setEditingUserId(null); // Close edit mode if open
    setPendingConfirmUserId(null);
    setPendingDeleteUserId(null);
    setUserModal(null);
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
    setEditName(user.name);
    setEditEmail(user.email);
    setEditError('');
    setChangingPasswordUserId(null);
    setPendingConfirmUserId(null);
    setPendingDeleteUserId(null);
    if (isLgUp) {
      setUserModal(null);
      setEditingUserId(user.id);
    } else {
      setEditingUserId(null);
      setUserModal({ mode: 'edit', user });
    }
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
        setUserModal(m => (m?.mode === 'edit' && m.user.id === userId ? null : m));
        await onReload();
      } else {
        setEditError(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setEditError('An error occurred. Please try again.');
    }
  };

  const handleDeleteUser = (userId: string, userName: string, bracketCounts?: { submitted: number; inProgress: number; deleted: number }) => {
    if (bracketCounts && (bracketCounts.submitted > 0 || bracketCounts.inProgress > 0 || bracketCounts.deleted > 0)) {
      alert(`Cannot delete user "${userName}". User has brackets: ${bracketCounts.submitted} submitted, ${bracketCounts.inProgress} in progress, ${bracketCounts.deleted} deleted.`);
      return;
    }

    // Show inline confirmation
    setPendingConfirmUserId(null);
    setUserModal(null);
    setPendingDeleteUserId(userId);
  };

  const handleCancelDeleteUser = () => {
    setPendingDeleteUserId(null);
  };

  const handleConfirmDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    setPendingDeleteUserId(null);

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
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleBulkDelete = async () => {
    // Get users that can be deleted (no bracket counts)
    let deletableUsers = filteredUsers.filter(user => {
      const counts = user.bracketCounts;
      return !counts || (counts.submitted === 0 && counts.inProgress === 0 && counts.deleted === 0);
    });

    // Filter out confirmed users if protection is enabled
    let protectedCount = 0;
    if (protectConfirmed) {
      const confirmedUsers = deletableUsers.filter(user => user.emailConfirmed);
      protectedCount = confirmedUsers.length;
      deletableUsers = deletableUsers.filter(user => !user.emailConfirmed);
    }

    if (deletableUsers.length === 0) {
      const reasons = [];
      if (protectedCount > 0) {
        reasons.push(`${protectedCount} confirmed user(s) are protected`);
      }
      const bracketCount = filteredUsers.length - deletableUsers.length - protectedCount;
      if (bracketCount > 0) {
        reasons.push(`${bracketCount} user(s) have brackets`);
      }
      alert(`No users can be deleted. ${reasons.join(' and ')}.`);
      return;
    }

    const skippedCount = filteredUsers.length - deletableUsers.length - protectedCount;
    let message = `This will delete ${deletableUsers.length} user(s) from the current view.\n\n`;
    if (protectedCount > 0) {
      message += `${protectedCount} confirmed user(s) will be protected and not deleted.\n`;
    }
    if (skippedCount > 0) {
      message += `${skippedCount} user(s) will be skipped because they have brackets.\n`;
    }
    message += '\nThis action cannot be undone. Are you sure you want to continue?';

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

  /** Shared password-change form (desktop Actions cell + mobile PLAYER area). */
  function renderPasswordChangePanel(user: User) {
    return (
      <div className="w-full max-w-full min-w-0 space-y-2 lg:min-w-[300px]">
        <div className="flex flex-col space-y-2">
          <input
            type="password"
            placeholder="New password (min 6 characters)"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-500"
            minLength={6}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-500"
            minLength={6}
          />
        </div>
        {passwordError && <div className="text-xs text-red-600">{passwordError}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleChangePassword(user.id)}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancelPasswordChange}
            className="rounded bg-gray-500 px-3 py-1 text-xs text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  /** Inline confirm / delete prompts (desktop Actions + mobile PLAYER). */
  function renderRowFlows(user: User) {
    if (changingPasswordUserId === user.id) {
      return renderPasswordChangePanel(user);
    }
    if (pendingConfirmUserId === user.id) {
      return (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2 rounded border border-green-200 bg-green-50 px-2 py-2 whitespace-nowrap">
            <span className="text-xs font-medium text-green-800">Confirm?</span>
            <button
              type="button"
              onClick={() => handleConfirmUserSubmit(user.id)}
              disabled={confirmingUserId === user.id}
              className="shrink-0 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmingUserId === user.id ? '…' : 'Yes'}
            </button>
            <button
              type="button"
              onClick={handleCancelConfirmUser}
              disabled={confirmingUserId === user.id}
              className="shrink-0 rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              No
            </button>
          </div>
        </div>
      );
    }
    if (pendingDeleteUserId === user.id) {
      return (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2 rounded border border-red-200 bg-red-50 px-2 py-2 whitespace-nowrap">
            <span className="text-xs font-medium text-red-700">Delete?</span>
            <button
              type="button"
              onClick={() => handleConfirmDeleteUser(user.id)}
              disabled={deletingUserId === user.id}
              className="shrink-0 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={handleCancelDeleteUser}
              disabled={deletingUserId === user.id}
              className="shrink-0 rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              No
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  /** Same compact icon treatment as desktop Actions column; used in mobile 2×3 grid. */
  const mobileIconBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded border border-transparent p-1.5 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40';

  /**
   * Mobile-only 2×2 icon grid beside PLAYER (`lg+` hidden).
   * Unconfirmed: row1 Edit, Confirm — row2 Change password, Delete.
   * Confirmed: row1 Edit, Show more — row2 Change password, Delete.
   */
  function renderMobileActionGrid(user: User) {
    const cannotDelete =
      Boolean(user.bracketCounts) &&
      (user.bracketCounts!.submitted > 0 ||
        user.bracketCounts!.inProgress > 0 ||
        user.bracketCounts!.deleted > 0);

    return (
      <div
        className="grid w-full grid-cols-2 grid-rows-2 place-items-center gap-1"
        data-testid="user-mobile-action-grid"
      >
        <button
          type="button"
          onClick={() => handleOpenEdit(user)}
          title="Edit user"
          className={`${mobileIconBtn} bg-purple-600 hover:bg-purple-700 focus:ring-purple-500`}
        >
          <Edit2 className="h-4 w-4 shrink-0" aria-hidden />
          <span className="sr-only">Edit</span>
        </button>
        {user.emailConfirmed ? (
          <button
            type="button"
            onClick={() => setUserModal({ mode: 'details', user })}
            title="Show more"
            data-testid="user-row-show-more"
            className={`${mobileIconBtn} bg-gray-600 hover:bg-gray-700 focus:ring-gray-500`}
          >
            <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            <span className="sr-only">Show more</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleRequestConfirmUser(user.id)}
            title="Confirm user"
            className={`${mobileIconBtn} bg-green-600 hover:bg-green-700 focus:ring-green-500`}
          >
            <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span className="sr-only">Confirm</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => handleOpenPasswordChange(user.id)}
          title="Change password"
          className={`${mobileIconBtn} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`}
        >
          <Key className="h-4 w-4 shrink-0" aria-hidden />
          <span className="sr-only">Change password</span>
        </button>
        <button
          type="button"
          onClick={() => handleDeleteUser(user.id, user.name, user.bracketCounts)}
          disabled={deletingUserId === user.id || cannotDelete}
          title={cannotDelete ? 'Cannot delete user with existing brackets' : 'Delete user'}
          className={`${mobileIconBtn} bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-gray-300 disabled:hover:bg-gray-300`}
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
          <span className="sr-only">Delete</span>
        </button>
      </div>
    );
  }

  /** Desktop Actions column: save/cancel when editing, else flows, else icon toolbar. */
  function renderDesktopActionsCell(user: User) {
    const isEditing = isLgUp && editingUserId === user.id;
    const flows = renderRowFlows(user);

    if (isEditing) {
      return (
        <div className="space-y-1">
          {editError && <div className="mb-1 text-xs text-red-600">{editError}</div>}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => handleSaveEdit(user.id)}
              className="rounded border border-transparent bg-blue-600 p-1.5 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              title="Save changes"
            >
              <Save className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded border border-transparent bg-red-600 p-1.5 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              title="Cancel editing"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }

    if (flows) {
      return flows;
    }

    return (
      <div className="flex items-center space-x-1">
        <button
          type="button"
          onClick={() => handleOpenEdit(user)}
          className="rounded border border-transparent bg-purple-600 p-1.5 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
          title="Edit user name and email"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        {!user.emailConfirmed && (
          <button
            type="button"
            onClick={() => handleRequestConfirmUser(user.id)}
            className="rounded border border-transparent bg-green-600 p-1.5 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
            title="Manually confirm this user"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => handleOpenPasswordChange(user.id)}
          className="rounded border border-transparent bg-blue-600 p-1.5 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          title="Change user password"
        >
          <Key className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleDeleteUser(user.id, user.name, user.bracketCounts)}
          disabled={
            deletingUserId === user.id ||
            Boolean(
              user.bracketCounts &&
                (user.bracketCounts.submitted > 0 ||
                  user.bracketCounts.inProgress > 0 ||
                  user.bracketCounts.deleted > 0)
            )
          }
          className={`rounded border border-transparent p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
            user.bracketCounts &&
            (user.bracketCounts.submitted > 0 ||
              user.bracketCounts.inProgress > 0 ||
              user.bracketCounts.deleted > 0)
              ? 'cursor-not-allowed bg-gray-400 text-white opacity-50'
              : 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
          }`}
          title={
            user.bracketCounts &&
            (user.bracketCounts.submitted > 0 ||
              user.bracketCounts.inProgress > 0 ||
              user.bracketCounts.deleted > 0)
              ? 'Cannot delete user with existing brackets'
              : 'Delete user'
          }
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const modalUserResolved =
    userModal != null ? (users.find(u => u.id === userModal.user.id) ?? userModal.user) : null;
  const modalIsUserAdmin = Boolean(
    modalUserResolved &&
      session?.user?.email?.toLowerCase() === modalUserResolved.email.toLowerCase()
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Counts at the top */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-600">Total</div>
          <div className="text-2xl font-bold text-blue-900">{totalUsers}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm font-medium text-green-600">Confirmed</div>
          <div className="text-2xl font-bold text-green-900">{totalConfirmed}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm font-medium text-yellow-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-900">{totalPending}</div>
        </div>
      </div>

      {/* Search and Bulk Delete */}
      <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="protectConfirmed"
              checked={protectConfirmed}
              onChange={(e) => setProtectConfirmed(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="protectConfirmed" className="text-sm font-medium text-gray-700">
              Protect Confirmed
            </label>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by any field..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReload}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center gap-2"
            title="Refresh user list"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setUnconfirmedOnly(v => !v)}
            aria-pressed={unconfirmedOnly}
            className={
              unconfirmedOnly
                ? 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors'
                : 'px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-colors'
            }
            title={
              unconfirmedOnly
                ? 'Show all users'
                : 'Show only users who have not confirmed their email'
            }
          >
            {unconfirmedOnly ? 'Show All' : 'Unconfirmed'}
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={isDeleting || filteredUsers.length === 0}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
          >
            {isDeleting ? 'Deleting...' : 'Bulk Delete'}
          </button>
        </div>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">
                PLAYER
              </th>
              <th className="table-cell w-[88px] px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider lg:hidden">
                Actions
              </th>
              <th className="hidden px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:table-cell">
                Role
              </th>
              <th className="hidden px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:table-cell">
                Created
              </th>
              <th className="hidden px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:table-cell">
                Last Login
              </th>
              <th
                className="hidden cursor-help px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:table-cell"
                title="Bracket counts: Submitted / In Progress / Deleted"
              >
                Brackets
              </th>
              <th
                className="hidden px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:table-cell"
                style={{ minWidth: '200px' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  {searchQuery.trim()
                    ? 'No users match your search'
                    : unconfirmedOnly
                      ? 'No unconfirmed users'
                      : 'No users found'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isUserAdmin = session?.user?.email?.toLowerCase() === user.email.toLowerCase();
                const isEditingRow = isLgUp && editingUserId === user.id;
                const mobileFlows = renderRowFlows(user);
                const hasMobileFlow = mobileFlows !== null;

                return (
                  <tr key={user.id}>
                    <td className="px-4 py-4 align-top sm:px-6">
                      <div className="flex min-w-0 flex-col gap-1">
                        {isEditingRow ? (
                          <>
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full min-w-0 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500"
                              placeholder="Name"
                            />
                            <input
                              type="email"
                              value={editEmail}
                              onChange={e => setEditEmail(e.target.value)}
                              className="w-full min-w-0 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500"
                              placeholder="Email"
                            />
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                            <a
                              href={`mailto:${user.email}`}
                              className="w-fit break-words text-sm font-normal text-blue-600 underline hover:text-blue-800"
                            >
                              {user.email}
                            </a>
                          </>
                        )}
                      </div>
                    </td>
                    <td
                      className={`table-cell align-top px-2 py-4 lg:hidden ${hasMobileFlow ? 'min-w-[200px] max-w-[55vw]' : 'w-[88px]'}`}
                    >
                      <div className="w-full min-w-0">{mobileFlows ?? renderMobileActionGrid(user)}</div>
                    </td>
                    <td className="hidden px-6 py-4 whitespace-nowrap lg:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          isUserAdmin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {isUserAdmin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 whitespace-nowrap text-sm text-gray-500 lg:table-cell">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="hidden px-6 py-4 whitespace-nowrap text-sm text-gray-500 lg:table-cell">
                      {user.lastLogin ? (
                        new Date(user.lastLogin).toLocaleString()
                      ) : (
                        <span className="italic text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="hidden px-6 py-4 whitespace-nowrap text-sm text-gray-900 lg:table-cell">
                      <span title="Submitted / In Progress / Deleted" className="font-mono">
                        {user.bracketCounts?.submitted ?? 0} / {user.bracketCounts?.inProgress ?? 0} /{' '}
                        {user.bracketCounts?.deleted ?? 0}
                      </span>
                    </td>
                    <td
                      className="hidden px-6 py-4 text-sm lg:table-cell"
                      style={{ overflow: 'visible', minWidth: '200px', width: '200px' }}
                    >
                      {renderDesktopActionsCell(user)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {userModal != null && modalUserResolved != null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={e => {
            if (e.target === e.currentTarget) closeUserModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <h2 id="user-modal-title" className="text-lg font-semibold text-gray-900">
                {userModal.mode === 'edit' ? 'Edit user' : 'User details'}
              </h2>
              <button
                type="button"
                onClick={closeUserModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {userModal.mode === 'details' ? (
                <>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Name</div>
                    <div className="mt-1 text-sm text-gray-900">{modalUserResolved.name}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Email</div>
                    <div className="mt-1 break-words text-sm text-gray-900">{modalUserResolved.email}</div>
                  </div>
                  <UserModalExtraFields user={modalUserResolved} isUserAdmin={modalIsUserAdmin} />
                </>
              ) : (
                <>
                  {editError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      {editError}
                    </div>
                  )}
                  <div>
                    <label htmlFor="modal-edit-name" className="text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      id="modal-edit-name"
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500"
                      placeholder="Name"
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-edit-email" className="text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      id="modal-edit-email"
                      type="email"
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500"
                      placeholder="Email"
                    />
                  </div>
                  <UserModalExtraFields user={modalUserResolved} isUserAdmin={modalIsUserAdmin} />
                  <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(userModal.user.id)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeUserModal();
                        setEditName('');
                        setEditEmail('');
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
