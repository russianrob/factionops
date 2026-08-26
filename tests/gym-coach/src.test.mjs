import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function grabArr(decl){const i=src.indexOf(decl);const j=src.indexOf("\n  ];",i);return src.slice(i,j+5);}
function grabObj(decl){const i=src.indexOf(decl);const j=src.indexOf("};",i);return src.slice(i,j+2);}

const mk = (srcCfg, opts) => {
  const o = Object.assign({ rate:180, max:150, warStack:false, canMult:1, drinks:[] }, opts||{});
  return new Function("var RESULT;" + `
    var state = { src: ${JSON.stringify(srcCfg)}, energySecPerE: ${o.rate}, energyMax: ${o.max},
                  warStack: ${o.warStack}, canMult: ${o.canMult}, drinkList: ${JSON.stringify(o.drinks)}, calEvents: [] };
    var XAN_E = 250;
    ${grabArr("var CAN_TYPES = [")}
    ${grabObj("var CLASSIC_CANS = {")}
    ${grabArr("var SRC_BASE = [")}
    ${grab("eventActive")} ${grab("caffeineOn")} ${grab("canType")} ${grab("canEnergy")} ${grab("energyRate")} ${grab("srcRows")}
    ${grab("srcRow")} ${grab("srcCount")} ${grab("srcEnergy")} ${grab("dailyEnergy")}
    RESULT = { daily: dailyEnergy(), rows: srcRows(), count: srcCount, energy: srcEnergy };`
    + "; return RESULT;")();
};
const CAN = (name, id) => ({ name, id, qty: 5, e: 0 });

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("natural regen comes from Torn's rate, not a hardcoded number", () => {
  assert.strictEqual(mk({}).daily.natural, 480);
  assert.strictEqual(mk({}, { rate: 90 }).daily.natural, 960);
});
t("the three staples are always offered", () => {
  const keys = mk({}).rows.map(r => r.k);
  ["munster","redcow","tourine"].forEach(k => assert.ok(keys.includes(k), "missing " + k));
});
t("a can you actually hold is offered too — even a seasonal one", () => {
  const keys = mk({}, { drinks:[CAN("Can of Rockstar Rudolph", 554)] }).rows.map(r => r.k);
  assert.ok(keys.includes("rudolph"), "cannot tick the only can you own: " + keys.join(","));
});
t("cans you do not hold are listed too, and marked as not held", () => {
  // REVERSES 0.7.1, deliberately. That release hid unheld cans so a configured
  // can could not inflate a projection silently. The cost was that you could
  // not SEE that a Taurine is triple a Damp Valley for the same booster slot.
  // The safeguard moved rather than vanished: `held` rides on every row.
  const rows = mk({}, { drinks:[CAN("Can of Rockstar Rudolph", 554)] }).rows;
  const by = Object.fromEntries(rows.filter(r => r.grp === "cans").map(r => [r.k, r]));
  assert.strictEqual(by.rudolph.held, 5, "the can you own");
  ["munster","redcow","tourine","xmass","santa","goose"].forEach(k => {
    assert.ok(by[k], k + " should now be listed");
    assert.strictEqual(by[k].held, 0, k + " must be marked as none held");
  });
});
t("a can you have configured stays listed even at zero", () => {
  // otherwise the row vanishes and its contribution disappears silently
  const keys = mk({ redcow: 4 }, { drinks:[CAN("Can of Rockstar Rudolph", 554)] }).rows.map(r => r.k);
  assert.ok(keys.includes("redcow"), "a configured can must not vanish");
  assert.ok(keys.includes("rudolph"));
});
t("with no inventory read yet every can is offered, not just the staples", () => {
  const keys = mk({}).rows.map(r => r.k);
  ["munster","redcow","tourine","goose","damp","croco","santa","rudolph","xmass"].forEach(k =>
    assert.ok(keys.includes(k), "missing " + k));
});
t("each listed can carries its real value", () => {
  const rows = mk({}, { drinks:[CAN("Can of Rockstar Rudolph",554), CAN("Can of Goose Juice",985)] }).rows;
  const by = Object.fromEntries(rows.map(r => [r.k, r.e]));
  assert.strictEqual(by.rudolph, 25);
  assert.strictEqual(by.goose, 5);
  assert.strictEqual(by.tourine, 30, "an unheld can still carries its true value");
  // and a held Taurine still prices correctly
  const held = mk({}, { drinks:[CAN("Can of Taurine Elite",533)] }).rows;
  assert.strictEqual(Object.fromEntries(held.map(r=>[r.k,r.e])).tourine, 30);
});
t("book and perk bonuses feed straight into the projection", () => {
  const plain = mk({ tourine: 8 }).daily.total;
  const boosted = mk({ tourine: 8 }, { canMult: 1.3 }).daily.total;
  assert.strictEqual(boosted - plain, 8 * (39 - 30), "8 cans x 9e extra");
});
t("xan only", () => assert.strictEqual(mk({ xan: 3 }).daily.total, 480 + 750));
t("refills and coupons are sized to YOUR max bar", () => {
  assert.strictEqual(mk({ refill: 1 }, { max: 250 }).daily.total, 480 + 250);
  assert.strictEqual(mk({ fhc: 2 }, { max: 200 }).daily.total, 480 + 400);
});
t("cans are summed together in the breakdown", () => {
  const d = mk({ munster: 2, redcow: 2, tourine: 2 }).daily;
  assert.strictEqual(d.cans, 40 + 50 + 60);
});
t("war stack banks the xans but keeps everything else", () => {
  const on = mk({ xan: 3, refill: 1, redcow: 4 }, { warStack: true }).daily;
  assert.strictEqual(on.xan, 0);
  assert.strictEqual(on.total, 480 + 150 + 100);
});
t("counts are clamped per row", () => {
  assert.strictEqual(mk({ redcow: 9999 }).count("redcow"), 24);
  // THREE. Not six, and not the four a nominal ~6h cooldown implies: a fourth
  // does not fit in a day in practice. The old cap of 6 let "Worth it?" price a
  // fifth and sixth that no amount of money can buy.
  assert.strictEqual(mk({ xan: 9999 }).count("xan"), 3);
  assert.strictEqual(mk({ xan: -5 }).count("xan"), 0);
});
t("garbage in storage degrades to zero rather than NaN", () => {
  const d = mk({ xan:"three", refill:null, redcow:undefined }).daily;
  assert.strictEqual(d.total, 480);
  assert.ok(Number.isFinite(d.total));
});
t("an unticked source contributes exactly nothing", () => {
  assert.strictEqual(mk({ xan: 3, redcow: 0 }).daily.total, mk({ xan: 3 }).daily.total);
});
t("Mc Smoogle Corp pays 100 energy every 7 days per increment", () => {
  const one = mk({ mcs: 1 }).daily;
  assert.strictEqual(Number(one.mcs.toFixed(2)), 14.29, "100/7 a day, got " + one.mcs);
  assert.strictEqual(Number((mk({ mcs: 3 }).daily.mcs).toFixed(2)), 42.86, "three increments");
});
t("MCS actually reaches the daily total", () => {
  const base = mk({}).daily.total;
  const withMcs = mk({ mcs: 2 }).daily.total;
  assert.strictEqual(Number((withMcs - base).toFixed(2)), 28.57);
});
t("the total sums whatever sources exist, not a hardcoded list", () => {
  // the old form named each bucket, so a source added later was displayed and
  // then silently left out of the number that matters
  const d = mk({ xan: 3, refill: 1, fhc: 1, redcow: 4, mcs: 1 }).daily;
  const parts = d.xan + d.refill + d.fhc + d.cans + d.mcs;
  assert.strictEqual(Number((d.total - d.natural).toFixed(2)), Number(parts.toFixed(2)),
    "total " + d.total + " does not match its own parts");
});
t("MCS is unaffected by war stack, unlike xanax", () => {
  const on = mk({ xan: 3, mcs: 2 }, { warStack: true }).daily;
  assert.strictEqual(on.xan, 0);
  assert.strictEqual(Number(on.mcs.toFixed(2)), 28.57);
});
t("every can is listed, not only the ones in your bag", () => {
  // Holding one weak can used to hide the other eight, so there was no way to
  // see that Taurine is three times the energy for the SAME 2h of booster.
  const rows = mk({}, { drinks: [CAN("Can of Damp Valley", 986)] })
    .rows.filter(r => r.grp === "cans");
  assert.strictEqual(rows.length, 9, rows.map(r => r.label).join(", "));
  assert.ok(rows.some(r => r.label === "Can of Munster"));
  assert.ok(rows.some(r => r.label === "Can of Santa Shooters"));
});

