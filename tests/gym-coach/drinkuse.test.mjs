// Using a can from the panel has to move the number on the panel.
//
// Reported: "used x amount of cans but the number stayed the same until I
// refreshed". The machinery for this already existed and its own comment says
// what it is for -- Torn caches the inventory for ~30s, so a use is recorded as
// PENDING and re-applied to every fetch until the API catches up. It adjusted
// state.items and the happy-item list. It never adjusted state.drinkList, which
// is what the cans rows, the heading total above them, and cansOnHand() all
// read from.
import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}

const APPLY = grab("applyPendingUses");
// The expiry lives as a literal inside the function; read it rather than
// restating it, or this suite agrees with itself after the source moves on.
const EXPIRY_MS = Number(APPLY.match(/now - p\.at > (\d+)/)[1]);

const apply = st => new Function("state", "var R;" + APPLY + "\napplyPendingUses();\nR = state;\nreturn R;")(st);

// Real clock: applyPendingUses expires anything older than its own window, so a
// hardcoded past timestamp makes every fixture expire before it is read.
const CAN = 530, OTHER = 531, NOW = Date.now();
function stateWith(over) {
  return Object.assign({
    pendingUse: {},
    rawQty: { cans: 21 },
    items: { cans: 21 },
    happyList: [],
    rawHappy: {},
    drinkList: [{ id: CAN, name: "Energy Drink", qty: 21 }],
    rawDrinks: { [CAN]: 21 },
  }, over);
}
const pend = (id, n, at) => ({ [id]: { key: "cans", n: n, at: at === undefined ? NOW : at } });

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); }
                      catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("using a can lowers the row you pressed", () => {
  const st = apply(stateWith({ pendingUse: pend(CAN, 1) }));
  assert.strictEqual(st.drinkList[0].qty, 20);
});

t("two uses subtract two", () => {
  const st = apply(stateWith({ pendingUse: pend(CAN, 2) }));
  assert.strictEqual(st.drinkList[0].qty, 19);
});

t("the row is subtracted from the pre-use count, not from itself", () => {
  // Re-applying on every fetch is the point, so the baseline has to be the
  // quantity the API last reported. Subtracting from the row's own current
  // value would compound one use into many.
  const st = stateWith({ pendingUse: pend(CAN, 1) });
  apply(st); apply(st); apply(st);
  assert.strictEqual(st.drinkList[0].qty, 20);
});

t("it never goes below zero", () => {
  const st = apply(stateWith({ pendingUse: pend(CAN, 99) }));
  assert.strictEqual(st.drinkList[0].qty, 0);
});

t("a can with no recorded baseline is left alone rather than guessed at", () => {
  const st = apply(stateWith({ pendingUse: pend(CAN, 1), rawDrinks: {} }));
  assert.strictEqual(st.drinkList[0].qty, 21);
});

t("using one item does not move a different one", () => {
  const st = apply(stateWith({
    pendingUse: pend(OTHER, 3),
    drinkList: [{ id: CAN, name: "Energy Drink", qty: 21 },
                { id: OTHER, name: "Feathery Hotel Coupon", qty: 8 }],
    rawDrinks: { [CAN]: 21, [OTHER]: 8 },
  }));
  assert.strictEqual(st.drinkList[0].qty, 21);
  assert.strictEqual(st.drinkList[1].qty, 5);
});

t("the aggregate count moves with the row", () => {
  // The heading総 and the advice read different stores; both have to agree or
  // the tab contradicts itself.
  const st = apply(stateWith({ pendingUse: pend(CAN, 1) }));
  assert.strictEqual(st.items.cans, 20);
  assert.strictEqual(st.drinkList[0].qty, 20);
});

t("a pending use that Torn never acknowledged expires, and the row comes back", () => {
  const st = apply(stateWith({ pendingUse: pend(CAN, 1, Date.now() - EXPIRY_MS - 1000) }));
  assert.strictEqual(st.drinkList[0].qty, 21, "held a use the API never confirmed");
  assert.deepStrictEqual(Object.keys(st.pendingUse), []);
});

t("no pending uses at all leaves everything untouched", () => {
  const st = apply(stateWith({}));
  assert.strictEqual(st.drinkList[0].qty, 21);
  assert.strictEqual(st.items.cans, 21);
});

t("an empty drink list is not a crash", () => {
  const st = apply(stateWith({ pendingUse: pend(CAN, 1), drinkList: [], rawDrinks: {} }));
  assert.strictEqual(st.drinkList.length, 0);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
