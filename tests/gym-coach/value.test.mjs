import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function consts(names){return names.map(n=>{
  const m=src.match(new RegExp("\\b"+n+"\\s*=\\s*([^,;]+)"));
  if(!m) throw new Error("missing const "+n);
  return "var "+n+" = "+m[1].trim()+";";}).join("\n");}

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol, a+" !~ "+b);

// --- price parsing ----------------------------------------------------------
const pw = new Function("return " + grab("parseWeav3r"))();
const pt = new Function("return " + grab("parseTornMarket"))();

t("the cheapest live listing wins, not the average or the first", () => {
  assert.strictEqual(pw({ market_price: 500000, bazaar_average: 999999,
    listings: [{ price: 480000 }, { price: 442000 }, { price: 461000 }] }), 442000);
});
t("the item-market price wins when it undercuts every bazaar listing", () => {
  assert.strictEqual(pw({ market_price: 400000, listings: [{ price: 480000 }] }), 400000);
});
t("an item nobody is selling has NO price, which is not a price of zero", () => {
  assert.strictEqual(pw({ market_price: 0, listings: [] }), 0);
  assert.strictEqual(pw({ market_price: 0, listings: null }), 0);
  assert.strictEqual(pw(null), 0);
  assert.strictEqual(pw("not json"), 0);
});
t("junk listings are skipped rather than read as free", () => {
  assert.strictEqual(pw({ market_price: 500000,
    listings: [{ price: 0 }, { price: null }, {}, { price: 490000 }] }), 490000);
});
t("Torn's item market is read in either shape it has shipped", () => {
  // v1: an object map keyed by index, price under "cost"
  assert.strictEqual(pt({ itemmarket: { 0: { cost: 830000 }, 1: { cost: 812000 } } }), 812000);
  // v2: a listings array, price under "price"
  assert.strictEqual(pt({ itemmarket: { listings: [{ price: 805000 }, { price: 830000 }] } }), 805000);
  assert.strictEqual(pt({}), 0);
  assert.strictEqual(pt(null), 0);
});

// --- money formatting -------------------------------------------------------
const fm = new Function("return " + grab("fmtMoney"))();
t("money reads at a glance instead of as nine digits", () => {
  assert.strictEqual(fm(1780000), "$1.78m");
  assert.strictEqual(fm(13549997), "$13.5m");
  assert.strictEqual(fm(823800), "$824k");
  assert.strictEqual(fm(587398000), "$587.4m");
  assert.strictEqual(fm(1200000000), "$1.20b");
  assert.strictEqual(fm(0), "—");
  assert.strictEqual(fm(-5), "—");
});

// --- the ranking ------------------------------------------------------------
// 10e per train, 1000 per train, so a day of E energy adds floor(E/10)*1000.
const DEFAULT_SRC_ROWS = [
  { k: "xan",     label: "Xanax",            e: 250,     grp: "",     max: 4  },
  { k: "refill",  label: "Energy refill",    e: 150,     grp: "",     max: 4  },
  { k: "fhc",     label: "Hotel coupon",     e: 150,     grp: "",     max: 4  },
  { k: "mcs",     label: "Mc Smoogle Corp",  e: 100 / 7, grp: "",     max: 5  },
  { k: "munster", label: "Can of Munster",   e: 20, id: 530, grp: "cans", max: 24 },
  { k: "tourine", label: "Can of Taurine Elite", e: 30, id: 533, grp: "cans", max: 24 },
];

