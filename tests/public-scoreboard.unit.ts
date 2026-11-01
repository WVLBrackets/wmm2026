import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sortFinalGames,
  sortGamesChronologically,
  sortLiveGames,
} from "../src/lib/scoreboardSort";
import { formatPeriodDisplay } from "../src/lib/scoreboardPeriod";
import {
  buildRegionNameMap,
  resolveRegionDisplayName,
} from "../src/lib/scoreboardRegion";
import type { ScoreboardGame } from "../src/lib/types/scoreboard";
import { DEFAULT_SCOREBOARD_PAGES } from "../src/lib/types/publicScoreboard";
import {
  DEFAULT_VINTAGE_CONTENT,
  normalizeToolbar,
} from "../src/lib/vintage/content";

function stubGame(
  overrides: Partial<ScoreboardGame> & Pick<ScoreboardGame, "gameKey">,
): ScoreboardGame {
  const now = new Date();
  return {
    environment: "test",
    year: 2027,
    kind: "bracket",
    roundLabel: "Round of 64",
    region: "East",
    seed1: 1,
    seed2: 16,
    team1Id: "a",
    team2Id: "b",
    team1Name: "A",
    team2Name: "B",
    status: "scheduled",
    score1: null,
    score2: null,
    winnerId: null,
    bbsMatchId: null,
    bbsHomeTeamId: null,
    bbsAwayTeamId: null,
    lastSyncedAt: null,
    source: "seed",
    adminLocked: false,
    updatedBy: null,
    tipoffAt: null,
    periodLabel: null,
    clock: null,
    statusNote: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("DEFAULT_SCOREBOARD_PAGES", () => {
  it("lists Final Four before Championship", () => {
    assert.equal(DEFAULT_SCOREBOARD_PAGES.length, 7);
    assert.deepEqual(
      DEFAULT_SCOREBOARD_PAGES.map((p) => p.slug),
      [
        "play-in",
        "round-1-day-1",
        "round-1-day-2",
        "round-2",
        "rounds-3-4",
        "final-four",
        "championship",
      ],
    );
  });
});

describe("sortGamesChronologically", () => {
  it("orders by tipoff then stable gameKey", () => {
    const early = stubGame({
      gameKey: "b",
      tipoffAt: new Date("2027-03-17T23:00:00Z"),
    });
    const late = stubGame({
      gameKey: "a",
      tipoffAt: new Date("2027-03-18T01:00:00Z"),
    });
    const sameTipA = stubGame({
      gameKey: "c-early-key",
      tipoffAt: new Date("2027-03-17T20:00:00Z"),
    });
    const sameTipB = stubGame({
      gameKey: "c-late-key",
      tipoffAt: new Date("2027-03-17T20:00:00Z"),
    });
    const noTip = stubGame({ gameKey: "zzz", tipoffAt: null });
    const sorted = sortGamesChronologically([
      late,
      noTip,
      early,
      sameTipB,
      sameTipA,
    ]);
    assert.deepEqual(
      sorted.map((g) => g.gameKey),
      ["c-early-key", "c-late-key", "b", "a", "zzz"],
    );
  });
});

describe("region display names", () => {
  it("maps bracket positions to region names", () => {
    const map = buildRegionNameMap([
      { name: "Midwest", position: "Top Left" },
      { name: "East", position: "Bottom Left" },
    ]);
    assert.equal(resolveRegionDisplayName("Top Left", map), "Midwest");
    assert.equal(resolveRegionDisplayName("Midwest", map), "Midwest");
    assert.equal(resolveRegionDisplayName("Top Left"), null);
  });
});

describe("formatPeriodDisplay", () => {
  it("labels halves and uncapped OT", () => {
    assert.equal(formatPeriodDisplay("1st"), "1ST HALF");
    assert.equal(formatPeriodDisplay("2nd"), "2ND HALF");
    assert.equal(formatPeriodDisplay("OT"), "OT");
    assert.equal(formatPeriodDisplay("2OT"), "2OT");
    assert.equal(formatPeriodDisplay("11OT"), "11OT");
  });
});

describe("public tipoffAt field", () => {
  it("is present on scoreboard game stubs as ISO or null", () => {
    const withTip = stubGame({
      gameKey: "t1",
      tipoffAt: new Date("2027-03-19T23:10:00.000Z"),
    });
    const without = stubGame({ gameKey: "t2", tipoffAt: null });
    assert.equal(withTip.tipoffAt?.toISOString(), "2027-03-19T23:10:00.000Z");
    assert.equal(without.tipoffAt, null);
  });
});

describe("section sorts", () => {
  it("live keeps earlier tipoffs first (closest to ending)", () => {
    const noon = stubGame({
      gameKey: "noon",
      tipoffAt: new Date("2027-03-17T16:00:00Z"),
    });
    const evening = stubGame({
      gameKey: "evening",
      tipoffAt: new Date("2027-03-17T23:00:00Z"),
    });
    assert.deepEqual(
      sortLiveGames([evening, noon]).map((g) => g.gameKey),
      ["noon", "evening"],
    );
  });

  it("finals put later tipoffs (more recent slate) on top", () => {
    const sweet16 = stubGame({
      gameKey: "s16",
      tipoffAt: new Date("2027-03-26T23:00:00Z"),
      updatedAt: new Date("2027-03-30T12:00:00Z"),
    });
    const elite8 = stubGame({
      gameKey: "e8",
      tipoffAt: new Date("2027-03-28T23:00:00Z"),
      updatedAt: new Date("2027-03-30T12:00:00Z"),
    });
    assert.deepEqual(
      sortFinalGames([sweet16, elite8]).map((g) => g.gameKey),
      ["e8", "s16"],
    );
  });

  it("finals fall back to updatedAt when tipoffs match or are missing", () => {
    const first = stubGame({
      gameKey: "first",
      tipoffAt: null,
      updatedAt: new Date("2027-03-17T18:00:00Z"),
    });
    const later = stubGame({
      gameKey: "later",
      tipoffAt: null,
      updatedAt: new Date("2027-03-17T20:00:00Z"),
    });
    assert.deepEqual(
      sortFinalGames([first, later]).map((g) => g.gameKey),
      ["later", "first"],
    );
  });
});

describe("toolbar Scores slot", () => {
  it("defaults include Scores → /scoreboard", () => {
    const scores = DEFAULT_VINTAGE_CONTENT.toolbar.find(
      (t) => t.id === "scoreboard",
    );
    assert.ok(scores);
    assert.equal(scores!.href, "/scoreboard");
    assert.equal(scores!.adminOnly, false);
    assert.equal(DEFAULT_VINTAGE_CONTENT.toolbar.length, 8);
  });

  it("fills an empty slot when older CMS omits Scores", () => {
    const normalized = normalizeToolbar([
      { id: "home", label: "Home", href: "/", icon: "House", adminOnly: false },
      {
        id: "standings",
        label: "Standings",
        href: "/standings",
        icon: "Trophy",
        adminOnly: false,
      },
    ]);
    assert.ok(
      normalized.some(
        (t) => t.href === "/scoreboard" || t.id === "scoreboard",
      ),
    );
  });
});
