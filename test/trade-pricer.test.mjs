// Verification for RW Pricer trade-pricing pure helpers.
// Keep these function bodies byte-identical to the copies inside
// torn-rw-pricer.user.js (injectTradePrices block). DOM wiring is verified
// on-device; this covers the parse/lookup/tier/sum logic.
import assert from 'node:assert/strict';
import test from 'node:test';

// ── helpers under test (canonical source — mirrored into the userscript) ──
function parseTradeLine(text) {
  var t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return { kind: 'empty' };
  if (/^No .* in trade$/i.test(t)) return { kind: 'empty' };
  var m = t.match(/^\$([\d,]+)\s+in trade$/i);
  if (m) return { kind: 'money', amount: Number(m[1].replace(/,/g, '')) };
  var im = t.match(/^(.*?)\s+x([\d,]+)$/);
  if (im) return { kind: 'item', name: im[1].trim(), qty: Number(im[2].replace(/,/g, '')) };
  return { kind: 'item', name: t, qty: 1 };
}
function extractItemId(href) {
  if (!href) return null;
  var m = String(href).match(/itemID=(\d+)/i);
  return m ? Number(m[1]) : null;
}
function lineValue(line, maps) {
  if (!line) return 0;
  if (line.kind === 'money') return line.amount > 0 ? line.amount : 0;
  if (line.kind !== 'item') return 0;
  var unit = 0;
  if (line.itemId != null && maps && maps.byId && maps.byId[line.itemId] > 0) unit = maps.byId[line.itemId];
  else if (line.name && maps && maps.byName) {
    var k = String(line.name).toLowerCase().trim();
    if (maps.byName[k] > 0) unit = maps.byName[k];
  }
  if (!(unit > 0)) return 0;
  return unit * (line.qty > 0 ? line.qty : 1);
}
function valueTier(value, maxValue) {
  if (!(value > 0) || !(maxValue > 0)) return 'none';
  var r = value / maxValue;
  if (r >= 0.6) return 'green';
  if (r >= 0.2) return 'amber';
  return 'red';
}
function sumSide(values) {
  var s = 0;
  for (var i = 0; i < values.length; i++) s += (values[i] > 0 ? values[i] : 0);
  return s;
}

// ── parseTradeLine ──
test('parseTradeLine: item with qty', () => {
  assert.deepEqual(parseTradeLine('Can of Taurine Elite x400'), { kind: 'item', name: 'Can of Taurine Elite', qty: 400 });
});
test('parseTradeLine: item with comma qty', () => {
  assert.deepEqual(parseTradeLine('Xanax x1,250'), { kind: 'item', name: 'Xanax', qty: 1250 });
});
test('parseTradeLine: item with x in the name keeps last xNN as qty', () => {
  assert.deepEqual(parseTradeLine('Box of Extra Strong Tissues x3'), { kind: 'item', name: 'Box of Extra Strong Tissues', qty: 3 });
});
test('parseTradeLine: bare item (no qty) → qty 1', () => {
  assert.deepEqual(parseTradeLine('Lawber Painting'), { kind: 'item', name: 'Lawber Painting', qty: 1 });
});
test('parseTradeLine: money', () => {
  assert.deepEqual(parseTradeLine('$8,085,346 in trade'), { kind: 'money', amount: 8085346 });
});
test('parseTradeLine: placeholders → empty', () => {
  assert.equal(parseTradeLine('No money in trade').kind, 'empty');
  assert.equal(parseTradeLine('No properties in trade').kind, 'empty');
  assert.equal(parseTradeLine('No items in trade').kind, 'empty');
  assert.equal(parseTradeLine('').kind, 'empty');
  assert.equal(parseTradeLine('   ').kind, 'empty');
});

// ── extractItemId ──
test('extractItemId: from remove link', () => {
  assert.equal(extractItemId('trade.php#step=remove&itemID=533&armoryID=0&ID=12430892'), 533);
});
test('extractItemId: html-entity ampersands', () => {
  assert.equal(extractItemId('trade.php#step=remove&amp;itemID=206&amp;armoryID=0&amp;ID=1'), 206);
});
test('extractItemId: missing → null', () => {
  assert.equal(extractItemId('trade.php#step=add&ID=1'), null);
  assert.equal(extractItemId(''), null);
  assert.equal(extractItemId(null), null);
});

// ── lineValue ──
const MAPS = { byId: { 533: 1191, 206: 829000 }, byName: { 'can of taurine elite': 1191, 'edelweiss': 8355 } };
test('lineValue: item by id × qty', () => {
  assert.equal(lineValue({ kind: 'item', name: 'Can of Taurine Elite', qty: 400, itemId: 533 }, MAPS), 1191 * 400);
});
test('lineValue: item falls back to name when no id', () => {
  assert.equal(lineValue({ kind: 'item', name: 'Edelweiss', qty: 21, itemId: null }, MAPS), 8355 * 21);
});
test('lineValue: id takes precedence over name', () => {
  assert.equal(lineValue({ kind: 'item', name: 'Edelweiss', qty: 1, itemId: 206 }, MAPS), 829000);
});
test('lineValue: money is its own amount', () => {
  assert.equal(lineValue({ kind: 'money', amount: 8085346 }, MAPS), 8085346);
});
test('lineValue: unknown item → 0', () => {
  assert.equal(lineValue({ kind: 'item', name: 'Mystery Thing', qty: 5, itemId: 99999 }, MAPS), 0);
});
test('lineValue: empty/placeholder → 0', () => {
  assert.equal(lineValue({ kind: 'empty' }, MAPS), 0);
});

// ── valueTier (matches mockup: $3.14M green > $1.27M amber > $175k red) ──
test('valueTier: mockup ratios', () => {
  const max = 3142566;
  assert.equal(valueTier(3142566, max), 'green'); // 100%
  assert.equal(valueTier(1273125, max), 'amber'); // 40%
  assert.equal(valueTier(175455, max), 'red');    // 5.6%
});
test('valueTier: boundaries', () => {
  assert.equal(valueTier(60, 100), 'green'); // exactly 0.6
  assert.equal(valueTier(59, 100), 'amber');
  assert.equal(valueTier(20, 100), 'amber'); // exactly 0.2
  assert.equal(valueTier(19, 100), 'red');
});
test('valueTier: zero/no max → none', () => {
  assert.equal(valueTier(0, 100), 'none');
  assert.equal(valueTier(50, 0), 'none');
});

// ── sumSide ──
test('sumSide: sums positive, ignores 0/negatives', () => {
  assert.equal(sumSide([3142566, 1273125, 175455]), 4591146); // matches mockup total
  assert.equal(sumSide([100, 0, -5, 50]), 150);
  assert.equal(sumSide([]), 0);
});
