#!/usr/bin/env node
// Pull every chain report, giving LIFETIME respect per member.
//
//   node tools/chain-reports.mjs [factionId]
//
// This is the only route to per-member respect that reaches past Torn's
// ~1 year of attack log: /faction/chainreport?id= names each attacker's
// respect for that chain, it reconciles exactly against the chain record,
// and 42055's chains run back to February 2019.
//
// One call per chain and NEVER repeated — a finished chain is immutable, so
// the store is a permanent record. ~1,850 calls the first time, then only
// whatever chained since.
//
// Safe to interrupt: the store is written every 25 reports.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));
await import('dotenv/config');

const factionId = process.argv[2] || process.env.OWNER_FACTION_ID || '42055';
const key = process.env.OWNER_API_KEY;
if (!key) { console.error('No OWNER_API_KEY in server/.env'); process.exit(1); }

const fh = await import('../faction-history.js');
console.log(`faction ${factionId} — listing chains…`);
const chains = await fh.fetchAllChains(key);
const have = Object.keys(fh.loadChainReports(factionId).chains || {}).length;
console.log(`  ${chains.length} chains, ${have} reports already held, `
  + `${chains.length - have} to fetch (~${Math.round((chains.length - have) * 1.1 / 60)} min)\n`);

const t0 = Date.now();
const { store, fetched, remaining } = await fh.captureChainReports(key, factionId, chains, {
  budget: 99999,
  onProgress: (p) => console.log(`  ${String(p.done).padStart(5)}/${p.todo}`
    + `  ${((Date.now() - t0) / 60000).toFixed(1)}m`),
});

// Reports carry ids, not names. The page resolves them against the roster;
// here the ids are enough to sanity-check the totals.
const r = fh.lifetimeChainRespect(store, {});
console.log(`\ndone in ${((Date.now() - t0) / 60000).toFixed(1)} min — fetched ${fetched}, `
  + `${remaining} left`);
console.log(`  ${r.chains} chains, ${r.members.length} members, ${r.total.toLocaleString()} respect`);
for (const m of r.members.slice(0, 10)) {
  console.log(`   ${String(m.name).padEnd(12)} ${m.respect.toLocaleString().padStart(12)}`
    + `  ${String(m.attacks).padStart(7)} attacks  avg ${m.avg}`);
}
process.exit(0);
