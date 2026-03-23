import { useMemo } from 'react';

export interface BracketFilterItem {
  id: string;
  userId: string;
  entryName: string;
  status: string;
  year?: number;
  bracketNumber?: number;
  userName?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
}

interface UseBracketFiltersArgs<T extends BracketFilterItem> {
  brackets: T[];
  optimisticUpdates?: Record<string, Partial<T>>;
  filterUser: string;
  filterStatus: string;
  filterYear: string;
  filterCreatedDate: string;
  filterUpdatedDate: string;
  searchQuery: string;
}

function toYmd(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds a filtered bracket list with optional optimistic row patches.
 */
export function useBracketFilters<T extends BracketFilterItem>({
  brackets,
  optimisticUpdates = {},
  filterUser,
  filterStatus,
  filterYear,
  filterCreatedDate,
  filterUpdatedDate,
  searchQuery,
}: UseBracketFiltersArgs<T>): T[] {
  return useMemo(() => {
    const mergedBrackets = brackets.map((bracket) => ({
      ...bracket,
      ...(optimisticUpdates[bracket.id] || {}),
    }));

    let filtered = mergedBrackets;

    if (filterUser !== 'all') {
      filtered = filtered.filter((bracket) => bracket.userId === filterUser);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((bracket) => bracket.status === filterStatus);
    }

    if (filterYear !== 'all') {
      const selectedYear = Number(filterYear);
      filtered = filtered.filter((bracket) => bracket.year === selectedYear);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((bracket) => {
        const displayId = `${bracket.year ?? new Date().getFullYear()}-${String(bracket.bracketNumber ?? '?').padStart(6, '0')}`.toLowerCase();
        const name = (bracket.userName ?? '').toLowerCase();
        const email = (bracket.userEmail ?? '').toLowerCase();
        const entry = bracket.entryName.toLowerCase();
        return (
          displayId.includes(query) ||
          name.includes(query) ||
          email.includes(query) ||
          entry.includes(query)
        );
      });
    }

    if (filterCreatedDate) {
      filtered = filtered.filter((bracket) => toYmd(bracket.createdAt) === filterCreatedDate);
    }

    if (filterUpdatedDate) {
      filtered = filtered.filter((bracket) => toYmd(bracket.updatedAt) === filterUpdatedDate);
    }

    return filtered;
  }, [
    brackets,
    optimisticUpdates,
    filterUser,
    filterStatus,
    filterYear,
    filterCreatedDate,
    filterUpdatedDate,
    searchQuery,
  ]);
}

