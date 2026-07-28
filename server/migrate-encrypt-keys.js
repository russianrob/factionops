// One-shot migration: re-write the three key-bearing JSON files with
// values encrypted via key-encryption.js. Idempotent — already-encrypted
// values are skipped (encrypt() detects the enc:v1: prefix).
//
// Usage: sudo -u warboard node migrate-encrypt-keys.js
//
// Safe to run while warboard is online: each file is rewritten atomically
// (temp file + rename). The running process keeps in-memory plaintext so
// no calls fail during the swap; on the NEXT restart, the encrypted files
// are loaded and decrypted transparently.

import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { encrypt, isEncrypted } from "./key-encryption.js";

const DATA_DIR = process.env.DATA_DIR || "./data";

function migrateFlatMap(file) {
  if (!existsSync(file)) {
    console.log(`[migrate] ${file} — not present, skipping`);
    return;
  }
  const raw = readFileSync(file, "utf-8");
  const obj = JSON.parse(raw);
  let total = 0, alreadyEnc = 0, freshlyEnc = 0;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    total++;
    if (typeof v !== "string") { out[k] = v; continue; }
    if (isEncrypted(v)) { out[k] = v; alreadyEnc++; continue; }
    out[k] = encrypt(v);
    freshlyEnc++;
  }
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(out, null, 2));
  renameSync(tmp, file);
  console.log(`[migrate] ${file} — ${freshlyEnc} encrypted, ${alreadyEnc} already-encrypted, ${total} total`);
}

function migrateKeysAsPropertyNames(file) {
  // oc-spawn-keys.json shape: { factionId: { apiKey: { addedAt, lastUsedAt } } }
  // Encrypt the inner property names (the API key strings).
  if (!existsSync(file)) {
    console.log(`[migrate] ${file} — not present, skipping`);
    return;
  }
  const raw = readFileSync(file, "utf-8");
  const obj = JSON.parse(raw);
  let totalKeys = 0, alreadyEnc = 0, freshlyEnc = 0;
  const out = {};
  for (const [fid, pool] of Object.entries(obj)) {
    out[fid] = {};
    for (const [k, info] of Object.entries(pool || {})) {
      totalKeys++;
      if (isEncrypted(k)) { out[fid][k] = info; alreadyEnc++; continue; }
      out[fid][encrypt(k)] = info;
      freshlyEnc++;
    }
  }
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(out, null, 2));
  renameSync(tmp, file);
  console.log(`[migrate] ${file} — ${freshlyEnc} encrypted, ${alreadyEnc} already-encrypted, ${totalKeys} total`);
}

console.log(`[migrate] Using DATA_DIR=${DATA_DIR}`);
migrateFlatMap(join(DATA_DIR, "player-keys.json"));
migrateFlatMap(join(DATA_DIR, "faction-keys.json"));
migrateKeysAsPropertyNames(join(DATA_DIR, "oc-spawn-keys.json"));
console.log("[migrate] Done.");
