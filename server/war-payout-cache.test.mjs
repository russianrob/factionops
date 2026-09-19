// When a finished war's payout may be cached forever.
//
// An ended war's ATTACK log is immutable, which is why its payout is cached
// with expiresAt: Infinity and persisted to disk. Its REWARDS are not: Torn
// publishes the ranked-war report's caches some time AFTER the war ends.
//
// A payout computed inside that gap comes back with no caches at all, and the
// forever-cache then freezes that zero permanently. Observed exactly:
//
//   war_42055:dynamic:...|F0|T_|$_   loot=0  source=none  items=0
//   generated 00:56 — the war ended 00:54:38
//
// while Torn's report for that war holds Armor x5, Medium Arms x9, Melee x6,
// Small Arms x2 and Heavy Arms x1, worth about $4.76b at the market values the
// server already had on disk.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./war-payouts.js", import.meta.url), "utf8");

function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in war-payouts.js: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
const box = {};
vm.createContext(box);
vm.runInContext(fn("payoutIsFinal") + "\nglobalThis.final = payoutIsFinal;", box);
const final = box.final;

test("a live war is never final", () => {
  assert.equal(final({ warEnded: false }, { lootTotal: 0, lootSource: "none" }), false);
  assert.equal(final({ warEnded: false }, { lootTotal: 5e9, lootSource: "caches+cash" }), false);
});

test("an ended war whose caches have landed is final", () => {
  assert.equal(final({ warEnded: true }, { lootTotal: 4.76e9, lootSource: "caches+cash" }), true);
});

test("an ended war with no rewards YET is not final", () => {
  // The reported fault. Torn had not published the report two minutes after
  // the war ended, so the payout was zero — and freezing that is what made it
  // permanent.
  assert.equal(final({ warEnded: true }, { lootTotal: 0, lootSource: "none" }), false);
});

test("an admin's own figure is final even with no caches found", () => {
  // The admin has told us the number; there is nothing left to wait for.
  assert.equal(final({ warEnded: true }, { lootTotal: 3e9, lootSource: "override" }), true);
  assert.equal(final({ warEnded: true }, { lootTotal: 3e9, lootSource: "admin override" }), true);
});

test("cash-only rewards count as landed", () => {
  // Some war tiers pay cash rather than caches. That is a real answer.
  assert.equal(final({ warEnded: true }, { lootTotal: 2e8, lootSource: "cash" }), true);
  assert.equal(final({ warEnded: true }, { lootTotal: 1e8, lootSource: "points" }), true);
});

test("a zero total is never final however it is labelled", () => {
  // Belt and braces: the thing worth never freezing is a payout of nothing.
  for (const src of ["caches+cash", "cash", "override", "points"]) {
    assert.equal(final({ warEnded: true }, { lootTotal: 0, lootSource: src }), false, src);
  }
});
