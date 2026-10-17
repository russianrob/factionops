import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// The CPR tooltip's per-checkpoint heatmap, as the served userscript builds
// it. The builder is pulled out of the source by name so the test runs the
// real thing: HTML in, HTML out, no page needed.
function extractFn(name) {
  const src = readFileSync(new URL('./public/scripts/oc-spawn-assistance.user.js', import.meta.url), 'utf8');
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `the userscript carries ${name}`);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return new Function(`${src.slice(start, i + 1)}; return ${name};`)();
}
const build = (...a) => extractFn('buildCheckpointHeatmap')(...a);
const dom = (html) => parseHTML(`<!doctype html><html><body>${html}</body></html>`).document;

// Shaped like the 2026-10-18 phone screenshot: No Reserve / Techie with
// five checkpoints, plus two single-checkpoint roles.
const SAMPLE = {
  'Smoke and Wing Mirrors::Hustler #2::C1': { pass: 1, fail: 0, rate: 100 },
  'No Reserve::Techie::C2': { pass: 5, fail: 1, rate: 83.3 },
  'No Reserve::Techie::C1': { pass: 3, fail: 3, rate: 50 },
  'No Reserve::Techie::C4': { pass: 4, fail: 0, rate: 100 },
  'No Reserve::Techie::C3': { pass: 3, fail: 3, rate: 50 },
  'No Reserve::Techie::C5': { pass: 0, fail: 1, rate: 0 },
  'Leave No Trace::Techie::C1': { pass: 0, fail: 1, rate: 0 },
};

test('nothing captured renders nothing', () => {
  assert.equal(build(undefined), '');
  assert.equal(build({}), '');
});

test('a cell is one line: rate and count are inline spans with no block children', () => {
  const doc = dom(build(SAMPLE));
  const cells = [...doc.querySelectorAll('td.oc-tt-heat-cell')];
  assert.equal(cells.length, 7);
  for (const td of cells) {
    assert.equal(td.querySelector('div'), null, 'no block element inside a cell');
    assert.ok(td.querySelector('span.r'), 'rate span');
    assert.ok(td.querySelector('span.s'), 'count span');
  }
});

test('checkpoints run in order across the row, with rate and pass/total', () => {
  const doc = dom(build(SAMPLE));
  const row = [...doc.querySelectorAll('tr')].find(tr => tr.textContent.includes('No Reserve'));
  const rates  = [...row.querySelectorAll('td.oc-tt-heat-cell span.r')].map(s => s.textContent);
  const counts = [...row.querySelectorAll('td.oc-tt-heat-cell span.s')].map(s => s.textContent);
  assert.deepEqual(rates,  ['50%', '83.3%', '50%', '100%', '0%']);
  assert.deepEqual(counts, ['3/6', '5/6', '3/6', '4/4', '0/1']);
});

test('the label sits in a clipping wrapper so a long OC name cannot widen the table', () => {
  const doc = dom(build(SAMPLE));
  const label = [...doc.querySelectorAll('td.oc-tt-heat-label')].find(td => td.textContent.includes('Smoke and Wing Mirrors'));
  const wrap = label.querySelector('.oc-tt-heat-lbl');
  assert.ok(wrap, 'label wrapper present');
  assert.ok(wrap.textContent.includes('Smoke and Wing Mirrors'));
  assert.equal(wrap.querySelector('span.r').textContent, 'Hustler #2');
});

test('colour bands are unchanged: green from 80, amber from 60, red below', () => {
  const doc = dom(build(SAMPLE));
  const row = [...doc.querySelectorAll('tr')].find(tr => tr.textContent.includes('No Reserve'));
  const fg = [...row.querySelectorAll('td.oc-tt-heat-cell')].map(td => (td.getAttribute('style').match(/color:(#[0-9a-f]{6})/) || [])[1]);
  assert.deepEqual(fg, ['#ef4444', '#74c69d', '#ef4444', '#74c69d', '#ef4444']);
});
