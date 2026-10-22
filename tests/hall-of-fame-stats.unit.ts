import test from "node:test";
import assert from "node:assert/strict";
import type { HallOfFameEntry } from "../src/lib/googleSheets";
import {
  buildHofViewModel,
  classifyHofYear,
  computeHofLifetimeStats,
  formatHofDollars,
  hofKnownEntryCount,
  resolveHofReigningChampion,
} from "../src/lib/hallOfFameStats";

/**
 * Build a normal completed-year sheet row for tests.
 */
function normalYear(
  year: string,
  first: string,
  team: string,
  score: number,
  entries: number,
): HallOfFameEntry {
  return {
    year,
    firstPlace: { name: first, team, score },
    secondPlace: { name: "Second", score: score - 10 },
    thirdPlace: { name: "Third", score: score - 20 },
    totalEntries: entries,
  };
}

test("classifies 2020, 2016, HIATUS, and normal years", () => {
  assert.equal(
    classifyHofYear(normalYear("2025", "A", "Florida", 100, 500)),
    "normal",
  );
  assert.equal(
    classifyHofYear({
      ...normalYear("2020", "HIATUS", "", 0, 0),
      firstPlace: { name: "HIATUS", team: "", score: 0 },
    }),
    "cancelled2020",
  );
  assert.equal(
    classifyHofYear({
      ...normalYear("2016", "Villanova Wildcats", "Villanova", 0, 0),
    }),
    "hiatus2016",
  );
});

test("unknown entry counts stay null instead of zero", () => {
  assert.equal(hofKnownEntryCount(0), null);
  assert.equal(hofKnownEntryCount(-1), null);
  assert.equal(hofKnownEntryCount(572), 572);
});

test("reigning champion is the first completed sheet year", () => {
  const entries: HallOfFameEntry[] = [
    {
      year: "2020",
      firstPlace: { name: "HIATUS", team: "", score: 0 },
      secondPlace: { name: "HIATUS", score: 0 },
      thirdPlace: { name: "HIATUS", score: 0 },
      totalEntries: 0,
    },
    normalYear("2025", "Jared Ingram", "Michigan", 145, 572),
    normalYear("2024", "Other", "UConn", 120, 400),
  ];
  const champ = resolveHofReigningChampion(entries);
  assert.equal(champ?.name, "Jared Ingram");
  assert.equal(champ?.year, "2025");
  assert.equal(champ?.points, 145);
  assert.equal(champ?.entryCount, 572);
});

test("lifetime stats skip special years and omit unknown entry totals", () => {
  const entries: HallOfFameEntry[] = [
    normalYear("2025", "A", "Florida", 100, 100),
    {
      year: "2020",
      firstPlace: { name: "HIATUS", team: "", score: 0 },
      secondPlace: { name: "HIATUS", score: 0 },
      thirdPlace: { name: "HIATUS", score: 0 },
      totalEntries: 0,
    },
    {
      year: "2016",
      firstPlace: { name: "Villanova", team: "Villanova", score: 0 },
      secondPlace: { name: "HIATUS", score: 0 },
      thirdPlace: { name: "HIATUS", score: 0 },
      totalEntries: 0,
    },
  ];
  const lifetime = computeHofLifetimeStats(entries);
  assert.equal(lifetime.tournamentsCompleted, 1);
  assert.equal(lifetime.uniqueMoneyWinners, 3);
  assert.equal(lifetime.totalEntries, 100);
  assert.equal(lifetime.totalPrizeDollars, 500);
});

test("view model preserves podium place order and formats dollars", () => {
  const vm = buildHofViewModel([
    normalYear("2025", "First", "Michigan", 145, 100),
  ]);
  assert.equal(vm.seasons[0].finishers[0].place, 1);
  assert.equal(vm.seasons[0].finishers[1].place, 2);
  assert.equal(vm.careerLeaders[0].name, "First");
  assert.equal(vm.careerLeaders[0].totalWinnings, 100 * 5 * 0.6);
  assert.equal(formatHofDollars(2750), "$2,750");
});
