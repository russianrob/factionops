import test from "node:test";
import assert from "node:assert/strict";
import { engine } from "./stakeout-watcher.js";

const NOW = 1_700_000_000_000;
const plain = (o) => JSON.parse(JSON.stringify(o));
const psnap = (o) => Object.assign(
  { name: "X", state: "Okay", description: "", lastAction: "Online", lastActionTs: NOW / 1000, lifeCur: 100, lifeMax: 100, revivable: false }, o);
const P = { okay: true, hospital: true, landing: true, online: true, life: 25, offline: 5, revivable: true };

test("engine: exports the five pure functions", () => {
  for (const k of ["hoursSince", "evaluatePlayer", "evaluateFaction", "mapPlayerResponse", "mapFactionResponse"]) {
    assert.equal(typeof engine[k], "function", `missing ${k}`);
  }
});
test("engine: null old -> [] (no cold-boot spam)", () => {
  assert.deepEqual(plain(engine.evaluatePlayer(null, psnap({}), P, NOW)), []);
});
test("engine: okay transition fires once then re-arms", () => {
  assert.deepEqual(plain(engine.evaluatePlayer(psnap({ state: "Hospital" }), psnap({ state: "Okay" }), P, NOW)), ["okay"]);
  assert.deepEqual(plain(engine.evaluatePlayer(psnap({ state: "Okay" }), psnap({ state: "Okay" }), P, NOW)), []);
});
test("engine: evaluateFaction takes 3 args (no nowMs)", () => {
  const fsnap = (o) => Object.assign({ name: "F", chain: 0, membersCur: 10, membersMax: 100, rankedWar: false, raid: false, territoryWar: false }, o);
  assert.deepEqual(plain(engine.evaluateFaction(fsnap({ rankedWar: false }), fsnap({ rankedWar: true }), { rankedWarStarts: true })), ["rankedWarStarts"]);
});
test("engine: mapPlayerResponse reads v2 profile shape", () => {
  const snap = engine.mapPlayerResponse({ profile: { name: "Bob", status: { state: "Hospital", description: "" }, last_action: { status: "Offline", timestamp: 1 }, life: { current: 50, maximum: 100 }, revivable: true } });
  assert.equal(plain(snap).state, "Hospital");
  assert.equal(plain(snap).revivable, true);
});
