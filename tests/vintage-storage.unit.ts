/** In-memory SQL integration tests; never connects to an external database. */
import test from "node:test";
import assert from "node:assert/strict";
import { newDb } from "pg-mem";
import pg from "pg";
import { DEFAULT_VINTAGE_CONTENT } from "../src/lib/vintage/content";
import { initializeVintageHomepageDatabase } from "../src/lib/database/migrations";
test("draft, publication and revision restoration persist independently in SQL", async () => {
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
    draft.hero.headline = "DRAFT HEADLINE";
    const saved = await writeVintageContent(
      { action: "save", version: 0, content: draft },
      "test@example.invalid",
    );
    assert.equal(saved.version, 1);
    assert.equal(saved.draft.hero.headline, "DRAFT HEADLINE");
    assert.equal(
      saved.published.hero.headline,
      DEFAULT_VINTAGE_CONTENT.hero.headline,
    );
    const published = await writeVintageContent(
      { action: "publish", version: 1, content: draft },
      "test@example.invalid",
    );
    assert.equal(published.published.hero.headline, "DRAFT HEADLINE");
    assert.equal(published.published.downloads[0].href, "");
    assert.equal(published.published.downloads[1].href, "");
    await assert.rejects(
      writeVintageContent(
        { action: "save", version: 0, content: draft },
        "test@example.invalid",
      ),
      /CONFLICT/,
    );
    const next = structuredClone(draft);
    next.hero.headline = "NEXT DRAFT";
    await writeVintageContent(
      { action: "save", version: 2, content: next },
      "test@example.invalid",
    );
    const restored = await writeVintageContent(
      { action: "restore", version: 3, revisionId: saved.revisions[0].id },
      "test@example.invalid",
    );
    assert.equal(restored.draft.hero.headline, "DRAFT HEADLINE");
    assert.equal(restored.published.hero.headline, "DRAFT HEADLINE");
    assert.equal(restored.revisions.length, 4);
    const picksReady = structuredClone(restored.draft);
    picksReady.downloads[0].href = "https://example.invalid/picks.xlsx";
    const picksPublished = await writeVintageContent(
      { action: "publish", version: 4, content: picksReady },
      "test@example.invalid",
    );
    assert.equal(
      picksPublished.published.downloads[0].href,
      picksReady.downloads[0].href,
    );
    assert.equal(picksPublished.published.downloads[1].href, "");
    const trackerReady = structuredClone(picksReady);
    trackerReady.downloads[1].href = "https://example.invalid/tracker.xlsx";
    const bothPublished = await writeVintageContent(
      { action: "publish", version: 5, content: trackerReady },
      "test@example.invalid",
    );
    assert.deepEqual(bothPublished.published.downloads, trackerReady.downloads);
  } finally {
    pg.Pool = originalPool;
    process.env = originalEnv;
    await pool.end();
  }
});
