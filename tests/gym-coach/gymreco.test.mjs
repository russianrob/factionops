import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function grabArr(d0){const i=src.indexOf(d0);const j=src.indexOf("\n  ];",i);return src.slice(i,j+5);}

const GYMS = new Function(grabArr("var GYMS = [") + " return GYMS;")();
const idx = name => GYMS.findIndex(g => g.Gym === name);

// className strings straight off gym.php: locked___ and lockedPurchased___ both
// mean unusable, active___ marks the one you are standing in.
const unlocked = classNames => new Function("var RESULT;" + `
  ${grabArr("var GYMS = [")}
  var nodes = ${JSON.stringify(classNames.map(c => ({ className: c })))};
  ${grab("gymsUnlocked")}
  RESULT = gymsUnlocked(nodes);` + "; return RESULT;")();

const better = (gymName, focus, owned) => new Function("var RESULT;" + `
  ${grabArr("var GYMS = [")}
  var state = { gymName: ${JSON.stringify(gymName)}, gymsOwned: ${JSON.stringify(owned)} };
  ${grab("betterGym")}
  RESULT = betterGym(${JSON.stringify(focus)});` + "; return RESULT;")();

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

// ---- reading the page ------------------------------------------------------
t("a locked gym is one whose class says so, either spelling", () => {
  const cls = ["gymButton___a", "gymButton___a locked___b", "gymButton___a lockedPurchased___c",
               "gymButton___a active___d"];
  assert.deepStrictEqual(unlocked(cls), [0, 3]);
});

t("the button order IS the gym order — no name matching", () => {
  // 31 buttons, only George's (23) unlocked
  const cls = GYMS.map((_, i) => i === 23 ? "gymButton___x" : "gymButton___x locked___y");
  assert.deepStrictEqual(unlocked(cls), [23]);
});

t("the 32nd button is Torn's jail placeholder and must not become a gym", () => {
  const cls = GYMS.map(() => "gymButton___x").concat(["gymButton___x"]);   // 32 nodes
  const out = unlocked(cls);
  assert.strictEqual(out.length, GYMS.length, "must stop at the end of GYMS");
  assert.ok(!out.includes(GYMS.length));
});

t("gyms unlock out of order, so the set is read, not a high-water mark", () => {
  // the real player from the DOM notes: all of 0-23 plus Elites (29), but none
  // of 24-28 and not SSL (30)
  const cls = GYMS.map((_, i) => (i <= 23 || i === 29) ? "gymButton___x" : "gymButton___x locked___y");
  const out = unlocked(cls);
  assert.ok(out.includes(29), "Elites is unlocked despite 24-28 being locked");
  assert.ok(!out.includes(24));
  assert.strictEqual(Math.max(...out), 29);
});

// ---- choosing ---------------------------------------------------------------
const ALL = GYMS.map((_, i) => i);

t("the reported case: a strictly better gym at the same energy is named", () => {
  const r = better("Anabolic Anomalies", "str", ALL);
  assert.ok(r, "should have found one");
  assert.strictEqual(r.gym.Gym, "George's");
  assert.strictEqual(r.pct, 46, "7.3 against 5.0 dots for the same 10e");
});

t("it never suggests a gym you have not unlocked", () => {
  // everything below George's, so the best AVAILABLE upgrade is Atlas (22)
  const owned = ALL.filter(i => i !== idx("George's"));
  const r = better("Anabolic Anomalies", "str", owned);
  assert.notStrictEqual(r.gym.Gym, "George's");
  assert.strictEqual(r.gym.Gym, "Atlas");
});

t("a dearer gym is never pushed, however strong", () => {
  // Gym 3000 is 50e a train for 10 Str dots. From a 10e gym that is not an
  // upgrade, it is a different trade, and the coach does not get to make it.
  const r = better("Anabolic Anomalies", "str", ALL);
  assert.ok(Number(r.gym.Energy) <= 10, "suggested a " + r.gym.Energy + "e gym from a 10e one");
});

t("already in the best gym you own means silence, not a suggestion", () => {
  assert.strictEqual(better("George's", "str", ALL), null);
});

t("it answers per stat, not per gym", () => {
  // George's is 7.3 across the board and dominates every other 10e gym, so it
  // is the answer for everything WHILE you own it. Take it away and the four
  // stats separate: different gyms top out on different dots.
  const owned = ALL.filter(i => i !== idx("George's"));
  const picks = ["str", "def", "spe", "dex"].map(k => better("Knuckle Heads", k, owned).gym.Gym);
  assert.strictEqual(new Set(picks).size > 1, true,
    "one gym answered every stat: " + picks.join(", "));
});

t("the strongest gym in Torn is not offered from a cheap one — it costs 5x", () => {
  // Mr. Isoyamas is Def 8, the best in the game, and 50e a train against 10e.
  // More dots AND more energy is a trade, not an upgrade.
  const r = better("Knuckle Heads", "def", ALL);
  assert.notStrictEqual(r.gym.Gym, "Mr. Isoyamas");
  assert.ok(Number(r.gym.Energy) <= 10);
});

