import test from "node:test";
import assert from "node:assert/strict";
import { stripEventHtml, pickNewEvents, buildNotifications } from "./personal-events.js";

// Torn's events feed returns malformed HTML — the href is mangled but the
// anchor TEXT is clean, so stripping tags yields a readable sentence that is
// used verbatim as the notification body.
const REAL = '<a href = http://www.torn.com/"http://www.torn.com/http://www.torn.com/profiles.php?XID=2223426">RedGang</a> attacked you [<a href = http://www.torn.com/"loader.php?sid=attackLog&ID=abc">view</a>]';

test("strip: real Torn event becomes a clean sentence", () => {
  assert.equal(stripEventHtml(REAL), "RedGang attacked you");
});

test("strip: drops the trailing [view] link artifact only at the end", () => {
  assert.equal(stripEventHtml("You were mugged [<a href='x'>view</a>]"), "You were mugged");
  // a legitimate mid-sentence "view" must survive
  assert.equal(stripEventHtml("Someone asked to view your profile"), "Someone asked to view your profile");
});

test("strip: decodes entities and collapses whitespace", () => {
  assert.equal(stripEventHtml("You &amp; Bob<br/>   traded &quot;items&quot;"), 'You & Bob traded "items"');
});

test("strip: tolerates junk", () => {
  assert.equal(stripEventHtml(null), "");
  assert.equal(stripEventHtml(undefined), "");
  assert.equal(stripEventHtml(""), "");
  assert.equal(stripEventHtml(12345), "12345");
});

// ── new-event selection ────────────────────────────────────────────────────
const feed = {
  e3: { timestamp: 300, event: "third" },
  e1: { timestamp: 100, event: "first" },
  e2: { timestamp: 200, event: "second" },
};

test("first run marks everything seen and alerts on NOTHING", () => {
  // Otherwise switching the feature on would fire a wall of backlog banners.
  const r = pickNewEvents(feed, new Set(), true);
  assert.deepEqual(r.fresh, []);
  assert.deepEqual([...r.seen].sort(), ["e1", "e2", "e3"]);
});

test("subsequent runs alert only on unseen ids, oldest first", () => {
  const seen = new Set(["e1", "e2"]);
  const r = pickNewEvents(feed, seen, false);
  assert.equal(r.fresh.length, 1);
  assert.equal(r.fresh[0].id, "e3");
  assert.ok(r.seen.has("e3"));
});

test("ordering is chronological so a burst reads in the order it happened", () => {
  const r = pickNewEvents(feed, new Set(), false);
  assert.deepEqual(r.fresh.map((e) => e.id), ["e1", "e2", "e3"]);
});

test("nothing new is a no-op, and the seen set does not grow unbounded", () => {
  const seen = new Set(["e1", "e2", "e3"]);
  const r = pickNewEvents(feed, seen, false);
  assert.deepEqual(r.fresh, []);
  const big = new Set(Array.from({ length: 5000 }, (_, i) => "old" + i));
  const r2 = pickNewEvents(feed, big, false);
  assert.ok(r2.seen.size <= 1000, `seen set must be capped, got ${r2.seen.size}`);
  for (const e of ["e1", "e2", "e3"]) assert.ok(r2.seen.has(e), "recent ids must survive the trim");
});

test("empty or malformed feed is handled without throwing", () => {
  assert.deepEqual(pickNewEvents({}, new Set(), false).fresh, []);
  assert.deepEqual(pickNewEvents(null, new Set(), false).fresh, []);
});

// ── notification shaping / burst guard ─────────────────────────────────────
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: "x" + i, timestamp: i, event: `Event ${i}` }));

test("a normal trickle sends one banner per event, body = the event's wording", () => {
  const out = buildNotifications(mk(3));
  assert.equal(out.length, 3);
  assert.equal(out[0].body, "Event 0");
  assert.equal(out[0].tag, "torn-event-x0", "stable per-event tag so retries collapse");
});

test("a burst collapses into ONE summary instead of carpet-bombing", () => {
  const out = buildNotifications(mk(9));
  assert.equal(out.length, 1);
  assert.match(out[0].title, /9 new events/, "count belongs in the title");
  assert.match(out[0].body, /Event 8/, "body shows the most recent event");
  assert.equal(out[0].tag, "torn-event-burst");
});

test("exactly at the cap still sends individually", () => {
  assert.equal(buildNotifications(mk(5)).length, 5);
  assert.equal(buildNotifications(mk(6)).length, 1);
});

test("empty input produces no notifications", () => {
  assert.deepEqual(buildNotifications([]), []);
});
