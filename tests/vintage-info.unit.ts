import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VINTAGE_INFO_CONTENT,
  formatInfoDeadline,
  formatInfoPrizeDollars,
  formatInfoTocLabelPlain,
  infoPrizePlaceAmount,
  infoPrizePoolTotal,
  normalizeVintageInfoContent,
  parseInfoNotesLines,
  parseInfoTocLabelLines,
  resolveInfoPrizeDisplay,
  validateVintageInfoContent,
} from "../src/lib/vintage/infoContent";

test("default handbook content validates", () => {
  validateVintageInfoContent(DEFAULT_VINTAGE_INFO_CONTENT);
});

test("normalize fills missing handbook sections and coerces prize status", () => {
  const normalized = normalizeVintageInfoContent({
    intro: { heading: "Guide" },
    prizes: { status: "nope", poolTotal: "$100" },
  });
  assert.equal(normalized.intro.heading, "Guide");
  assert.equal(
    normalized.intro.supporting,
    DEFAULT_VINTAGE_INFO_CONTENT.intro.supporting,
  );
  assert.equal(normalized.quickFacts.feeIcon, "DollarSign");
  assert.equal(normalized.quickFacts.deadlineIcon, "Calendar");
  assert.equal(normalized.quickFacts.ctaIcon, "ArrowRight");
  assert.equal(normalized.prizes.status, "projected");
  assert.equal(normalized.prizes.entryCount, 20);
  assert.equal(normalized.entry.steps.length, 3);
  validateVintageInfoContent(normalized);
});

test("quick facts icons reject unknown Lucide names", () => {
  const bad = structuredClone(DEFAULT_VINTAGE_INFO_CONTENT);
  bad.quickFacts.feeIcon = "NotARealIcon";
  assert.throws(() => validateVintageInfoContent(bad));
});

test("TOC labels support || two-line breaks and migrate legacy titles", () => {
  assert.deepEqual(parseInfoTocLabelLines("Tracker &||Results"), [
    "Tracker &",
    "Results",
  ]);
  assert.equal(formatInfoTocLabelPlain("Tracker &||Results"), "Tracker & Results");
  const normalized = normalizeVintageInfoContent({
    toc: {
      items: [
        { id: "toc-entry", label: "Entry & Payment", anchor: "entry-payment" },
        { id: "toc-tracker", label: "Tracker & Results", anchor: "tracker" },
        { id: "toc-questions", label: "Questions", anchor: "questions" },
      ],
    },
  });
  assert.equal(normalized.toc.items[0].label, "Entry &||Payment");
  assert.equal(normalized.toc.items[1].label, "Tracker &||Results");
  assert.equal(normalized.toc.items.length, 2);
  assert.ok(
    normalized.toc.items.every((item) => item.anchor !== "questions"),
  );
});

test("prize pool is $5 × entries and splits by place percent", () => {
  assert.equal(infoPrizePoolTotal(550), 2750);
  assert.equal(infoPrizePlaceAmount(2750, 60), 1650);
  assert.equal(infoPrizePlaceAmount(2750, 30), 825);
  assert.equal(infoPrizePlaceAmount(2750, 10), 275);
  assert.equal(formatInfoPrizeDollars(2750), "$2,750");

  const projected = resolveInfoPrizeDisplay(DEFAULT_VINTAGE_INFO_CONTENT.prizes);
  assert.equal(projected.poolLabel, "PROJECTED PRIZE POOL");
  assert.equal(projected.poolTotalLabel, "$2,750*");
  assert.equal(projected.places[0].percentLabel, "60%");
  assert.equal(projected.places[0].amountLabel, "$1,650*");
  assert.equal(projected.showFootnote, true);
  assert.match(projected.poolExplanation, /550/);
  assert.doesNotMatch(projected.poolExplanation, /<entries>/);

  const finalized = resolveInfoPrizeDisplay({
    ...DEFAULT_VINTAGE_INFO_CONTENT.prizes,
    status: "finalized",
    entryCount: 100,
  });
  assert.equal(finalized.poolLabel, "FINAL PRIZE POOL");
  assert.equal(finalized.poolTotalLabel, "$500");
  assert.equal(finalized.places[0].amountLabel, "$300");
  assert.equal(finalized.showFootnote, false);
  assert.match(finalized.poolExplanation, /100/);
});

test("tracker notes migrate legacy fields and split on ||", () => {
  assert.deepEqual(parseInfoNotesLines("One||Two||Three"), [
    "One",
    "Two",
    "Three",
  ]);
  const normalized = normalizeVintageInfoContent({
    tracker: {
      heading: "Tracker",
      body: "First paragraph.",
      optionalNote: "Second paragraph.",
    },
  });
  assert.equal(normalized.tracker.heading, "Tracker");
  assert.equal(
    normalized.tracker.notes,
    "First paragraph.||Second paragraph.",
  );
  assert.equal(normalized.tracker.excelLinkLabel, undefined);
  validateVintageInfoContent(normalized);
});

test("legacy prize percentLabel migrates and percents must sum to 100", () => {
  const normalized = normalizeVintageInfoContent({
    prizes: {
      entryCount: 40,
      places: [
        { place: "1st", percentLabel: "60%" },
        { place: "2nd", percentLabel: "30%" },
        { place: "3rd", percentLabel: "10%" },
      ],
    },
  });
  assert.equal(normalized.prizes.places[0].percent, 60);
  validateVintageInfoContent(normalized);

  const bad = structuredClone(DEFAULT_VINTAGE_INFO_CONTENT);
  bad.prizes.places[0].percent = 50;
  assert.throws(() => validateVintageInfoContent(bad));
});

test("formatInfoDeadline uses a compact Eastern date-time", () => {
  assert.equal(formatInfoDeadline(""), "");
  assert.equal(formatInfoDeadline("not-a-date"), "");
  const formatted = formatInfoDeadline("2026-03-19T16:00:00.000Z");
  assert.match(formatted, /^\d{1,2}\/\d{1,2} /);
  assert.doesNotMatch(formatted, /on /);
});

test("blank handbook heading is rejected", () => {
  const bad = structuredClone(DEFAULT_VINTAGE_INFO_CONTENT);
  bad.intro.heading = "";
  assert.throws(() => validateVintageInfoContent(bad));
});
