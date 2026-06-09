import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Load the userscript as a CommonJS module via its guarded module.exports.
const mod = require("./public/scripts/torn-foreign-stock.user.js");

test("module loads and exports an object", () => {
  assert.strictEqual(typeof mod, "object");
});

test("normalizeCountryName maps canonical names", () => {
  assert.strictEqual(mod.normalizeCountryName("Mexico"), "mex");
  assert.strictEqual(mod.normalizeCountryName("South Africa"), "sou");
  assert.strictEqual(mod.normalizeCountryName("Cayman Islands"), "cay");
});

test("normalizeCountryName handles variants + whitespace/case", () => {
  assert.strictEqual(mod.normalizeCountryName("  united   kingdom "), "uni");
  assert.strictEqual(mod.normalizeCountryName("UK"), "uni");
  assert.strictEqual(mod.normalizeCountryName("United Arab Emirates"), "uae");
  assert.strictEqual(mod.normalizeCountryName("UAE"), "uae");
});

test("normalizeCountryName returns null for unknown", () => {
  assert.strictEqual(mod.normalizeCountryName("Torn"), null);
  assert.strictEqual(mod.normalizeCountryName(""), null);
  assert.strictEqual(mod.normalizeCountryName(null), null);
});
