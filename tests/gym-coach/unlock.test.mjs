// Energy until the next gym unlocks.
//
// The numbers are PER-SEGMENT: the wiki's "Estimate E for next gym" column is
// energy trained WHILE AT that gym, not a running lifetime total. Read as
// cumulative, the 18,000 -> 18,100 pair would be a 100-energy segment (~10
// trains) wedged between segments of 5,580 and 6,040, and George's would take
// ~72 days at heavy training instead of the year-plus it actually takes.
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
function grabArr(d0) {
  const i = src.indexOf(d0);
  assert.ok(i !== -1, d0 + " is not defined in the script");
  const j = src.indexOf("\n  ];", i);
  return src.slice(i, j + 5);
}
const GYMS_SRC = grabArr("var GYMS = [");
const SEG_SRC = grabArr("var GYM_SEGMENT_E = [");
const SEGMENT = new Function(SEG_SRC + " return GYM_SEGMENT_E;")();

const run = (body, ...fns) =>
  new Function("var RESULT;" + GYMS_SRC + SEG_SRC +
    fns.map(f => grab(f)).join("\n") + "\n" + body + "; return RESULT;")();

const estimate = (gymId, pct, expMult) =>
  run(`RESULT = unlockEstimate(${gymId}, ${pct}, ${expMult === undefined ? 1 : expMult});`,
    "unlockEstimate");

const expMultOf = data =>
  run(`RESULT = gymExpMult(${JSON.stringify(data)});`, "gymExpMult", "extractPercentMult");

const isGymPerk = line =>
  run(`RESULT = isGymPerkLine(${JSON.stringify(line)});`, "isGymPerkLine");

// A gym button as gym.php renders it: the icon child carries the 1-based Torn
// gym id, and only the gym you are working toward carries inProgress___.
function button(cls, gymId, pctText) {
  const kids = [];
  if (gymId) kids.push({ sel: '[class*="gym-"]', className: "gymIcon___D89ig gym-" + gymId + "___adXZv" });
  if (pctText !== undefined) kids.push({ sel: '[class*="percentage"]', className: "percentage___xY", textContent: pctText });
  return {
    className: cls,
    querySelector(s) { const k = kids.find(x => x.sel === s); return k || null; },
  };
}
// nodes carry functions, so they cannot cross a JSON boundary — call directly.
const scanWith = nodes => {
  const fn = new Function("NODES", grab("unlockScan") + "\nreturn unlockScan(NODES);");
  return fn(nodes);
};

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// ---- the table -------------------------------------------------------------
t("the table holds one segment per unlockable standard gym", () => {
  // 24 standard gyms, so 23 transitions (gym 2 through gym 24).
  assert.strictEqual(SEGMENT.length, 23);
});

t("segments only ever grow", () => {
  for (let i = 1; i < SEGMENT.length; i++)
    assert.ok(SEGMENT[i] > SEGMENT[i - 1], "segment " + i + " is not larger than the one before it");
});

t("the two ends match the wiki", () => {
  assert.strictEqual(SEGMENT[0], 200);        // Premier Fitness -> Average Joes
  assert.strictEqual(SEGMENT[22], 106305);    // The Edge -> George's
});

t("a segment is the table value itself, not a difference between rows", () => {
  // Anyone who reads the table as a cumulative ladder would compute the
  // segment as SEGMENT[g-2] - SEGMENT[g-3]. For Deep Burn that is 18,100 -
  // 18,000 = 100 energy, about ten trains, which is the absurdity that proves
  // the cumulative reading wrong. The raw value is the answer.
  assert.strictEqual(estimate(16, 0).req, 18100);
  assert.notStrictEqual(estimate(16, 0).req, SEGMENT[14] - SEGMENT[13]);
});

t("the whole ladder to George's costs far more than its last rung", () => {
  // 551,255 -- about a year at a heavy 1,470e/day, which is the grind players
  // describe. The cumulative reading would put George's at 106,305, ten weeks.
  const total = SEGMENT.reduce((a, b) => a + b, 0);
  assert.strictEqual(total, 551255);
  assert.ok(total > SEGMENT[22] * 5);
});

// ---- the estimate ----------------------------------------------------------
t("a fresh segment needs the whole segment", () => {
  const e = estimate(2, 0);
  assert.strictEqual(e.req, 200);
  assert.strictEqual(e.remainMax, 200);
});

t("George's costs its own segment, not the lifetime total", () => {
  // Sum of every segment is 551,255; the answer must be the last one alone.
  assert.strictEqual(estimate(24, 0).req, 106305);
});

t("the estimate names the gym being unlocked", () => {
  assert.strictEqual(estimate(24, 0).gym.Gym, "George's");
});

t("half way through a segment leaves about half", () => {
  const e = estimate(24, 50);
  assert.ok(e.remainMax > 53000 && e.remainMax <= 53200, "remainMax was " + e.remainMax);
});

