'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UserFilterComboboxUser {
  id: string;
  email: string;
  name: string;
}

type ListEntry = { kind: 'all' } | { kind: 'user'; user: UserFilterComboboxUser };

interface UserFilterComboboxProps {
  /** User id or `'all'` */
  value: string;
  onChange: (userId: string) => void;
  users: UserFilterComboboxUser[];
  id?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Formats a user for display in the filter control.
 */
function formatUserLabel(user: UserFilterComboboxUser): string {
  return `${user.name} (${user.email})`;
}

/**
 * Sort users alphabetically by display name, then email.
 */
function sortUsersAlphabetically(list: UserFilterComboboxUser[]): UserFilterComboboxUser[] {
  return [...list].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (byName !== 0) return byName;
    return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
  });
}

/**
 * Filterable combobox for “Filter by User” on the admin brackets panel.
 * Supports type-to-filter, ArrowUp/ArrowDown to move highlight, Enter to select.
 */
export default function UserFilterCombobox({
  value,
  onChange,
  users,
  id = 'filter-by-user-combobox',
  className = '',
  inputClassName = '',
}: UserFilterComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const sortedUsers = useMemo(() => sortUsersAlphabetically(users), [users]);

  const selectedLabel = useMemo(() => {
    if (value === 'all') return '';
    const u = sortedUsers.find((x) => x.id === value);
    return u ? formatUserLabel(u) : '';
  }, [value, sortedUsers]);

  const [open, setOpen] = useState(false);
  /** Text in the input while interacting (filter query or mirrors selection when closed). */
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedUsers;
    return sortedUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [sortedUsers, query]);

  /**
   * Empty query: "All users" first, then every user (alphabetical).
   * Non-empty query: only matching users so Enter targets the first match (or sole match).
   */
  const listEntries: ListEntry[] = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return [{ kind: 'all' as const }, ...sortedUsers.map((u) => ({ kind: 'user' as const, user: u }))];
    }
    return filteredUsers.map((u) => ({ kind: 'user' as const, user: u }));
  }, [query, sortedUsers, filteredUsers]);

  /** When the list length changes, keep the highlight index valid. */
  useEffect(() => {
    setHighlightedIndex((i) => {
      if (listEntries.length === 0) return 0;
      return Math.min(Math.max(0, i), listEntries.length - 1);
    });
  }, [listEntries.length]);

  /** Keep the input aligned with the current filter when the parent value changes (e.g. Clear Filters). */
  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  const closeAndCommitLabel = useCallback(
    (userId: string) => {
      onChange(userId);
      setOpen(false);
      if (userId === 'all') {
        setQuery('');
      } else {
        const u = sortedUsers.find((x) => x.id === userId);
        setQuery(u ? formatUserLabel(u) : '');
      }
      setHighlightedIndex(0);
    },
    [onChange, sortedUsers]
  );

  const selectHighlighted = useCallback(() => {
    if (listEntries.length === 0) return;
    const idx = Math.min(Math.max(0, highlightedIndex), listEntries.length - 1);
    const entry = listEntries[idx];
    if (entry.kind === 'all') {
      closeAndCommitLabel('all');
    } else {
      closeAndCommitLabel(entry.user.id);
    }
  }, [listEntries, highlightedIndex, closeAndCommitLabel]);

  const showList = open && (listEntries.length > 0 || query.trim().length > 0);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selectedLabel);
        setHighlightedIndex(0);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [selectedLabel]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);
    setOpen(true);
    setHighlightedIndex(0);
  };

  const onInputFocus = () => {
    setOpen(true);
    setHighlightedIndex(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(0);
        return;
      }
      setHighlightedIndex((i) => (listEntries.length === 0 ? 0 : (i + 1) % listEntries.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(
          listEntries.length === 0 ? 0 : Math.max(0, listEntries.length - 1)
        );
        return;
      }
      setHighlightedIndex((i) =>
        listEntries.length === 0 ? 0 : (i - 1 + listEntries.length) % listEntries.length
      );
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(0);
        return;
      }
      selectHighlighted();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery(selectedLabel);
      setHighlightedIndex(0);
    }
  };

  /** Scroll highlighted row into view inside the list panel. */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="All users — type to search"
        value={query}
        onChange={onInputChange}
        onFocus={onInputFocus}
        onKeyDown={onKeyDown}
        className={`border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 w-full min-w-[12rem] max-w-[40ch] placeholder:text-gray-500 ${inputClassName}`}
      />
      {showList && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full min-w-[16rem] overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {listEntries.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No matching users</li>
          ) : (
            listEntries.map((entry, index) => {
              const isActive = index === highlightedIndex;
              if (entry.kind === 'all') {
                return (
                  <li
                    key="__all__"
                    role="option"
                    aria-selected={isActive}
                    data-index={index}
                    className={`cursor-pointer px-3 py-2 text-sm ${
                      isActive ? 'bg-blue-100 text-blue-900' : 'text-gray-900 hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      closeAndCommitLabel('all');
                    }}
                  >
                    <span className="font-medium">All users</span>
                  </li>
                );
              }
              const { user } = entry;
              return (
                <li
                  key={user.id}
                  role="option"
                  aria-selected={isActive}
                  data-index={index}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    isActive ? 'bg-blue-100 text-blue-900' : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    closeAndCommitLabel(user.id);
                  }}
                >
                  <div className="font-medium truncate">{user.name}</div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
