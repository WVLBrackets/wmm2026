'use client';

import { Fragment } from 'react';
import { Trash2, Edit, Save, X, Vote, CheckCircle, Clock, Calculator } from 'lucide-react';

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
  submittedAt?: string | null;
}

/**
 * Admin brackets table: first line date, second line time (local timezone).
 */
function AdminBracketDateTimeCell({
  iso,
  title,
}: {
  iso: string;
  title?: string;
}) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return <span className="text-gray-400">—</span>;
  }
  const dateLine = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeLine = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
  return (
    <div className="flex flex-col leading-tight" title={title}>
      <span>{dateLine}</span>
      <span className="text-xs text-gray-400">{timeLine}</span>
    </div>
  );
}

const DEFAULT_PERM_DELETE_MESSAGE =
  'Permanently delete this bracket? This cannot be undone.||Are you sure you want to continue?';

/**
 * Renders site-config style messages that use `||` as paragraph breaks.
 */
function renderMessageWithLineBreaks(message: string) {
  const parts = message.split('||');
  if (parts.length === 1) {
    return <>{message}</>;
  }
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

/** Status glyph beside entry name (mobile layout). */
function BracketStatusIcon({ status }: { status: string }) {
  if (status === 'submitted') {
    return (
      <span className="inline-flex shrink-0" title="Submitted">
        <CheckCircle className="h-5 w-5 text-green-600" aria-hidden />
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex shrink-0" title="In progress">
        <Clock className="h-5 w-5 text-yellow-600" aria-hidden />
      </span>
    );
  }
  if (status === 'deleted') {
    return (
      <span className="inline-flex shrink-0" title="Deleted">
        <Trash2 className="h-5 w-5 text-red-600" aria-hidden />
      </span>
    );
  }
  return <span className="inline-block h-5 w-5 shrink-0" aria-hidden />;
}

interface RowEditForm {
  entryName?: string;
  status?: string;
  userId?: string;
}

interface RowFeedback {
  type: 'success' | 'error';
  message: string;
}

interface BracketTableRowProps {
  bracket: Bracket;
  users: User[];
  /** When true, two-column mobile row (stacked entry/user + 2×2 actions). */
  isMobileLayout?: boolean;
  isEditing: boolean;
  editForm: RowEditForm;
  onEditFormChange: (updates: Partial<RowEditForm>) => void;
  onSave: () => void;
  onCancel: () => void;
  onEditPicks: () => void;
  onEditDetails: () => void;
  onDelete: () => void;
  pendingDelete: boolean;
  deleting: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  feedback: RowFeedback | null;
  isSyncing: boolean;
  /** Message for permanent delete confirmation (`||` = line break). From site config when available. */
  permanentDeleteMessage?: string;
}

const actionIconBtn =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded border border-transparent p-1.5 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40';

export default function BracketTableRow({
  bracket,
  users,
  isMobileLayout = false,
  isEditing,
  editForm,
  onEditFormChange,
  onSave,
  onCancel,
  onEditPicks,
  onEditDetails,
  onLiveScore,
  showLiveScoreButton = true,
  onDelete,
  pendingDelete,
  deleting,
  onConfirmDelete,
  onCancelDelete,
  feedback,
  isSyncing,
  permanentDeleteMessage = DEFAULT_PERM_DELETE_MESSAGE,
}: BracketTableRowProps) {
  const selectedUser = users.find((u) => u.id === (editForm.userId || bracket.userId));
  const isDeletedStatus = bracket.status === 'deleted';

  if (isMobileLayout) {
    const permanentPending = pendingDelete && isDeletedStatus;
    if (permanentPending) {
      return (
        <tr>
          <td className="px-3 py-3 align-top">
            <div className="flex min-w-0 items-start gap-2">
              <BracketStatusIcon status={bracket.status} />
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <div className="text-sm font-semibold leading-snug text-gray-900 break-words">
                    {bracket.entryName}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {bracket.year || new Date().getFullYear()}-
                    {String(bracket.bracketNumber || '?').padStart(6, '0')}
                  </div>
                </div>
                <div
                  className="rounded border border-red-200 bg-red-50 px-2 py-2 text-left text-xs leading-snug text-gray-800"
                  data-testid="admin-permanent-delete-confirmation"
                >
                  {renderMessageWithLineBreaks(permanentDeleteMessage)}
                </div>
              </div>
            </div>
          </td>
          <td className="w-[96px] min-w-[96px] align-top px-2 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={deleting}
                className="rounded bg-red-800 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                disabled={deleting}
                className="rounded bg-gray-200 px-2 py-1.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                No
              </button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr>
        <td className="px-3 py-3 align-top">
          {isEditing ? (
            <div className="flex min-w-0 flex-col gap-2">
              <select
                value={editForm.userId || ''}
                onChange={(e) => onEditFormChange({ userId: e.target.value })}
                title={
                  selectedUser ? `${selectedUser.name} (${selectedUser.email})` : 'Select user'
                }
                className="w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={editForm.entryName || ''}
                onChange={(e) => onEditFormChange({ entryName: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSave();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                  }
                }}
                className="w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                placeholder="Entry name"
              />
              <select
                value={editForm.status || ''}
                onChange={(e) => onEditFormChange({ status: e.target.value })}
                className="w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
              >
                <option value="in_progress">In Progress</option>
                <option value="submitted">Submitted</option>
                <option value="deleted">Deleted</option>
              </select>
              {feedback && (
                <div
                  className={`text-xs whitespace-normal break-words ${
                    feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {feedback.message}
                </div>
              )}
              {isSyncing && <div className="text-xs text-blue-600">Syncing updates...</div>}
            </div>
          ) : (
            <div className="flex min-w-0 items-start gap-2">
              <BracketStatusIcon status={bracket.status} />
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold leading-snug text-gray-900 break-words">
                  {bracket.entryName}
                </div>
                <div className="mt-1 text-sm text-gray-900 break-words">{bracket.userName}</div>
                <div className="mt-0.5 text-sm break-words text-blue-600">{bracket.userEmail}</div>
                <div
                  className="mt-1 text-xs text-gray-500"
                  title="Bracket ID"
                >
                  {bracket.year || new Date().getFullYear()}-
                  {String(bracket.bracketNumber || '?').padStart(6, '0')}
                </div>
                {feedback && (
                  <div
                    className={`mt-2 text-xs whitespace-normal break-words ${
                      feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}
                {isSyncing && <div className="mt-1 text-xs text-blue-600">Syncing updates...</div>}
              </div>
            </div>
          )}
        </td>
        <td className="w-[96px] min-w-[96px] align-top px-2 py-3">
          {isEditing ? (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={onSave}
                className={`${actionIconBtn} bg-green-600 hover:bg-green-700 focus:ring-green-500`}
                title="Save"
              >
                <Save className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">Save</span>
              </button>
              <button
                type="button"
                onClick={onCancel}
                className={`${actionIconBtn} bg-gray-500 hover:bg-gray-600 focus:ring-gray-500`}
                title="Cancel"
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">Cancel</span>
              </button>
            </div>
          ) : pendingDelete ? (
            <div className="flex min-w-0 flex-col gap-1 rounded border border-red-200 bg-red-50 p-1.5">
              <span className="text-center text-[10px] font-medium text-red-800">Delete?</span>
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={deleting}
                className="rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                disabled={deleting}
                className="rounded bg-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50"
              >
                No
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 grid-rows-2 place-items-center gap-1">
              <button
                type="button"
                onClick={onEditDetails}
                title="Edit entry name and status"
                className={`${actionIconBtn} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`}
              >
                <Edit className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">Edit details</span>
              </button>
              <button
                type="button"
                onClick={onEditPicks}
                title="Edit picks"
                className={`${actionIconBtn} bg-purple-600 hover:bg-purple-700 focus:ring-purple-500`}
              >
                <Vote className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">Edit picks</span>
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                title={
                  isDeletedStatus
                    ? 'Permanently remove this bracket from the database'
                    : 'Mark bracket as deleted (soft delete)'
                }
                className={`${actionIconBtn} ${
                  isDeletedStatus
                    ? 'bg-red-900 hover:bg-red-950 focus:ring-red-800 disabled:bg-gray-300'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-gray-300'
                }`}
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">Delete</span>
              </button>
              {showLiveScoreButton && onLiveScore ? (
                <button
                  type="button"
                  onClick={onLiveScore}
                  title="KEY scoring (completed games)"
                  className={`${actionIconBtn} bg-teal-600 hover:bg-teal-700 focus:ring-teal-500`}
                  data-testid="admin-bracket-live-score"
                >
                  <Calculator className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="sr-only">KEY scoring</span>
                </button>
              ) : (
                <div
                  className="h-9 w-9 shrink-0 rounded border border-dashed border-gray-200 bg-gray-50/70"
                  aria-hidden
                />
              )}
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="min-w-0 overflow-hidden px-4 py-4 align-top">
        {isEditing ? (
          <>
            <input
              type="text"
              value={editForm.entryName || ''}
              onChange={(e) => onEditFormChange({ entryName: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSave();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancel();
                }
              }}
              className="box-border w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            />
            {feedback && (
              <div
                className={`mt-1 min-w-0 whitespace-normal break-words text-xs ${
                  feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {feedback.message}
              </div>
            )}
            {isSyncing && <div className="mt-1 text-xs text-blue-600">Syncing updates...</div>}
          </>
        ) : (
          <>
            <div className="truncate text-sm text-gray-900" title={bracket.entryName}>
              {bracket.entryName}
            </div>
            {feedback && (
              <div
                className={`mt-1 min-w-0 whitespace-normal break-words text-xs ${
                  feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {feedback.message}
              </div>
            )}
            {isSyncing && <div className="mt-1 text-xs text-blue-600">Syncing updates...</div>}
          </>
        )}
      </td>
      <td className="min-w-0 overflow-hidden px-4 py-4 align-top">
        {isEditing ? (
          <div className="min-w-0 w-full overflow-hidden">
            <select
              value={editForm.userId || ''}
              onChange={(e) => onEditFormChange({ userId: e.target.value })}
              title={
                selectedUser ? `${selectedUser.name} (${selectedUser.email})` : 'Select user'
              }
              className="w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="truncate text-sm font-medium text-gray-900" title={bracket.userName}>
              {bracket.userName}
            </div>
            <div className="truncate text-sm text-gray-500" title={bracket.userEmail}>
              {bracket.userEmail}
            </div>
          </>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap align-top">
        <div
          className="truncate text-sm font-medium text-gray-600"
          title={`${bracket.year || new Date().getFullYear()}-${String(bracket.bracketNumber || '?').padStart(6, '0')}`}
        >
          {bracket.year || new Date().getFullYear()}-{String(bracket.bracketNumber || '?').padStart(6, '0')}
        </div>
      </td>
      <td className="min-w-0 whitespace-nowrap px-4 py-4 align-top">
        {isEditing ? (
          <select
            value={editForm.status || ''}
            onChange={(e) => onEditFormChange({ status: e.target.value })}
            className="w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
          >
            <option value="in_progress">In Progress</option>
            <option value="submitted">Submitted</option>
            <option value="deleted">Deleted</option>
          </select>
        ) : (
          <span
            className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
              bracket.status === 'submitted'
                ? 'bg-green-100 text-green-800'
                : bracket.status === 'in_progress'
                  ? 'bg-yellow-100 text-yellow-800'
                  : bracket.status === 'deleted'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
            }`}
          >
            {bracket.status}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-gray-500">
        <AdminBracketDateTimeCell iso={bracket.createdAt} title="Created" />
      </td>
      <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-gray-500">
        <AdminBracketDateTimeCell iso={bracket.updatedAt} title="Updated" />
      </td>
      <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-gray-500">
        {bracket.status === 'submitted' && bracket.submittedAt ? (
          <AdminBracketDateTimeCell
            iso={bracket.submittedAt}
            title="Submitted (from submitted_at; CSV Submitted Timestamp)"
          />
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="sticky right-0 z-10 w-[7.75rem] min-w-[7.75rem] border-l border-gray-200 bg-white px-2 py-4 align-top shadow-[-6px_0_12px_-8px_rgba(0,0,0,0.12)]">
        {isEditing ? (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onSave}
              className={`${actionIconBtn} bg-green-600 hover:bg-green-700 focus:ring-green-500`}
              title="Save"
            >
              <Save className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">Save</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={`${actionIconBtn} bg-gray-500 hover:bg-gray-600 focus:ring-gray-500`}
              title="Cancel"
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">Cancel</span>
            </button>
          </div>
        ) : pendingDelete && !isDeletedStatus ? (
          <div className="flex min-w-0 flex-col gap-1 rounded border border-red-200 bg-red-50 p-1.5">
            <span className="text-center text-[10px] font-medium text-red-800">Delete?</span>
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={deleting}
              className="rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={deleting}
              className="rounded bg-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50"
            >
              No
            </button>
          </div>
        ) : pendingDelete && isDeletedStatus ? (
          <div
            className="flex min-w-0 flex-col gap-2 rounded border border-red-200 bg-red-50 p-2"
            data-testid="admin-permanent-delete-confirmation"
          >
            <div className="text-left text-[10px] leading-snug text-gray-800">
              {renderMessageWithLineBreaks(permanentDeleteMessage)}
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={deleting}
                className="rounded bg-red-800 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-900 disabled:opacity-50"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                disabled={deleting}
                className="rounded bg-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                No
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 grid-rows-2 place-items-center gap-1">
            <button
              type="button"
              onClick={onEditDetails}
              title="Edit entry name and status"
              className={`${actionIconBtn} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`}
            >
              <Edit className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">Edit details</span>
            </button>
            <button
              type="button"
              onClick={onEditPicks}
              title="Edit picks"
              className={`${actionIconBtn} bg-purple-600 hover:bg-purple-700 focus:ring-purple-500`}
            >
              <Vote className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">Edit picks</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              title={
                isDeletedStatus
                  ? 'Permanently remove this bracket from the database'
                  : 'Mark bracket as deleted (soft delete)'
              }
              className={`${actionIconBtn} ${
                isDeletedStatus
                  ? 'bg-red-900 hover:bg-red-950 focus:ring-red-800 disabled:bg-gray-300'
                  : 'bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-gray-300'
              }`}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">Delete</span>
            </button>
            {showLiveScoreButton && onLiveScore ? (
              <button
                type="button"
                onClick={onLiveScore}
                title="KEY scoring (completed games)"
                className={`${actionIconBtn} bg-teal-600 hover:bg-teal-700 focus:ring-teal-500`}
                data-testid="admin-bracket-live-score"
              >
                <Calculator className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">KEY scoring</span>
              </button>
            ) : (
              <div
                className="h-9 w-9 shrink-0 rounded border border-dashed border-gray-200 bg-gray-50/70"
                aria-hidden
              />
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
