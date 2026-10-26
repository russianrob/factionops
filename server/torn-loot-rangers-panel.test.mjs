// Torn Loot Rangers Floating Panel: the NPC links in the box. These tests load the real script into
// a hand-built Torn page, with Loot Rangers' answer, the timers, localStorage and the page's
// jQuery under their control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TLR_SRC lets a mutant copy be tested in place of the served file.
const SRC = process.env.TLR_SRC || '/opt/warboard/server/public/scripts/torn-loot-rangers-panel.user.js';
// The test clock: 2026-10-26 15:00 TCT, in Unix seconds.
const NOW = Date.UTC(2026, 9, 26, 15) / 1000;

// Loot Rangers' answer (api.lzpt.io/loot), with the fields the box reads: Duke (4), Leslie (15)
// and Jimmy (19) in that order, Leslie still in hospital.
function answer(time) {
  return {
    time: { current: NOW, clear: NOW + 3600, attack: false, ...time },
    order: [4, 15, 19],
    npcs: {
      4: { name: 'Duke', next: true, hosp_out: NOW - 60 },
      15: { name: 'Leslie', next: true, hosp_out: NOW + 600 },
      19: { name: 'Jimmy', next: true, hosp_out: NOW - 30 },
    },
  };
}

// Runs the script on a blank Torn page while Loot Rangers gives `data`, and returns the box's
// body once the answer is drawn.
async function box(data) {
  const dom = parseHTML('<!doctype html><html><head></head><body></body></html>');
  const doc = dom.document;
  const store = {};
  new Function('window', 'document', 'localStorage', 'GM_xmlhttpRequest', '$', 'setInterval', 'console',
    readFileSync(SRC, 'utf8'))(
    { addEventListener() {} },
    doc,
    { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    (req) => req.onload({ responseText: JSON.stringify(data) }),
    // Torn's pages have jQuery; the box walks the order with $.each.
    { each: (list, fn) => list.forEach((v, i) => fn(i, v)) },
    () => 0,
    { log() {}, error() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return doc.getElementById('lr-body');
}

const hrefs = (el) => [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));

test('the NPC links go to Torn\'s attack page (page.php), before an attack and while one is underway', async () => {
  const before = await box(answer({}));
  assert.match(before.textContent, /^Next: Duke at 16:00:00 TCTOrder: Duke, Leslie, Jimmy\.$/);
  assert.deepEqual(hrefs(before), ['page.php?sid=attack&user2ID=4', 'page.php?sid=attack&user2ID=4',
    'page.php?sid=attack&user2ID=15', 'page.php?sid=attack&user2ID=19']);

  // Under way, with Duke back in hospital: the next one out of hospital is Jimmy.
  const data = answer({ attack: true });
  data.npcs[4].hosp_out = NOW + 60;
  const during = await box(data);
  assert.match(during.textContent, /^NPC attack is underway! Next: Jimmy\./);
  assert.deepEqual(hrefs(during), ['page.php?sid=attack&user2ID=19']);
});

test('the header and the CHANGELOG say 3.2.2, and the meta file is the header and a newline', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length);
  assert.match(header, /\n\/\/ @version      3\.2\.2\n/);
  assert.match(src, /\n\/\* CHANGELOG\n \* 3\.2\.2  The NPC links open Torn's attack page again\./);
  assert.equal(readFileSync(SRC.replace(/\.user\.js$/, '.meta.js'), 'utf8'), header + '\n');
});
