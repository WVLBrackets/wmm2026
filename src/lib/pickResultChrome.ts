/**
 * Shared Final Four / Champ result chrome for Standings and My Picks.
 *
 * Shade (fill):
 * - pending (game not decided, pick still alive) → white
 * - correct (KEY winner matches pick) → green
 * - incorrect (KEY winner differs OR pick eliminated before that game) → red
 *
 * Finalist border (heavy frame on finals picks only):
 * - pending → black (admin width)
 * - correct → green
 * - incorrect → red
 *
 * Championship cell uses the same shade rules vs the KEY championship winner;
 * it does not use the finalist black frame (only green/red status border when decided).
 */

export type PickResultTone = "correct" | "incorrect" | "pending";

/**
 * Normalize team labels for KEY / pick comparison.
 */
export function normalizeTeamLabel(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Whether a pick appears on the eliminated list from KEY scoring.
 */
export function isPickEliminated(
  pick: string,
  eliminatedTeams: readonly string[],
): boolean {
  const p = normalizeTeamLabel(pick);
  if (!p) return false;
  return eliminatedTeams.some((e) => normalizeTeamLabel(e) === p);
}

/**
 * Resolve one pick against one KEY game cell (+ elimination list).
 *
 * @param pick - Entry's selected team name for this slot
 * @param keyWinner - KEY winner for that game (blank = not played yet)
 * @param eliminatedTeams - Teams already out per KEY
 */
export function resolvePickResultTone(
  pick: string,
  keyWinner: string,
  eliminatedTeams: readonly string[],
): PickResultTone {
  const p = normalizeTeamLabel(pick);
  if (!p) return "pending";
  const actual = normalizeTeamLabel(keyWinner);
  if (actual !== "") {
    return p === actual ? "correct" : "incorrect";
  }
  if (isPickEliminated(p, eliminatedTeams)) return "incorrect";
  return "pending";
}

/** @deprecated Prefer {@link PickResultTone}; kept for StandingsData callers. */
export type StandingsShade = "correct" | "incorrect" | "neutral";

/** @deprecated Prefer {@link PickResultTone}. */
export type StandingsBorderTone = "correct" | "incorrect" | "neutral";

/**
 * Map shared tone → legacy shade label (`pending` → `neutral`).
 */
export function toneToLegacyShade(tone: PickResultTone): StandingsShade {
  if (tone === "pending") return "neutral";
  return tone;
}

/**
 * Map shared tone → legacy border label (`pending` → `neutral`).
 */
export function toneToLegacyBorder(tone: PickResultTone): StandingsBorderTone {
  if (tone === "pending") return "neutral";
  return tone;
}

/**
 * Regional champ (Elite 8) cell fill — KEY cell E/F/G/H.
 */
export function getRegionalChampionSquareShade(
  pick: string,
  keyCellWinner: string,
  eliminatedTeams: string[],
): StandingsShade {
  return toneToLegacyShade(
    resolvePickResultTone(pick, keyCellWinner, eliminatedTeams),
  );
}

/**
 * Heavy border on finalist picks — KEY semi cell I or J.
 */
export function getFinalistBorderTone(
  pick: string,
  keyCellWinner: string,
  eliminatedTeams: string[],
): StandingsBorderTone {
  return toneToLegacyBorder(
    resolvePickResultTone(pick, keyCellWinner, eliminatedTeams),
  );
}

export interface ChampionDisplayColors {
  shade: StandingsShade;
  /** `undefined` when still pending (no heavy champ border). */
  borderTone: StandingsBorderTone | undefined;
}

/**
 * Champ column vs KEY championship winner (K).
 * Pending → white, no heavy border. Decided/eliminated → green/red fill + border.
 */
export function getChampionDisplayColors(
  pick: string,
  championshipWinner: string,
  eliminatedTeams: string[],
): ChampionDisplayColors {
  const tone = resolvePickResultTone(
    pick,
    championshipWinner,
    eliminatedTeams,
  );
  if (tone === "pending") {
    return { shade: "neutral", borderTone: undefined };
  }
  return {
    shade: tone,
    borderTone: tone,
  };
}

/** KEY-derived fields needed to paint FF / Champ chrome. */
export interface PickResultKeyContext {
  /** Regional Elite 8 winners in sheet order TL, BL, TR, BR. */
  regionalChampionKey: [string, string, string, string];
  /** Semifinal winners [left, right]. */
  semifinalKey: [string, string];
  /** Championship winner (blank if not played). */
  finalWinner: string;
  eliminatedTeams: string[];
}

/**
 * Empty KEY context — all cells pending / white.
 */
export function emptyPickResultKeyContext(): PickResultKeyContext {
  return {
    regionalChampionKey: ["", "", "", ""],
    semifinalKey: ["", ""],
    finalWinner: "",
    eliminatedTeams: [],
  };
}
