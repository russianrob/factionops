// Reading a stock list out of a forum post's TEXT.
//
// The deterministic parsers in RW Pricer handle five post formats and cost
// nothing. This is the fallback for the sixth: a shape nobody has written a
// rule for yet. Nothing here calls the model. What is tested is everything
// around it — the fence around untrusted text, the verification that throws
// out anything the post does not actually say, and which of the names it
// learned are safe to remember.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  textKey, buildTextPrompt, verifyItems, learnableAlias, newAliases,
} from "./rwp-text-read.js";

const feed = JSON.parse(fs.readFileSync(new URL("./data/rwp-prices.json", import.meta.url), "utf8"));

const POST = `
DBK | orange | 61% Achilles + 35% Bleed | Q: 157.58% | Price: 2.2b
Kodachi | yellow | 53% Parry | Q: 105.26% | Price: 600m
`;

test("the same post hits the same cache slot however it is spaced", () => {
  assert.equal(textKey(POST), textKey(POST.replace(/\n/g, "\n   ")));
  assert.notEqual(textKey(POST), textKey(POST + "Scimitar | yellow | 50% Parry"));
  assert.equal(textKey(""), textKey("   "));
});

test("the post is fenced and marked untrusted", () => {
  // A forum post is written by a stranger and is about to sit inside a prompt.
  const p = buildTextPrompt(POST);
  assert.match(p, /DBK/, "the post must actually be in there");
  assert.match(p, /untrusted/i);
  assert.ok(p.indexOf("DBK") > p.indexOf("Rules:"), "the post comes after the rules, not before");
});

// ── Verification ───────────────────────────────────────────────
// The model reads prose and can invent, exactly as it invented "Big Al's Gun
// Shop Katana" from a picture. Text has a check a picture never had: the
// source is right here, so anything it returns can be held against it.

test("an item the post does not mention is dropped", () => {
  const out = verifyItems(feed, POST, [
    { name: "Kodachi", bonuses: [{ name: "Parry", pct: 53 }] },
    { name: "Cobra Derringer", bonuses: [{ name: "Assassinate", pct: 97 }] },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Kodachi");
});

test("a roll the post does not state is dropped", () => {
  // 53% Parry is in the post. 97% Parry is not, and a roll is the single most
  // expensive thing to get wrong.
  const out = verifyItems(feed, POST, [
    { name: "Kodachi", bonuses: [{ name: "Parry", pct: 97 }] },
  ]);
  assert.equal(out.length, 0);
});

test("a name that is not a Torn item is dropped", () => {
  const out = verifyItems(feed, POST, [
    { name: "Kodachi Supreme", bonuses: [{ name: "Parry", pct: 53 }] },
  ]);
  assert.equal(out.length, 0);
});

test("a bonus that is not a Torn bonus is dropped", () => {
  const out = verifyItems(feed, POST, [
    { name: "Kodachi", bonuses: [{ name: "Sharpness", pct: 53 }] },
  ]);
  assert.equal(out.length, 0);
});

test("an abbreviation the post DOES use survives, and carries what it read", () => {
  const out = verifyItems(feed, POST, [
    { name: "Diamond Bladed Knife", readAs: "DBK",
      bonuses: [{ name: "Achilles", pct: 61 }, { name: "Bleed", pct: 35 }] },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Diamond Bladed Knife");
  assert.equal(out[0].readAs, "DBK");
});

test("a rarity the post does not state is not invented", () => {
  const out = verifyItems(feed, POST, [
    { name: "Kodachi", rarity: "Red", bonuses: [{ name: "Parry", pct: 53 }] },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].rarity, null, "the post says yellow, so Red is not kept");
});

// ── Learning a name ────────────────────────────────────────────
// The point of the fallback is that the SECOND post in an unknown shape costs
// nothing. Post text caches only help the same post; a learned alias helps
// every future post that uses the same shorthand.

test("an abbreviation built from the initials is learnable", () => {
  assert.equal(learnableAlias("DBK", "Diamond Bladed Knife"), true);
  assert.equal(learnableAlias("cd", "Cobra Derringer"), true);
});

test("a spelling variant is learnable", () => {
  assert.equal(learnableAlias("Armalite M15A4", "ArmaLite M-15A4"), true);
  assert.equal(learnableAlias("sig552", "SIG 552"), true);
});

test("a shared word is learnable", () => {
  assert.equal(learnableAlias("Derringer", "Cobra Derringer"), true);
});

test("a name with no relation to the item is NOT learnable", () => {
  // This is the guard that matters. Forum text is written by strangers, and an
  // alias is remembered and applied to every later post — a bad one would
  // mislabel weapons long after the post that taught it is gone.
  assert.equal(learnableAlias("gun", "Cobra Derringer"), false);
  assert.equal(learnableAlias("the good one", "Diamond Bladed Knife"), false);
  assert.equal(learnableAlias("x", "Kodachi"), false);
  assert.equal(learnableAlias("", "Kodachi"), false);
});

test("an alias that already means something else is refused", () => {
  // "Kodachi" is a weapon. It must never become shorthand for another one.
  assert.equal(learnableAlias("Kodachi", "Samurai Sword"), false);
});

test("only names the feed does not already know are learned", () => {
  const learned = newAliases(feed, [
    { name: "Diamond Bladed Knife", readAs: "DBK" },
    { name: "Kodachi", readAs: "Kodachi" },
    { name: "SIG 552", readAs: "SIG 552" },
  ]);
  assert.deepEqual(learned, { dbk: "Diamond Bladed Knife" });
});

test("nothing is learned from an item that failed verification", () => {
  // newAliases runs on verified items only; handed nothing, it learns nothing.
  assert.deepEqual(newAliases(feed, []), {});
});

test("readAs is the item's name, not the line it sat on", () => {
  // The first run returned readAs "DBK w/ Achilles 61 and Bleed 35" — the whole
  // line. It verifies fine, because the post obviously contains its own line,
  // but it is useless as a name: nothing can be learned from it and the badge
  // would quote a sentence back at the reader.
  const out = verifyItems(feed, POST, [
    { name: "Diamond Bladed Knife", readAs: "DBK | orange | 61% Achilles + 35% Bleed | Q: 157.58%",
      bonuses: [{ name: "Achilles", pct: 61 }] },
  ]);
  assert.equal(out.length, 0, "a whole line is not a name");
});

test("a name of a plausible length still passes", () => {
  const out = verifyItems(feed, POST, [
    { name: "Diamond Bladed Knife", readAs: "DBK", bonuses: [{ name: "Achilles", pct: 61 }] },
  ]);
  assert.equal(out.length, 1);
});

test("the prompt says readAs is the name alone", () => {
  const p = buildTextPrompt(POST);
  assert.match(p, /just the name/i, "the instruction has to be explicit: " + p.slice(0, 400));
});
