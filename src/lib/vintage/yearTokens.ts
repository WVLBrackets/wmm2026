/**
 * Replace Active Tourney Year placeholders in admined vintage copy.
 * Supports `{year}`, `<year>`, and common sheet-style aliases.
 *
 * @param template - Admin-authored string that may include year tokens
 * @param year - Active tourney year (from homepage `tournament.year`)
 */
export function resolveVintageYearTokens(
  template: string,
  year: string | number,
): string {
  const y = String(year).trim();
  if (!template) return template;
  return template
    .replace(/\{year\}/gi, y)
    .replace(/<year>/gi, y)
    .replace(/\{tournament_year\}/gi, y)
    .replace(/<tournament_year>/gi, y)
    .replace(/\{tournamentYear\}/g, y);
}
