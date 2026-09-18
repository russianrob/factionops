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

// ── Call expiry: the server decides, the client must not undercut it ────
// Calls were being dropped after five minutes while the userscript said
// fifteen. The server is the authority — CALL_EXPIRE_MS in the environment —
// and the client's constant only prunes its own view. A client window SHORTER
// than the server's is the dangerous direction: it hides a call the server
// still holds, so the target reads as free and two people hit it.
const ENV = fs.readFileSync(new URL("./.env", import.meta.url), "utf8");
const envMs = (k) => {
  const m = ENV.match(new RegExp("^" + k + "=(\\d+)\\s*$", "m"));
  return m ? Number(m[1]) : null;
};
const clientMs = (k) => {
  const m = SRC.match(new RegExp(k + ":\\s*([0-9*\\s]+),"));
  if (!m) return null;
  return m[1].split("*").map((x) => Number(x.trim())).reduce((a, b) => a * b, 1);
};

test("a regular call lasts twenty minutes, on both sides", () => {
  assert.equal(envMs("CALL_EXPIRE_MS"), 20 * 60 * 1000, "server");
  assert.equal(clientMs("CALL_TIMEOUT"), 20 * 60 * 1000, "client");
});

test("a deal lasts two hours, on both sides", () => {
  // The client already said two hours. The server was expiring them at
  // fifteen minutes, and the server wins — which is why deals lapsed
  // mid-negotiation despite the constant.
  assert.equal(envMs("DEAL_EXPIRE_MS"), 2 * 60 * 60 * 1000, "server");
  assert.equal(clientMs("DEAL_TIMEOUT"), 2 * 60 * 60 * 1000, "client");
});

test("the client never prunes a call the server still holds", () => {
  assert.ok(clientMs("CALL_TIMEOUT") >= envMs("CALL_EXPIRE_MS"),
    "client call window is shorter than the server's");
  assert.ok(clientMs("DEAL_TIMEOUT") >= envMs("DEAL_EXPIRE_MS"),
    "client deal window is shorter than the server's");
});

test("nothing still advertises the old fifteen minutes", () => {
  // The toasts said "yours for 15 min" while the constant said two hours and
  // the server enforced fifteen. Three numbers, one of them shown to people.
  assert.ok(!/Deal call[^']*15 min/.test(SRC), "a deal toast still says 15 min");
  assert.ok(!/Multi-hit deal[^']*15 min/.test(SRC), "the deal badge still says 15 min");
});
