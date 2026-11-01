import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  championshipTieBreakerFromScores,
  shouldApplyScoreboardFinalToOfficial,
} from "../src/lib/services/scoreboardService";

describe("championshipTieBreakerFromScores", () => {
  it("sums both scores when finite numbers", () => {
    assert.equal(championshipTieBreakerFromScores(68, 65), 133);
    assert.equal(championshipTieBreakerFromScores(0, 0), 0);
  });

  it("returns null when either score is missing", () => {
    assert.equal(championshipTieBreakerFromScores(null, 65), null);
    assert.equal(championshipTieBreakerFromScores(68, null), null);
    assert.equal(championshipTieBreakerFromScores(undefined, 65), null);
  });
});

describe("shouldApplyScoreboardFinalToOfficial", () => {
  const base = {
    gameKey: "East-r64-1",
    status: "scheduled" as const,
    winnerId: null as string | null,
    score1: null as number | null,
    score2: null as number | null,
  };

  it("applies when a game newly goes final", () => {
    assert.equal(
      shouldApplyScoreboardFinalToOfficial(base, {
        ...base,
        status: "final",
        winnerId: "team-a",
        score1: 80,
        score2: 70,
      }),
      true,
    );
  });

  it("skips when already final with the same winner and scores", () => {
    const finalRow = {
      ...base,
      status: "final" as const,
      winnerId: "team-a",
      score1: 80,
      score2: 70,
    };
    assert.equal(shouldApplyScoreboardFinalToOfficial(finalRow, finalRow), false);
  });

  it("applies when the final winner changes", () => {
    assert.equal(
      shouldApplyScoreboardFinalToOfficial(
        {
          ...base,
          status: "final",
          winnerId: "team-a",
          score1: 80,
          score2: 70,
        },
        {
          ...base,
          status: "final",
          winnerId: "team-b",
          score1: 70,
          score2: 80,
        },
      ),
      true,
    );
  });

  it("applies championship score changes for tie-breaker even if winner unchanged", () => {
    assert.equal(
      shouldApplyScoreboardFinalToOfficial(
        {
          gameKey: "championship",
          status: "final",
          winnerId: "team-a",
          score1: 70,
          score2: 68,
        },
        {
          gameKey: "championship",
          status: "final",
          winnerId: "team-a",
          score1: 72,
          score2: 68,
        },
      ),
      true,
    );
  });

  it("does not apply non-final updates", () => {
    assert.equal(
      shouldApplyScoreboardFinalToOfficial(base, {
        ...base,
        status: "live",
        score1: 40,
        score2: 38,
      }),
      false,
    );
  });
});
