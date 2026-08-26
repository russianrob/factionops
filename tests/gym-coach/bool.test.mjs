import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
const mk = store => new Function("var RESULT;" +
  `var S = ${JSON.stringify(store)};
   function storeGet(k, f){ return (k in S) ? S[k] : f; }
   ${grab("storeBool")}
   RESULT = storeBool;` + "; return RESULT;")();

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("PDA's string \"false\" reads as false, not true", () => {
  assert.strictEqual(mk({ warStack: "false" })("warStack", false), false,
    "this is the bug: it switched itself on every reload");
});
t("string \"true\" reads as true", () => assert.strictEqual(mk({ warStack: "true" })("warStack", false), true));
t("real booleans still work", () => {
  assert.strictEqual(mk({ a: true })("a", false), true);
  assert.strictEqual(mk({ a: false })("a", true), false);
});
t("numeric storage works", () => {
  assert.strictEqual(mk({ a: 0 })("a", true), false);
  assert.strictEqual(mk({ a: 1 })("a", false), true);
});
t("\"0\" / \"1\" / \"on\" / \"off\" / empty all behave", () => {
  const f = k => mk({ a: k })("a", false);
  [["0",false],["1",true],["on",true],["off",false],["",false],["  TRUE ",true]]
    .forEach(([v,want]) => assert.strictEqual(f(v), want, JSON.stringify(v)));
});
t("an unset key falls back to the default", () => {
  assert.strictEqual(mk({})("nope", false), false);
  assert.strictEqual(mk({})("nope", true), true);
});
t("junk falls back rather than turning things on", () => {
  assert.strictEqual(mk({ a: {} })("a", false), false);
  assert.strictEqual(mk({ a: "banana" })("a", false), false);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
