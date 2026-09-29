// Torn's v1 API HTML-escapes faction names; v2 does not. `fetchRankedWar`
// reads v1, so "Howler's Haven" arrives as "Howler&#039;s Haven" and was
// stored that way — then the page ran it through esc() and rendered the
// entity literally.
//
// torn-api.js already states the rule for this ("the escaped form is a
// rendering artefact, not the datum... escape at the render site"), so the
// datum is decoded on the way in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities } from "./torn-api.js";

test("decodes the apostrophe Torn actually sent us", () => {
  assert.equal(decodeEntities("Howler&#039;s Haven"), "Howler's Haven");
});

test("decodes the other forms of the same character", () => {
  assert.equal(decodeEntities("Leafy&#39;s Tree"), "Leafy's Tree");
  assert.equal(decodeEntities("Leafy&apos;s Tree"), "Leafy's Tree");
});

test("decodes the named entities a faction name can carry", () => {
  assert.equal(decodeEntities("Tom &amp; Jerry"), "Tom & Jerry");
  assert.equal(decodeEntities("&quot;Quoted&quot;"), '"Quoted"');
  assert.equal(decodeEntities("&lt;tag&gt;"), "<tag>");
});

test("ampersand is decoded LAST, so &amp;#039; is not over-decoded", () => {
  // Decoding &amp; first would turn "&amp;#039;" into "&#039;" and then
  // into "'", inventing a character the faction name never had.
  assert.equal(decodeEntities("Five &amp;#039; Dime"), "Five &#039; Dime");
});

test("leaves a plain name untouched", () => {
  assert.equal(decodeEntities("The Brotherhood of Battle"), "The Brotherhood of Battle");
});

test("decoding does not make a name safe to inject — it still needs escaping", () => {
  // Explicit: this function's output is DATA. The render site escapes.
  assert.equal(decodeEntities("&lt;script&gt;"), "<script>");
});

test("survives rubbish without throwing", () => {
  assert.equal(decodeEntities(null), "");
  assert.equal(decodeEntities(undefined), "");
  assert.equal(decodeEntities(123), "123");
  assert.equal(decodeEntities("&notanentity;"), "&notanentity;");
});