t("a whole-number percent is reported as a range, not a false precision", () => {
  const e = estimate(24, 63);
  assert.ok(e.remainMin < e.remainMax, "min and max were both " + e.remainMax);
  // One percent of the segment is the width of the uncertainty.
  assert.ok(Math.abs((e.remainMax - e.remainMin) - SEGMENT[22] / 100) < 2);
});

t("the last percent never reports a negative remainder", () => {
  const e = estimate(24, 99);
  assert.ok(e.remainMin >= 0, "remainMin was " + e.remainMin);
});

t("a bar sitting on 100% reports nothing left, never a negative", () => {
  // The bar reads 100% for the stretch between earning the last of the segment
  // and Torn registering the unlock. Without a clamp the "at least" figure goes
  // below zero and the card reads "-1,063e to go".
  const e = estimate(24, 100);
  assert.strictEqual(e.remainMin, 0);
  assert.strictEqual(e.remainMax, 0);
});

t("remaining never exceeds the segment itself", () => {
  for (let g = 2; g <= 24; g++)
    for (const pct of [0, 1, 37, 99, 100]) {
      const e = estimate(g, pct);
      assert.ok(e.remainMax <= e.req, "gym " + g + " at " + pct + "% claimed " + e.remainMax + " of " + e.req);
    }
});

t("there is no segment leading to the first gym", () => {
  assert.strictEqual(estimate(1, 0), null);
});

t("specialist gyms are stat-gated, so they have no energy answer", () => {
  // Torn ids 25..31 are Balboas onward.
  for (const g of [25, 27, 31]) assert.strictEqual(estimate(g, 0), null, "gym " + g + " returned an energy figure");
});

// ---- the gym EXP perk ------------------------------------------------------
t("the Music Store perk lowers the energy needed", () => {
  const e = estimate(24, 0, expMultOf({ job_perks: ["30% gym experience"] }));
  assert.strictEqual(e.req, Math.round(106305 / 1.3));
});

t("the perk multiplier is read from the line, not hardcoded", () => {
  assert.ok(Math.abs(expMultOf({ job_perks: ["50% gym experience"] }) - 1.5) < 1e-9);
});

t("no perk means no adjustment", () => {
  assert.strictEqual(expMultOf({ job_perks: ["10% happy"] }), 1);
  assert.strictEqual(expMultOf({}), 1);
});

t("a gym GAINS perk is not a gym EXP perk", () => {
  // "+10% gym gains" raises stat gain per train. It does nothing to how fast
  // the next gym unlocks, and must not shrink the requirement.
  assert.strictEqual(expMultOf({ job_perks: ["+ 10% gym gains"], company_perks: ["+ 5% strength gain"] }), 1);
});

t("an implausible gym experience figure is ignored rather than trusted", () => {
  // A reworded perk, or some unrelated line that happens to carry the phrase,
  // must not silently rescale every estimate. Out of range means "I do not
  // understand this line", and the honest fallback is the unadjusted table.
  assert.strictEqual(expMultOf({ job_perks: ["900% gym experience"] }), 1);
  assert.strictEqual(expMultOf({ job_perks: ["-25% gym experience"] }), 1);
});

t("gym EXP still never leaks into the stat multipliers", () => {
  // The stat side deliberately drops this line; if that ever changes, every
  // projection in the script inflates by 30%.
  assert.strictEqual(isGymPerk("30% gym experience"), false);
});

// ---- reading the page ------------------------------------------------------
t("the percentage is read off the gym marked inProgress", () => {
  const r = scanWith([
    button("gymButton___a active___b", 23),
    button("gymButton___a inProgress___c", 24, "63%"),
    button("gymButton___a locked___d", 25),
  ]);
  assert.strictEqual(r.gymId, 24);
  assert.strictEqual(r.pct, 63);
});

t("no inProgress gym means every standard gym is already unlocked", () => {
  const r = scanWith([
    button("gymButton___a active___b", 24),
    button("gymButton___a lockedPurchased___d", 25),
  ]);
  assert.strictEqual(r, null);
});

t("a half-rendered button is ignored rather than guessed at", () => {
  // inProgress present but the percentage has not painted yet.
  assert.strictEqual(scanWith([button("gymButton___a inProgress___c", 24)]), null);
});

t("a percentage with no gym id is ignored", () => {
  assert.strictEqual(scanWith([button("gymButton___a inProgress___c", 0, "63%")]), null);
});

t("the gym id comes from the icon class, not the button's position", () => {
  // Only one node, and it is the 24th gym — position would say 0.
  assert.strictEqual(scanWith([button("gymButton___a inProgress___c", 24, "5%")]).gymId, 24);
});

t("a decimal percentage is not truncated to nonsense", () => {
  assert.strictEqual(scanWith([button("gymButton___a inProgress___c", 24, "7.5%")]).pct, 7.5);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
