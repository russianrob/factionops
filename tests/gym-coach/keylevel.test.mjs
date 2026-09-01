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
// readKeyLevel(payload) -> { level, type, full, faction } | null
function level(payload) {
  return new Function("var R;" + `
    ${grab("readKeyLevel")}
    R = readKeyLevel(${JSON.stringify(payload)});
  ` + "return R;")();
}
const FULL = "aaaaaaaaaaaaaaaa", LIM = "bbbbbbbbbbbbbbbb", PDA = "cccccccccccccccc";
const ACCESS = (extra) => ({ info: { access: Object.assign({ level: 3, type: "Limited Access" }, extra) } });

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
    // faction is null, not false: Torn does not send the flag here and "I could
    // not tell" is a different claim from "you do not have it".
    { level: 4, type: "Full Access", full: true, faction: null });
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

// --- the save policy -------------------------------------------------------
// Owner's decision: a Limited key is refused at the box. The one thing that
// must NOT happen is a transient failure being read as "Limited" -- that would
// turn a rate limit into a lockout, which is the same mistake the probe made.
function verdict(payload) {
  return new Function("var R;" + `
    ${grab("readKeyLevel")}
    ${grab("keySaveVerdict")}
    R = keySaveVerdict(${JSON.stringify(payload)});
  ` + "return R;")();
}

t("a Full key is accepted", () => {
  assert.strictEqual(verdict({ info: { access: { level: 4, type: "Full Access" } } }), "full");
});

t("a Limited key is refused", () => {
  assert.strictEqual(verdict({ info: { access: { level: 3, type: "Limited Access" } } }), "limited");
});

t("a Minimal or Public key is refused too", () => {
  assert.strictEqual(verdict({ info: { access: { level: 2, type: "Minimal Access" } } }), "limited");
  assert.strictEqual(verdict({ info: { access: { level: 1, type: "Public Only" } } }), "limited");
});

t("a check that could not run ACCEPTS, rather than locking you out", () => {
  // Torn rate-limits at 100 calls a minute and the coach is already polling.
  // Refusing on a failed check would make a busy moment look like a bad key
  // and leave someone unable to save a perfectly good one.
  assert.strictEqual(verdict({ error: { code: 5, error: "Too many requests" } }), "unknown");
  assert.strictEqual(verdict(null), "unknown");
  assert.strictEqual(verdict({}), "unknown");
});

t("an invalid key is refused rather than waved through as unknown", () => {
  // Code 2 is Torn saying the key is not real. That is a definite answer, not
  // an inconclusive one, so it must not benefit from the doubt.
  assert.strictEqual(verdict({ error: { code: 2, error: "Incorrect key" } }), "invalid");
});

t("the verdict reads the shape httpGet's REJECTION is rebuilt into", () => {
  // httpGet rejects with an Error carrying .code and no payload, so the save
  // path reconstructs { error: { code } } from it. If that reconstruction is
  // dropped the verdict sees null, scores "unknown", and saves a bad key.
  const rebuilt = c => ({ error: { code: c, error: "x" } });
  assert.strictEqual(verdict(rebuilt(2)), "invalid");
  assert.strictEqual(verdict(rebuilt(5)), "unknown");
  assert.strictEqual(verdict(rebuilt(16)), "unknown");
});


// ---- faction API access -----------------------------------------------------
//
// The faction board needs a POSITION ability ("Faction API Access"), which is a
// separate axis from the key's access level -- a Full key held by a member
// whose position lacks it still cannot read contributors. /key/info answers any
// key and the coach already calls it, so knowing this costs nothing and saves
// firing six requests that Torn will refuse. A refused call still counts
// against the hundred a minute.

t("faction access is read off the key, alongside the level", () => {
  assert.strictEqual(level(ACCESS({ faction: true })).faction, true);
  assert.strictEqual(level(ACCESS({ faction: false })).faction, false);
});

t("an absent flag is null, NOT false", () => {
  // Torn does not describe this field. If it ever stops being sent, "I could
  // not tell" must not turn into "you do not have it" and hide the tab from
  // somebody whose board works perfectly.
  assert.strictEqual(level(ACCESS({})).faction, null);
});

t("a Full key does not imply faction access", () => {
  // The two axes are independent. Inferring one from the other is the mistake
  // this whole field exists to prevent.
  const k = level({ info: { access: { level: 4, type: "Full Access", faction: false } } });
  assert.strictEqual(k.full, true);
  assert.strictEqual(k.faction, false);
});

t("and a Limited key can perfectly well have it", () => {
  const k = level(ACCESS({ faction: true }));
  assert.strictEqual(k.full, false);
  assert.strictEqual(k.faction, true);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);