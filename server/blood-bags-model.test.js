// The numbers behind /bloodbags: what each armoury line counts as, who it counts
// for, and how the board ranks members. Synthetic lines only, written the way
// Torn writes them. Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
import { test } from "node:test";
import assert from "node:assert/strict";
import * as model from "./blood-bags-model.js";

// Torn's profile link, as the armoury news writes it: spaces around "=", plain http.
const who = (id, name) => `<a href = "http://www.torn.com/profiles.php?XID=${id}">${name}</a>`;
const line = (over) => ({ kind: "fill", playerId: "1", name: "P1", type: null, qty: 1, toId: null, toName: null, ...over });

// ── reading a line ──────────────────────────────────────────────────────────
test("a typed fill is one bag given, of that type", () => {
  assert.deepEqual(
    model.parseLine(`${who(1001, "Ash")} filled one of the faction's Empty Blood Bags to create a Blood Bag : O+`),
    line({ kind: "fill", playerId: "1001", name: "Ash", type: "O+" }));
});

test("an older fill has no type, with or without the closing full stop", () => {
  const want = line({ kind: "fill", playerId: "2", name: "Old", type: null });
  assert.deepEqual(model.parseLine(`${who(2, "Old")} filled one of the faction's Empty Blood Bag items`), want);
  assert.deepEqual(model.parseLine(`${who(2, "Old")} filled one of the faction's Empty Blood Bag items.`), want);
});

test("a deposit of filled bags is N given, written Nx or N x", () => {
  assert.deepEqual(model.parseLine(`${who(1002, "Birch")} deposited 6x Blood Bag : O+`),
    line({ kind: "deposit", playerId: "1002", name: "Birch", type: "O+", qty: 6 }));
  assert.deepEqual(model.parseLine(`${who(1003, "0xCedar")} deposited 139 x Blood Bag : AB+`),
    line({ kind: "deposit", playerId: "1003", name: "0xCedar", type: "AB+", qty: 139 }));
});

test("a use is one bag used, with or without the closing full stop", () => {
  const want = line({ kind: "use", playerId: "1004", name: "D4isy", type: "O+" });
  assert.deepEqual(model.parseLine(`${who(1004, "D4isy")} used one of the faction's Blood Bag : O+ items`), want);
  assert.deepEqual(model.parseLine(`${who(1004, "D4isy")} used one of the faction's Blood Bag : O+ items.`), want);
});

test("a use with no type is one bag used, counted under all types only", () => {
  assert.deepEqual(model.parseLine(`${who(5, "P5")} used one of the faction's Blood Bag items`),
    line({ kind: "use", playerId: "5", name: "P5", type: null }));
});

test("AB types are read whole, never as A or B", () => {
  assert.equal(model.parseLine(`${who(1, "P1")} used one of the faction's Blood Bag : AB- items`).type, "AB-");
  assert.equal(model.parseLine(`${who(1, "P1")} deposited 2x Blood Bag : AB+`).type, "AB+");
});

test("a hand-out counts for whoever got the bags, named or themselves, with Torn's suffix or without", () => {
  assert.deepEqual(
    model.parseLine(`${who(1016, "Quill")} gave 2x Blood Bag : A+ to ${who(1005, "Elm")} from the faction armory`),
    line({ kind: "gave", playerId: "1016", name: "Quill", type: "A+", qty: 2, toId: "1005", toName: "Elm" }));
  assert.deepEqual(
    model.parseLine(`${who(1006, "Fern_")} loaned 3x Blood Bag : B- to themselves from the faction armory`),
    line({ kind: "loaned", playerId: "1006", name: "Fern_", type: "B-", qty: 3, toId: "1006", toName: "Fern_" }));
  assert.deepEqual(
    model.parseLine(`${who(9, "Lead")} gave 1x Blood Bag : O- to ${who(8, "Mem")}`),
    line({ kind: "gave", playerId: "9", name: "Lead", type: "O-", qty: 1, toId: "8", toName: "Mem" }));
});

test("a return cancels use for the member returning; a retrieval for the member it was taken from", () => {
  assert.deepEqual(model.parseLine(`${who(1007, "Gale_j")} returned 7x Blood Bag : B-`),
    line({ kind: "returned", playerId: "1007", name: "Gale_j", type: "B-", qty: 7 }));
  assert.deepEqual(model.parseLine(`${who(1008, "Hazel")} retrieved 1x Blood Bag : A+ from ${who(1009, "Iris")}`),
    line({ kind: "retrieved", playerId: "1008", name: "Hazel", type: "A+", qty: 1, toId: "1009", toName: "Iris" }));
});

test("an older profile link without quotes still reads", () => {
  assert.equal(model.parseLine(`<a href = http://www.torn.com/profiles.php?XID=1010>Juniper69</a> deposited 1x Blood Bag : A-`).playerId, "1010");
});

test("empty bags, irradiated bags, medical boxes and other items count for nothing", () => {
  for (const text of [
    `${who(1011, "Kestrel")} deposited 1672x Empty Blood Bag`,
    `${who(1012, "Larch")} deposited 42 x Empty Blood Bag`,
    `${who(1013, "Maple")} opened a Box of Medical Supplies and gained 20x Empty Blood Bag which has been placed in the armory`,
    `${who(1014, "Nettle")} deposited 1 x Blood Bag : Irradiated`,
    `${who(1, "P1")} used one of the faction's Blood Bag : Irradiated items`,
    `${who(1015, "Oak")} used one of the faction's Xanax items`,
    `${who(1002, "Birch")} deposited 5x Spray Paint : Red`,
    `${who(1, "P1")} deposited 0x Blood Bag : O+`,
    "",
  ]) assert.equal(model.parseLine(text), null, text);
});

test("each kind counts for the right member", () => {
  assert.equal(model.chargedTo(line({ kind: "use", playerId: "1" })), "1");
  assert.equal(model.chargedTo(line({ kind: "returned", playerId: "1" })), "1");
  assert.equal(model.chargedTo(line({ kind: "gave", playerId: "1", toId: "2" })), "2");
  assert.equal(model.chargedTo(line({ kind: "loaned", playerId: "1", toId: "2" })), "2");
  assert.equal(model.chargedTo(line({ kind: "retrieved", playerId: "1", toId: "2" })), "2");
});

test("a blood line in a wording the reader has not met is flagged; known ones are not", () => {
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} donated 2x Blood Bag : O+ to the hospital`), true);
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} used one of the faction's Blood Bag : O+ items`), false);
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} deposited 4x Empty Blood Bag`), false);
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} deposited 1 x Blood Bag : Irradiated`), false);
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} used one of the faction's Xanax items`), false);
});
