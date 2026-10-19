import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VINTAGE_CONTENT,
  formatAnnouncementAt,
  normalizeVintageContent,
  validateVintageContent,
  safeHref,
} from "../src/lib/vintage/content";
import {
  isVintageEnabled,
  isPrimaryVintageAdmin,
} from "../src/lib/vintage/access";
import { assertDedicatedVintageDatabase } from "../src/lib/vintage/databaseSafety";
test("default content validates; URLs cannot execute scripts or escape to protocol-relative hosts", () => {
  validateVintageContent(DEFAULT_VINTAGE_CONTENT);
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.com",
    "/\\example.com",
    "http://example.com",
    "https://user:pass@example.com",
  ])
    assert.equal(safeHref(href), false, href);
  for (const href of ["/bracket", "https://example.com/workbook.xlsx", ""])
    assert.equal(safeHref(href), true, href);
});
test("strips removed homepage sections and requires three home cards", () => {
  const withLegacy = normalizeVintageContent({
    hero: { headline: "gone" },
    promotions: [{ enabled: true }],
    downloads: [{ label: "old" }],
    history: { headline: "archives" },
    introduction: { body: "old intro" },
  });
  assert.equal("hero" in withLegacy, false);
  assert.equal("promotions" in withLegacy, false);
  assert.equal("downloads" in withLegacy, false);
  assert.equal("history" in withLegacy, false);
  assert.equal("introduction" in withLegacy, false);
  validateVintageContent(withLegacy);

  // Short or empty home-card lists are padded back to Play / Champ / Excel.
  assert.equal(normalizeVintageContent({ homeCards: [] }).homeCards.length, 3);
});

test("rejects bad dates, unsafe URLs, blank masthead, and invalid announcements", () => {
  const variants = [
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.exploreBand.info.ctaHref = "javascript:alert(1)";
    },
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.homeCards[0].playImageSrc = "javascript:alert(1)";
    },
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.tournament.countdownEnabled = true;
      c.tournament.countdownAt = "not a date";
    },
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.masthead.first = "";
    },
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.announcementBoard.items[0].at = "wrong";
    },
  ];
  for (const mutate of variants) {
    const c = structuredClone(DEFAULT_VINTAGE_CONTENT);
    mutate(c);
    assert.throws(() => validateVintageContent(c));
  }
  // Empty objects are migrated to the default document (theme + toolbar).
  assert.doesNotThrow(() => validateVintageContent({}));
  const migrated = normalizeVintageContent({});
  assert.equal(migrated.toolbar.length, 8);
  assert.equal(migrated.theme.primary, "#152c3a");
});

