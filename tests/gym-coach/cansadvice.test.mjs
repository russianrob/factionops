import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}

const H = 3600;
// `cans` is what the plan budgets, `held` what the inventory says, boosterCd in
// seconds against a 48h ceiling.
function run(opts) {
  const { budget = {}, held = null, boosterCd = 0, cap48 = true, invAt = null,
          energy = 25, max = 150, gymEnergy = 10, rows = null } = opts;
  const canRows = rows || [{ k:"rudolph", id:999, label:"Can of Rockstar Rudolph", e:38, grp:"cans", max:24 }];
  return new Function("var RESULT;" + `
    var CAN_TYPES = ${JSON.stringify(canRows.filter(r => r.grp === "cans").map((r,i) => ({ k:r.k, ids:[r.id || 900+i], label:r.label, e:r.e })))};
    var state = {
      src: ${JSON.stringify(budget)},
      drinkList: ${JSON.stringify(held || [])},
      invAt: ${invAt === null ? (held ? 1e12 : 0) : invAt},
      boosterCd: ${boosterCd}, boosterPerk: ${cap48},
      energy: ${energy}, energyMax: ${max}, gymEnergy: ${gymEnergy}
    };
    var BOOSTER_CAP = 24 * 3600, BOOSTER_CAP_PERK = 48 * 3600;
    function srcRows(){ return ${JSON.stringify(canRows)}; }
    function srcRow(k){ var r = srcRows().filter(function(x){return x.k===k;}); return r[0] || null; }
    function canType(name, id){
      for (var i=0;i<CAN_TYPES.length;i++){
        if (id && CAN_TYPES[i].ids.indexOf(Number(id)) !== -1) return CAN_TYPES[i];
        if (name && CAN_TYPES[i].label === name) return CAN_TYPES[i];
      }
      return null;
    }
    function fmt(n){ return String(Math.round(n)); }
    ${grab("boosterCap")} ${grab("srcCount")} ${grab("cansOnHand")} ${grab("canStep")}
    RESULT = { on: cansOnHand(), step: canStep("4h 2m") };` + "; return RESULT;")();
}

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("the cans your plan budgets are named in the advice", () => {
  // the reported case: 4 a day budgeted, 25/150, booster at 37h57m of 48h.
  // 125e short of the cap at 38e a can is four.
  const r = run({ budget: { rudolph: 4 }, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:40 }],
                  boosterCd: 37*H + 57*60 });
  assert.strictEqual(r.on.n, 4);
  assert.strictEqual(r.on.e, 152);
  assert.match(r.step.text, /Drink 4 × Can of Rockstar Rudolph/);
  assert.match(r.step.text, /\+152e/);
  assert.match(r.step.text, /instead of waiting 4h 2m/);
});

t("a big daily budget is spread across sessions, not drunk in one go", () => {
  // 12 a day budgeted. Drinking all twelve at 25/150 would bank 331e above the
  // cap, where natural regen pauses. Four fills the bar; the rest wait.
  const r = run({ budget: { rudolph: 12 }, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:40 }],
                  boosterCd: 0, energy: 25, max: 150 });
  assert.strictEqual(r.on.perDay, 12);
  assert.strictEqual(r.on.n, 4, "should fill the bar, not empty the cupboard");
  assert.match(r.step.text, /4 of the 12 a day you budget/);
  assert.match(r.step.text, /keep for later sessions/);
});

t("a nearly-full bar needs one can, not the whole budget", () => {
  const r = run({ budget: { rudolph: 12 }, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:40 }],
                  energy: 130, max: 150 });
  assert.strictEqual(r.on.n, 1);
});

t("a full bar gets no can advice at all — the answer is to train", () => {
  const r = run({ budget: { rudolph: 12 }, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:40 }],
                  energy: 150, max: 150 });
  assert.strictEqual(r.on, null);
  assert.strictEqual(r.step, null);
});

t("it counts trains, because that is the unit that matters", () => {
  const r = run({ budget: { rudolph: 4 }, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:40 }],
                  boosterCd: 0, gymEnergy: 10 });
  assert.match(r.step.text, /15 more trains/);   // 152e at 10e a train
});

