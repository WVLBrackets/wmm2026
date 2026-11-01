import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStandingsTournamentLive,
  shouldUseStandingsRosterMode,
} from "../src/lib/services/standingsRosterGate";

describe("isStandingsTournamentLive", () => {
  it("is false by default / blank / false-ish", () => {
    assert.equal(isStandingsTournamentLive(undefined), false);
    assert.equal(isStandingsTournamentLive(""), false);
    assert.equal(isStandingsTournamentLive("false"), false);
    assert.equal(isStandingsTournamentLive("off"), false);
    assert.equal(isStandingsTournamentLive(false), false);
  });

  it("is true for true-ish values", () => {
    assert.equal(isStandingsTournamentLive("true"), true);
    assert.equal(isStandingsTournamentLive("TRUE"), true);
    assert.equal(isStandingsTournamentLive("yes"), true);
    assert.equal(isStandingsTournamentLive("1"), true);
    assert.equal(isStandingsTournamentLive(true), true);
  });
});

describe("shouldUseStandingsRosterMode", () => {
  it("uses roster for active year when Tournament Live is off", () => {
    assert.equal(shouldUseStandingsRosterMode(2027, 2027, "false"), true);
    assert.equal(shouldUseStandingsRosterMode(2027, 2027, false), true);
    assert.equal(shouldUseStandingsRosterMode(2027, 2027, ""), true);
  });

  it("uses full standings when Tournament Live is on", () => {
    assert.equal(shouldUseStandingsRosterMode(2027, 2027, "true"), false);
    assert.equal(shouldUseStandingsRosterMode(2027, 2027, true), false);
  });

  it("does not roster a different live year", () => {
    assert.equal(shouldUseStandingsRosterMode(2026, 2027, "false"), false);
  });

  it("does not roster legacy archive years", () => {
    assert.equal(shouldUseStandingsRosterMode(2025, 2025, "false"), false);
  });
});

describe("roster payload shape (contract)", () => {
  it("public roster entries expose only entryName and optional mine", () => {
    const entries = [
      { entryName: "Alpha", mine: true },
      { entryName: "Beta" },
    ];
    for (const row of entries) {
      const keys = Object.keys(row).sort();
      assert.ok(keys.every((k) => k === "entryName" || k === "mine"));
      assert.equal(typeof row.entryName, "string");
      assert.ok(!("userId" in row));
      assert.ok(!("bracketId" in row));
      assert.ok(!("picks" in row));
      assert.ok(!("paid" in row));
    }
  });
});
