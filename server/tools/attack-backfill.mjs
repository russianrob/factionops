#!/usr/bin/env node
// Walk the attack log all the way back to Torn's floor, in one run.
//
//   node tools/attack-backfill.mjs [factionId]
//
// The page build only backfills ~120 pages at a time on purpose: a full year
// is ~2,470 pages, and spending that inside a build would hold roughly half
// the faction's 100 calls/minute for 45 minutes every time somebody opened
// the page. This is the deliberate one-off that gets it over with.
//
// Safe to interrupt. Coverage is an interval extended only from its own
// edges and the store is written every 50 pages, so a kill costs at most the
// last fifty and a re-run picks up where it stopped.
//
// Once it finishes, backfillDone is set and ordinary builds stop backfilling
// entirely — only the cheap forward pass keeps running.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));
await import('dotenv/config');

const factionId = process.argv[2] || process.env.OWNER_FACTION_ID || '42055';
const key = process.env.OWNER_API_KEY;
if (!key) { console.error('No OWNER_API_KEY in server/.env'); process.exit(1); }

const fh = await import('../faction-history.js');
const before = fh.loadCapturedAttacks(factionId);
const day = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') : '—');

console.log(`faction ${factionId}`);
console.log(`  covered before: ${day(before.coveredFrom)} .. ${day(before.coveredTo)}`);
console.log(`  backfillDone  : ${!!before.backfillDone}`);
console.log('  walking back to Torn\'s floor — expect ~45 min, Ctrl-C is safe\n');

const t0 = Date.now();
let last = 0;
const { store, pages, rows } = await fh.captureAttacks(key, factionId, {
  maxBackfillPages: 5000,
  onProgress: (p) => {
    if (p.pages - last < 50) return;
    last = p.pages;
    const mins = (Date.now() - t0) / 60000;
    console.log(`  ${String(p.pages).padStart(5)} pages  ${String(p.rows).padStart(7)} rows`
      + `  ${mins.toFixed(1)}m  (${p.phase})`);
  },
});

console.log(`\ndone in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
console.log(`  pages ${pages}, rows ${rows}`);
console.log(`  covered now  : ${day(store.coveredFrom)} .. ${day(store.coveredTo)}`);
console.log(`  backfillDone : ${!!store.backfillDone}`);
console.log(`  days held    : ${Object.keys(store.days).length}`);
if (!store.backfillDone) {
  console.log('\n  Not finished — re-run to continue from where it stopped.');
}
process.exit(0);
