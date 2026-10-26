/** Frozen legacy Final standings archives (Webnode import). */
import test from "node:test";
import assert from "node:assert/strict";
import { resolvePickResultTone } from "../src/lib/pickResultChrome";
import {
  getLegacyStandings,
  isLegacyStandingsYear,
  isNewspaperStandingsYear,
  listLegacyStandingsYears,
  listStandingsArchiveYears,
} from "../src/lib/legacyStandings";

test("legacy years include 2017–2019 and 2021–2025", () => {
  assert.deepEqual(listLegacyStandingsYears(), [
    2025, 2024, 2023, 2022, 2021, 2019, 2018, 2017,
  ]);
  assert.equal(isLegacyStandingsYear(2024), true);
  assert.equal(isLegacyStandingsYear(2021), true);
  assert.equal(isLegacyStandingsYear(2019), true);
  assert.equal(isLegacyStandingsYear(2018), true);
  assert.equal(isLegacyStandingsYear(2017), true);
  assert.equal(isNewspaperStandingsYear(2020), true);
  assert.equal(isNewspaperStandingsYear(2019), false);
  assert.ok(listStandingsArchiveYears().includes(2020));
  assert.ok(listStandingsArchiveYears().includes(2019));
  assert.ok(listStandingsArchiveYears().includes(2018));
  assert.ok(listStandingsArchiveYears().includes(2017));
});

test("2017 archive KEY + UNC champ", () => {
  const data = getLegacyStandings(2017)!;
  assert.equal(data.entries.length, 376);
  assert.equal(data.finalWinner, "North Carolina");
  assert.deepEqual(data.regionalChampionKey, [
    "South Carolina",
    "Gonzaga",
    "Oregon",
    "North Carolina",
  ]);
  assert.equal(data.entries[0].player, "Calvin F_1");
  assert.equal(data.entries[0].points, 142);
  assert.equal(data.entries[0].champion, "North Carolina");
  assert.equal(data.entries[0].paid, true);
  assert.ok(data.entries.every((e) => e.paid === true));
  assert.ok(data.entries.some((e) => e.player === "Chris Higgins"));
});

test("2018 archive KEY + Villanova champ", () => {
  const data = getLegacyStandings(2018)!;
  assert.equal(data.entries.length, 399);
  assert.equal(data.finalWinner, "Villanova");
  assert.deepEqual(data.regionalChampionKey, [
    "Loyola Chicago",
    "Michigan",
    "Villanova",
    "Kansas",
  ]);
  assert.equal(data.entries[0].player, "Steve Yang 2");
  assert.equal(data.entries[0].points, 119);
  assert.equal(data.entries[0].champion, "Villanova");
  assert.equal(data.entries[0].paid, true);
  assert.ok(data.entries.every((e) => e.paid === true));
  assert.ok(data.entries.some((e) => e.player === "Joe Bruce"));
});

test("2024 archive KEY + UConn champ + finalist frames", () => {
  const data = getLegacyStandings(2024)!;
  assert.equal(data.entries.length, 454);
  assert.equal(data.finalWinner, "Connecticut");
  assert.deepEqual(data.regionalChampionKey, [
    "Connecticut",
    "Alabama",
    "NC State",
    "Purdue",
  ]);
  assert.equal(data.entries[0].player, "ClemsonWestPurple");
  assert.equal(data.entries[0].points, 142);
  assert.equal(data.entries[0].champion, "Connecticut");
  assert.deepEqual(data.entries[0].finals, ["Connecticut", "Purdue"]);
  assert.equal(data.entries[0].paid, true);
  assert.ok(data.entries.every((e) => e.paid === true));
});

test("2019 archive KEY + Virginia champ", () => {
  const data = getLegacyStandings(2019)!;
  assert.equal(data.entries.length, 423);
  assert.equal(data.finalWinner, "Virginia");
  assert.deepEqual(data.regionalChampionKey, [
    "Michigan State",
    "Texas Tech",
    "Virginia",
    "Auburn",
  ]);
  assert.equal(data.entries[0].player, "Madrambler@cox.net");
  assert.equal(data.entries[0].points, 141);
  assert.equal(data.entries[0].champion, "Virginia");
  assert.ok(data.entries[0].finals[0] || data.entries[0].finals[1]);
  assert.equal(data.entries[0].paid, true);
});

test("2025 archive KEY + leader + finalist frames", () => {
  const data = getLegacyStandings(2025)!;
  assert.equal(data.entries.length, 420);
  assert.equal(data.finalWinner, "Florida");
  assert.equal(data.entries[0].player, "#DOGE Patrolers");
  assert.equal(data.entries[0].points, 156);
  assert.equal(data.entries[0].paid, true);
  assert.deepEqual(data.entries[0].finals, ["Florida", "Houston"]);
  assert.equal(data.entries[0].bracketId, undefined);
  assert.ok(data.entries.every((e) => e.finals.filter(Boolean).length === 2));
});

test("2023 archive matches HoF points + UConn champ + finalist frames", () => {
  const data = getLegacyStandings(2023)!;
  assert.equal(data.entries.length, 457);
  assert.equal(data.finalWinner, "Connecticut");
  assert.deepEqual(data.regionalChampionKey, [
    "San Diego State",
    "Florida Atlantic",
    "Miami",
    "Connecticut",
  ]);
  assert.equal(data.entries[0].player, "Jimenez 07");
  assert.equal(data.entries[0].points, 116);
  assert.equal(data.entries[0].champion, "Connecticut");
  assert.deepEqual(data.entries[0].finals, ["Alabama", "Connecticut"]);
  assert.ok(data.entries.every((e) => e.finals.filter(Boolean).length === 2));
  assert.equal(
    resolvePickResultTone(
      "Connecticut",
      data.finalWinner || "",
      data.eliminatedTeams || [],
    ),
    "correct",
  );
});

test("2022 archive has finals frames + Kansas champ", () => {
  const data = getLegacyStandings(2022)!;
  assert.equal(data.entries.length, 428);
  assert.equal(data.finalWinner, "Kansas");
  const leader = data.entries[0];
  assert.equal(leader.player, "Christian Ciciarelli 2");
  assert.equal(leader.points, 126);
  assert.equal(leader.champion, "Kansas");
  assert.ok(leader.finals[0] || leader.finals[1]);
  assert.equal(
    resolvePickResultTone(
      leader.champion,
      data.finalWinner || "",
      data.eliminatedTeams || [],
    ),
    "correct",
  );
});

test("2021 archive KEY + Baylor champ", () => {
  const data = getLegacyStandings(2021)!;
  assert.equal(data.entries.length, 374);
  assert.equal(data.finalWinner, "Baylor");
  assert.deepEqual(data.regionalChampionKey, [
    "Gonzaga",
    "UCLA",
    "Baylor",
    "Houston",
  ]);
  assert.equal(data.entries[0].player, "Barnaby");
  assert.equal(data.entries[0].points, 131);
});
