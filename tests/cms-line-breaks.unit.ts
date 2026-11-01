import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CMS_LINE_BREAK_TOKEN,
  cmsPlainText,
  hasCmsLineBreak,
  splitCmsLines,
} from "../src/lib/cms/lineBreaks";

test("splitCmsLines splits on || and trims", () => {
  assert.deepEqual(
    splitCmsLines(`First ${CMS_LINE_BREAK_TOKEN} Second`),
    ["First", "Second"],
  );
  assert.deepEqual(splitCmsLines("One||Two||Three"), ["One", "Two", "Three"]);
});

test("splitCmsLines drops empty segments by default", () => {
  assert.deepEqual(splitCmsLines("A||||B"), ["A", "B"]);
  assert.deepEqual(splitCmsLines("||only||"), ["only"]);
});

test("splitCmsLines respects maxLines by folding extras", () => {
  assert.deepEqual(splitCmsLines("A||B||C||D", { maxLines: 2 }), [
    "A",
    "B C D",
  ]);
  assert.deepEqual(splitCmsLines("A||B||C", { maxLines: 3 }), ["A", "B", "C"]);
});

test("cmsPlainText collapses breaks to spaces", () => {
  assert.equal(cmsPlainText("Hello||World"), "Hello World");
  assert.equal(hasCmsLineBreak("Hello||World"), true);
  assert.equal(hasCmsLineBreak("Hello World"), false);
});

test("plain string without token returns single line", () => {
  assert.deepEqual(splitCmsLines("No breaks here"), ["No breaks here"]);
  assert.deepEqual(splitCmsLines("   "), []);
});
