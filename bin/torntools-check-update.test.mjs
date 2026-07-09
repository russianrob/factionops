// Run: node bin/torntools-check-update.test.mjs
import assert from "node:assert";
import { compareVersions, pickUpdate } from "./torntools-check-update.mjs";

let pass = 0;
function t(name, fn) { fn(); pass++; console.log("  ✓", name); }

console.log("compareVersions");
t("newer patch is numeric not lexical (9.0.13 > 9.0.7)", () => {
  assert.strictEqual(compareVersions("9.0.13", "9.0.7"), 1);
  assert.strictEqual(compareVersions("9.0.7", "9.0.13"), -1);
});
t("equal versions compare 0", () => {
  assert.strictEqual(compareVersions("9.0.7", "9.0.7"), 0);
});
t("third segment dominates before fourth (9.0.7 > 9.0.6.2)", () => {
  assert.strictEqual(compareVersions("9.0.7", "9.0.6.2"), 1);
});
t("fourth segment breaks ties (9.0.6.2 > 9.0.6)", () => {
  assert.strictEqual(compareVersions("9.0.6.2", "9.0.6"), 1);
});
t("major dominates (10.0.0 > 9.9.9)", () => {
  assert.strictEqual(compareVersions("10.0.0", "9.9.9"), 1);
});

console.log("pickUpdate");
t("no notify when latest equals served", () => {
  const r = pickUpdate({ latest: "9.0.13", served: "9.0.13", lastNotified: "" });
  assert.strictEqual(r.notify, false);
  assert.strictEqual(r.reason, "up-to-date");
});
t("no notify when latest older than served", () => {
  const r = pickUpdate({ latest: "9.0.6", served: "9.0.13", lastNotified: "" });
  assert.strictEqual(r.notify, false);
  assert.strictEqual(r.reason, "up-to-date");
});
t("notify when newer than served and never notified", () => {
  const r = pickUpdate({ latest: "9.0.14", served: "9.0.13", lastNotified: "" });
  assert.strictEqual(r.notify, true);
  assert.strictEqual(r.reason, "update-available");
  assert.strictEqual(r.version, "9.0.14");
});
t("no re-notify for the same version already notified", () => {
  const r = pickUpdate({ latest: "9.0.14", served: "9.0.13", lastNotified: "9.0.14" });
  assert.strictEqual(r.notify, false);
  assert.strictEqual(r.reason, "already-notified");
});
t("notify again when an even newer version appears after a prior notify", () => {
  const r = pickUpdate({ latest: "9.0.15", served: "9.0.13", lastNotified: "9.0.14" });
  assert.strictEqual(r.notify, true);
  assert.strictEqual(r.reason, "update-available");
});

console.log(`\n${pass} passed`);
