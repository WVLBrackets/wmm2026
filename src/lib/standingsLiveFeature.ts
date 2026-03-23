/**
 * Site config `show_live_standings` must be exactly `YES` (case-insensitive) to enable
 * live standings toggle, nav link, and persisted user preference.
 */
export function isShowLiveStandingsEnabled(raw: string | undefined): boolean {
  return raw?.trim().toUpperCase() === 'YES';
}
