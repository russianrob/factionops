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
  isOwnOutput, readPostText,
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

test("the prompt knows a coloured square is a rarity", () => {
  // A shop list wrote its rarities as squares rather than words —
  // red / orange / yellow — and every item came back with no colour at all.
  // That is real data in the post being thrown away.
  const p = buildTextPrompt("x".repeat(40));
  assert.match(p, /\u{1F7E5}|\u{1F7E7}|\u{1F7E8}/u, "the squares must be in the prompt: " + p.slice(-500));
  assert.match(p, /square/i);
});

test("a square counts as the post stating a rarity", () => {
  // verifyItems only keeps a colour the post actually says. A square IS the
  // post saying it, so the check has to see it as one.
  const post = "\u{1F7E5} Jackhammer 18% Expose 3.00B";
  const out = verifyItems(feed, post, [
    { name: "Jackhammer", readAs: "Jackhammer", rarity: "Red",
      bonuses: [{ name: "Expose", pct: 18 }] },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].rarity, "Red", "the square said so");
});

test("a colour the post states in NO form is still refused", () => {
  const post = "Jackhammer 18% Expose 3.00B";
  const out = verifyItems(feed, post, [
    { name: "Jackhammer", readAs: "Jackhammer", rarity: "Red",
      bonuses: [{ name: "Expose", pct: 18 }] },
  ]);
  assert.equal(out[0].rarity, null);
});

test("a square of the wrong colour does not license a different one", () => {
  const post = "\u{1F7E8} Mag 7 17% Warlord 280M";
  const out = verifyItems(feed, post, [
    { name: "Mag 7", readAs: "Mag 7", rarity: "Red", bonuses: [{ name: "Warlord", pct: 17 }] },
  ]);
  assert.equal(out[0].rarity, null, "the post said yellow, not red");
});

test("control characters in a post do not change its cache identity", () => {
  // The cleaner's character class was written with RAW control bytes rather
  // than escapes, which made the whole module read as a binary file to grep and
  // silently hid its exports during a diagnosis. Escaped now — and this is the
  // behaviour that had to survive the rewrite.
  const plain = "DBK | orange | 61% Achilles + 35% Bleed";
  const withCtl = "DBK\u0000 | orange | 61%\u001f Achilles + 35% Bleed\u007f";
  assert.equal(textKey(withCtl), textKey(plain));
});

test("a post is still distinguished by its actual words", () => {
  // The cleaner must not be so aggressive that different posts collide.
  assert.notEqual(textKey("DBK | 61% Achilles"), textKey("DBK | 62% Achilles"));
});

test("a post carrying the card's own footer is refused", () => {
  // The last defence, and the only one that reaches a stale copy of the script
  // that cannot be updated: if the text handed over contains the footer the
  // card prints, it is the card being read back, not a post.
  assert.equal(isOwnOutput("Jackhammer 18% Expose → $1.76b "
    + "Read from the post’s wording, so check it against what is written above."), true);
  // A straight apostrophe too — the same sentence with the quote normalised.
  assert.equal(isOwnOutput("Read from the post's wording, so check it"), true);
});

test("an ordinary post is not mistaken for the card", () => {
  assert.equal(isOwnOutput("DBK | orange | 61% Achilles + 35% Bleed | Price: 2.2b"), false);
  assert.equal(isOwnOutput("Reading the post carefully, prices are firm"), false);
  assert.equal(isOwnOutput(""), false);
});

// ── The shape that lost two weapons ────────────────────────────
// A post that groups by colour:
//     orange:
//     jackhammer 20% eviscerate 612m
//     yellow:
//     enfield 23% specialist 289m
//     enfield 21% specialist 263m
//     ...
// came back with four items out of six. Both enfields were dropped — the same
// weapon with the same bonus at two different rolls — and everything under
// "yellow:" came back with no colour at all, because the prompt only ever
// described a colour written ON the item's own line.