const rank = (prices, opts = {}) => { const canRows = opts.rows || DEFAULT_SRC_ROWS;
  return new Function("var RESULT;" + `
  var DAY_MS = 86400000;
  var HIST_KEYS = ["str","def","spe","dex"];
  var GYMS = [{ Gym: "T", Energy: ${opts.energyP === undefined ? 10 : opts.energyP}, Str: 1, Def: 1, Spe: 1, Dex: 1 }];
  var GOAL_MAX_DAYS = 3650;
  var goalCache = { key: "", val: null };
  var GOAL_STEPS = [0, 5e7, 1e8, 2.5e8, 5e8];
  var GOAL_MAX_TRAINS = 4e6;
  var valueCache = { key: "", val: null };
  var VALUE_STEPS = [1,2,3,5,10,15,20,24];
  var VALUE_STEP_MAX_DAYS = 400;
  var MCS_MAX_EXTRA = 4;
  ${consts(["CAL_WINDOW","CAL_MIN_DAYS","CAL_MODEL_LO","CAL_MODEL_HI","CAL_USAGE_LO","CAL_USAGE_HI","PRICE_TTL","XAN_ID","FHC_ID"])}
  // Derived from the rows under test so a new can id resolves, PLUS the
  // deliberate mcs entry: it is resolvable to an item id on purpose, so that
  // only the explicit grp check keeps Mc Smoogle out of the purchase ranking.
  var CAN_TYPES = ${JSON.stringify(
    canRows.filter(r => r.grp === "cans")
           .map((r, i) => ({ k: r.k, ids: [r.id || 900 + i], label: r.label, e: r.e }))
           .concat([{ k: "mcs", ids: [7777], label: "Mc Smoogle Corp", e: 100 / 7 }]))}
      ${[/var STAT_BOOKS = \{[\s\S]*?\n  \};/, /var BOOK_PCT = [^;]+;/, /var BOOK_CAP = [^;]+;/, /var BOOK_DAYS = [^;]+;/].map(re => re.exec(src)[0]).join("\n")}
    var state = { books: {}, goalOrder: [], goalStep: 0,
    hist: [], ledger: [], prices: ${JSON.stringify(prices)}, mcsCost: 0,
    gymName: "T", happyMax: 5000, perks: {}, focus: "str", energyMax: 150,
    stats: { str: 1000000, def: 0, spe: 0, dex: 0 },
    goals: ${JSON.stringify(opts.goals || { str: 4000000 })}
  };
  function Date_now(){ return 1e12; }
  var Date = { now: Date_now };
  function dailyEnergy(){ return { total: ${opts.plan === undefined ? 300 : opts.plan} }; }
  function gainOne(){ return 1000; }
  function srcRows(){ return ${JSON.stringify(canRows)}; }
  ${grab("dayKey")} ${grab("calClamp")} ${grab("predictDay")} ${grab("calibration")}
  ${grab("canIdFor")} ${grab("srcItemId")} ${grab("priceOf")} ${grab("priceStale")}
  ${grab("valueCandidates")} ${grab("valuePlan")}
  ${grab("gymFor")} ${grab("dotsFor")} ${grab("trainsTo")} ${grab("trainsPerDay")} ${grab("goalLevels")} ${grab("orderedGoalKeys")} ${[/var STAT_BOOKS = \{[\s\S]*?\n  \};/, /var BOOK_PCT = [^;]+;/, /var BOOK_CAP = [^;]+;/, /var BOOK_DAYS = [^;]+;/].map(re => re.exec(src)[0]).join("\n")}
    ${grab("bookAward")} ${grab("bookPending")} ${grab("pendingBookAward")} ${grab("shareCap")} ${grab("goalSegments")} ${grab("scheduleDays")} ${grab("goalPlan")} ${grab("hasGoals")}
  RESULT = { plan: valuePlan(), cands: valueCandidates() };` + "; return RESULT;")(); };

const VALUE_STEPS_TEST = JSON.parse(/VALUE_STEPS = (\[[^\]]*\])/.exec(src)[1]);
const NOW = 1e12;
const P = (o) => Object.fromEntries(Object.entries(o).map(([k,v]) => [k, { p: v, at: NOW }]));

t("things you cannot buy on the market are not ranked by price", () => {
  const r = rank({});
  const ks = r.cands.map(c => c.k);
  assert.ok(!ks.includes("refill"), "refills cost points, not money");
  assert.ok(!ks.includes("mcs"), "Mc Smoogle is capital, not a purchase");
  assert.deepStrictEqual(ks.sort(), ["fhc","munster","tourine","xan"]);
});

t("each candidate maps to the right item on the market", () => {
  const by = Object.fromEntries(rank({}).cands.map(c => [c.k, c.id]));
  assert.strictEqual(by.xan, 206);
  assert.strictEqual(by.fhc, 367);
  assert.strictEqual(by.munster, 530);
  assert.strictEqual(by.tourine, 533);
});

