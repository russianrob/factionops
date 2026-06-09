import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Load the userscript as a CommonJS module via its guarded module.exports.
const mod = require("./public/scripts/torn-foreign-stock.user.js");

test("module loads and exports an object", () => {
  assert.strictEqual(typeof mod, "object");
});
