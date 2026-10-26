/** Accessible result naming for Standings / bracket preview (design F02). */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PICK_RESULT_A11Y_PHRASES,
  formatBracketPreviewPickAccessibleName,
  formatStandingsPickAccessibleName,
} from "../src/lib/pickResultChrome";
import {
  DEFAULT_VINTAGE_STANDINGS_CONTENT,
  normalizeVintageStandingsContent,
  standingsPickResultA11yPhrases,
} from "../src/lib/vintage/standingsContent";

test("standings accessible names separate shade from finalist frame", () => {
  assert.equal(
    formatStandingsPickAccessibleName({
      teamLabel: "Connecticut",
      shadeTone: "correct",
      isFinalist: true,
      borderTone: "pending",
    }),
    "Connecticut, correct regional pick, picked to reach the final, result pending",
  );
  assert.equal(
    formatStandingsPickAccessibleName({
      teamLabel: "Florida",
      shadeTone: "incorrect",
    }),
    "Florida, incorrect or eliminated regional pick",
  );
  assert.equal(
    formatStandingsPickAccessibleName({
      teamLabel: "Houston",
      shadeTone: "correct",
      champ: true,
    }),
    "Houston, correct champion pick",
  );
});

test("CMS phrases override hover / aria wording", () => {
  const phrases = {
    ...DEFAULT_PICK_RESULT_A11Y_PHRASES,
    incorrectRegional: "missed regional",
    finalistFrame: "finalist pick",
    incorrectFinalist: "finalist out",
  };
  assert.equal(
    formatStandingsPickAccessibleName({
      teamLabel: "Duke",
      shadeTone: "incorrect",
      isFinalist: true,
      borderTone: "incorrect",
      phrases,
    }),
    "Duke, missed regional, finalist pick, finalist out",
  );
});

test("Standings CMS maps to shared phrases used by Standings and My Picks", () => {
  const copy = normalizeVintageStandingsContent({
    ...DEFAULT_VINTAGE_STANDINGS_CONTENT,
    a11yIncorrectRegional: "wrong regional",
    a11yFinalistFrame: "to the final",
  });
  const phrases = standingsPickResultA11yPhrases(copy);
  assert.equal(phrases.incorrectRegional, "wrong regional");
  assert.equal(phrases.finalistFrame, "to the final");
  assert.equal(
    formatStandingsPickAccessibleName({
      teamLabel: "Duke",
      shadeTone: "incorrect",
      isFinalist: true,
      borderTone: "incorrect",
      phrases,
    }),
    "Duke, wrong regional, to the final, incorrect or eliminated finalist pick",
  );
});

test("bracket preview rows name KEY result without color alone", () => {
  assert.equal(
    formatBracketPreviewPickAccessibleName(1, "Duke", "green"),
    "#1 Duke, correct pick",
  );
  assert.equal(
    formatBracketPreviewPickAccessibleName(8, "Florida", "red"),
    "#8 Florida, incorrect or eliminated",
  );
  assert.equal(
    formatBracketPreviewPickAccessibleName(4, "Purdue", "blue"),
    "#4 Purdue, still possible",
  );
});
