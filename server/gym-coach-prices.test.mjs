import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Gym Coach Beta's item prices come from Torn and nowhere else. Until 0.12.15
// the first choice was weav3r.dev, a third-party mirror that also carried
// bazaar listings; Torn's own API exposes no bazaar prices, so dropping the
// mirror costs a few percent of accuracy on a figure that only feeds a ranking,
// and buys a script whose only outbound host is api.torn.com.
const DIR = '/opt/warboard/server/public/scripts/';
const BETA = readFileSync(DIR + 'gym-coach-beta.user.js', 'utf8');
const head = BETA.slice(0, BETA.indexOf('==/UserScript=='));

function fn(name) {
  const start = BETA.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `the script carries ${name}`);
  let i = BETA.indexOf('{', start), depth = 0;
  for (; i < BETA.length; i++) {
    if (BETA[i] === '{') depth++;
    else if (BETA[i] === '}' && --depth === 0) break;
  }
  return BETA.slice(start, i + 1);
}

test('the only outbound host is api.torn.com: no weav3r.dev anywhere, header included', () => {
  assert.doesNotMatch(head, /@connect\s+weav3r\.dev/);
  assert.equal(BETA.includes('weav3r'), false, 'no reference to the mirror remains');
});

test('prices are fetched from Torn v2 item market, with the key the script already holds', () => {
  const src = fn('fetchPrice');
  assert.match(src, /api\.torn\.com\/v2\/market\/.*itemmarket/);
  assert.match(src, /resolveKey\(\)/);
  assert.doesNotMatch(src, /weav3r|bazaar/);
});

test('the market parser takes the cheapest listing from the v2 item-market shape', () => {
  const parseTornMarket = new Function(`${fn('parseTornMarket')}; return parseTornMarket;`)();
  // Shape observed 2026-10-18 for Xanax (206): cheapest first, but do not rely on order.
  const v2 = { itemmarket: { item: { id: 206, name: 'Xanax' }, listings: [
    { id: 1, price: 897994, amount: 3 }, { id: 2, price: 896000, amount: 1 }, { id: 3, price: 898000, amount: 2 } ] } };
  assert.equal(parseTornMarket(v2), 896000);
  assert.equal(parseTornMarket({ itemmarket: { item: { id: 206 }, listings: [] } }), 0, 'no listings is no price, never free');
});

test('no changelog and no credit comment: the body starts right after the header', () => {
  assert.equal(BETA.includes('CHANGELOG'), false);
  assert.equal(BETA.includes('free for everyone (MIT)'), false);
  const afterHeader = BETA.slice(BETA.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length).trimStart();
  assert.doesNotMatch(afterHeader, /^\/\*/, 'no block comment opens the body');
});
