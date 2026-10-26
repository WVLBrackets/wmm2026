/** In-memory SQL integration tests; never connects to an external database. */
import test from "node:test";
import assert from "node:assert/strict";
import { newDb } from "pg-mem";
import pg from "pg";
import { DEFAULT_VINTAGE_CONTENT } from "../src/lib/vintage/content";
import { initializeVintageHomepageDatabase } from "../src/lib/database/migrations";
test("draft and publication persist independently in SQL without revision history", async () => {
  const memory = newDb();
  const adapter = memory.adapters.createPg();
  const originalPool = pg.Pool;
  // Patch only this isolated test worker before importing the content store.
  pg.Pool = adapter.Pool as typeof pg.Pool;
  const originalEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: "development",
    VERCEL_ENV: "preview",
    VINTAGE_HOMEPAGE_ENABLED: "true",
    VINTAGE_DATABASE_URL: "postgres://test:test@localhost/vintage_test",
  });
  const pool = new adapter.Pool();
  try {
    await initializeVintageHomepageDatabase(pool as unknown as pg.Pool);
    const { readVintageState, writeVintageContent } =
      await import("../src/lib/vintage/store");
    const original = await readVintageState();
    assert.equal(original.version, 0);
    const draft = structuredClone(DEFAULT_VINTAGE_CONTENT);
    draft.masthead.second = "DRAFT EDITION";
    const saved = await writeVintageContent(
      { action: "save", version: 0, content: draft },
      "test@example.invalid",
    );
    assert.equal(saved.version, 1);
    assert.equal(saved.draft.masthead.second, "DRAFT EDITION");
    assert.equal(
      saved.published.masthead.second,
      DEFAULT_VINTAGE_CONTENT.masthead.second,
    );
    const published = await writeVintageContent(
      { action: "publish", version: 1, content: draft },
      "test@example.invalid",
    );
    assert.equal(published.published.masthead.second, "DRAFT EDITION");
    assert.equal(published.published.homeCards[2].excelPicksHref, "");
    assert.equal(published.published.homeCards[2].excelTrackerHref, "");
    await assert.rejects(
      writeVintageContent(
        { action: "save", version: 0, content: draft },
        "test@example.invalid",
      ),
      /CONFLICT/,
    );
    const next = structuredClone(draft);
    next.masthead.second = "NEXT DRAFT";
    await writeVintageContent(
      { action: "save", version: 2, content: next },
      "test@example.invalid",
    );
    const afterSave = await readVintageState();
    assert.equal(afterSave.draft.masthead.second, "NEXT DRAFT");
    assert.equal(afterSave.published.masthead.second, "DRAFT EDITION");
    assert.equal(afterSave.version, 3);
    const picksReady = structuredClone(afterSave.draft);
    picksReady.homeCards[2].excelPicksHref =
      "https://example.invalid/picks.xlsx";
    const picksPublished = await writeVintageContent(
      { action: "publish", version: 3, content: picksReady },
      "test@example.invalid",
    );
    assert.equal(
      picksPublished.published.homeCards[2].excelPicksHref,
      picksReady.homeCards[2].excelPicksHref,
    );
    assert.equal(picksPublished.published.homeCards[2].excelTrackerHref, "");
    const trackerReady = structuredClone(picksReady);
    trackerReady.homeCards[2].excelTrackerHref =
      "https://example.invalid/tracker.xlsx";
    const bothPublished = await writeVintageContent(
      { action: "publish", version: 4, content: trackerReady },
      "test@example.invalid",
    );
    assert.equal(
      bothPublished.published.homeCards[2].excelPicksHref,
      trackerReady.homeCards[2].excelPicksHref,
    );
    assert.equal(
      bothPublished.published.homeCards[2].excelTrackerHref,
      trackerReady.homeCards[2].excelTrackerHref,
    );
  } finally {
    pg.Pool = originalPool;
    process.env = originalEnv;
    await pool.end();
  }
});
