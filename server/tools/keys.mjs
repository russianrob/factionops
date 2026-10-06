#!/usr/bin/env node
// Stored-API-key hygiene.
//
// warboard keeps a member's Torn key so it can poll on their behalf. When
// somebody leaves the faction the key stays behind: FactionOps already refuses
// them (the faction check in /api/auth), but the credential itself is still on
// the box and still works against Torn directly. This is how it gets cleaned.
//
//   node tools/keys.mjs audit             who we hold keys for, vs the roster
//   node tools/keys.mjs remove <playerId> drop one
//   node tools/keys.mjs prune             drop every key for a non-member
//
// remove/prune reload the server afterwards. They have to: removeApiKey
// rewrites player-keys.json, but the RUNNING process keeps its own in-memory
// Map, so without a reload the key stays usable until the next restart and the
// job is only half done. Pass --no-reload to skip that.
import "dotenv/config";
import { execSync } from "node:child_process";
import * as store from "../store.js";

const FACTION = "42055";
const argv = process.argv.slice(2);
const cmd = (argv[0] || "audit").toLowerCase();
const noReload = argv.includes("--no-reload");

store.loadPlayerKeys();
const stored = () => new Set(store.getAllApiKeys().map(([id]) => String(id)));

async function roster() {
  const key = process.env.OWNER_API_KEY;
  if (!key) throw new Error("OWNER_API_KEY not set — cannot read the roster");
  const r = await fetch(`https://api.torn.com/v2/faction/members?striptags=true`
    + `&key=${encodeURIComponent(key)}&comment=wb-keys`);
  const d = await r.json();
  if (d.error) throw new Error(`Torn: ${d.error.error} (code ${d.error.code})`);
  const list = Array.isArray(d.members) ? d.members
    : Object.keys(d.members || {}).map((k) => ({ id: k, ...d.members[k] }));
  return new Map(list.map((m) => [String(m.id), m.name]));
}

function reload(why) {
  if (noReload) { console.log("\n! not reloaded (--no-reload). The key stays live in memory until restart."); return; }
  try {
    execSync("pm2 reload warboard", { stdio: "ignore" });
    console.log(`\nreloaded warboard (${why}) — in-memory copy dropped`);
  } catch (e) {
    console.log(`\n! reload FAILED: ${e.message}\n  Run: pm2 reload warboard`);
  }
}

if (cmd === "audit") {
  const members = await roster();
  const have = stored();
  const gone = [...have].filter((id) => !members.has(id)).sort();
  const missing = [...members.keys()].filter((id) => !have.has(id));
  console.log(`current members : ${members.size}`);
  console.log(`stored keys     : ${have.size}`);
  console.log(`\nkeys for NON-members: ${gone.length}`);
  for (const id of gone) console.log(`   ${id}`);
  console.log(`\nmembers with no key : ${missing.length}`);
} else if (cmd === "remove") {
  const id = String(argv[1] || "").trim();
  if (!/^\d+$/.test(id)) { console.log("usage: node tools/keys.mjs remove <playerId>"); process.exit(1); }
  const had = !!store.getApiKeyForPlayer(id);
  if (!had) { console.log(`no key stored for ${id} — nothing to do`); process.exit(0); }
  store.removeApiKey(id);
  const still = !!store.getApiKeyForPlayer(id);
  console.log(`${id}: had key = ${had}, after removal = ${still}`);
  if (still) { console.log("! removal did not take"); process.exit(1); }
  reload(`removed ${id}`);
} else if (cmd === "prune") {
  const members = await roster();
  const gone = [...stored()].filter((id) => !members.has(id)).sort();
  if (!gone.length) { console.log("nothing to prune — every stored key belongs to a current member"); process.exit(0); }
  console.log(`pruning ${gone.length} key(s) for non-members:`);
  for (const id of gone) { store.removeApiKey(id); console.log(`   removed ${id}`); }
  reload(`pruned ${gone.length}`);
} else {
  console.log("usage: node tools/keys.mjs [audit | remove <playerId> | prune] [--no-reload]");
  process.exit(1);
}