t("cheaper time wins: the ranking is by cost per day saved, not sticker price", () => {
  // Taurine costs 10x a Munster for half again the energy, so it buys its days
  // far more expensively — even though both are "a can".
  const r = rank(P({ 530: 1000000, 533: 10000000, 206: 800000, 367: 13000000 }));
  const munster = r.plan.rows.find(x => x.k === "munster");
  const tourine = r.plan.rows.find(x => x.k === "tourine");
  assert.ok(munster.each < tourine.each,
    "munster " + munster.each + " should undercut taurine " + tourine.each);
  // Sorted by that figure, cheapest first — among things whose ONLY cost is
  // money. Cans are ordered by strength instead, because they also spend a 2h
  // booster slot that no price can express; that ordering has its own tests.
  const priced = r.plan.rows.filter(x => x.price > 0 && x.grp !== "cans").map(x => x.each);
  assert.deepStrictEqual(priced, priced.slice().sort((a, b) => a - b));
  // the cheapest sticker price is NOT automatically the best value: xanax is
  // the cheapest item here and also happens to win, but munster is dearer than
  // nothing and still beats the pricier can
  assert.strictEqual(r.plan.rows[0].k, "xan");
});

t("an unpriced item ranks last rather than looking free", () => {
  const r = rank(P({ 530: 1000000 }));          // only munster has a price
  assert.strictEqual(r.plan.rows[0].k, "munster");
  const tail = r.plan.rows[r.plan.rows.length - 1];
  assert.strictEqual(tail.price, 0);
  assert.strictEqual(tail.each, 0);
});

t("cost per day saved is the whole run's spend, not one day's", () => {
  const r = rank(P({ 530: 1000000 }));
  const m = r.plan.rows.find(x => x.k === "munster");
  near(m.total, m.price * m.days);
  near(m.each, (m.price * m.days) / m.saved);
  assert.ok(m.saved > 0 && m.days < r.plan.base);
});

t("a source that cannot move the date even at 24 a day is left off entirely", () => {
  // At 100,000e a train, even 24 xanax a day is 6,000e — not one extra train.
  // Days are fractional now, so "the goal is one day out" no longer floors it;
  // what actually stops a purchase helping is the train granularity.
  const r = rank(P({ 530: 1000000, 533: 1000000, 206: 1000000, 367: 1000000 }),
                 { energyP: 100000, plan: 1000000 });
  assert.strictEqual(r.plan.rows.length, 0);
});

t("a source too small to matter one at a time is quoted at a count that is", () => {
  // At 100e a train, one 20e can never buys a train and the row would vanish —
  // which reads as "cans do nothing" rather than "one is not enough".
  const r = rank(P({ 530: 1000000, 533: 1000000, 206: 1000000, 367: 1000000 }),
                 { energyP: 100, plan: 1000 });
  const m = r.plan.rows.find(x => x.k === "munster");
  assert.ok(m, "the can must still be listed");
  assert.ok(m.n > 1, "and quoted at more than one a day, got " + m.n);
  assert.ok(VALUE_STEPS_TEST.includes(m.n), "at one of the offered steps");
  // the quoted spend is for that many a day, not for one
  near(m.total, m.price * m.n * m.days);
});

t("every listed row genuinely shortens the goal", () => {
  const r = rank(P({ 530: 1000000, 533: 1000000, 206: 1000000, 367: 1000000 }));
  assert.ok(r.plan.rows.length > 0);
  r.plan.rows.forEach(row => {
    assert.ok(row.days < r.plan.base, row.k + " must finish sooner than the baseline");
    assert.ok(row.saved > 0, row.k + " must save at least a day");
    assert.ok(VALUE_STEPS_TEST.includes(row.n), row.k + " quoted at an odd count " + row.n);
  });
});

t("the smallest step that works is the one quoted, not the largest", () => {
  const r = rank(P({ 530: 1000000, 533: 1000000, 206: 1000000, 367: 1000000 }));
  const m = r.plan.rows.find(x => x.k === "munster");
  const t2 = r.plan.rows.find(x => x.k === "tourine");
  assert.ok(m && t2);
  // taurine is 30e to munster's 20e, so it needs no more of them than munster
  assert.ok(t2.n <= m.n, "the stronger can should need no more per day");
});

t("no goal means no ranking, and so no outbound price request", () => {
  assert.strictEqual(rank({}, { goals: {} }).plan, null);
});