t("what you hold is marked, so a plan built on an empty cupboard is visible", () => {
  const rows = mk({}, { drinks: [CAN("Can of Damp Valley", 986)] })
    .rows.filter(r => r.grp === "cans");
  const damp = rows.find(r => r.k === "damp");
  const munster = rows.find(r => r.k === "munster");
  assert.strictEqual(damp.held, 5, "the inventory count should ride on the row");
  assert.strictEqual(munster.held, 0);
});

t("cans you hold come first, then the strongest of the rest", () => {
  const rows = mk({}, { drinks: [CAN("Can of Goose Juice", 985)] })
    .rows.filter(r => r.grp === "cans");
  assert.strictEqual(rows[0].k, "goose", "held first even though it is the weakest");
  const rest = rows.slice(1);
  for (let i = 1; i < rest.length; i++) {
    assert.ok(rest[i - 1].e >= rest[i].e,
      "unheld cans should descend by strength: " + rest.map(r => r.k + ":" + r.e).join(" "));
  }
});

t("an unheld can can still be ticked into the plan", () => {
  // Deliberate: you may be planning a purchase. It has to COUNT toward the
  // projection or ticking it would be a lie in the other direction.
  const r = mk({ tourine: 4 }, { drinks: [CAN("Can of Damp Valley", 986)], canMult: 1.5 });
  const tourine = r.rows.filter(x => x.k === "tourine")[0];
  assert.strictEqual(tourine.held, 0);
  assert.strictEqual(r.count("tourine"), 4);
  assert.strictEqual(r.energy("tourine"), 4 * 45, "45e a can at +50%");
  assert.ok(r.daily.cans >= 180, "and it must reach the daily total: " + r.daily.cans);
});

t("holding nothing at all still lists all nine", () => {
  const rows = mk({}).rows.filter(r => r.grp === "cans");
  assert.strictEqual(rows.length, 9);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
