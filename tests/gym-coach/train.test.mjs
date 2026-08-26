import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){const m=new RegExp("var "+n+" = (\\{[^}]*\\});").exec(src);return "var "+n+" = "+m[1]+";";}

const run = (pending, after) => new Function("var RESULT;" + `
  var logged = [];
  var GAIN_WAIT_MS = 50000;
  function refresh(){ return { then: function(){ return this; } }; }
  var state = { open: false, energy: ${after.energy}, stats: ${JSON.stringify(after.stats)} };
  function fmt(n){ return Math.round(n).toLocaleString("en-US"); }
  function pushLog(t){ logged.push(t); }
  function renderPanel(){}
  ${grab("inferTrainSkillFromDelta")}
  ${grabVar("STAT_KEY")}
  var pendingTrain = ${JSON.stringify(pending)};
  ${grab("finaliseTrain")}
  finaliseTrain(true);
  RESULT = logged;` + "; return RESULT;")();

const S = (str,def,spe,dex) => ({ str, def, spe, dex });
let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("logs what the session COST, not what is left in the bar", () => {
  const out = run({ skill:"Speed", preE:150, preStats:S(1,1,259461019,1), gym:"Frontline Fitness" },
                  { energy:0, stats:S(1,1,259462144,1) });
  assert.strictEqual(out.length, 1);
  assert.ok(/150e spent/.test(out[0]), out[0]);
  assert.ok(!/·\s*0e/.test(out[0]), "logged the remaining balance: " + out[0]);
});
t("includes the stat actually gained", () => {
  const out = run({ skill:"Speed", preE:150, preStats:S(1,1,1000,1), gym:"g" },
                  { energy:0, stats:S(1,1,2125,1) });
  assert.ok(/\+1,125/.test(out[0]), out[0]);
});
t("a click that trained nothing writes no line at all", () => {
  // this is the '0e' entry from the report: clicked with an empty bar
  const out = run({ skill:"Speed", preE:5, preStats:S(1,1,1000,1), gym:"g" },
                  { energy:5, stats:S(1,1,1000,1) });
  assert.deepStrictEqual(out, [], "logged a no-op train: " + out[0]);
});
t("names the stat from the gain when the page did not say", () => {
  // this is the 'Trained 5e' entry with no stat name
  const out = run({ skill:"", preE:25, preStats:S(1,1,1000,1), gym:"g" },
                  { energy:0, stats:S(1,1,1188,1) });
  assert.ok(/Trained Speed/.test(out[0]), out[0]);
});
t("falls back to no stat name rather than printing a question mark", () => {
  const out = run({ skill:"", preE:25, preStats:S(1,1,1000,1), gym:"g" },
                  { energy:0, stats:S(1,1,1000,1) });
  assert.ok(/^Trained · 25e spent/.test(out[0]), out[0]);
  assert.ok(!/\?/.test(out[0]), out[0]);
});
t("a partial spend is reported as the part spent", () => {
  const out = run({ skill:"Strength", preE:150, preStats:S(1000,1,1,1), gym:"g" },
                  { energy:100, stats:S(1375,1,1,1) });
  assert.ok(/50e spent/.test(out[0]), out[0]);
});
t("energy gained mid-window never reports a negative spend", () => {
  const out = run({ skill:"Strength", preE:20, preStats:S(1000,1,1,1), gym:"g" },
                  { energy:270, stats:S(1375,1,1,1) });   // a xanax landed
  assert.ok(/0e spent/.test(out[0]) && /\+375/.test(out[0]), out[0]);
});
t("finalising twice does not double-log", () => {
  const out = new Function("var RESULT;" + `
    var logged=[]; var state={open:false,energy:0,stats:${JSON.stringify(S(1,1,2125,1))}};
    function fmt(n){return String(n);} function pushLog(t){logged.push(t);} function renderPanel(){}
    ${grab("inferTrainSkillFromDelta")} ${grabVar("STAT_KEY")}
    var pendingTrain={skill:"Speed",preE:150,preStats:${JSON.stringify(S(1,1,1000,1))},gym:"g"};
    ${grab("finaliseTrain")}
    finaliseTrain(true); finaliseTrain(); finaliseTrain();
    RESULT=logged;` + "; return RESULT;")();
  assert.strictEqual(out.length, 1, "logged " + out.length + " times");
});
// Grabbed from the source, NOT reimplemented — the first version of these
// tests inlined the rule and every mutation passed.
const pollTrainEntry = new Function("var RESULT;" + `
  function fmt(n){ return Math.round(n).toLocaleString("en-US"); }
  ${grab("inferTrainSkillFromDelta")}
  ${grabVar("STAT_KEY")}
  ${grab("pollTrainEntry")}
  RESULT = pollTrainEntry;` + "; return RESULT;")();
const pollLog = (prevE, nowE, prevStats, nowStats, pending) => {
  const line = pollTrainEntry(prevE, nowE, prevStats, nowStats, "George's", pending);
  return line ? [line] : [];
};

t("a stale poll reading a few points low is NOT logged as a train", () => {
  // the reported bug: page said 155, API says 150, nothing was trained
  const out = pollLog(155, 150, S(614884840,1,1,1), S(614884840,1,1,1), false);
  assert.deepStrictEqual(out, [], "invented a train: " + out[0]);
});
t("a real train the click handler missed is still logged", () => {
  const out = pollLog(150, 0, S(614884840,1,1,1), S(614885940,1,1,1), false);
  assert.strictEqual(out.length, 1);
  assert.ok(/150e spent/.test(out[0]) && /\+1,100/.test(out[0]), out[0]);
});
t("the gain is the stat that moved, not the total of all four", () => {
  // dex jumps because the API caught up; strength is what was trained
  const out = pollLog(150, 0, S(1000,1,1,1), S(2000,1,1,1685994823), false);
  assert.ok(/Dexterity/.test(out[0]), "should attribute to the stat that moved most: " + out[0]);
  assert.ok(!/\+1,685,995,823/.test(out[0]), "summed unrelated stats: " + out[0]);
});
t("it stands down while a click-driven train is being measured", () => {
  const out = pollLog(150, 0, S(1000,1,1,1), S(2000,1,1,1), true);
  assert.deepStrictEqual(out, [], "double-logged alongside the click handler");
});
t("a drop of 4 or less is ignored either way", () => {
  assert.deepStrictEqual(pollLog(150, 147, S(1000,1,1,1), S(1400,1,1,1), false), []);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