t("added energy is discounted the same way the baseline is", () => {
  // With a usage factor of 0.5, a 250e xanax contributes 125e to the schedule.
  // Adding it raw would overstate the saving by double.
  const hist = [], ledger = [];
  const today = Math.floor(NOW / 86400000);
  let str = 1000000;
  hist.push({ d: today - 15, v: [str, 0, 0, 0] });
  for (let i = 14; i >= 1; i--) {
    str += 30000;
    hist.push({ d: today - i, v: [str, 0, 0, 0] });
    ledger.push({ d: today - i, used: 150, wasted: 150 });   // usage 0.5
  }
  const r = new Function("var RESULT;" + `
    var DAY_MS = 86400000;
    var GYMS = [{ Gym: "T", Energy: 10, Str: 1, Def: 1, Spe: 1, Dex: 1 }];
    var HIST_KEYS = ["str","def","spe","dex"];
    var goalCache = { key: "", val: null };
    var GOAL_STEPS = [0, 5e7, 1e8, 2.5e8, 5e8];
    var GOAL_MAX_TRAINS = 4e6;
    ${consts(["CAL_WINDOW","CAL_MIN_DAYS","CAL_MODEL_LO","CAL_MODEL_HI","CAL_USAGE_LO","CAL_USAGE_HI","PRICE_TTL","XAN_ID","FHC_ID"])}
    var CAN_TYPES = [];
    var valueCache = { key: "", val: null };
    var VALUE_STEPS = [1,2,3,5,10,15,20,24];
    var VALUE_STEP_MAX_DAYS = 400;
    var MCS_MAX_EXTRA = 4;
    var state = { books: {}, hist: ${JSON.stringify(hist)}, ledger: ${JSON.stringify(ledger)},
                  prices: {}, mcsCost: 0, goalOrder: [], goalStep: 0,
                  gymName: "T", happyMax: 5000, perks: {}, energyMax: 150,
                  stats: { str: ${str}, def: 0, spe: 0, dex: 0 },
                  goals: { str: ${str + 500000} } };
    function Date_now(){ return ${NOW}; }
    var Date = { now: Date_now };
    function dailyEnergy(){ return { total: 300 }; }
    function gainOne(){ return 1000; }
    function srcRows(){ return [{ k: "xan", label: "Xanax", e: 250 }]; }
    ${grab("dayKey")} ${grab("calClamp")} ${grab("predictDay")} ${grab("calibration")}
    ${grab("canIdFor")} ${grab("srcItemId")} ${grab("priceOf")} ${grab("priceStale")}
    ${grab("valueCandidates")} ${grab("valuePlan")}
    ${grab("gymFor")} ${grab("dotsFor")} ${grab("trainsTo")} ${grab("trainsPerDay")}
    ${grab("goalLevels")} ${grab("orderedGoalKeys")} ${[/var STAT_BOOKS = \{[\s\S]*?\n  \};/, /var BOOK_PCT = [^;]+;/, /var BOOK_CAP = [^;]+;/, /var BOOK_DAYS = [^;]+;/].map(re => re.exec(src)[0]).join("\n")}
    ${grab("bookAward")} ${grab("bookPending")} ${grab("pendingBookAward")} ${grab("shareCap")} ${grab("goalSegments")}
    ${grab("scheduleDays")} ${grab("goalPlan")} ${grab("hasGoals")}
    var pl = goalPlan();
    RESULT = { cal: calibration(), plan: valuePlan(), energy: pl.energy,
               trains: pl.totalTrains,
               disc: scheduleDays(pl.totalTrains, pl.energy + 125),
               raw:  scheduleDays(pl.totalTrains, pl.energy + 250) };` + "; return RESULT;")();
  near(r.cal.usage, 0.5);
  const xan = r.plan.rows.find(x => x.k === "xan");
  near(xan.days, r.disc, 1e-9);
  assert.notStrictEqual(r.disc, r.raw, "the discounted and raw figures must differ");
});

t("a price older than the cache window is refetched, a fresh one is not", () => {
  const f = new Function("var state = { books: {}, prices: { '530': { p: 1, at: 1e12 - 1000 }, " +
    "'533': { p: 1, at: 1e12 - 7 * 3600 * 1000 } } };" +
    "var Date = { now: function(){ return 1e12; } };" +
    consts(["PRICE_TTL"]) + " return " + grab("priceStale"))();
  assert.strictEqual(f(530), false);
  assert.strictEqual(f(533), true);
  assert.strictEqual(f(999), true);      // never fetched
});

