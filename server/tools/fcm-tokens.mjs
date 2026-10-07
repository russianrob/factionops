#!/usr/bin/env node
// Inspect and prune the registered app device tokens (FCM / APNs).
//
//   node tools/fcm-tokens.mjs list [playerId]
//   node tools/fcm-tokens.mjs prune <tokenPrefix> [<tokenPrefix>...]
//
// Pruning is safe to get slightly wrong: a device that still has the app
// installed re-registers its token on the next launch, so a wrongly removed
// live device heals itself. The reverse is not true — a stale token is
// invisible, because FCM and APNs both return success for tokens they will
// never deliver to. That asymmetry is why this errs toward removing.
//
// Tokens are addressed by PREFIX so a full device token never has to be
// pasted onto a command line or into a log.
//
// After pruning, reload the server: it holds the token store in memory and
// persists the whole thing on the next registration, which would otherwise
// write its pre-prune copy straight back over this change.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { copyFileSync, existsSync, statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const [action, ...args] = process.argv.slice(2);
const fcm = await import('../fcm-subscriptions.js');

const fmtDate = (ms) => (ms
  ? new Date(ms).toISOString().slice(0, 10)
  : '    ?     ');

function rows(playerId) {
  return fcm.listAll()
    .filter((s) => !playerId || String(s.playerId) === String(playerId))
    .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
}

function show(list) {
  if (!list.length) { console.log('  (none)'); return; }
  for (const s of list) {
    console.log(`  ${String(s.playerId).padEnd(9)} ${String(s.platform).padEnd(8)}`
      + ` ${String(s.appPackage || '?').padEnd(26)}`
      + ` ${s.token.slice(0, 10)}…  updated ${fmtDate(s.updatedAt)}`);
  }
}

if (action === 'list') {
  const list = rows(args[0]);
  console.log(`${list.length} registered device token(s)`
    + (args[0] ? ` for ${args[0]}` : '') + ':');
  show(list);
  process.exit(0);
}

if (action === 'prune') {
  if (!args.length) {
    console.error('usage: node tools/fcm-tokens.mjs prune <tokenPrefix> [...]');
    process.exit(1);
  }

  const all = fcm.listAll();
  const doomed = [];
  for (const prefix of args) {
    const hits = all.filter((s) => s.token.startsWith(prefix));
    if (hits.length === 0) {
      console.error(`no token starts with "${prefix}" — aborting, nothing removed`);
      process.exit(1);
    }
    if (hits.length > 1) {
      console.error(`"${prefix}" matches ${hits.length} tokens — too short, aborting`);
      process.exit(1);
    }
    doomed.push(hits[0]);
  }

  // Back up before touching anything — this file is the only record of which
  // devices a player registered, and it is not reconstructible from the log.
  const FILE = join(process.cwd(), 'data', 'fcm-subscriptions.json');
  if (existsSync(FILE)) {
    const bak = `${FILE}.bak`;
    copyFileSync(FILE, bak);
    console.log(`backed up to ${bak}`);
  }

  console.log('removing:');
  show(doomed);
  for (const s of doomed) fcm.removeToken(s.token);

  console.log(`\nremaining ${fcm.listAll().length} token(s):`);
  show(rows());

  // The store is owned by the server's user; a root-written file would make
  // every later persist fail with EACCES, silently, and lose registrations
  // on the next restart.
  const owner = statSync(FILE).uid;
  console.log(`\nfile uid now ${owner}`
    + (owner === 0 ? '  ← ROOT: chown back to the server user before reloading' : ''));
  console.log('Now reload the server so it drops its pre-prune in-memory copy.');
  process.exit(0);
}

console.error('usage: node tools/fcm-tokens.mjs list|prune …');
process.exit(1);
