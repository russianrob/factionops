// The assist requests a FactionOps poll still owes a member: each member gets
// each request once, on their next poll, oldest first, while it is under the
// minute FactionOps will still show it; never their own. Each test uses its
// own war, so no test sees another's requests. Ids and names are made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ASSIST_FRESH_MS, recordAssist, takeAssistFor, hasAssistFor } from "./assist-relay.js";

const T0 = Date.UTC(2026, 9, 28, 9, 0);
const SENDER = 1000001, A = 1000002, B = "1000003";
const req = (targetId, at = T0) => ({
  type: "assist_request", mode: "assist", playerId: SENDER, playerName: "Asker",
  targetId, targetName: "Target" + targetId, attackUrl: "https://www.torn.com/page.php?sid=attack&user2ID=" + targetId,
  timestamp: at,
});

test("FactionOps shows an assist request only while it is under a minute old", () => {
  assert.equal(ASSIST_FRESH_MS, 60 * 1000);
});

test("a member who polls after a request gets it, once", () => {
  const war = "war_1000101";
  recordAssist(war, req(2000001), SENDER);
  assert.equal(takeAssistFor(war, A, T0 + 2000).targetId, 2000001);
  assert.equal(takeAssistFor(war, A, T0 + 3000), null, "handed out twice");
});

test("every member gets their own copy", () => {
  const war = "war_1000102";
  recordAssist(war, req(2000001), SENDER);
  assert.equal(takeAssistFor(war, A, T0 + 1000).targetId, 2000001);
  assert.equal(takeAssistFor(war, B, T0 + 1000).targetId, 2000001);
});

test("the member who asked does not get their own request back", () => {
  const war = "war_1000103";
  recordAssist(war, req(2000001), SENDER);
  assert.equal(takeAssistFor(war, SENDER, T0 + 1000), null);
  assert.equal(takeAssistFor(war, String(SENDER), T0 + 1000), null, "an id as a string is the same member");
});

test("a member's id as a number or a string is the same member", () => {
  const war = "war_1000104";
  recordAssist(war, req(2000001), SENDER);
  assert.ok(takeAssistFor(war, "1000002", T0 + 1000));
  assert.equal(takeAssistFor(war, 1000002, T0 + 1000), null);
});

test("a request just under a minute old still goes out; one a minute old does not", () => {
  const war = "war_1000105";
  recordAssist(war, req(2000001), SENDER);
  assert.ok(takeAssistFor(war, A, T0 + ASSIST_FRESH_MS - 1));
  assert.equal(takeAssistFor(war, B, T0 + ASSIST_FRESH_MS), null);
});

test("two requests go out oldest first, one per poll", () => {
  // FactionOps drops a request older than the last one it showed.
  const war = "war_1000106";
  recordAssist(war, req(2000001, T0), SENDER);
  recordAssist(war, req(2000002, T0 + 5000), SENDER);
  assert.equal(takeAssistFor(war, A, T0 + 6000).targetId, 2000001);
  assert.equal(takeAssistFor(war, A, T0 + 7000).targetId, 2000002);
  assert.equal(takeAssistFor(war, A, T0 + 8000), null);
});

test("a stale request is skipped and the next one still goes out", () => {
  const war = "war_1000107";
  recordAssist(war, req(2000001, T0), SENDER);
  recordAssist(war, req(2000002, T0 + 30000), SENDER);
  assert.equal(takeAssistFor(war, A, T0 + 70000).targetId, 2000002);
});

test("each war keeps its own requests", () => {
  recordAssist("war_1000108", req(2000001), SENDER);
  assert.equal(takeAssistFor("war_1000109", A, T0 + 1000), null);
  assert.ok(takeAssistFor("war_1000108", A, T0 + 1000));
});

test("asking whether one is waiting does not hand it out", () => {
  const war = "war_1000110";
  assert.equal(hasAssistFor(war, A, T0), false);
  recordAssist(war, req(2000001), SENDER);
  assert.equal(hasAssistFor(war, A, T0 + 1000), true);
  assert.equal(hasAssistFor(war, A, T0 + 1000), true);
  assert.equal(hasAssistFor(war, SENDER, T0 + 1000), false);
  assert.equal(hasAssistFor(war, A, T0 + ASSIST_FRESH_MS), false, "a stale one is not waiting");
  takeAssistFor(war, A, T0 + 1000);
  assert.equal(hasAssistFor(war, A, T0 + 1000), false);
});

test("a war holds at most ten requests, the newest", () => {
  const war = "war_1000111";
  for (let i = 1; i <= 12; i++) recordAssist(war, req(2000000 + i, T0 + i), SENDER);
  const got = [];
  for (let r; (r = takeAssistFor(war, A, T0 + 100)); ) got.push(r.targetId);
  assert.deepEqual(got, [2000003, 2000004, 2000005, 2000006, 2000007, 2000008, 2000009, 2000010, 2000011, 2000012]);
});

test("a war id that is not a string is no war: nothing is kept or handed out, and nothing throws", () => {
  // What Express gives a crafted query such as warId[toString]=x: an object
  // that String() cannot turn into text.
  const odd = { toString: "x" };
  assert.doesNotThrow(() => recordAssist(odd, req(2000001), SENDER));
  assert.equal(hasAssistFor(odd, A, T0 + 1000), false);
  assert.equal(takeAssistFor(odd, A, T0 + 1000), null);
});
