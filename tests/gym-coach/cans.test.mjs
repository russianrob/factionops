import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function grabArr(decl){const i=src.indexOf(decl);const j=src.indexOf("\n  ];",i);return src.slice(i,j+5);}

const mk = mult => new Function("var RESULT;" + `
  var state = { canMult: ${mult} , calEvents: [] };
  ${grabArr("var CAN_TYPES = [")}
  ${grab("eventActive")} ${grab("caffeineOn")} ${grab("canType")} ${grab("canEnergy")} ${grab("drinkEnergy")}
  RESULT = { e: drinkEnergy, type: canType };` + "; return RESULT;")();

const perks = payload => new Function("var RESULT;" + `
  ${grab("extractPercentMult")} ${grab("isGymPerkLine")} ${grab("parsePerks")}
  RESULT = parsePerks(${JSON.stringify(payload)});` + "; return RESULT;")();

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("every can Torn sells has a value, from the Drink Gains table", () => {
  const d = mk(1).e;
  assert.strictEqual(d("Can of Goose Juice", 985), 5);
  assert.strictEqual(d("Can of Damp Valley", 986), 10);
  assert.strictEqual(d("Can of Crocozade", 987), 15);
  assert.strictEqual(d("Can of Munster", 530), 20);
  assert.strictEqual(d("Can of Santa Shooters", 553), 20);
  assert.strictEqual(d("Can of Red Cow", 532), 25);
  assert.strictEqual(d("Can of Rockstar Rudolph", 554), 25);
  assert.strictEqual(d("Can of Taurine Elite", 533), 30);
  assert.strictEqual(d("Can of X-MASS", 555), 30);
});
t("Rockstar Rudolph — the one that showed no value — is 25e", () => {
  assert.strictEqual(mk(1).e("Can of Rockstar Rudolph", 554), 25);
});
t("the id wins over the name, since names drift with events", () => {
  assert.strictEqual(mk(1).e("Mystery Festive Can", 533), 30, "should trust id 533");
});
t("the name is used when the id is unknown", () => {
  assert.strictEqual(mk(1).e("Can of Red Cow", 0), 25);
});
t("a genuinely unknown drink still claims nothing", () => {
  assert.strictEqual(mk(1).e("Can of Something New", 99999), 0);
});
t("book and perk bonuses raise what a can is worth", () => {
  assert.strictEqual(mk(1.1).e("Can of Red Cow", 532), 28, "25 x 1.10 = 27.5 -> 28");
  assert.strictEqual(mk(1.3).e("Can of Taurine Elite", 533), 39);
  assert.strictEqual(mk(1).e("Can of Taurine Elite", 533), 30, "no perks, no change");
});
t("the multiplier is read from books, faction, job and company perks", () => {
  assert.strictEqual(perks({ book_perks: ["+ 10% energy drinks"] }).canMult.toFixed(2), "1.10");
  assert.strictEqual(perks({ faction_perks: ["+ 20% energy drinks"] }).canMult.toFixed(2), "1.20");
  assert.strictEqual(perks({ job_perks: ["+ 5% consumable gain"] }).canMult.toFixed(2), "1.05");
  assert.strictEqual(perks({ company_perks: ["+ 15% energy drink gain"] }).canMult.toFixed(2), "1.15");
});
t("several bonuses stack", () => {
  const m = perks({ book_perks: ["+ 10% energy drinks"], faction_perks: ["+ 20% energy drinks"] }).canMult;
  assert.strictEqual(m.toFixed(3), (1.1 * 1.2).toFixed(3));
});
t("unrelated perks do not move it", () => {
  assert.strictEqual(perks({ faction_perks: ["+ 10% gym gains", "Increases maximum life by 100"] }).canMult, 1);
});
t("a nonsense percentage is ignored rather than trusted", () => {
  assert.strictEqual(perks({ faction_perks: ["+ 9000% energy drinks"] }).canMult, 1);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
