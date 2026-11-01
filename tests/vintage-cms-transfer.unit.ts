/** Field-level CMS transfer package helpers (published only). */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CMS_TRANSFER_KIND,
  CMS_TRANSFER_SCHEMA_VERSION,
  applySelectedPublishedPatches,
  buildVintageCmsTransferBundle,
  deskForTransferPath,
  diffCmsTransferBundle,
  diffJsonLeaves,
  getAtTransferPath,
  parseVintageCmsTransferBundle,
  summarizeCmsTransferChanges,
} from "../src/lib/vintage/cmsTransfer";
import { DEFAULT_VINTAGE_CONTENT } from "../src/lib/vintage/content";
import {
  INFO_HANDBOOK_KEY,
  STANDINGS_CONTENT_KEY,
} from "../src/lib/vintage/homepageDocument";
import { DEFAULT_VINTAGE_INFO_CONTENT } from "../src/lib/vintage/infoContent";
import { DEFAULT_VINTAGE_STANDINGS_CONTENT } from "../src/lib/vintage/standingsContent";

test("deskForTransferPath maps sidecar prefixes", () => {
  assert.equal(deskForTransferPath("masthead.first"), "home");
  assert.equal(deskForTransferPath(`${INFO_HANDBOOK_KEY}.title`), "guidebook");
  assert.equal(
    deskForTransferPath(`${STANDINGS_CONTENT_KEY}.shadeCorrect`),
    "standings",
  );
});

test("diffJsonLeaves reports nested leaf changes", () => {
  const before = { a: 1, nest: { x: "old", y: true } };
  const after = { a: 1, nest: { x: "new", y: true } };
  const changes = diffJsonLeaves(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].path, "nest.x");
  assert.equal(changes[0].before, "old");
  assert.equal(changes[0].after, "new");
});

test("build + parse round-trip is published-only and empty diff against self", () => {
  const published = {
    ...DEFAULT_VINTAGE_CONTENT,
    [INFO_HANDBOOK_KEY]: DEFAULT_VINTAGE_INFO_CONTENT,
    [STANDINGS_CONTENT_KEY]: {
      ...DEFAULT_VINTAGE_STANDINGS_CONTENT,
      shadeCorrect: "#aabbcc",
    },
  };
  const bundle = buildVintageCmsTransferBundle({
    published,
    sourceLabel: "local",
  });
  assert.equal(bundle.kind, CMS_TRANSFER_KIND);
  assert.equal(bundle.schemaVersion, CMS_TRANSFER_SCHEMA_VERSION);
  assert.equal(bundle.sourceLabel, "local");
  assert.equal("draft" in bundle, false);

  const parsed = parseVintageCmsTransferBundle(bundle);
  const selfDiff = diffCmsTransferBundle({
    currentPublished: parsed.published,
    incoming: parsed,
  });
  assert.equal(selfDiff.length, 0);
});

test("parse accepts schema v1 packages and ignores draft", () => {
  const published = {
    ...DEFAULT_VINTAGE_CONTENT,
    [STANDINGS_CONTENT_KEY]: {
      ...DEFAULT_VINTAGE_STANDINGS_CONTENT,
      heading: "From package",
    },
  };
  const parsed = parseVintageCmsTransferBundle({
    kind: CMS_TRANSFER_KIND,
    schemaVersion: 1,
    draft: {
      ...DEFAULT_VINTAGE_CONTENT,
      [STANDINGS_CONTENT_KEY]: {
        ...DEFAULT_VINTAGE_STANDINGS_CONTENT,
        heading: "Draft should be ignored",
      },
    },
    published,
    sourceLabel: "legacy",
  });
  assert.equal(parsed.schemaVersion, CMS_TRANSFER_SCHEMA_VERSION);
  assert.equal(
    getAtTransferPath(parsed.published, `${STANDINGS_CONTENT_KEY}.heading`),
    "From package",
  );
  assert.equal("draft" in parsed, false);
});

test("diffCmsTransferBundle details published standings change", () => {
  const base = {
    ...DEFAULT_VINTAGE_CONTENT,
    [STANDINGS_CONTENT_KEY]: DEFAULT_VINTAGE_STANDINGS_CONTENT,
  };
  const incomingPublished = {
    ...DEFAULT_VINTAGE_CONTENT,
    [STANDINGS_CONTENT_KEY]: {
      ...DEFAULT_VINTAGE_STANDINGS_CONTENT,
      heading: "League Standings",
    },
  };
  const bundle = buildVintageCmsTransferBundle({
    published: incomingPublished,
  });
  const changes = diffCmsTransferBundle({
    currentPublished: base,
    incoming: bundle,
  });
  assert.ok(changes.some((c) => c.path.includes("heading")));
  const heading = changes.find((c) => c.path.endsWith("heading"));
  assert.ok(heading);
  assert.equal(heading!.desk, "standings");
  assert.equal(heading!.after, "League Standings");
  const summary = summarizeCmsTransferChanges(changes);
  assert.ok(summary.total >= 1);
  assert.ok(summary.byDesk.standings >= 1);
});

test("applySelectedPublishedPatches applies only selected paths", () => {
  const current = {
    ...DEFAULT_VINTAGE_CONTENT,
    [STANDINGS_CONTENT_KEY]: {
      ...DEFAULT_VINTAGE_STANDINGS_CONTENT,
      heading: "Current heading",
      shadeCorrect: "#111111",
    },
  };
  const incoming = {
    ...DEFAULT_VINTAGE_CONTENT,
    [STANDINGS_CONTENT_KEY]: {
      ...DEFAULT_VINTAGE_STANDINGS_CONTENT,
      heading: "Incoming heading",
      shadeCorrect: "#abcdef",
    },
  };
  const patched = applySelectedPublishedPatches({
    currentPublished: current,
    incomingPublished: incoming,
    selectedPaths: [`${STANDINGS_CONTENT_KEY}.heading`],
  });
  assert.equal(
    getAtTransferPath(patched, `${STANDINGS_CONTENT_KEY}.heading`),
    "Incoming heading",
  );
  assert.equal(
    getAtTransferPath(patched, `${STANDINGS_CONTENT_KEY}.shadeCorrect`),
    "#111111",
  );
});

test("parseVintageCmsTransferBundle rejects wrong kind", () => {
  assert.throws(
    () =>
      parseVintageCmsTransferBundle({
        kind: "nope",
        schemaVersion: 2,
        published: {},
      }),
    /vintage-cms-transfer/,
  );
});
