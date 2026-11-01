import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatScoreboardDateLabel } from "../src/lib/scoreboardDateLabel";
import {
  filterScoreboardYears,
  SCOREBOARD_MIN_YEAR,
} from "../src/lib/scoreboardYears";
import { historicalPlayInForYear } from "../src/lib/scoreboardHistoricalPlayIn";

describe("filterScoreboardYears", () => {
  it("floors at 2026", () => {
    assert.equal(SCOREBOARD_MIN_YEAR, 2026);
    assert.deepEqual(filterScoreboardYears([2027, 2025, 2026, 2019]), [
      2027,
      2026,
    ]);
  });
});

describe("formatScoreboardDateLabel", () => {
  it("formats a single day as M/D/YY", () => {
    assert.equal(
      formatScoreboardDateLabel(["2026-03-21T17:00:00.000Z"]),
      "3/21/26",
    );
  });

  it("formats multi-day as first - last", () => {
    const label = formatScoreboardDateLabel([
      "2026-03-26T17:00:00.000Z",
      "2026-03-29T23:30:00.000Z",
      "2026-03-27T19:15:00.000Z",
      "2026-03-28T20:00:00.000Z",
      null,
    ]);
    assert.equal(label, "3/26/26 - 3/29/26");
  });

  it("returns null when no tipoffs", () => {
    assert.equal(formatScoreboardDateLabel([null, undefined]), null);
  });
});

describe("historicalPlayInForYear", () => {
  it("returns four 2026 First Four finals", () => {
    const rows = historicalPlayInForYear(2026);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].team1Name, "Howard");
    assert.equal(rows[0].score1, 86);
    assert.equal(rows[0].score2, 83);
    assert.equal(historicalPlayInForYear(2027).length, 0);
  });
});
