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

// ── timeframes, types and wars ──────────────────────────────────────────────
const DAY = 86400;
const NOW = 1792800000;                       // 2026-10-24 00:00 UTC, in seconds
const at = (daysAgo) => NOW - Math.round(daysAgo * DAY);

test("a timeframe is one of five, 7 days when missing; anything else is refused", () => {
  assert.equal(model.parseWindow(undefined), "7d");
  assert.equal(model.parseWindow(""), "7d");
  for (const w of ["24h", "7d", "30d", "90d", "all"]) assert.equal(model.parseWindow(w), w);
  assert.equal(model.parseWindow("30D"), "30d");
  for (const bad of ["1y", "7", "__proto__", "toString"]) assert.equal(model.parseWindow(bad), null, bad);
});

test("a blood type is all or one of eight, and a + typed into a link still reads", () => {
  assert.equal(model.parseType(undefined), "all");
  assert.equal(model.parseType("ALL"), "all");
  assert.equal(model.parseType("A+"), "A+");
  assert.equal(model.parseType("A "), "A+", "a literal + in a query string arrives as a space");
  assert.equal(model.parseType("ab "), "AB+");
  assert.equal(model.parseType("o-"), "O-");
  for (const bad of ["C+", " A", "A", "Irradiated"]) assert.equal(model.parseType(bad), null, bad);
});

test("a war runs from its start to its end; a live one to now; one not started yet is no war", () => {
  const wars = [
    { id: 1, start: at(10), end: at(9) },
    { id: 2, start: at(1), end: 0 },
    { id: 3, start: NOW + DAY, end: 0 },
  ];
  assert.deepEqual(model.warSpans(wars, NOW), [{ start: at(10), end: at(9) }, { start: at(1), end: NOW }]);
  assert.deepEqual(model.liveWar(wars, NOW), { id: 2, start: at(1) });
  assert.equal(model.liveWar([{ id: 1, start: at(10), end: at(9) }], NOW), null);
});

test("a timeframe covers its days up to now; all time starts where the history reaches", () => {
  assert.deepEqual(model.windowRange("7d", NOW, at(300)), { fromSec: NOW - 7 * DAY, toSec: NOW });
  assert.deepEqual(model.windowRange("24h", NOW, at(300)), { fromSec: NOW - DAY, toSec: NOW });
  assert.deepEqual(model.windowRange("all", NOW, at(300)), { fromSec: at(300), toSec: NOW });
});

// ── per member ──────────────────────────────────────────────────────────────
const L = (kind, playerId, daysAgo, over = {}) => ({ ts: at(daysAgo), kind, playerId: String(playerId), type: "O+", qty: 1, toId: null, ...over });
const sevenDays = (over = {}) => ({ fromSec: NOW - 7 * DAY, toSec: NOW, type: "all", warSpans: [], ...over });

test("given is fills plus deposits; used is uses plus hand-outs received, less returns; net is the difference", () => {
  const out = model.tally([
    L("fill", 1, 1), L("fill", 1, 2), L("deposit", 1, 3, { qty: 5 }),
    L("use", 1, 1), L("gave", 9, 2, { qty: 3, toId: "1" }), L("returned", 1, 2, { qty: 1 }),
  ], sevenDays());
  assert.deepEqual(out.get("1"), { given: 7, used: 3, usedInWars: 0, net: 4 });
  assert.equal(out.get("9"), undefined, "handing bags out counts nothing for the leader");
});

test("three fills by one member in the same second are three bags", () => {
  const out = model.tally([L("fill", 1, 1), L("fill", 1, 1), L("fill", 1, 1)], sevenDays());
  assert.equal(out.get("1").given, 3);
});

test("a timeframe includes both its ends and nothing outside them", () => {
  const out = model.tally([
    L("fill", 1, 7), L("fill", 1, 0), L("fill", 1, 7.01), { ...L("fill", 1, 0), ts: NOW + 1 },
  ], sevenDays());
  assert.equal(out.get("1").given, 2);
});

test("the type filter keeps one type, and fills with no type count under all types only", () => {
  const lines = [L("fill", 1, 1, { type: "A+" }), L("fill", 1, 1, { type: null }), L("use", 1, 1, { type: "O+" })];
  assert.deepEqual(model.tally(lines, sevenDays()).get("1"), { given: 2, used: 1, usedInWars: 0, net: 1 });
  assert.deepEqual(model.tally(lines, sevenDays({ type: "A+" })).get("1"), { given: 1, used: 0, usedInWars: 0, net: 1 });
  assert.deepEqual(model.tally(lines, sevenDays({ type: "O+" })).get("1"), { given: 0, used: 1, usedInWars: 0, net: -1 });
});

test("use during a war counts as used but not against net, a live war's up to now", () => {
  const spans = model.warSpans([{ id: 1, start: at(5), end: at(4) }, { id: 2, start: at(1), end: 0 }], NOW);
  const out = model.tally([
    L("use", 1, 4.5), L("use", 1, 0.5), L("use", 1, 3), L("fill", 1, 3),
  ], sevenDays({ warSpans: spans }));
  assert.deepEqual(out.get("1"), { given: 1, used: 3, usedInWars: 2, net: 0 });
});

test("a hand-out to themselves counts against the leader; a retrieval cancels it for the member it came from", () => {
  const out = model.tally([
    L("loaned", 9, 1, { qty: 2, toId: "9" }),
    L("gave", 9, 1, { qty: 4, toId: "2" }), L("retrieved", 9, 0.5, { qty: 1, toId: "2" }),
  ], sevenDays());
  assert.equal(out.get("9").used, 2);
  assert.equal(out.get("2").used, 3);
});

