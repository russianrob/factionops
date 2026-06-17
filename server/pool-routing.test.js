import test from "node:test";
import assert from "node:assert/strict";

import { selectionForPurpose } from "./store.js";

test("chain monitor routes to the chain selection", () => {
  assert.equal(selectionForPurpose("chain"), "chain");
});

test("xanax tracker routes to the armorynews selection", () => {
  assert.equal(selectionForPurpose("xanax-tracker"), "armorynews");
});

test("war status and attack feeds keep their existing routing", () => {
  assert.equal(selectionForPurpose("war-status"), "members");
  assert.equal(selectionForPurpose("attacks-feed"), "attacks");
  assert.equal(selectionForPurpose("enemy-attacks"), "attacks");
});

test("unmapped purposes route to no required selection", () => {
  assert.equal(selectionForPurpose("nonexistent-poller"), null);
});
