import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function grabArr(decl){const i=src.indexOf(decl);const j=src.indexOf("\n  ];",i);return src.slice(i,j+5);}

const meter = (cd, perk) => new Function("var RESULT;" + `
  var H = 3600, BOOSTER_CAP = 24*H, BOOSTER_CAP_PERK = 48*H;
  var state = { boosterCd: ${cd}, boosterPerk: ${perk} };
  function fmtCd(s){ s=Math.max(0,Math.floor(s)); var h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
    return h ? h+"h "+m+"m" : m+"m"; }
  ${grab("boosterCap")} ${grab("boosterMeterHtml")}
  RESULT = boosterMeterHtml();` + "; return RESULT;")();

const caffeine = (events, mult) => new Function("var RESULT;" + `
  var state = { calEvents: ${JSON.stringify(events)}, canMult: ${mult} };
  ${grabArr("var CAN_TYPES = [")}
  ${grab("eventActive")} ${grab("caffeineOn")} ${grab("canType")} ${grab("canEnergy")} ${grab("drinkEnergy")}
  RESULT = { on: caffeineOn(), e: drinkEnergy };` + "; return RESULT;")();

const H = 3600, DAY = 86400;
const now = () => Math.floor(Date.now()/1000);
let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("28h against a 48h cap is NOT a full bar", () => {
  const h = meter(28*H + 39*60, true);
  const w = /width:([\d.]+)%/.exec(h)[1];
  assert.ok(Number(w) > 55 && Number(w) < 65, "bar reads " + w + "%, expected about 60%");
  assert.ok(!/gcb-fill full/.test(h), "styled as maxed out");
});
t("it says how much headroom is left and how many cans fit", () => {
  const h = meter(28*H, true);
  assert.ok(/20h 0m of headroom/.test(h), h);
  assert.ok(/room for 10 more cans/.test(h), "20h / 2h per can = 10");
});
t("a part-slot still counts, because a can may carry you past the cap", () => {
  // 46h42m of 48h: Torn lets you drink while UNDER the cap, landing at 48h42m
  const h = meter(46*H + 42*60, true);
  assert.ok(/room for 1 more can\b/.test(h), "said there was no room: " + h);
});
t("47h leaves room for exactly one, not two", () => {
  const h = meter(47*H, true);
  assert.ok(/room for 1 more can\b/.test(h), h);
});
t("44h leaves room for two", () => {
  assert.ok(/room for 2 more cans/.test(meter(44*H, true)));
});
t("at the cap there is genuinely no room", () => {
  const h = meter(48*H, true);
  assert.ok(/At the ceiling/.test(h), h);
});
t("the cap shown reflects the faction perk", () => {
  assert.ok(/\/ 48h/.test(meter(28*H, true)));
  assert.ok(/\/ 24h/.test(meter(10*H, false)));
});
t("without the perk, 23h really is nearly full", () => {
  const w = Number(/width:([\d.]+)%/.exec(meter(23*H, false))[1]);
  assert.ok(w > 95, "reads " + w + "%");
});
t("at the ceiling it says so plainly", () => {
  const h = meter(48*H, true);
  assert.ok(/At the ceiling/.test(h), h);
  assert.ok(/gcb-fill full/.test(h), "should be flagged");
});
t("one can of room reads singular", () => {
  assert.ok(/room for 1 more can\b/.test(meter(46*H, true)));
});
t("the booster band is gone from the 12-hour rail", () => {
  assert.ok(!/gcb-band b2/.test(src), "the rail still draws a booster band");
});

t("Caffeine Consumption doubles every can while it runs", () => {
  const c = caffeine([{ title: "CaffeineCon 2026", start: now() - DAY, end: now() + DAY }], 1);
  assert.strictEqual(c.on, true);
  assert.strictEqual(c.e("Can of Red Cow", 532), 50, "25 doubled");
  assert.strictEqual(c.e("Can of Taurine Elite", 533), 60);
});
t("it stacks on top of your perk bonus", () => {
  const c = caffeine([{ title: "CaffeineCon", start: now() - DAY, end: now() + DAY }], 1.3);
  assert.strictEqual(c.e("Can of Red Cow", 532), Math.round(25 * 1.3) * 2);
});
t("an event that has finished does not double anything", () => {
  const c = caffeine([{ title: "CaffeineCon", start: now() - 30*DAY, end: now() - 20*DAY }], 1);
  assert.strictEqual(c.on, false);
  assert.strictEqual(c.e("Can of Red Cow", 532), 25);
});
t("an unrelated event does not double anything", () => {
  const c = caffeine([{ title: "International Beer Day", start: now() - DAY, end: now() + DAY }], 1);
  assert.strictEqual(c.on, false);
});
t("no calendar data at all is simply not doubled", () => {
  assert.strictEqual(caffeine([], 1).on, false);
  assert.strictEqual(caffeine([], 1).e("Can of Red Cow", 532), 25);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
