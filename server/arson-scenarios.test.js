// Run: node server/arson-scenarios.test.js
import assert from "node:assert";
import { upsertScenario } from "./arson-scenarios.js";

let pass = 0;
function t(name, fn) { fn(); pass++; console.log("  ✓", name); }

// Approving a crime log used to write a parallel record to arson-overrides.json,
// which the ledger merged over arsonists-ledger-scenarios.json at runtime. This
// folds the approval straight into the scenarios list instead.
//
// No history / revert: a wrong approval is corrected by submitting a new log
// with the right numbers and approving that, which overwrites. Storing previous
// values would be a second mechanism for something already possible, in a file
// every client downloads on every page load.

const base = () => ([
  { scenarioName: "A Black Mark", payout: 220000, actions: { ignite: [{ resourceId: "flamethrower", qty: 1 }] } },
  { scenarioName: "A Hot Lead", payout: 50000, actions: { place: [{ resourceId: "gasoline", qty: 1 }] } },
]);

console.log("upsertScenario");

t("updates an existing scenario in place, without growing the list", () => {
  const out = upsertScenario(base(), { scenarioName: "A Hot Lead", payout: 44000, actions: {} });
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out.find((s) => s.scenarioName === "A Hot Lead").payout, 44000);
});

t("replaces actions wholesale, not merged", () => {
  const out = upsertScenario(base(), { scenarioName: "A Hot Lead", payout: 44000, actions: { ignite: [{ resourceId: "match", qty: 2 }] } });
  const rec = out.find((s) => s.scenarioName === "A Hot Lead");
  assert.deepStrictEqual(rec.actions, { ignite: [{ resourceId: "match", qty: 2 }] });
  assert.strictEqual(rec.actions.place, undefined, "the old action must not survive");
});

// Ledger keys are mixed-case ("A Black Mark"); overrides were lowercased. An
// exact match would miss every existing record and append 10 duplicates.
t("matches case-insensitively rather than appending a duplicate", () => {
  const out = upsertScenario(base(), { scenarioName: "a black mark", payout: 180000, actions: {} });
  assert.strictEqual(out.length, 2, "must not append a second 'a black mark'");
  assert.strictEqual(out.find((s) => /black mark/i.test(s.scenarioName)).payout, 180000);
});

t("keeps the original scenarioName casing on update", () => {
  const out = upsertScenario(base(), { scenarioName: "a black mark", payout: 180000, actions: {} });
  assert.strictEqual(out[0].scenarioName, "A Black Mark");
});

t("appends an unknown scenario", () => {
  const out = upsertScenario(base(), { scenarioName: "Brand New Job", payout: 9000, actions: {} });
  assert.strictEqual(out.length, 3);
  assert.strictEqual(out[2].scenarioName, "Brand New Job");
  assert.strictEqual(out[2].payout, 9000);
});

t("appended scenarios keep the casing they were submitted with", () => {
  const out = upsertScenario(base(), { scenarioName: "Brand New Job", payout: 9000, actions: {} });
  assert.strictEqual(out[2].scenarioName, "Brand New Job");
});

t("does not mutate the input list or its records", () => {
  const original = base();
  upsertScenario(original, { scenarioName: "A Hot Lead", payout: 1, actions: {} });
  assert.strictEqual(original[1].payout, 50000);
});

t("a non-array input yields a list containing just the new record", () => {
  const out = upsertScenario(null, { scenarioName: "Only One", payout: 5, actions: {} });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].scenarioName, "Only One");
});

console.log(`\n${pass} passed`);