test("the prompt says a colour on its own line heads the lines under it", () => {
  const p = buildTextPrompt("x".repeat(40));
  assert.match(p, /heading|header|on its own line|above/i,
    "a grouped post must be readable: " + p);
});

test("the prompt says the same item can be listed more than once", () => {
  // Two enfields, same bonus, different rolls, both lost. A model that reads
  // the second as a repeat of the first drops a weapon the seller is offering.
  const p = buildTextPrompt("x".repeat(40));
  assert.match(p, /more than once|twice|again|repeat|separate listing/i,
    "repeated weapons must survive: " + p);
});

test("a rarity carried down from a heading is still checked against the post", () => {
  // The verification does not loosen: "yellow" has to appear SOMEWHERE in the
  // post for Yellow to be kept, and in a grouped post it does — as the heading.
  const post = "orange:\njackhammer 20% eviscerate 612m\nyellow:\nsig 552 16% puncture 102m";
  const out = verifyItems(feed, post, [
    { name: "SIG 552", readAs: "sig 552", rarity: "Yellow", bonuses: [{ name: "Puncture", pct: 16 }] },
    { name: "Jackhammer", readAs: "jackhammer", rarity: "Orange", bonuses: [{ name: "Eviscerate", pct: 20 }] },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].rarity, "Yellow");
  assert.equal(out[1].rarity, "Orange");
});

test("a colour the post never writes is still refused in a grouped post", () => {
  const post = "orange:\njackhammer 20% eviscerate 612m";
  const out = verifyItems(feed, post, [
    { name: "Jackhammer", readAs: "jackhammer", rarity: "Red", bonuses: [{ name: "Eviscerate", pct: 20 }] },
  ]);
  assert.equal(out[0].rarity, null, "the post says orange, not red");
});

test("two listings of one weapon at different rolls both survive", () => {
  const post = "yellow:\nenfield 23% specialist 289m\nenfield 21% specialist 263m";
  const out = verifyItems(feed, post, [
    { name: "Enfield SA-80", readAs: "enfield", rarity: "Yellow", bonuses: [{ name: "Specialist", pct: 23 }] },
    { name: "Enfield SA-80", readAs: "enfield", rarity: "Yellow", bonuses: [{ name: "Specialist", pct: 21 }] },
  ]);
  assert.equal(out.length, 2, "one of the two listings was dropped");
  assert.deepEqual(out.map((i) => i.bonuses[0].pct).sort(), [21, 23]);
});

test("a cached post never spends the budget", () => {
  // The whole reason opening the readers is affordable: the cache is checked
  // before mayRead is consulted, so a post somebody has already had read costs
  // nothing and is not rationed. Passing a FUNCTION proves when it is called.
  let claims = 0;
  const mayRead = () => { claims++; return true; };
  // No cache entry for this text, so the claim must happen exactly once.
  const unique = "Kodachi " + Math.random() + " 53% Parry 600m Jackhammer 18% Expose";
  return readPostText(feed, unique, { mayRead, force: false }).then(() => {
    assert.equal(claims, 1, "an uncached read did not claim budget");
  });
});

test("a refused claim reads as needsMember, not as a failure", () => {
  // The caller distinguishes them; a 500 would make the script show a broken
  // badge instead of staying quiet.
  const unique = "Kodachi " + Math.random() + " 53% Parry 600m Jackhammer 18% Expose";
  return readPostText(feed, unique, { mayRead: () => false }).then((out) => {
    assert.equal(out.ok, true);
    assert.equal(out.needsMember, true);
    assert.equal(out.items, null);
  });
});

test("a plain boolean still works", () => {
  // The image reader and older callers pass one.
  const unique = "Kodachi " + Math.random() + " 53% Parry 600m Jackhammer 18% Expose";
  return readPostText(feed, unique, { mayRead: false }).then((out) => {
    assert.equal(out.needsMember, true);
  });
});
