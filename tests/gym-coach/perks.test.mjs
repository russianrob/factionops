import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}

const parse = payload => new Function("var RESULT;" + `
  ${grab("extractPercentMult")} ${grab("isGymPerkLine")} ${grab("parsePerks")}
  RESULT = parsePerks(${JSON.stringify(payload)});` + "; return RESULT;")();
const isGym = line => new Function("var RESULT;" + `
  ${grab("isGymPerkLine")} RESULT = isGymPerkLine(${JSON.stringify(line)});` + "; return RESULT;")();

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("education perks count even when they never say 'gym'", () => {
  assert.strictEqual(isGym("+ 1% strength gain"), true);
  assert.strictEqual(isGym("+ 2% defense gain"), true);
  assert.strictEqual(isGym("Increases all battle stats gain by 1%"), true);
  const p = parse({ education_perks: ["+ 1% strength gain"] });
  assert.ok(p.str > 1.0, "education perk did not raise strength, got " + p.str);
});
t("company gym perks count", () => {
  const p = parse({ company_perks: ["+ 10% gym gains"] });
  assert.strictEqual(Number(p.all.toFixed(2)), 1.1);
});
t("perks that raise a DIFFERENT bar are not mistaken for gym gains", () => {
  ["+ 10% energy drinks", "+ 5% consumable gain", "+ 20% happy gain",
   "+ 10% nerve gain", "+ 5% crime success", "+ 100 max life",
   "+ 10% medical item gain", "+ 2h booster cooldown"].forEach(line =>
     assert.strictEqual(isGym(line), false, "wrongly counted: " + line));
});
t("a drinks perk does not inflate the gym multiplier", () => {
  const p = parse({ book_perks: ["+ 10% energy drinks"] });
  assert.strictEqual(p.all, 1, "drinks perk leaked into gym gains");
  assert.strictEqual(Number(p.canMult.toFixed(2)), 1.10, "and it should still count as a DRINK perk");
});
t("every source that contributed is recorded, not just three", () => {
  const p = parse({
    faction_perks: ["+ 10% gym gains"], company_perks: ["+ 5% gym gains"],
    education_perks: ["+ 1% strength gain"], property_perks: ["+ 2% gym gains"],
    book_perks: ["+ 3% gym gains"], merit_perks: ["+ 4% gym gains"]
  });
  ["faction","company","education","property","book","merit"].forEach(k =>
    assert.ok(p.hits[k] && p.hits[k].length, "no hits recorded for " + k));
});
t("the recorded line is the perk text itself, so it can be checked", () => {
  const p = parse({ education_perks: ["+ 1% strength gain"] });
  assert.strictEqual(p.hits.education[0], "+ 1% strength gain");
});
t("stat-specific perks land on the right stat", () => {
  const p = parse({ education_perks: ["+ 10% defense gain"] });
  assert.ok(p.def > p.str, "defense " + p.def + " should exceed strength " + p.str);
});
t("nothing to find is not an error", () => {
  const p = parse({});
  assert.strictEqual(p.all, 1);
  assert.deepStrictEqual(p.hits, {});
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
