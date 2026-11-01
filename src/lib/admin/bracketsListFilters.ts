/**
 * Persist Admin → Brackets list filters across Edit Picks (Save / Cancel return).
 * Stored in sessionStorage so a remount of {@link BracketsTab} restores the same view.
 */

export const ADMIN_BRACKETS_FILTERS_KEY = 'wmm.adminBracketsFilters';

export type AdminBracketsListFilters = {
  filterYear: string;
  filterStatus: string;
  filterUser: string;
  filterCreatedDate: string;
  filterUpdatedDate: string;
  searchQuery: string;
  protectSubmitted: boolean;
};

export const DEFAULT_ADMIN_BRACKETS_FILTERS: AdminBracketsListFilters = {
  filterYear: 'all',
  filterStatus: 'all',
  filterUser: 'all',
  filterCreatedDate: '',
  filterUpdatedDate: '',
  searchQuery: '',
  protectSubmitted: true,
};

/**
 * Read persisted Brackets tab filters, or null when missing / invalid.
 */
export function readAdminBracketsFilters(): AdminBracketsListFilters | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_BRACKETS_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminBracketsListFilters>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      filterYear:
        typeof parsed.filterYear === 'string'
          ? parsed.filterYear
          : DEFAULT_ADMIN_BRACKETS_FILTERS.filterYear,
      filterStatus:
        typeof parsed.filterStatus === 'string'
          ? parsed.filterStatus
          : DEFAULT_ADMIN_BRACKETS_FILTERS.filterStatus,
      filterUser:
        typeof parsed.filterUser === 'string'
          ? parsed.filterUser
          : DEFAULT_ADMIN_BRACKETS_FILTERS.filterUser,
      filterCreatedDate:
        typeof parsed.filterCreatedDate === 'string'
          ? parsed.filterCreatedDate
          : DEFAULT_ADMIN_BRACKETS_FILTERS.filterCreatedDate,
      filterUpdatedDate:
        typeof parsed.filterUpdatedDate === 'string'
          ? parsed.filterUpdatedDate
          : DEFAULT_ADMIN_BRACKETS_FILTERS.filterUpdatedDate,
      searchQuery:
        typeof parsed.searchQuery === 'string'
          ? parsed.searchQuery
          : DEFAULT_ADMIN_BRACKETS_FILTERS.searchQuery,
      protectSubmitted:
        typeof parsed.protectSubmitted === 'boolean'
          ? parsed.protectSubmitted
          : DEFAULT_ADMIN_BRACKETS_FILTERS.protectSubmitted,
    };
  } catch {
    return null;
  }
}

/**
 * Persist Brackets tab filters for the next return from Edit Picks.
 *
 * @param filters - Current filter controls
 */
export function writeAdminBracketsFilters(filters: AdminBracketsListFilters): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ADMIN_BRACKETS_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    // Ignore quota / private-mode failures; return still lands on Brackets tab.
  }
}

/**
 * Admin Edit Picks return target (filters restored by BracketsTab from sessionStorage).
 *
 * @param liveResults - When true, return to Live Results instead of Brackets
 */
export function adminBracketEditorReturnHref(liveResults = false): string {
  return liveResults ? '/admin?tab=live-results' : '/admin?tab=brackets';
}
