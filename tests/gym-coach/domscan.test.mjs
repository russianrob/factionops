import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}

// rowQty against the shapes Torn is likely to render
const qty = html => new Function("var RESULT;" + `
  var row = { textContent: ${JSON.stringify(html.text)},
              querySelector: function(){ return ${html.qtyEl ? JSON.stringify({textContent: html.qtyEl}) : "null"}; } };
  ${grab("rowQty")}
  RESULT = rowQty(row);` + "; return RESULT;")();

const fresh = (domAt, invAt, id, apiQty, map) => new Function("var RESULT;" + `
  var state = { invDom: ${JSON.stringify({ at: domAt, qty: map })}, invAt: ${invAt} };
  ${grab("domFresher")} ${grab("freshQty")}
  RESULT = freshQty(${id}, ${apiQty});` + "; return RESULT;")();

// The whole drink-list build: API rows corrected by the scrape, PLUS any can the
// scrape saw that the API has not caught up with yet.
const drinkList = (apiDrinks, domQty, domAt, invAt) => new Function("var RESULT;" + `
  var CAN_TYPES = ${JSON.stringify([
    { k:"munster", ids:[530], label:"Can of Munster", e:20 },
    { k:"redcow",  ids:[532], label:"Can of Red Cow", e:25 },
    { k:"tourine", ids:[533], label:"Can of Taurine Elite", e:30 },
    { k:"goose",   ids:[985], label:"Can of Goose Juice", e:5 }
  ])};
  var state = { invDom: ${JSON.stringify({ at: domAt, qty: domQty })}, invAt: ${invAt},
                canMult: 1, calEvents: [] };
  function caffeineOn(){ return false; }
  function canEnergy(t){ return t && t.e ? t.e : 0; }
  function canType(name, id){
    for (var i=0;i<CAN_TYPES.length;i++){
      if (id && CAN_TYPES[i].ids.indexOf(Number(id)) !== -1) return CAN_TYPES[i];
      if (name && CAN_TYPES[i].label === name) return CAN_TYPES[i];
    }
    return null;
  }
  function drinkEnergy(name, id){ var t = canType(name, id); return t ? t.e : 0; }
  var drinks = ${JSON.stringify(apiDrinks)};
  ${grab("domFresher")} ${grab("freshQty")} ${grab("adoptScrapedCans")}
  drinks.forEach(function (d) { d.qty = freshQty(d.id, d.qty); });
  adoptScrapedCans(drinks);
  RESULT = { raw: drinks.slice(),
             list: drinks.filter(function (d) { return d.qty > 0; })
                         .sort(function (a,b){ return (b.e||0)-(a.e||0) || b.qty-a.qty; }) };` + "; return RESULT;")();

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("reads the count from a quantity element", () => {
  assert.strictEqual(qty({ text: "Can of Red Cow x21", qtyEl: "x21" }), 21);
  assert.strictEqual(qty({ text: "whatever", qtyEl: "1,204" }), 1204);
});
t("falls back to the xN Torn prints beside the name", () => {
  assert.strictEqual(qty({ text: "Can of Rockstar Rudolph x21 Energy Drink" }), 21);
  assert.strictEqual(qty({ text: "Xanax x1,204" }), 1204);
});
t("a row with no count at all yields null, not a wrong number", () => {
  assert.strictEqual(qty({ text: "Can of Munster" }), null);
  assert.strictEqual(qty({ text: "" }), null);
});
t("a scraped count wins while it is newer than the API reading", () => {
  assert.strictEqual(fresh(2000, 1000, 532, 21, { 532: 18 }), 18, "should use the scraped 18");
});
t("the API takes over once it catches up", () => {
  assert.strictEqual(fresh(1000, 2000, 532, 18, { 532: 21 }), 18, "stale scrape should not win");
});
t("an item that was not on the page keeps its API count", () => {
  assert.strictEqual(fresh(2000, 1000, 999, 7, { 532: 18 }), 7);
});
t("no scan yet means nothing changes", () => {
  const out = new Function("var RESULT;" + `
    var state = { invDom: null, invAt: 1000 };
    ${grab("domFresher")} ${grab("freshQty")}
    RESULT = freshQty(532, 21);` + "; return RESULT;")();
  assert.strictEqual(out, 21);
});
t("a count of zero is honoured — you drank the last one", () => {
  assert.strictEqual(fresh(2000, 1000, 532, 21, { 532: 0 }), 0,
    "zero must not be treated as missing");
});
t("a can bought since the last API read is picked up from the item page", () => {
  // The reported case: owned 30 Rudolph, bought Taurine Elite. The API inventory
  // is minutes stale so it has NO row for Taurine at all — and freshQty can only
  // correct rows that already exist, so the scrape could never introduce it.
  const out = drinkList(
    [{ id: 554, name: "Can of Rockstar Rudolph", qty: 30, e: 25 }],
    { 554: 30, 533: 5 },      // the item page shows both
    2000, 1000);              // scrape newer than the API read
  const names = out.list.map(d => d.name);
  assert.ok(names.includes("Can of Taurine Elite"), "lost the new can: " + JSON.stringify(names));
  assert.strictEqual(out.list.find(d => d.id === 533).qty, 5);
});

t("it does not duplicate a can the API already returned", () => {
  const out = drinkList(
    [{ id: 533, name: "Can of Taurine Elite", qty: 2, e: 30 }],
    { 533: 9 }, 2000, 1000);
  assert.strictEqual(out.list.length, 1, JSON.stringify(out.list));
  assert.strictEqual(out.list[0].qty, 9, "the scrape corrects the count it already had");
});

t("a stale scrape adds nothing, so the API stays authoritative once it catches up", () => {
  const out = drinkList(
    [{ id: 554, name: "Can of Rockstar Rudolph", qty: 30, e: 25 }],
    { 533: 5 }, 1000, 2000);          // API read NEWER than the scrape
  assert.deepStrictEqual(out.list.map(d => d.id), [554]);
});

t("a can the item page shows as zero is not invented", () => {
  const out = drinkList([], { 533: 0 }, 2000, 1000);
  assert.deepStrictEqual(out.list, []);
  // checked on the RAW array: a later `qty > 0` filter would hide a zero row
  // that was pushed anyway, so the guard would be untested through the list
  assert.deepStrictEqual(out.raw, [], "a zero count must never be pushed at all");
});

t("only cans are adopted — the scrape sees the whole item page", () => {
  // 206 is Xanax. It has a count on the page and must not arrive in the drink list.
  const out = drinkList([], { 206: 40, 533: 3 }, 2000, 1000);
  assert.deepStrictEqual(out.list.map(d => d.id), [533]);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
