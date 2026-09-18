// The war-page filters in FactionOps.
//
// Functions are lifted out of the shipping userscript and run in a vm, the same
// way rwp-refresh.js runs RW Pricer's own parser — the point is to test what
// ships rather than a copy that can drift from it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./public/scripts/factionops.user.js", import.meta.url), "utf8");

function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in the shipping script: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fn("isAwayFromTorn") + "\nglobalThis.away = isAwayFromTorn;", sandbox);
const away = sandbox.away;

// ── Who cannot be hit from Torn ────────────────────────────────
// A war list shows every enemy, including the ones sitting in another country.
// They cannot be attacked from here, so on a busy call sheet they are rows to
// scroll past.

test("someone in another country is away", () => {
  assert.equal(away("abroad", "In Switzerland"), true);
  assert.equal(away("abroad", "In Mexico"), true);
});

test("someone on a plane is away, in both directions", () => {
  assert.equal(away("traveling", "Traveling to Switzerland"), true);
  assert.equal(away("traveling", "Returning to Torn from Switzerland"), true);
});

test("a foreign hospital is away", () => {
  // The case from the report: "In a Swiss hospital for 4 minutes and 23
  // seconds". The state is Hospital like any other, and only the wording says
  // the bed is in another country.
  assert.equal(away("hospital", "In a Swiss hospital for 4 minutes and 23 seconds"), true);
  assert.equal(away("hospital", "In a Mexican hospital for 1 hour"), true);
  assert.equal(away("hospital", "In a South African hospital for 2 minutes"), true);
});

test("a hospital in Torn is NOT away", () => {
  // This is the distinction the whole filter turns on. Someone in a Torn
  // hospital is attackable the moment they leave it, and hiding them would
  // hide most of a war.
  assert.equal(away("hospital", "In hospital for 10 minutes"), false);
  assert.equal(away("hospital", "In hospital for 1 hour and 3 minutes"), false);
});

test("everybody else stays on the list", () => {
  assert.equal(away("okay", "Okay"), false);
  assert.equal(away("jail", "In jail for 20 minutes"), false);
  assert.equal(away("hospital", ""), false);
});

test("the state is read whatever its case", () => {
  assert.equal(away("Abroad", "In Switzerland"), true);
  assert.equal(away("TRAVELING", "Traveling to Japan"), true);
});

test("a missing status never hides anybody", () => {
  // Unknown data shows, for the same reason unknown stats do: a hidden row is
  // a target nobody attacks.
  assert.equal(away(null, null), false);
  assert.equal(away(undefined, undefined), false);
  assert.equal(away("", ""), false);
});

test("a description mentioning a country does not hide a healthy target", () => {
  // Only the hospital wording is inspected, and only when the state is
  // Hospital. Torn writes travel plans into other states' descriptions.
  assert.equal(away("okay", "In a Swiss hospital"), false);
});
