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
  // factionopsVersionTooOld delegates the name match to this. Omitting it
  // fails every test here with "factionopsClientName is not defined",
  // which reads like a broken gate rather than a half-built sandbox.
  fn("factionopsClientName"),
  fn("factionopsVersionBelow"),
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

test("the floor is 5.6.26: everything older is refused, it and newer pass", () => {
  // Raised at the owner's request (2026-10-27) with the 5.6.26 release.
  assert.equal(MIN, "5.6.26");
  for (const v of ["5.6.25", "5.6.19", "5.5.3", "5.4.7"]) assert.equal(tooOld(v), true, v);
  for (const v of ["5.6.26", "5.6.27", "5.7.0", "6.0.0"]) assert.equal(tooOld(v), false, v);
});

test("a current version passes", () => {
  assert.equal(tooOld(MIN), false);
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

// What an outdated copy is answered. The owner wants an outdated copy to stop
// working on the war page and nowhere else: the chain bar and the
// notifications keep running (2026-10-27). From 5.5.3 a copy answered 403
// takes its buttons off the war page, says why, and carries on with the
// sign-in it saved. Older copies read a 403 as a silent failure, so they keep
// the 426, which they show as "outdated, please update".
let _answer;
function answer(v) {
  if (!_answer) {
    const b2 = { Number, Math, Set, String };
    vm.createContext(b2);
    vm.runInContext([
      line(/^const FACTIONOPS_MIN_VERSION = .*$/m),
      line(/^const FACTIONOPS_WAR_PAGE_OFF_VERSION = .*$/m),
      fn("factionopsVersionBelow"),
      fn("factionopsOutdatedAnswer"),
      "globalThis.answer = factionopsOutdatedAnswer;",
    ].join("\n"), b2);
    _answer = b2.answer;
  }
  return _answer(v);
}

test("an outdated copy from 5.5.3 on is answered 403, which takes it off the war page", () => {
  for (const v of ["5.6.25", "5.6.19", "5.5.3"]) {
    const a = answer(v);
    assert.equal(a.status, 403, v);
    assert.equal(a.body.outdated, true, v);
    assert.equal(a.body.updateUrl, "https://tornwar.com/scripts/factionops.user.js", v);
  }
});

test("the 403 names the copy, the version to update to, what stops, and how to update", () => {
  // The copy toasts this text as it stands; only its 426 branch adds the
  // Tampermonkey hint itself.
  assert.equal(answer("5.6.25").body.error,
    `FactionOps 5.6.25 is outdated: update to v${MIN} or newer to use it on the war page. `
    + "Open Tampermonkey → Check for userscript updates.");
});

test("a copy older than 5.5.3 keeps the 426, the refusal it shows", () => {
  for (const v of ["5.5.2", "5.4.7", "5.1.90", "4.0.0", "banana"]) {
    const a = answer(v);
    assert.equal(a.status, 426, v);
    assert.equal(a.body.error, `FactionOps ${v} is outdated — please update to v${MIN} or newer.`, v);
    assert.equal(a.body.outdated, true, v);
    assert.equal(a.body.updateUrl, "https://tornwar.com/scripts/factionops.user.js", v);
  }
});

test("/api/auth sends an outdated copy that answer", () => {
  const route = SRC.slice(SRC.indexOf('router.post("/api/auth"'));
  const gate = route.slice(0, route.indexOf("factionopsVersionTooOld(scriptVersion)") + 900);
  assert.match(gate, /const answer = factionopsOutdatedAnswer\(scriptVersion\);/);
  assert.match(gate, /return res\.status\(answer\.status\)\.json\(answer\.body\);/);
});
