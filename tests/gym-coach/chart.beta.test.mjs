process.env.TZ = "America/New_York"; // must precede any Date use
import fs from "fs";
import assert from "assert";

const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error("missing " + name);
  let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error("unbalanced " + name);
}

// Harness: real histChart + fmtAxis + fmtDay, with the surrounding state stubbed.
const mk = (statsObj, hist, projTotals) => {
  const ctx = {};
  const code = `
  var DAY_MS = 86400000;
  var HIST_KEYS = ["str","def","spe","dex"];
  var HIST_COLOURS = { str:"#e8a33d", def:"#3d9ae8", spe:"#e85f8a", dex:"#2ecc71" };
  var state = { stats: __STATS__, hist: __HIST__ };
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function dayKey(ms){ return Math.floor(ms / DAY_MS); }
  function histWindow(days){ var cut = dayKey(Date.now()) - days; return state.hist.filter(function(e){ return e.d >= cut; }); }
  function histProjection(days){
    var out = {};
    HIST_KEYS.forEach(function(k){
      var pts = [];
      for (var i=0;i<=8;i++){ var d = Math.round(days*i/8); pts.push({ d:d, v:(state.stats[k]||0) + d*__PROJ__[k] }); }
      out[k] = pts;
    });
    return out;
  }
  ${grab("fmtAxis")}
  ${grab("fmtDay")}
  ${grab("niceStep")}
  ${grab("histChart")}
  RESULT = histChart;
  `.replace("__STATS__", JSON.stringify(statsObj)).replace("__HIST__", JSON.stringify(hist)).replace("__PROJ__", JSON.stringify(projTotals));
  const fn = new Function("var RESULT; " + code + "; return RESULT;");
  return fn();
};

const today = Math.floor(Date.now() / 86400000);
const hist5 = [0,1,2,3,4].map(n => ({ d: today - 4 + n, v: [1000+n*20, 400+n*8, 1100+n*22, 1700+n*30] }));

let pass = 0, fail = 0;
const t = (name, f) => { try { f(); pass++; console.log("ok   " + name); } catch (e) { fail++; console.log("FAIL " + name + " :: " + e.message); } };

// ---- balanced, shared-axis case (the reference screenshot's shape) ----
const shared = mk({str:948,def:357,spe:1042,dex:1674}, hist5, {str:4351,def:3120,spe:0,dex:4737})(365);

const xLabels = svg => [...svg.matchAll(/<text x="[\d.]+" y="159" fill="#8a93a0" font-size="9" text-anchor="[a-z]+">([^<]+)</g)].map(m => m[1]);
const yLabels = svg => [...svg.matchAll(/<text x="31" y="[\d.]+" fill="#8a93a0" font-size="9" text-anchor="end">([^<]+)</g)].map(m => m[1]);

const hGrid = svg => [...svg.matchAll(/<line x1="36" y1="[\d.]+" x2="352" y2="[\d.]+" stroke="#2a313a"/g)].length;

t("y-axis prints a value label per gridline", () => {
  const texts = yLabels(shared.svg);
  assert.strictEqual(texts.length, hGrid(shared.svg), "labels and gridlines disagree");
  texts.forEach(x => assert.ok(/^[\d.]+[kmb]?$/.test(x), "not a number: " + x));
});
const num = t => {
  const m = /^([\d.]+)([kmb]?)$/.exec(t);
  return Number(m[1]) * ({ "": 1, k: 1e3, m: 1e6, b: 1e9 })[m[2]];
};