t("Mc Smoogle escalates to the smallest number of increments that helps", () => {
  // One increment is 100e a week — 14.3e a day. Against a 1000e plan at 50e a
  // train, one, two and three all still buy 20 trains; the fourth reaches 21.
  // So the honest answer is "four", not "no".
  const r = rank(P({}), { energyP: 50, plan: 1000 });
  assert.strictEqual(r.plan.mcs.n, 4);
  assert.ok(r.plan.mcs.saved > 0);
  assert.ok(r.plan.mcs.days < r.plan.base);
});

t("Mc Smoogle reports honestly when no affordable number of increments helps", () => {
  // four increments is 57e a day, nowhere near a 100,000e train
  const r = rank(P({}), { energyP: 100000, plan: 1000000 });
  assert.strictEqual(r.plan.mcs.n, 0);
  assert.strictEqual(r.plan.mcs.saved, 0);
});

t("Mc Smoogle never proposes more increments than the block holds", () => {
  const r = rank(P({}), { energyP: 500, plan: 5000 });  // one increment is tiny here
  assert.ok(r.plan.mcs.n <= 4, "proposed " + r.plan.mcs.n);
});

t("cans rank by strength, not by cost per energy", () => {
  // The reported case. Goose Juice is 8e for $433k = 54k an energy; Red Cow is
  // 38e for $2.39m = 63k an energy. By money Goose wins — and it is a QUARTER
  // of the energy in an identical 2h booster slot, which is the cost that binds.
  const rows = [
    { k:"goose",   id:985, label:"Can of Goose Juice",  e:8,  grp:"cans", max:24 },
    { k:"redcow",  id:532, label:"Can of Red Cow",      e:38, grp:"cans", max:24 },
    { k:"tourine", id:533, label:"Can of Taurine Elite",e:45, grp:"cans", max:24 },
  ];
  const r = rank(P({ 985: 433000, 532: 2390000, 533: 50000000 }),
                 { rows, budget: { goose:4, redcow:4, tourine:4 } });
  const cans = r.plan.rows.filter(x => x.grp === "cans").map(x => x.k);
  assert.deepStrictEqual(cans, ["tourine","redcow","goose"],
    "strongest first, got " + cans.join(", "));
});

t("money still breaks ties between cans of equal strength", () => {
  const rows = [
    { k:"redcow",  id:532, label:"Can of Red Cow",         e:38, grp:"cans", max:24 },
    { k:"rudolph", id:554, label:"Can of Rockstar Rudolph",e:38, grp:"cans", max:24 },
  ];
  const r = rank(P({ 532: 2400000, 554: 2390000 }), { rows, budget: { redcow:4, rudolph:4 } });
  const cans = r.plan.rows.filter(x => x.grp === "cans").map(x => x.k);
  assert.deepStrictEqual(cans, ["rudolph","redcow"], "the cheaper of two equals leads");
});

t("things that cost only money keep the money ranking, above the cans", () => {
  // The can is deliberately the better buy ON MONEY — dirt cheap against a very
  // expensive xanax — so a comparator that merely sorted by cost per day saved
  // would put it first. It must still sit below: a xanax spends no booster
  // slot, and the slot is the scarcer of the two currencies.
  const rows = [
    { k:"xan",     label:"Xanax", e:250, grp:"", max:4 },
    { k:"tourine", id:533, label:"Can of Taurine Elite", e:45, grp:"cans", max:24 },
  ];
  const r = rank(P({ 206: 90000000, 533: 50000 }), { rows, budget: { xan:1, tourine:4 } });
  const xan = r.plan.rows.find(x => x.k === "xan");
  const can = r.plan.rows.find(x => x.grp === "cans");
  assert.ok(can.each < xan.each,
    "fixture is wrong — the can should look cheaper: " + can.each + " vs " + xan.each);
  assert.strictEqual(r.plan.rows[0].k, "xan", "a xanax costs no booster slot");
  assert.strictEqual(r.plan.rows[r.plan.rows.length - 1].grp, "cans");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