t("you are never told to drink cans you do not have", () => {
  const r = run({ budget: { rudolph: 4 }, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:2 }] });
  assert.strictEqual(r.on.n, 2, "held 2, budgeted 4");
  assert.match(r.step.text, /Drink 2 ×/);
});

t("holding none of a budgeted can says so rather than suggesting a drink", () => {
  const r = run({ budget: { rudolph: 4 }, held: [], invAt: 1e12 });
  assert.strictEqual(r.on.dry, true);
  assert.strictEqual(r.on.n, 0);
  assert.match(r.step.text, /budgets 4 cans a day but you are holding none/);
});

t("before the inventory has loaded it still advises, rather than going silent", () => {
  // drinkList is [] here too — only invAt separates "none held" from "not read"
  const r = run({ budget: { rudolph: 4 }, held: [], invAt: 0 });
  assert.strictEqual(r.on.n, 4);
});

t("no cans budgeted means the advice stays out of the way", () => {
  const r = run({ budget: {}, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:40 }] });
  assert.strictEqual(r.on, null);
  assert.strictEqual(r.step, null);
});

t("the booster ceiling caps the number suggested", () => {
  // 45h of 48h leaves 3h = room for 2 cans, even though 4 would fill the bar
  const r = run({ budget: { rudolph: 4 }, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:40 }],
                  boosterCd: 45*H });
  assert.strictEqual(r.on.fits, 2);
  assert.strictEqual(r.on.n, 2, "must not advise past the ceiling");
  assert.match(r.step.text, /Only 2 fit before the booster ceiling/);
});

t("at the ceiling it says so instead of suggesting a drink", () => {
  const r = run({ budget: { rudolph: 4 }, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:40 }],
                  boosterCd: 48*H });
  assert.strictEqual(r.on.blocked, true);
  assert.match(r.step.text, /booster cooldown is at the ceiling/);
  assert.ok(!/Drink/.test(r.step.text));
});

t("it never banks the bar far past the cap", () => {
  // 120/150 with four budgeted: one can covers the 30e gap, three would bank
  // 114e above the cap where regen is paused.
  const r = run({ budget: { rudolph: 4 }, held: [{ name:"Can of Rockstar Rudolph", id:999, qty:40 }],
                  energy: 120, max: 150 });
  assert.strictEqual(r.on.n, 1);
  assert.ok(120 + r.on.e < 150 + 38, "at most one can past the cap");
});

t("with a mixed bag the strongest can is offered first", () => {
  const rows = [
    { k:"goose", id:985, label:"Can of Goose Juice", e:6, grp:"cans", max:24 },
    { k:"tourine", id:533, label:"Can of Taurine Elite", e:33, grp:"cans", max:24 },
  ];
  const r = run({ rows, budget: { goose: 4, tourine: 4 },
                  held: [{ name:"Can of Goose Juice", id:985, qty:9 },
                         { name:"Can of Taurine Elite", id:533, qty:9 }],
                  boosterCd: 44*H });          // 4h left = room for 2
  assert.strictEqual(r.on.n, 2);
  assert.strictEqual(r.on.e, 66, "should take two Taurine, not two Goose");
  assert.match(r.step.text, /2 × Can of Taurine Elite/);
});

t("a non-can source is never offered as a drink", () => {
  const rows = [
    { k:"xan", label:"Xanax", e:250, grp:"", max:6 },
    { k:"rudolph", id:999, label:"Can of Rockstar Rudolph", e:38, grp:"cans", max:24 },
  ];
  // invAt 0 so the held check cannot mask the bug: with the inventory unread
  // every budgeted row is taken at face value, and only the grp check keeps
  // Xanax out of a list of things to drink.
  const r = run({ rows, budget: { xan: 3, rudolph: 2 },
                  held: [], invAt: 0, energy: 25, max: 150 });
  assert.strictEqual(r.on.n, 2);
  assert.ok(!/Xanax/.test(r.step.text), "xanax is not a can");
  assert.strictEqual(r.on.perDay, 2, "a xanax is not part of the can budget either");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
