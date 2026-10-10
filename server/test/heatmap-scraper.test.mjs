import { test } from "node:test";
import assert from "node:assert/strict";
import { safeName, redactKeys, KEY_SHAPED } from "../heatmap-scraper.js";

// A mis-ordered call once put a live API key in the enemyName slot and every
// log line in this module printed it. The caller is fixed; these guards exist
// so the next mis-wiring is a cosmetic bug instead of a credential disclosure.

test("a key-shaped value is never used as a name", () => {
  // A key-shaped string. Deliberately NOT the one that leaked: writing a real
  // credential into a test is how it got into the repo the first time.
  assert.equal(safeName("A1b2C3d4E5f6G7h8", "42055"), "42055");
  // Any 16-char alphanumeric is refused, whatever it is.
  assert.equal(safeName("abcdefghijklmnop", "7227"), "7227");
  assert.equal(safeName("0123456789ABCDEF", "7227"), "7227");
});

test("real faction names still come through", () => {
  assert.equal(safeName("Dead Fragment", "42055"), "Dead Fragment");
  assert.equal(safeName("Howler's Haven", "42055"), "Howler's Haven");
  // Short, long, and punctuated names are all unaffected.
  assert.equal(safeName("NSA", "1"), "NSA");
  assert.equal(safeName("Knockout - Ringside", "48443"), "Knockout - Ringside");
  assert.equal(safeName("a".repeat(17), "1"), "a".repeat(17));
  assert.equal(safeName("a".repeat(15), "1"), "a".repeat(15));
});

test("a missing name falls back to the faction id", () => {
  assert.equal(safeName(null, "42055"), "42055");
  assert.equal(safeName(undefined, "42055"), "42055");
  assert.equal(safeName("", "42055"), "42055");
});

test("redactKeys strips key-shaped tokens out of library error text", () => {
  // axios sometimes puts the request URL in error.message, and the URL carries
  // the key as a query parameter.
  const msg = "connect ETIMEDOUT https://api.torn.com/faction/7227?selections=basic&key=A1b2C3d4E5f6G7h8";
  const out = redactKeys(msg);
  assert.doesNotMatch(out, /A1b2C3d4E5f6G7h8/);
  assert.match(out, /\*\*\*redacted\*\*\*/);
  // Ordinary messages are left readable.
  assert.equal(redactKeys("Request failed with status code 500"), "Request failed with status code 500");
  assert.equal(redactKeys(undefined), "");
});

test("the key shape is exactly 16 alphanumerics, anchored", () => {
  assert.ok(KEY_SHAPED.test("A1b2C3d4E5f6G7h8"));
  assert.ok(!KEY_SHAPED.test("A1b2C3d4E5f6G7h"));   // 15
  assert.ok(!KEY_SHAPED.test("A1b2C3d4E5f6G7h8X")); // 17
  assert.ok(!KEY_SHAPED.test("A1b2C3d4-5f6G7h8")); // punctuation
});
