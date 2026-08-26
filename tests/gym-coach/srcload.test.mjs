import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
// the restore block, lifted from boot() and run against a saved object
const i = src.indexOf('if (sv && typeof sv === "object") {');
const j = src.indexOf("\n      }", i) + 8;
const block = src.slice(i, j);

const restore = saved => new Function("var RESULT;" + `
  var state = { src: {} };
  var sv = ${JSON.stringify(saved)};
  ${block}
  RESULT = state.src;` + "; return RESULT;")();

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("a saved source is restored even if it was added after the code that loads it", () => {
  assert.strictEqual(restore({ mcs: 2 }).mcs, 2, "Mc Smoogle Corp was dropped on load");
});
t("the familiar sources still restore", () => {
  const r = restore({ xan: 3, refill: 1, fhc: 1, munster: 2, redcow: 4, tourine: 8 });
  assert.deepStrictEqual(r, { xan:3, refill:1, fhc:1, munster:2, redcow:4, tourine:8 });
});
t("the old generic can count migrates to Red Cow", () => {
  assert.strictEqual(restore({ cans: 6 }).redcow, 6);
  assert.strictEqual(restore({ cans: 6 }).cans, undefined, "the old key should not linger");
});
t("an explicit Red Cow count wins over the legacy one", () => {
  assert.strictEqual(restore({ cans: 6, redcow: 2 }).redcow, 2);
});
t("zero and junk are dropped rather than stored", () => {
  const r = restore({ xan: 0, mcs: "two", refill: null, fhc: NaN });
  assert.deepStrictEqual(r, {});
});
t("nothing saved gives nothing back", () => {
  assert.deepStrictEqual(restore({}), {});
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
