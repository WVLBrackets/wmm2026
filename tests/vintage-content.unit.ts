import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VINTAGE_CONTENT,
  validateVintageContent,
  safeHref,
} from "../src/lib/vintage/content";
import { isVintageEnabled } from "../src/lib/vintage/access";
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
test("a publication schema must preserve both promotions and Excel resources", () => {
  for (const key of ["promotions", "downloads"] as const) {
    const c = structuredClone(DEFAULT_VINTAGE_CONTENT);
    c[key].pop();
    assert.throws(() => validateVintageContent(c));
  }
});
test("requires image descriptions and rejects bad dates, URLs, crop values and missing fields", () => {
  const variants = [
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.hero.image.alt = "";
    },
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.hero.ctaHref = "javascript:alert(1)";
    },
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.hero.image.position = "unsafe";
    },
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.tournament.countdownEnabled = true;
      c.tournament.countdownAt = "not a date";
    },
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.hero.headline = "";
    },
    (c: typeof DEFAULT_VINTAGE_CONTENT) => {
      c.announcements[0].date = "wrong";
    },
  ];
  for (const mutate of variants) {
    const c = structuredClone(DEFAULT_VINTAGE_CONTENT);
    mutate(c);
    assert.throws(() => validateVintageContent(c));
  }
  assert.throws(() => validateVintageContent({}));
});
test("production blocks Vintage V1 even when the enable flag is set", () => {
  const env = { ...process.env };
  try {
    process.env.VERCEL_ENV = "production";
    process.env.VINTAGE_HOMEPAGE_ENABLED = "true";
    assert.equal(isVintageEnabled(), false);
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
