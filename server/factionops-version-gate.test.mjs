// The FactionOps version gate on /api/auth.
//
// The gate exists to stop an outdated FactionOps talking to a server that has
// moved on. It compares the client's version against a semver floor — which
// quietly rates anything unparseable as version ZERO, because Number('sidekick')
// is NaN and `NaN || 0` is 0. So a partner script that versions itself with a
// name rather than a number was told it was out of date and refused with a 426.
//
// A partner is not obliged to follow FactionOps's numbering. Named builds are
// allowed through by an explicit list rather than by loosening the comparison,
// so a genuinely old client with a mangled version is still caught.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./routes.js", import.meta.url), "utf8");

function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in routes.js: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
const line = (re) => {
  const m = SRC.match(re);
  assert.ok(m, "not found: " + re);
  return m[0].trim();
};

const box = { Number, Math, Set, String };
vm.createContext(box);
vm.runInContext([
  line(/^const FACTIONOPS_MIN_VERSION = .*$/m),
  line(/^const FACTIONOPS_NAMED_VERSIONS = [\s\S]*?;$/m),
  fn("factionopsVersionTooOld"),
  "globalThis.tooOld = factionopsVersionTooOld;",
].join("\n"), box);
const tooOld = box.tooOld;
const MIN = SRC.match(/FACTIONOPS_MIN_VERSION = '([^']+)'/)[1];

test("a named partner build is let through", () => {
  assert.equal(tooOld("sidekick"), false);
});

test("the name is matched however it is cased or padded", () => {
  assert.equal(tooOld("Sidekick"), false);
  assert.equal(tooOld("SIDEKICK"), false);
  assert.equal(tooOld(" sidekick "), false);
});

test("a genuinely outdated FactionOps is still refused", () => {
  // The whole point of the gate. This must not be collateral.
  assert.equal(tooOld("4.9.73"), true);
  assert.equal(tooOld("1.0.0"), true);
});

test("a current version passes", () => {
  assert.equal(tooOld(MIN), false);
  assert.equal(tooOld("5.4.2"), false);
});

test("a client that sends no version is still let through", () => {
  // Legacy behaviour, deliberately kept — see the guard's own comment.
  assert.equal(tooOld(undefined), false);
  assert.equal(tooOld(""), false);
  assert.equal(tooOld(null), false);
});

test("an unparseable version that is NOT on the list is still refused", () => {
  // The fix is an allowlist, not a loosening. Anything unrecognised is still
  // rated against the floor, so a mangled version cannot walk past the gate.
  assert.equal(tooOld("banana"), true);
  assert.equal(tooOld("1.0-beta"), true);
});

test("the allowlist cannot be fooled by a version-shaped string", () => {
  assert.equal(tooOld("sidekick.9.9.9"), true);
  assert.equal(tooOld("0.0.1-sidekick"), true);
});