test("returning bags cancels use but never adds to net", () => {
  const spans = model.warSpans([{ id: 1, start: at(3), end: at(2) }], NOW);
  // Lent before the window and returned inside it.
  const before = model.tally([L("loaned", 9, 20, { qty: 7, toId: "1" }), L("returned", 1, 1, { qty: 7 })], sevenDays());
  assert.deepEqual(before.get("1"), { given: 0, used: 0, usedInWars: 0, net: 0 });
  // Lent during a war and returned after it.
  const acrossWar = model.tally([L("loaned", 9, 2.5, { qty: 4, toId: "1" }), L("returned", 1, 1, { qty: 4 })], sevenDays({ warSpans: spans }));
  assert.deepEqual(acrossWar.get("1"), { given: 0, used: 4, usedInWars: 4, net: 0 });
});

// ── the board ───────────────────────────────────────────────────────────────
const member = (id, name) => ({ playerId: String(id), name });
const board = (over = {}) => model.buildBoard({
  lines: [], roster: [], wars: [], nowSec: NOW, window: "7d", type: "all", viewerId: "0", reachSec: at(300), ...over,
});
// n fills, or n uses, by one member a day ago.
const fills = (id, n) => Array.from({ length: n }, () => L("fill", id, 1));
const uses = (id, n) => Array.from({ length: n }, () => L("use", id, 1));

test("the lists hold current members only; the overview counts everyone, former members too", () => {
  const b = board({
    roster: [member(1, "Ann")],
    lines: [...fills(1, 2), ...fills(77, 5), ...uses(77, 1)],
  });
  assert.deepEqual(b.topGiven.map((r) => r.playerId), ["1"]);
  assert.deepEqual(b.overview, { given: 7, used: 1, usedInWars: 0, net: 6, members: 1 });
});

test("top contributors: most given first, ties by name whatever the case, ten at most", () => {
  const roster = Array.from({ length: 12 }, (_, i) => member(i + 1, "m" + String(i + 1).padStart(2, "0")));
  roster[2].name = "Bea"; roster[3].name = "alf";
  const lines = [...fills(3, 20), ...fills(4, 20)];
  for (let i = 5; i <= 12; i++) lines.push(...fills(i, i));
  const b = board({ roster, lines });
  assert.equal(b.topGiven.length, 10);
  assert.deepEqual(b.topGiven.slice(0, 3), [
    { rank: 1, playerId: "4", name: "alf", value: 20 },
    { rank: 2, playerId: "3", name: "Bea", value: 20 },
    { rank: 3, playerId: "12", name: "m12", value: 12 },
  ]);
  assert.ok(!b.topGiven.some((r) => r.playerId === "1" || r.playerId === "2"), "nobody with nothing given");
});

test("top net lists only net above zero; the Wall of Shame only below it, lowest first, never padded", () => {
  const b = board({
    roster: [member(1, "Ann"), member(2, "Bob"), member(3, "Cat"), member(4, "Dan"), member(5, "Eve")],
    lines: [...fills(1, 5), ...uses(1, 1), ...uses(2, 3), ...uses(3, 1), ...fills(4, 1), ...uses(4, 1), ...uses(5, 3)],
  });
  assert.deepEqual(b.topNet, [{ rank: 1, playerId: "1", name: "Ann", value: 4 }]);
  assert.deepEqual(b.wall, [
    { rank: 1, playerId: "2", name: "Bob", value: -3 },
    { rank: 2, playerId: "5", name: "Eve", value: -3 },
    { rank: 3, playerId: "3", name: "Cat", value: -1 },
  ]);
});

test("a member who only used bags during wars is on no list, and the overview still shows the use", () => {
  const b = board({
    roster: [member(1, "Ann")],
    wars: [{ id: 1, start: at(2), end: at(1) }],
    lines: [L("use", 1, 1.5), L("use", 1, 1.5)],
  });
  assert.deepEqual([b.topGiven, b.topNet, b.wall], [[], [], []]);
  assert.deepEqual(b.overview, { given: 0, used: 2, usedInWars: 2, net: 0, members: 1 });
});

test("the viewer's line ranks them by net among the whole roster, even outside the top ten", () => {
  const roster = Array.from({ length: 15 }, (_, i) => member(i + 1, "m" + String(i + 1).padStart(2, "0")));
  const lines = [];
  for (let i = 1; i <= 13; i++) lines.push(...fills(i, 20 - i));
  lines.push(...fills(14, 1), ...uses(14, 2), L("use", 14, 1, { ts: at(1.5) }));
  const b = board({ roster, lines, viewerId: "14", wars: [{ id: 1, start: at(2), end: at(1.2) }] });
  assert.deepEqual(b.you, { rank: 15, of: 15, given: 1, used: 3, usedInWars: 1, net: -1 });
  assert.equal(board({ roster, lines, viewerId: "15" }).you, null, "nothing given or used in the window");
});

test("a viewer who is not on today's roster still sees their figures, unranked", () => {
  const b = board({ roster: [member(1, "Ann")], lines: fills(99, 2), viewerId: "99" });
  assert.deepEqual(b.you, { rank: null, of: 1, given: 2, used: 0, usedInWars: 0, net: 2 });
});

test("all time starts where the history reaches; the type filter reaches the lists", () => {
  const roster = [member(1, "Ann")];
  const lines = [L("fill", 1, 200, { type: "A+" }), L("fill", 1, 400, { type: "A+" }), L("fill", 1, 1, { type: "O+" })];
  assert.equal(board({ roster, lines, window: "all" }).topGiven[0].value, 2);
  assert.equal(board({ roster, lines, window: "all", type: "A+" }).topGiven[0].value, 1);
  assert.deepEqual(board({ roster, lines, window: "all", type: "B-" }).topGiven, []);
});
