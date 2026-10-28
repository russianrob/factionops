// An id in the query string is one string. Express also reads
// warId[toString]=x as an object and warId=a&warId=b as an array. Handed to
// the war store, either one made a war record that store.saveState() then
// failed on for every war, and String() or a template literal on the object
// throws, which in an async route took the whole server down. routes.js turns
// them away with a 400 before any route sees them. The guard is lifted out of
// routes.js and run on made-up requests.
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

// The guard on one request: whether the route would run, and what was
// answered when it would not.
function run(query) {
  const box = {};
  vm.createContext(box);
  vm.runInContext(fn("rejectOddIds") + "\nglobalThis.guard = rejectOddIds;", box);
  let status = null, body = null, passed = false;
  const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
  box.guard({ query }, res, () => { passed = true; });
  return { passed, status, body };
}

test("a war id as one string goes through, and so does a request with none", () => {
  assert.equal(run({ warId: "war_1000003", since: "5" }).passed, true);
  assert.equal(run({ warId: "war_1000003", enemyFactionId: "1000004" }).passed, true);
  assert.equal(run({}).passed, true);
});

test("a war id read as an object or an array is turned away with a 400", () => {
  for (const warId of [{ toString: "x" }, ["war_1000003", "war_1000004"]]) {
    const r = run({ warId });
    assert.deepEqual([r.passed, r.status], [false, 400]);
    assert.equal(typeof (r.body && r.body.error), "string");
  }
});

test("so is an enemy faction id that is not one string", () => {
  const r = run({ warId: "war_1000003", enemyFactionId: { toString: "x" } });
  assert.deepEqual([r.passed, r.status], [false, 400]);
});

test("the guard comes before every route", () => {
  const use = SRC.indexOf("\nrouter.use(rejectOddIds);\n");
  assert.ok(use > 0, "not used");
  assert.ok(use < SRC.search(/^router\.(get|post|put|patch|delete)\(/m), "after a route");
});
