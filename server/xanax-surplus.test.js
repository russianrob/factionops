// Keeping gross and deposited apart is what makes a return bigger than its own
// war's takes survive. The old code computed the net in place, so that surplus
// was destroyed before it was ever stored.
import test from "node:test";
import assert from "node:assert/strict";
import { surplus } from "./xanax-tracker.js";
import * as xm from "./xanax-model.js";

const S = (gross, deposited) => ({ gross, deposited });

test("no surplus when takes cover the return", () => {
  assert.equal(surplus(S({ a: 4 }, { a: 3 }), "a"), 0);
  assert.equal(surplus(S({ a: 4 }, { a: 4 }), "a"), 0);
});

test("the overflow beyond this war's takes is the surplus", () => {
  // Silent Bullet: took 2 in the Asgard war, handed back 8.
  assert.equal(surplus(S({ a: 2 }, { a: 8 }), "a"), 6);
});

test("a pure donor carries their whole deposit", () => {
  assert.equal(surplus(S({}, { a: 5 }), "a"), 5);
});

test("wars frozen before the split carry nothing back", () => {
  // No gross/deposited maps at all -- must be 0, never a guess.
  assert.equal(surplus({ taken: { a: 9 } }, "a"), 0);
  assert.equal(surplus(null, "a"), 0);
  assert.equal(surplus({}, "a"), 0);
});

test("carry-back settles older wars newest-first and stops when spent", () => {
  // Four wars, oldest->newest, two vials taken in each; 8 returned in the last.
  const wars = [
    { gross: { a: 2 }, deposited: {},        ta: 0 },
    { gross: { a: 2 }, deposited: {},        ta: 0 },
    { gross: { a: 2 }, deposited: {},        ta: 1 },
    { gross: { a: 2 }, deposited: { a: 8 },  ta: 0 },
  ];
  let credit = 0; const charged = [];
  for (let i = wars.length - 1; i >= 0; i--) {
    credit += surplus(wars[i], "a");
    let x = Math.max(0, (wars[i].gross.a || 0) - (wars[i].deposited.a || 0));
    const paid = Math.min(credit, x);
    credit -= paid; x -= paid;
    charged.unshift(x);
  }
  assert.deepEqual(charged, [0, 0, 0, 0], "all four wars settle");
  assert.equal(credit, 0, "the 8 vials are exactly consumed");
  assert.equal(charged.reduce((t, x, i) => t + xm.deficit(x, wars[i].ta), 0), 0);
});

test("a partial return settles only what it covers, newest first", () => {
  const wars = [
    { gross: { a: 2 }, deposited: {},       ta: 0 },
    { gross: { a: 2 }, deposited: {},       ta: 0 },
    { gross: { a: 0 }, deposited: { a: 3 }, ta: 0 },
  ];
  let credit = 0; const charged = [];
  for (let i = wars.length - 1; i >= 0; i--) {
    credit += surplus(wars[i], "a");
    let x = Math.max(0, (wars[i].gross.a || 0) - (wars[i].deposited.a || 0));
    const paid = Math.min(credit, x);
    credit -= paid; x -= paid;
    charged.unshift(x);
  }
  // 3 returned: clears the newest debt of 2, leaves 1 against the oldest.
  assert.deepEqual(charged, [1, 0, 0]);
  assert.equal(credit, 0);
});
