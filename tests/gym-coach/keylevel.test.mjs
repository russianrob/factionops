// Which key the coach uses, and what it does about a Limited one.
//
// The gym log is Full-only, and without it an unwatched gap cannot be
// reconstructed. So which key wins is not a detail: on PDA it decides whether
// missed energy is exact or merely honest.
import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n) {
  const i = src.indexOf("function " + n + "(");
  assert.ok(i !== -1, "function " + n + "() is not defined in the script");
  let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); }
  }
}
// resolveKey reads a module-level PDA_INJECTED_KEY plus two stores.
function resolve({ injected = "", own = "", stable = "" }) {
  return new Function("var R;" + `
    var PDA_INJECTED_KEY = ${JSON.stringify(injected)};
    function storeGet(k, d){ return k === "api_key" ? ${JSON.stringify(own)} : d; }
    function stableGet(k, d){ return k === "api_key" ? ${JSON.stringify(stable)} : d; }
    ${grab("resolveKey")}
    R = resolveKey();
  ` + "return R;")();
}
// readKeyLevel(payload) -> { level, type, full } | null
function level(payload) {
  return new Function("var R;" + `
    ${grab("readKeyLevel")}
    R = readKeyLevel(${JSON.stringify(payload)});
  ` + "return R;")();
}
const FULL = "aaaaaaaaaaaaaaaa", LIM = "bbbbbbbbbbbbbbbb", PDA = "cccccccccccccccc";

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a key you typed in beats the one PDA injected", () => {
  // The flip. Typing a key is a deliberate act; injection is an install-time
  // default. On PDA the injected key is usually Limited, so the old order made
  // a Full key you had entered yourself completely unreachable.
  assert.strictEqual(resolve({ injected: PDA, own: FULL }), FULL);
});

t("PDA's key is still used when you have not entered one", () => {
  // The whole point of injection: a PDA user who never pastes a key still works.
  assert.strictEqual(resolve({ injected: PDA }), PDA);
});

t("the stable script's key is the last resort, not the first", () => {
  assert.strictEqual(resolve({ injected: PDA, stable: FULL }), PDA);
  assert.strictEqual(resolve({ own: LIM, stable: FULL }), LIM);
  assert.strictEqual(resolve({ stable: FULL }), FULL);
});

t("an unsubstituted PDA placeholder is not a key", () => {
  assert.strictEqual(resolve({ injected: "###PDA-" + "APIKEY###", own: FULL }), FULL);
});

t("blank entries are skipped rather than returned", () => {
  assert.strictEqual(resolve({ own: "   ", stable: FULL }), FULL);
  assert.strictEqual(resolve({}), "");
});

// --- reading the level -----------------------------------------------------

t("a Full key is recognised", () => {
  assert.deepStrictEqual(level({ info: { access: { level: 4, type: "Full Access" } } }),
    { level: 4, type: "Full Access", full: true });
});

t("a Limited key is recognised, and is not full", () => {
  const r = level({ info: { access: { level: 3, type: "Limited Access" } } });
  assert.strictEqual(r.full, false);
  assert.strictEqual(r.type, "Limited Access");
});

t("level decides it, not the wording", () => {
  // Torn could rename the tiers; the numeric level is the stable part.
  assert.strictEqual(level({ info: { access: { level: 4, type: "Something Else" } } }).full, true);
  assert.strictEqual(level({ info: { access: { level: 2, type: "Full Access" } } }).full, false);
});

t("an unreadable answer is null, not 'not full'", () => {
  // Treating a failed check as "Limited" would nag people whose key is fine.
  assert.strictEqual(level({ error: { code: 5, error: "Too many requests" } }), null);
  assert.strictEqual(level({}), null);
  assert.strictEqual(level(null), null);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