test("rejects invalid theme colors, fonts, and unknown toolbar icons", () => {
  const badColor = structuredClone(DEFAULT_VINTAGE_CONTENT);
  badColor.theme.primary = "navy";
  assert.throws(() => validateVintageContent(badColor));
  const badFont = structuredClone(DEFAULT_VINTAGE_CONTENT);
  badFont.theme.fonts.body = "Comic Sans MS";
  assert.throws(() => validateVintageContent(badFont));
  const badIcon = structuredClone(DEFAULT_VINTAGE_CONTENT);
  badIcon.toolbar[0].icon = "NotARealLucideIcon";
  assert.throws(() => validateVintageContent(badIcon));
  const customIcon = structuredClone(DEFAULT_VINTAGE_CONTENT);
  customIcon.toolbar[0].icon =
    "custom:https://example.com/bucket/vintage/icon.svg";
  assert.doesNotThrow(() => validateVintageContent(customIcon));
});
test("production requires the explicit vintage availability flag", () => {
  const env = { ...process.env };
  try {
    Object.assign(process.env, {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    process.env.VINTAGE_HOMEPAGE_ENABLED = "true";
    assert.equal(isVintageEnabled(), true);
    delete process.env.VINTAGE_HOMEPAGE_ENABLED;
    assert.equal(isVintageEnabled(), false);
    process.env.VINTAGE_HOMEPAGE_ENABLED = "true";
    process.env.VERCEL_ENV = "preview";
    assert.equal(isVintageEnabled(), true);
    delete process.env.VINTAGE_HOMEPAGE_ENABLED;
    assert.equal(isVintageEnabled(), false);
  } finally {
    process.env = env;
  }
});
test("dedicated database guard detects equivalent pooled URLs with different credentials", () => {
  const env = {
    PRODUCTION_POSTGRES_URL:
      "postgresql://prod:secret@ep-demo.example.com/brackets?sslmode=require",
  };
  assert.throws(() =>
    assertDedicatedVintageDatabase(
      "postgres://other:other@ep-demo-pooler.example.com:5432/brackets",
      env,
    ),
  );
  assert.doesNotThrow(() =>
    assertDedicatedVintageDatabase(
      "postgres://other:other@ep-demo.example.com/vintage",
      env,
    ),
  );
});

test("only the primary administrator's exact authenticated email selects vintage", () => {
  assert.equal(isPrimaryVintageAdmin("wvanderlaan@gmail.com"), true);
  assert.equal(isPrimaryVintageAdmin("WVANDERLAAN@gmail.com"), true);
  for (const email of [
    undefined,
    null,
    "",
    "wvanderlaan",
    "other-admin@example.invalid",
    "wvanderlaan+test@gmail.com",
    "wvanderlaan@gmail.com.attacker.invalid",
  ])
    assert.equal(isPrimaryVintageAdmin(email), false);
});

test("homepage document split/merge preserves handbook sidecar", async () => {
  const {
    INFO_HANDBOOK_KEY,
    mergeHomepageDocument,
    splitHomepageDocument,
    isInfoRevisionContent,
    wrapInfoRevisionContent,
  } = await import("../src/lib/vintage/homepageDocument");
  const { DEFAULT_VINTAGE_CONTENT } = await import("../src/lib/vintage/content");
  const { DEFAULT_VINTAGE_INFO_CONTENT } = await import(
    "../src/lib/vintage/infoContent"
  );
  const merged = mergeHomepageDocument(
    DEFAULT_VINTAGE_CONTENT,
    DEFAULT_VINTAGE_INFO_CONTENT,
  );
  assert.ok(INFO_HANDBOOK_KEY in merged);
  const split = splitHomepageDocument(merged);
  assert.equal(
    (split.info as typeof DEFAULT_VINTAGE_INFO_CONTENT).intro.heading,
    DEFAULT_VINTAGE_INFO_CONTENT.intro.heading,
  );
  assert.equal(
    (split.homepage as typeof DEFAULT_VINTAGE_CONTENT).masthead.first,
    DEFAULT_VINTAGE_CONTENT.masthead.first,
  );
  assert.equal(isInfoRevisionContent(wrapInfoRevisionContent(DEFAULT_VINTAGE_INFO_CONTENT)), true);
  assert.equal(isInfoRevisionContent(DEFAULT_VINTAGE_CONTENT), false);
});

test("Info toolbar icon defaults to BookOpen and migrates FileText", () => {
  const fresh = normalizeVintageContent({});
  const info = fresh.toolbar.find((item) => item.id === "info");
  assert.equal(info?.icon, "BookOpen");
  const migrated = normalizeVintageContent({
    toolbar: [
      { id: "info", label: "Info", href: "/info", icon: "FileText" },
    ],
  });
  assert.equal(migrated.toolbar[0].icon, "BookOpen");
});

test("countdown title and live message default when missing or blank", () => {
  const missing = normalizeVintageContent({ tournament: { year: "2027" } });
  assert.equal(missing.tournament.countdownTitle, "Countdown to tipoff");
  assert.equal(
    missing.tournament.liveTourneyMessage,
    "The tournament is underway!",
  );
  const blank = normalizeVintageContent({
    tournament: { countdownTitle: "   ", liveTourneyMessage: "  " },
  });
  assert.equal(blank.tournament.countdownTitle, "Countdown to tipoff");
  assert.equal(
    blank.tournament.liveTourneyMessage,
    "The tournament is underway!",
  );
  const custom = normalizeVintageContent({
    tournament: {
      countdownTitle: "  Tipoff approaches  ",
      liveTourneyMessage: "  Madness is live  ",
    },
  });
  assert.equal(custom.tournament.countdownTitle, "Tipoff approaches");
  assert.equal(custom.tournament.liveTourneyMessage, "Madness is live");
  validateVintageContent(custom);
});

test("explore band normalizes and validates with Info + Hall panels", () => {
  const normalized = normalizeVintageContent({});
  assert.equal(normalized.exploreBand.enabled, true);
  assert.equal(normalized.exploreBand.info.ctaHref, "/info");
  assert.equal(normalized.exploreBand.hall.ctaHref, "/hall-of-fame");
  validateVintageContent(normalized);
  const disabled = structuredClone(normalized);
  disabled.exploreBand.enabled = false;
  disabled.exploreBand.info.headline = "New around here?";
  validateVintageContent(disabled);
});

test("announcement board migrates legacy dispatches and formats timestamps", () => {
  const migrated = normalizeVintageContent({
    announcements: [
      {
        id: "legacy-1",
        date: "2026-10-15",
        headline: "Tipoff week",
        text: "Brackets open Friday.",
      },
    ],
  });
  assert.equal(migrated.announcementBoard.enabled, true);
  assert.equal(migrated.announcementBoard.items.length, 1);
  assert.equal(migrated.announcementBoard.items[0].id, "legacy-1");
  assert.ok(migrated.announcementBoard.items[0].at.includes("2026-10-15"));
  assert.match(
    migrated.announcementBoard.items[0].text,
    /Tipoff week.*Brackets open Friday/,
  );
  validateVintageContent(migrated);
  assert.match(
    formatAnnouncementAt("2026-10-15T16:00:00.000Z"),
    /\d+\/\d+\/\d+/,
  );
});

test("home cards normalize to exactly Play / Champ / Excel", () => {
  const fromLegacy = normalizeVintageContent({
    homeCards: [
      { id: "x", type: "hallOfFame", enabled: true },
      { id: "playNow-1", type: "playNow", enabled: true, playCtaLabel: "GO" },
      { id: "y", type: "announcements", enabled: true },
      {
        id: "reigningChamp-2",
        type: "reigningChamp",
        enabled: true,
        champName: "TEST",
      },
      {
        id: "excelDownloads-3",
        type: "excelDownloads",
        enabled: false,
        excelCaption: "XLS",
      },
    ],
  });
  assert.equal(fromLegacy.homeCards.length, 3);
  assert.deepEqual(
    fromLegacy.homeCards.map((card) => card.type),
    ["playNow", "reigningChamp", "excelDownloads"],
  );
  assert.equal(fromLegacy.homeCards[0].playCtaLabel, "GO");
  assert.equal(fromLegacy.homeCards[1].champName, "TEST");
  assert.equal(fromLegacy.homeCards[2].excelCaption, "XLS");
  validateVintageContent(fromLegacy);
});

test("excel plate resolves CMS override or bundled master by download URLs", async () => {
  const { excelCardVariant, excelPlateSrc, EXCEL_MASTER_SRC } = await import(
    "../src/lib/vintage/homeCards"
  );
  const base = {
    excelPicksHref: "",
    excelTrackerHref: "",
    excelNeitherImageSrc: "",
    excelPicksImageSrc: "",
    excelBothImageSrc: "",
  };
  assert.equal(excelCardVariant(base), "neither");
  assert.equal(excelPlateSrc(base), EXCEL_MASTER_SRC.neither);
  assert.equal(
    excelPlateSrc({ ...base, excelNeitherImageSrc: "/custom/neither.jpg" }),
    "/custom/neither.jpg",
  );
  assert.equal(
    excelCardVariant({ ...base, excelPicksHref: "/files/picks.xlsx" }),
    "picks",
  );
  assert.equal(
    excelPlateSrc({
      ...base,
      excelPicksHref: "/a.xlsx",
      excelTrackerHref: "/b.xlsx",
      excelBothImageSrc: "/custom/both.jpg",
    }),
    "/custom/both.jpg",
  );
});

test("admin edit gears deep-link to countdown or a specific card slot", async () => {
  const { parseVintageAdminFocus, vintageAdminEditHref } = await import(
    "../src/lib/vintage/adminFocus"
  );
  assert.equal(
    vintageAdminEditHref({ kind: "countdown" }),
    "/vintage/admin?focus=countdown",
  );
  assert.equal(
    vintageAdminEditHref({ kind: "explore" }),
    "/vintage/admin?focus=explore",
  );
  assert.equal(
    vintageAdminEditHref({ kind: "card", id: "excelDownloads-3" }),
    "/vintage/admin?focus=card&id=excelDownloads-3",
  );
  assert.deepEqual(parseVintageAdminFocus("countdown", null), {
    kind: "countdown",
  });
  assert.deepEqual(parseVintageAdminFocus("explore", null), {
    kind: "explore",
  });
  assert.deepEqual(parseVintageAdminFocus("announcements", null), {
    kind: "announcements",
  });
  assert.equal(
    vintageAdminEditHref({ kind: "announcements" }),
    "/vintage/admin?focus=announcements",
  );
  assert.deepEqual(parseVintageAdminFocus("card", "playNow-1"), {
    kind: "card",
    id: "playNow-1",
  });
  assert.equal(parseVintageAdminFocus("card", "  "), null);
  assert.equal(parseVintageAdminFocus(null, "x"), null);
});

test("footer captions force ALL CAPS and treat || as a two-line break", async () => {
  const { parseFooterCaptionLines } = await import(
    "../src/components/vintage/CardFooterCaption"
  );
  assert.deepEqual(parseFooterCaptionLines("Go Blue"), ["GO BLUE"]);
  assert.deepEqual(
    parseFooterCaptionLines("Prefer the old school?||Here you go ..."),
    ["PREFER THE OLD SCHOOL?", "HERE YOU GO ..."],
  );
  assert.deepEqual(
    parseFooterCaptionLines("one||two||three extras"),
    ["ONE", "TWO THREE EXTRAS"],
  );
});
