#!/usr/bin/env node
// Put names to the member ids in the chain-report store.
//
//   node tools/resolve-names.mjs [factionId] [budget]
//
// Chain reports carry ids only, and a lifetime leaderboard is mostly people
// who have left — the roster cannot name them. One call each, cached
// forever, highest-respect first so the visible top fills in immediately.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));
await import('dotenv/config');

const factionId = process.argv[2] || process.env.OWNER_FACTION_ID || '42055';
const budget = Number(process.argv[3] || 250);
const key = process.env.OWNER_API_KEY;
if (!key) { console.error('No OWNER_API_KEY'); process.exit(1); }

const fh = await import('../faction-history.js');
const store = fh.loadChainReports(factionId);
const ranked = fh.lifetimeChainRespect(store, fh.loadNames(factionId));
const ids = ranked.members.map((m) => String(m.id));
console.log(`${ids.length} members in the chain-report store; resolving up to ${budget}…`);
const t0 = Date.now();
const { names, resolved } = await fh.resolveNames(key, factionId, ids, { budget });
const named = Object.values(names).filter(Boolean).length;
console.log(`resolved ${resolved} in ${((Date.now() - t0) / 60000).toFixed(1)} min; `
  + `${named}/${ids.length} now named\n`);
for (const m of fh.lifetimeChainRespect(store, names).members.slice(0, 15)) {
  console.log(`  ${String(m.name).padEnd(18)} ${Math.round(m.respect).toLocaleString().padStart(10)}`
    + `  ${String(m.attacks).padStart(6)} attacks  avg ${m.avg}`);
}
process.exit(0);