t("from George's, at 10e, there is nowhere better to go", () => {
  // Balboas (Def 7.5) and Isoyamas (Def 8) both beat it on dots and both cost
  // more energy per train. Silence is the honest answer, not a nudge.
  ["str", "def", "spe", "dex"].forEach(k =>
    assert.strictEqual(better("George's", k, ALL), null, k + " should have no upgrade"));
});

t("from a gym that cannot train the stat at all, any gym that can is an upgrade", () => {
  // Balboas has no Strength. The percentage is meaningless against zero, so it
  // must not be reported as one.
  const r = better("Balboas Gym", "str", ALL);
  assert.ok(r, "should offer somewhere that trains Strength");
  assert.strictEqual(r.pct, null, "no percentage against zero dots");
  assert.ok(Number(r.gym.Str) > 0);
});

t("with nothing scanned it stays quiet rather than guessing", () => {
  assert.strictEqual(better("Anabolic Anomalies", "str", []), null);
  assert.strictEqual(better("Anabolic Anomalies", "str", null), null);
});


// ---- how far the unlocked-gym scan can be trusted ---------------------------
//
// Reported: the coach told somebody to switch to a gym they do not own, and
// asserted they had it unlocked. The scan maps index-1:1 against the gym table
// and skips the Jail placeholder, so the mapping is not the suspect -- what was
// missing was any way to tell which scan the claim rested on.

const trust = (owned, at) => new Function("var R;" + grabArr("var GYMS = [") + `
  var state = { gymsOwned: ${JSON.stringify(owned)}, gymsOwnedAt: ${at || 0} };
  ${grab("gymScanTrust")}
  R = gymScanTrust();
  return R;`)();

t("a partial scan is trusted, and reports what it saw", () => {
  const r = trust([0, 1, 2, 3, 20], 1234);
  assert.strictEqual(r.known, true);
  assert.strictEqual(r.count, 5);
  assert.strictEqual(r.at, 1234);
});

t("never having scanned is not knowing", () => {
  assert.strictEqual(trust([], 0).known, false);
});

t("EVERY gym unlocked is treated as suspicious, not as impressive", () => {
  // A gym is marked unlocked by the ABSENCE of a lock class, so a class Torn
  // has renamed finds nothing locked and reports the lot as owned. That is the
  // shape of the report this exists for.
  const all = [];
  const n = GYMS.length;
  for (let i = 0; i < n; i++) all.push(i);
  const r = trust(all, Date.now());
  assert.strictEqual(r.known, false, "a full house should not be asserted as fact");
  assert.match(r.why, /page changed/i);
});

t("one short of every gym is still trusted", () => {
  // The guard is for the all-or-nothing failure, not for people who own a lot.
  const n = GYMS.length;
  const nearly = [];
  for (let i = 0; i < n - 1; i++) nearly.push(i);
  assert.strictEqual(trust(nearly, Date.now()).known, true);
});


// ---- the gym you are climbing toward is not a gym you own -------------------
//
// Reported live: a member standing in Cha Cha's was told to "change gym to
// Atlas -- and you have it unlocked". Atlas is the very next rung. Unlocked
// gyms never re-lock, so a stale scan can only UNDER-report; an over-report by
// exactly one is the tile being unlocked reading as owned.

t("a gym marked in progress is not owned, whatever else its class says", () => {
  assert.deepStrictEqual(unlocked(["gymButton___a", "gymButton___a inProgress___c"]), [0]);
});

const node = pct => ({
  className: "gymButton___h",
  querySelector: sel => (pct && /percentage/.test(sel) ? { textContent: pct } : null)
});

const sansProgress = (owned, nodes) => new Function("var R;" + `
  ${grab("ownedSansProgress")}
  R = ownedSansProgress(${JSON.stringify(owned)}, arguments[0]);
  return R;`)(nodes);

t("the one tile carrying an unlock percentage is dropped from the owned set", () => {
  // Keyed on the percentage child, not on a class token: the percentage is the
  // part that has been read off the live page.
  assert.deepStrictEqual(sansProgress([0, 1, 2], [node(), node(), node("63%")]), [0, 1]);
});

t("no percentage anywhere leaves the set alone", () => {
  assert.deepStrictEqual(sansProgress([0, 1, 2], [node(), node(), node()]), [0, 1, 2]);
});

t("several percentages mean something else, and nothing is dropped", () => {
  // If the element ever stops meaning unlock progress, dropping every tile that
  // carries one would empty the owned set and silence every recommendation.
  assert.deepStrictEqual(sansProgress([0, 1, 2], [node("5%"), node("9%"), node()]), [0, 1, 2]);
});

t("a tile too primitive to query is skipped rather than thrown on", () => {
  assert.deepStrictEqual(sansProgress([0, 1], [{ className: "x" }, node("63%")]), [0]);
});

t("a percentage on a tile that is locked anyway changes nothing", () => {
  assert.deepStrictEqual(sansProgress([0, 1], [node(), node(), node("63%")]), [0, 1]);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);