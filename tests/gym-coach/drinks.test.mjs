import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function grabArr(decl){const i=src.indexOf(decl);const j=src.indexOf("\n  ];",i);return src.slice(i,j+5);}

const count = rows => new Function("var RESULT;" + `
  ${grabArr("var ITEM_MAP = [")}
  ${grabArr("var CAN_TYPES = [")}
  var state = { canMult: 1 , calEvents: [] };
  ${grab("eventActive")} ${grab("caffeineOn")} ${grab("canType")} ${grab("canEnergy")}
  var HAPPY_CANDY = /candy/i;
  ${grab("drinkEnergy")} ${grab("countItems")}
  RESULT = countItems(${JSON.stringify(rows)});` + "; return RESULT;")();

const boosterCap = perk => new Function("var RESULT;" + `
  var H = 3600; var BOOSTER_CAP = 24 * H; var BOOSTER_CAP_PERK = 48 * H;
  var state = { boosterPerk: ${perk}, boosterCd: 0 };
  function storeSet(){}
  ${grab("boosterCap")} ${grab("noteBoosterPerk")} ${grab("boosterOpen")}
  RESULT = { cap: boosterCap(), open: boosterOpen, state: state, note: noteBoosterPerk };`
  + "; return RESULT;")();

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};
const D = (name, amount, id) => ({ name, amount, id, _cat: "Energy Drink" });

t("each can in the inventory is listed individually", () => {
  const r = count([D("Can of Munster",8,530), D("Can of Red Cow",10,532), D("Can of Taurine Elite",3,533)]);
  assert.strictEqual(r.drinks.length, 3);
  assert.deepStrictEqual(r.drinks.map(d=>d.name).sort(),
    ["Can of Munster","Can of Red Cow","Can of Taurine Elite"]);
});
t("the lumped total still adds up to the individual cans", () => {
  const r = count([D("Can of Munster",8,530), D("Can of Red Cow",10,532), D("Can of Taurine Elite",3,533)]);
  const lumped = r.qty.munster + r.qty.redcow + r.qty.tourine + r.qty.cans;
  assert.strictEqual(lumped, 21, "expected 21, got " + lumped);
  assert.strictEqual(r.drinks.reduce((a,d)=>a+d.qty,0), 21);
});
t("known cans carry their energy value", () => {
  const r = count([D("Can of Munster",1,530), D("Can of Red Cow",1,532), D("Can of Taurine Elite",1,533)]);
  const by = Object.fromEntries(r.drinks.map(d=>[d.name,d.e]));
  assert.strictEqual(by["Can of Munster"], 20);
  assert.strictEqual(by["Can of Red Cow"], 25);
  assert.strictEqual(by["Can of Taurine Elite"], 30);
});
t("an unfamiliar drink is listed but NOT given an invented energy value", () => {
  const r = count([D("Can of Something Brand New",4,99999)]);
  assert.strictEqual(r.drinks.length, 1);
  assert.strictEqual(r.drinks[0].qty, 4);
  assert.strictEqual(r.drinks[0].e, 0, "invented an energy figure for an unknown drink");
});
t("each listed can keeps its own item id, so it can be used directly", () => {
  const r = count([D("Can of Munster",8,530), D("Can of Red Cow",10,532)]);
  assert.deepStrictEqual(r.drinks.map(d=>d.id).sort(), [530,532]);
});
t("drinks with zero held are not listed", () => {
  const r = count([D("Can of Munster",0,530), D("Can of Red Cow",10,532)]);
  assert.strictEqual(r.drinks.length, 1);
});
t("non-drinks never leak into the drinks list", () => {
  const r = count([{name:"Xanax",amount:85,id:206,_cat:"Drug"}, D("Can of Red Cow",10,532)]);
  assert.deepStrictEqual(r.drinks.map(d=>d.name), ["Can of Red Cow"]);
});

t("without the faction perk the booster ceiling is 24h", () => {
  const b = boosterCap(false);
  assert.strictEqual(b.cap, 24*3600);
  assert.strictEqual(b.open(23*3600), true);
  assert.strictEqual(b.open(25*3600), false);
});
t("with the perk it is 48h, so 29h still allows a can", () => {
  const b = boosterCap(true);
  assert.strictEqual(b.cap, 48*3600);
  assert.strictEqual(b.open(29*3600 + 4*60), true, "this is the reported case");
  assert.strictEqual(b.open(47*3600), true);
  assert.strictEqual(b.open(49*3600), false);
});
t("a cooldown above 24h proves the perk, whatever it is called", () => {
  const b = boosterCap(false);
  b.state.boosterCd = 29*3600;
  b.note();
  assert.strictEqual(b.state.boosterPerk, true, "failed to infer the perk from the bar");
});
t("a normal cooldown does not falsely claim the perk", () => {
  const b = boosterCap(false);
  b.state.boosterCd = 12*3600;
  b.note();
  assert.strictEqual(b.state.boosterPerk, false);
});
t("a row mis-tagged as a drink is rejected when the name says otherwise", () => {
  // the API tagging a Xanax row Energy Drink must not put it in the can list
  const r = count([{name:"Xanax",amount:85,id:206,_cat:"Energy Drink"},
                   {name:"Feathery Hotel Coupon",amount:4,id:367,_cat:"Energy Drink"},
                   D("Can of Red Cow",10,532)]);
  assert.deepStrictEqual(r.drinks.map(d=>d.name), ["Can of Red Cow"]);
});
const perkScan = lines => new Function("var RESULT;" + `
  ${grabArr("var ITEM_MAP = [")}
  ${grab("extractPercentMult")} ${grab("isGymPerkLine")} ${grab("parsePerks")}
  RESULT = parsePerks({ faction_perks: ${JSON.stringify(lines)} });` + "; return RESULT;")();

t("the perk scan recognises the wording it is likely to meet", () => {
  [ "Increases maximum booster cooldown by 24 hours",
    "+ 24 hour booster cooldown cap",
    "Energy drink booster cooldown maximum increased",
    "Booster cooldown cap raised to 48 hours" ].forEach(line => {
      assert.strictEqual(perkScan([line]).boosterPerk, true, "missed: " + line);
    });
});
t("the perk scan does not fire on unrelated faction perks", () => {
  [ "+ 10% gym gains", "+ 5% strength gym gains", "Increases maximum life by 100" ]
    .forEach(line => assert.strictEqual(perkScan([line]).boosterPerk, false, "false positive: " + line));
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
