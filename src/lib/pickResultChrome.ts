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
 * CMS-backed hover / aria phrases for Final Four & Champ tiles
 * (Standings + My Picks). Edited once under Vintage Standings admin.
 */
export interface PickResultA11yPhrases {
  emptySelection: string;
  noChampionPick: string;
  correctRegional: string;
  incorrectRegional: string;
  correctChampion: string;
  incorrectChampion: string;
  correctFinalist: string;
  incorrectFinalist: string;
  /** Shared when a tone is still pending (any column). */
  pending: string;
  /** Separate from shade — heavy frame means picked to reach the final. */
  finalistFrame: string;
}

/** Built-in defaults; Standings CMS overrides via `standingsPickResultA11yPhrases`. */
export const DEFAULT_PICK_RESULT_A11Y_PHRASES: PickResultA11yPhrases = {
  emptySelection: "Empty selection",
  noChampionPick: "No champion pick",
  correctRegional: "correct regional pick",
  incorrectRegional: "incorrect or eliminated regional pick",
  correctChampion: "correct champion pick",
  incorrectChampion: "incorrect or eliminated champion pick",
  correctFinalist: "correct finalist pick",
  incorrectFinalist: "incorrect or eliminated finalist pick",
  pending: "result pending",
  finalistFrame: "picked to reach the final",
};

/**
 * Normalize team labels for KEY / pick comparison.
 */
export function normalizeTeamLabel(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Short phrase for a KEY result tone (fill / border), for accessible names.
 *
 * @param tone - Shared correct / incorrect / pending tone
 * @param context - Optional “regional” vs “champion” / “finalist” wording
 * @param phrases - CMS phrases (defaults when omitted)
 */
export function describePickResultTone(
  tone: PickResultTone,
  context?: "regional" | "champion" | "finalist" | "pick",
  phrases: PickResultA11yPhrases = DEFAULT_PICK_RESULT_A11Y_PHRASES,
): string {
  if (tone === "pending") return phrases.pending;
  if (context === "regional") {
    return tone === "correct"
      ? phrases.correctRegional
      : phrases.incorrectRegional;
  }
  if (context === "champion") {
    return tone === "correct"
      ? phrases.correctChampion
      : phrases.incorrectChampion;
  }
  if (context === "finalist") {
    return tone === "correct"
      ? phrases.correctFinalist
      : phrases.incorrectFinalist;
  }
  // Generic “pick” (bracket preview / fallback)
  if (tone === "correct") return "correct pick";
  if (tone === "incorrect") return "incorrect or eliminated";
  return phrases.pending;
}

/**
 * Accessible name for a Standings / My Picks logo tile.
 * Shade (regional or champ fill) and finalist frame stay separate phrases.
 * Visual ✓/✕ overlays were rejected as too cluttered; meaning stays in aria-label / title.
 *
 * @param options.teamLabel - Team display name
 * @param options.shadeTone - Cell fill vs KEY (regional FF or championship)
 * @param options.isFinalist - Heavy frame = picked to reach the final
 * @param options.borderTone - Frame color vs KEY semi (finalists only)
 * @param options.champ - Champion column (no finalist frame semantics)
 * @param options.phrases - CMS phrases from Standings content
 */
export function formatStandingsPickAccessibleName(options: {
  teamLabel: string;
  shadeTone: PickResultTone;
  isFinalist?: boolean;
  borderTone?: PickResultTone;
  champ?: boolean;
  phrases?: PickResultA11yPhrases;
}): string {
  const phrases = options.phrases ?? DEFAULT_PICK_RESULT_A11Y_PHRASES;
  const fallback = options.champ
    ? phrases.noChampionPick
    : phrases.emptySelection;
  const label = normalizeTeamLabel(options.teamLabel) || fallback;
  const parts: string[] = [label];

  if (options.champ) {
    parts.push(describePickResultTone(options.shadeTone, "champion", phrases));
  } else {
    parts.push(describePickResultTone(options.shadeTone, "regional", phrases));
    if (options.isFinalist) {
      parts.push(phrases.finalistFrame);
      if (options.borderTone) {
        parts.push(
          describePickResultTone(options.borderTone, "finalist", phrases),
        );
      }
    }
  }

  return parts.join(", ");
}

/**
 * Accessible name for a full-bracket preview team row with KEY coloring.
 *
 * @param seed - Tournament seed
 * @param name - Team name
 * @param tone - Canvas KEY tone (`green` / `red` / `blue`)
 */
export function formatBracketPreviewPickAccessibleName(
  seed: number | string,
  name: string,
  tone: "green" | "red" | "blue" | undefined,
): string {
  const base = `#${seed} ${normalizeTeamLabel(name) || "TBD"}`;
  if (tone === "green") return `${base}, correct pick`;
  if (tone === "red") return `${base}, incorrect or eliminated`;
  if (tone === "blue") return `${base}, still possible`;
  return base;
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