t("the axis top is tight — no empty gridline floating above the data", () => {
  // niceStep rounds the step up, so a lazy line count leaves a whole blank band
  // over the highest point and squashes every line into the lower half.
  [[365, 4351], [1461, 2742], [30, 91], [90, 1e6]].forEach(([days, gain]) => {
    const c = mk({str:1000,def:1000,spe:1000,dex:1000}, hist5, {str:gain,def:0,spe:0,dex:0})(days);
    const texts = yLabels(c.svg);
    const hi = 1000 + days * gain;
    assert.ok(texts.length >= 4 && texts.length <= 6, days + "d: " + texts.length + " gridlines");
    assert.ok(num(texts[0]) >= hi, days + "d: top " + texts[0] + " below data max " + hi);
    assert.ok(num(texts[1]) < hi, days + "d: wasted a whole step — " + JSON.stringify(texts) + " for max " + hi);
    assert.strictEqual(texts[texts.length - 1], "0");
  });
});
t("y-axis is anchored at zero", () => {
  const texts = yLabels(shared.svg);
  assert.strictEqual(texts[texts.length - 1], "0", "bottom label should be 0, got " + texts[texts.length-1]);
});
t("y-axis top label covers the largest plotted value", () => {
  const top = yLabels(shared.svg)[0];
  assert.strictEqual(top, "2m", "top label must be >= dex's 1.73m and round, got " + top);
});
t("gridline values are round, not the raw max divided by four", () => {
  const texts = yLabels(shared.svg);
  assert.deepStrictEqual(texts, ["2m", "1.5m", "1m", "500k", "0"], "got " + JSON.stringify(texts));
});
t("ranges past 90d label by year, so two seasons apart cannot collide", () => {
  const bottom = xLabels(shared.svg);
  const dated = bottom.filter(x => x !== "now");
  dated.forEach(x => assert.ok(/^[A-Z][a-z]{2} '\d{2}$/.test(x), "expected month+year at 365d, got " + x));
  assert.strictEqual(new Set(dated).size, dated.length, "duplicate x labels: " + dated);
});
t("ranges of 90d or less label by day of month", () => {
  const c = mk({str:948,def:357,spe:1042,dex:1674}, hist5, {str:4351,def:3120,spe:0,dex:4737})(30);
  const bottom = xLabels(c.svg).filter(x => x !== "now");
  bottom.forEach(x => assert.ok(/^[A-Z][a-z]{2} \d{1,2}$/.test(x), "expected month+day at 30d, got " + x));
});
t("an untrainable stat draws flat on the floor rather than vanishing", () => {
  // spe gains 0/day in this fixture — the reference chart shows exactly this.
  const m = shared.svg.match(/<path d="([^"]+)" fill="none" stroke="#e85f8a" stroke-width="1.4"/);
  assert.ok(m, "speed projection line missing entirely");
  const ys = [...m[1].matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(x => Number(x[2]));
  const floor = 176 - 30;
  assert.ok(ys.every(y => Math.abs(y - floor) < 1.5), "speed should hug the zero line, got " + ys.join(","));
  assert.ok(new Set(ys).size === 1, "a zero-gain stat must be flat, got " + ys.join(","));
});
t("x-axis prints dated labels plus now", () => {
  const bottom = xLabels(shared.svg);
  assert.ok(bottom.includes("now"), "no now label: " + bottom);
  const dated = bottom.filter(x => /^[A-Z][a-z]{2} ('?\d+)$/.test(x));
  assert.ok(dated.length >= 3, "expected >=3 date labels, got " + JSON.stringify(dated));
});
t("x labels never collide (>=40 units apart)", () => {
  const xs = [...shared.svg.matchAll(/<text x="([\d.]+)" y="159"/g)].map(m => Number(m[1])).sort((a,b)=>a-b);
  assert.ok(xs.length >= 4, "selector matched " + xs.length + " labels — the test would pass on nothing");
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i-1] >= 40, "labels at " + xs[i-1] + " and " + xs[i]);
});
t("grid is drawn", () => {
  const lines = [...shared.svg.matchAll(/stroke="#2a313a"/g)].length;
  assert.ok(lines >= 8, "expected grid lines, got " + lines);
});
t("legend names all four stats with a number each", () => {
  ["STR","DEF","SPE","DEX"].forEach(k => assert.ok(shared.legend.includes(k), "legend missing " + k));
  assert.ok((shared.legend.match(/<b>/g) || []).length === 4, "expected 4 legend values");
});
t("every series ends in a dot", () => {
  assert.strictEqual([...shared.svg.matchAll(/<circle /g)].length, 4);
});
t("svg no longer distorts text with preserveAspectRatio=none", () => {
  assert.ok(!/preserveAspectRatio="none"/.test(shared.svg));
});

// ---- lopsided case: per-stat scaling, where a shared y axis would lie ----
const lop = mk({str:144000000,def:900000,spe:146000,dex:12000}, hist5, {str:5e5,def:3e3,spe:900,dex:80})(365);
t("lopsided stats keep one axis and still print numbers", () => {
  const texts = yLabels(lop.svg);
  assert.strictEqual(texts.length, 5, "lost the y axis on lopsided stats: " + JSON.stringify(texts));
  assert.strictEqual(texts[texts.length - 1], "0");
});
t("lopsided stats each get their real figure in the legend", () => {
  assert.strictEqual((lop.legend.match(/<b>/g) || []).length, 4);
  assert.ok(/41k|12k/.test(lop.legend), "dex figure missing from legend: " + lop.legend);
});

// ---- short range and no-history edges ----
const oneDay = mk({str:948,def:357,spe:1042,dex:1674}, hist5, {str:4351,def:3120,spe:0,dex:4737})(1);
t("1d range still labels its axes", () => {
  assert.ok(oneDay.svg.includes(">now<"));
  assert.ok(/[A-Z][a-z]{2} \d+/.test(oneDay.svg), "no date label at 1d");
});
const none = mk({str:948,def:357,spe:1042,dex:1674}, [], {str:4351,def:3120,spe:0,dex:4737})(30);
t("no history: no solid path, projection and axes still drawn", () => {
  assert.strictEqual(none.empty, true);
  assert.ok(!/stroke-width="1.6"/.test(none.svg), "drew a solid path with no history");
  assert.ok(none.svg.includes(">now<"));
  assert.ok(none.legend.includes("STR"));
});
t("dates are read back in UTC, so they match the calendar west of UTC", () => {
  // dayKey counts UTC days; local getters render UTC midnight as the day before
  // in every western timezone. This asserts the exact string, not the shape.
  const c = mk({str:948,def:357,spe:1042,dex:1674}, hist5, {str:4351,def:3120,spe:0,dex:4737})(30);
  const start = xLabels(c.svg)[0];
  const expect = new Date((today - 4) * 86400000)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  assert.strictEqual(start, expect, "recorded start label drifted off the UTC day it came from");
});
t("the year label survives a year boundary west of UTC", () => {
  // UTC midnight Jan 1 is Dec 31, 8pm in New York — a local getter reports the
  // wrong YEAR here, which the day-format test above cannot see.
  const fmtDay = new Function("var DAY_MS=86400000;" + grab("fmtDay") + "; return fmtDay;")();
  assert.strictEqual(fmtDay(Date.UTC(2027, 0, 1) / 86400000, true), "Jan '27");
  assert.strictEqual(fmtDay(Date.UTC(2027, 0, 1) / 86400000, false), "Jan 1");
  assert.strictEqual(fmtDay(Date.UTC(2026, 11, 31) / 86400000, true), "Dec '26");
});
t("fmtAxis is compact and correct", () => {
  const f = mk({str:1,def:1,spe:1,dex:1}, [], {str:0,def:0,spe:0,dex:0});
  // reach fmtAxis through the legend of a known projection
  const g = mk({str:1234567890,def:45600000,spe:12400,dex:850}, [], {str:0,def:0,spe:0,dex:0})(30);
  ["1.2b","46m","12k","850"].forEach(x => assert.ok(g.legend.includes(x), "missing " + x + " in " + g.legend));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
