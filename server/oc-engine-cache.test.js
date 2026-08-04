// Run: node server/oc-engine-cache.test.js
import assert from "node:assert";
import { crimesFingerprint, shouldRecompute } from "./oc-engine-cache.js";

let pass = 0;
function t(name, fn) { fn(); pass++; console.log("  ✓", name); }

// The Failure Risk panel was showing an hour-old snapshot: it listed a crime the
// faction no longer had ("Cash Me if You Can") while omitting six that it did,
// including a fully-filled Honey Trap. The engine cache keyed only on faction id
// + settings and expired on a 1h timer, so it never noticed the crimes changed.

console.log("crimesFingerprint");

const base = [
  { id: 1, name: "Honey Trap", status: "Planning", slots: [{ user_id: 5 }, { user_id: 6 }, { user_id: 7 }] },
  { id: 2, name: "Bidding War", status: "Recruiting", slots: [{ user_id: 8 }, {}, {}] },
];

t("identical crime sets fingerprint the same", () => {
  assert.strictEqual(crimesFingerprint(base), crimesFingerprint(structuredClone(base)));
});

t("API ordering does not change the fingerprint", () => {
  assert.strictEqual(crimesFingerprint(base), crimesFingerprint([...base].reverse()));
});

t("a new crime changes it", () => {
  const more = [...base, { id: 3, name: "Market Forces", status: "Planning", slots: [{ user_id: 9 }] }];
  assert.notStrictEqual(crimesFingerprint(base), crimesFingerprint(more));
});

t("a removed crime changes it", () => {
  assert.notStrictEqual(crimesFingerprint(base), crimesFingerprint([base[0]]));
});

t("filling a slot changes it", () => {
  const filled = structuredClone(base);
  filled[1].slots[1] = { user_id: 99 };
  assert.notStrictEqual(crimesFingerprint(base), crimesFingerprint(filled));
});

t("a status change changes it (Recruiting -> Planning)", () => {
  const moved = structuredClone(base);
  moved[1].status = "Planning";
  assert.notStrictEqual(crimesFingerprint(base), crimesFingerprint(moved));
});

t("empty and missing lists are stable, not crashes", () => {
  assert.strictEqual(crimesFingerprint([]), crimesFingerprint([]));
  assert.strictEqual(crimesFingerprint(undefined), crimesFingerprint(null));
});

console.log("shouldRecompute");
const FP = crimesFingerprint(base);
const HOUR = 3600_000;

t("no cache entry -> recompute", () => {
  assert.strictEqual(shouldRecompute(null, { settingsHash: "s", fingerprint: FP, now: 1000, ttlMs: HOUR }), true);
});

t("nothing changed and inside the TTL -> reuse", () => {
  const cached = { ts: 1000, settingsHash: "s", fingerprint: FP };
  assert.strictEqual(shouldRecompute(cached, { settingsHash: "s", fingerprint: FP, now: 1000 + 60_000, ttlMs: HOUR }), false);
});

// The actual bug: crimes changed five minutes ago and the panel kept serving the
// stale set for the rest of the hour.
t("crimes changed inside the TTL -> recompute anyway", () => {
  const cached = { ts: 1000, settingsHash: "s", fingerprint: FP };
  const changed = crimesFingerprint([...base, { id: 3, name: "New", status: "Planning", slots: [] }]);
  assert.strictEqual(shouldRecompute(cached, { settingsHash: "s", fingerprint: changed, now: 1000 + 60_000, ttlMs: HOUR }), true);
});

t("settings changed -> recompute (existing behaviour preserved)", () => {
  const cached = { ts: 1000, settingsHash: "s", fingerprint: FP };
  assert.strictEqual(shouldRecompute(cached, { settingsHash: "DIFFERENT", fingerprint: FP, now: 1000 + 60_000, ttlMs: HOUR }), true);
});

// The TTL still matters: engines fold in OC history and role weights, which move
// without the crime set changing at all.
t("TTL expiry still forces a recompute even when nothing else changed", () => {
  const cached = { ts: 1000, settingsHash: "s", fingerprint: FP };
  assert.strictEqual(shouldRecompute(cached, { settingsHash: "s", fingerprint: FP, now: 1000 + HOUR + 1, ttlMs: HOUR }), true);
});

console.log(`\n${pass} passed`);
