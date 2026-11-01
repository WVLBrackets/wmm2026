import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractBbsTipoffAt,
  isBbsMatchFinished,
  mapBbsGameStatus,
  normalizeBbsTournamentRow,
} from "../src/lib/bigBalls/tournamentClient";
import { defaultBbsSeasonForTourneyYear } from "../src/lib/services/scoreboardService";
import {
  matchBbsToScoreboardGame,
  normalizeTeamName,
  patchFromBbsMatch,
} from "../src/lib/services/scoreboardSyncService";
import type { ScoreboardGame } from "../src/lib/types/scoreboard";

/**
 * Minimal scoreboard row for mapping tests.
 */
function game(
  overrides: Partial<ScoreboardGame> &
    Pick<ScoreboardGame, "gameKey" | "team1Id" | "team2Id">,
): ScoreboardGame {
  const now = new Date();
  return {
    environment: "test",
    year: 2026,
    kind: "bracket",
    roundLabel: "Round of 64",
    region: "East",
    seed1: 1,
    seed2: 16,
    team1Name: "Duke",
    team2Name: "Vermont",
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

describe("defaultBbsSeasonForTourneyYear", () => {
  it("maps March Madness calendar year to BBS season-start year", () => {
    assert.equal(defaultBbsSeasonForTourneyYear(2026), "2025");
    assert.equal(defaultBbsSeasonForTourneyYear(2027), "2026");
  });
});

describe("extractBbsTipoffAt", () => {
  it("reads scheduled_at (current tournament feed) into ISO", () => {
    assert.equal(
      extractBbsTipoffAt({ scheduled_at: "2026-03-19T16:15:00.000Z" }),
      "2026-03-19T16:15:00.000Z",
    );
    assert.equal(
      extractBbsTipoffAt({ kickoff_utc: "2026-03-20T00:00:00.000Z" }),
      "2026-03-20T00:00:00.000Z",
    );
    assert.equal(extractBbsTipoffAt({}), null);
  });
});

describe("normalizeBbsTournamentRow (March 2026 feed shape)", () => {
  it("parses home_team / away_team / scheduled_at / status_state", () => {
    const match = normalizeBbsTournamentRow({
      gender: "men",
      season: 2025,
      round: 1,
      region_label: null,
      bracket_location: 2,
      scheduled_at: "2026-03-19T16:15:00.000Z",
      status: "post",
      status_state: "final",
      home_team: {
        school: "Ohio State",
        full_name: "Ohio State Buckeyes",
        abbreviation: "OSU",
        seed: "8",
        score: 64,
        winner: null,
      },
      away_team: {
        school: "TCU",
        full_name: "TCU Horned Frogs",
        abbreviation: "TCU",
        seed: "9",
        score: 66,
        winner: true,
      },
    });
    assert.equal(match.status, "final");
    assert.equal(match.draw, "men");
    assert.equal(match.homeName, "Ohio State");
    assert.equal(match.awayName, "TCU");
    assert.equal(match.homeScore, 64);
    assert.equal(match.awayScore, 66);
    assert.equal(match.awayWinner, true);
    assert.equal(match.tipoffAt, "2026-03-19T16:15:00.000Z");
    assert.ok(match.matchId.startsWith("bbs:ncaab:"));
  });
});

describe("mapBbsGameStatus / isBbsMatchFinished", () => {
  it("treats post + status_state final as finished", () => {
    assert.equal(mapBbsGameStatus("post", "final"), "final");
    assert.equal(isBbsMatchFinished("post", "final"), true);
    assert.equal(isBbsMatchFinished("finished"), true);
    assert.equal(isBbsMatchFinished("Final"), true);
  });

  it("rejects live / scheduled", () => {
    assert.equal(isBbsMatchFinished("live"), false);
    assert.equal(isBbsMatchFinished("scheduled", "pre"), false);
    assert.equal(isBbsMatchFinished(""), false);
  });
});

describe("normalizeTeamName", () => {
  it("strips university fluff and aliases UConn → Connecticut", () => {
    assert.equal(normalizeTeamName("University of Kentucky"), "kentucky");
    assert.equal(normalizeTeamName("St. John's"), "st john s");
    assert.equal(normalizeTeamName("  NC  State  "), "nc state");
    assert.equal(normalizeTeamName("UConn"), "connecticut");
    assert.equal(normalizeTeamName("Connecticut"), "connecticut");
    assert.equal(normalizeTeamName("McNeese"), "mcneese state");
    assert.equal(normalizeTeamName("Miami (OH)"), "miami oh");
  });
});

describe("matchBbsToScoreboardGame", () => {
  const games = [
    game({
      gameKey: "r64-e-1",
      team1Id: "duke",
      team2Id: "vermont",
      team1Name: "Duke",
      team2Name: "Vermont",
    }),
    game({
      gameKey: "r64-e-2",
      team1Id: "kentucky",
      team2Id: "oakland",
      team1Name: "Kentucky",
      team2Name: "Oakland",
      seed1: 2,
      seed2: 15,
    }),
    game({
      gameKey: "r64-e-3",
      team1Id: "connecticut",
      team2Id: "furman",
      team1Name: "Connecticut",
      team2Name: "Furman",
    }),
  ];

  it("maps by bbs team ids when both sides match", () => {
    const bbsToOur = new Map([
      ["bbs-duke", "duke"],
      ["bbs-vermont", "vermont"],
    ]);
    const mapped = matchBbsToScoreboardGame(
      {
        matchId: "m1",
        status: "final",
        rawStatus: "finished",
        statusState: "final",
        round: 1,
        regionLabel: "East",
        bracketLocation: 1,
        draw: "men",
        homeTeamId: "bbs-duke",
        awayTeamId: "bbs-vermont",
        homeName: "Duke",
        awayName: "Vermont",
        homeSchool: "Duke",
        awaySchool: "Vermont",
        homeSeed: 1,
        awaySeed: 16,
        homeScore: 78,
        awayScore: 55,
        homeWinner: true,
        awayWinner: false,
        tipoffAt: null,
        periodLabel: null,
        clock: null,
        raw: {},
      },
      games,
      bbsToOur,
    );
    assert.ok(mapped);
    assert.equal(mapped!.gameKey, "r64-e-1");
    assert.equal(mapped!.winnerOurId, "duke");
    assert.equal(mapped!.team1IsHome, true);
  });

  it("falls back to unique normalized names", () => {
    const mapped = matchBbsToScoreboardGame(
      {
        matchId: "m2",
        status: "final",
        rawStatus: "post",
        statusState: "final",
        round: 1,
        regionLabel: "East",
        bracketLocation: 2,
        draw: "men",
        homeTeamId: null,
        awayTeamId: null,
        homeName: "University of Kentucky",
        awayName: "Oakland",
        homeSchool: "Kentucky",
        awaySchool: "Oakland",
        homeSeed: 2,
        awaySeed: 15,
        homeScore: 70,
        awayScore: 68,
        homeWinner: true,
        awayWinner: null,
        tipoffAt: null,
        periodLabel: null,
        clock: null,
        raw: {},
      },
      games,
      new Map(),
    );
    assert.ok(mapped);
    assert.equal(mapped!.gameKey, "r64-e-2");
    assert.equal(mapped!.winnerOurId, "kentucky");
  });

  it("aliases UConn to Connecticut for name match", () => {
    const mapped = matchBbsToScoreboardGame(
      {
        matchId: "m-uconn",
        status: "final",
        rawStatus: "post",
        statusState: "final",
        round: 1,
        regionLabel: "East",
        bracketLocation: 3,
        draw: "men",
        homeTeamId: null,
        awayTeamId: null,
        homeName: "UConn",
        awayName: "Furman",
        homeSchool: "UConn",
        awaySchool: "Furman",
        homeSeed: 2,
        awaySeed: 15,
        homeScore: 80,
        awayScore: 60,
        homeWinner: true,
        awayWinner: null,
        tipoffAt: "2026-03-20T00:00:00.000Z",
        periodLabel: null,
        clock: null,
        raw: {},
      },
      games,
      new Map(),
    );
    assert.ok(mapped);
    assert.equal(mapped!.gameKey, "r64-e-3");
    assert.equal(mapped!.winnerOurId, "connecticut");
  });

  it("does not guess when name match is ambiguous", () => {
    const dupGames = [
      ...games,
      game({
        gameKey: "r64-w-1",
        team1Id: "duke",
        team2Id: "vermont",
        team1Name: "Duke",
        team2Name: "Vermont",
      }),
    ];
    const mapped = matchBbsToScoreboardGame(
      {
        matchId: "m3",
        status: "final",
        rawStatus: "finished",
        statusState: "final",
        round: 1,
        regionLabel: "East",
        bracketLocation: 1,
        draw: "men",
        homeTeamId: null,
        awayTeamId: null,
        homeName: "Duke",
        awayName: "Vermont",
        homeSchool: "Duke",
        awaySchool: "Vermont",
        homeSeed: 1,
        awaySeed: 16,
        homeScore: 80,
        awayScore: 60,
        homeWinner: true,
        awayWinner: null,
        tipoffAt: null,
        periodLabel: null,
        clock: null,
        raw: {},
      },
      dupGames,
      new Map(),
    );
    assert.equal(mapped, null);
  });

  it("rejects ties (no winner)", () => {
    const mapped = matchBbsToScoreboardGame(
      {
        matchId: "m4",
        status: "final",
        rawStatus: "finished",
        statusState: "final",
        round: 1,
        regionLabel: "East",
        bracketLocation: 1,
        draw: "men",
        homeTeamId: "bbs-duke",
        awayTeamId: "bbs-vermont",
        homeName: "Duke",
        awayName: "Vermont",
        homeSchool: "Duke",
        awaySchool: "Vermont",
        homeSeed: 1,
        awaySeed: 16,
        homeScore: 70,
        awayScore: 70,
        homeWinner: null,
        awayWinner: null,
        tipoffAt: null,
        periodLabel: null,
        clock: null,
        raw: {},
      },
      games,
      new Map([
        ["bbs-duke", "duke"],
        ["bbs-vermont", "vermont"],
      ]),
    );
    assert.ok(mapped);
    assert.equal(mapped!.winnerOurId, null);
  });
});

describe("patchFromBbsMatch", () => {
  it("writes tipoff for scheduled games without forcing scores", () => {
    const patch = patchFromBbsMatch(
      {
        matchId: "m-sched",
        status: "scheduled",
        rawStatus: "scheduled",
        statusState: "pre",
        round: 1,
        regionLabel: null,
        bracketLocation: 1,
        draw: "men",
        homeTeamId: null,
        awayTeamId: null,
        homeName: "Duke",
        awayName: "Siena",
        homeSchool: "Duke",
        awaySchool: "Siena",
        homeSeed: 1,
        awaySeed: 16,
        homeScore: null,
        awayScore: null,
        homeWinner: null,
        awayWinner: null,
        tipoffAt: "2026-03-19T17:00:00.000Z",
        periodLabel: null,
        clock: null,
        raw: {},
      },
      { team1IsHome: true, winnerOurId: null },
    );
    assert.equal(patch.tipoffAt, "2026-03-19T17:00:00.000Z");
    assert.equal(patch.status, undefined);
    assert.equal(patch.score1, undefined);
  });

  it("writes final scores and winner", () => {
    const patch = patchFromBbsMatch(
      {
        matchId: "m-final",
        status: "final",
        rawStatus: "post",
        statusState: "final",
        round: 1,
        regionLabel: null,
        bracketLocation: 1,
        draw: "men",
        homeTeamId: null,
        awayTeamId: null,
        homeName: "Ohio State",
        awayName: "TCU",
        homeSchool: "Ohio State",
        awaySchool: "TCU",
        homeSeed: 8,
        awaySeed: 9,
        homeScore: 64,
        awayScore: 66,
        homeWinner: null,
        awayWinner: true,
        tipoffAt: "2026-03-19T16:15:00.000Z",
        periodLabel: null,
        clock: null,
        raw: {},
      },
      { team1IsHome: true, winnerOurId: "tcu" },
    );
    assert.equal(patch.status, "final");
    assert.equal(patch.score1, 64);
    assert.equal(patch.score2, 66);
    assert.equal(patch.winnerId, "tcu");
    assert.equal(patch.tipoffAt, "2026-03-19T16:15:00.000Z");
  });
});
