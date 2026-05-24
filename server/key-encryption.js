// Encryption-at-rest helper for stored Torn API keys.
//
// Threat model: an attacker who gets a snapshot of the on-disk data
// directory (file read via app bug, leaked backup, image clone) should
// not be able to recover plaintext API keys without ALSO obtaining
// /etc/warboard/master.key.
//
// AES-256-GCM. 12-byte nonce per record. Master key is 32 bytes loaded
// from /etc/warboard/master.key (base64). Output format:
//
//     enc:v1:<base64(nonce|ciphertext|authTag)>
//
// Reader is backward-compatible: any value not starting with "enc:v1:"
// is returned as-is so legacy plaintext entries keep working until the
// next mutation re-saves them encrypted.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const MASTER_KEY_PATH = process.env.WARBOARD_MASTER_KEY_PATH || "/etc/warboard/master.key";
const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

let _masterKey = null;

function loadMasterKey() {
  if (_masterKey) return _masterKey;
  if (!existsSync(MASTER_KEY_PATH)) {
    throw new Error(
      `Master key not found at ${MASTER_KEY_PATH}. Generate one with:\n` +
      `  openssl rand -base64 32 > ${MASTER_KEY_PATH}\n` +
      `  chown warboard:warboard ${MASTER_KEY_PATH} && chmod 400 ${MASTER_KEY_PATH}`
    );
  }
  const raw = readFileSync(MASTER_KEY_PATH, "utf-8").trim();
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `Master key at ${MASTER_KEY_PATH} must be base64-encoded 32 bytes (got ${buf.length} bytes after decode).`
    );
  }
  _masterKey = buf;
  return _masterKey;
}

// Eagerly verify the master key at module load. Fail loud at startup
// rather than discover the issue mid-request when a key save is
// attempted and the file can't be encrypted.
loadMasterKey();

export function isEncrypted(s) {
  return typeof s === "string" && s.startsWith(PREFIX);
}

export function encrypt(plaintext) {
  if (typeof plaintext !== "string" || plaintext.length === 0) return plaintext;
  if (isEncrypted(plaintext)) return plaintext; // already encrypted, don't double-wrap
  const key = loadMasterKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([nonce, ct, tag]).toString("base64");
}

export function decrypt(value) {
  if (!isEncrypted(value)) return value; // legacy plaintext, return as-is
  const key = loadMasterKey();
  const blob = Buffer.from(value.slice(PREFIX.length), "base64");
  if (blob.length < 12 + 16) {
    throw new Error("Encrypted blob too short to contain nonce + auth tag");
  }
  const nonce = blob.subarray(0, 12);
  const tag = blob.subarray(blob.length - 16);
  const ct = blob.subarray(12, blob.length - 16);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf-8");
}

// Helpers for plain object maps (playerId/factionId → key)
export function encryptMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    out[k] = typeof v === "string" ? encrypt(v) : v;
  }
  return out;
}

export function decryptMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    try {
      out[k] = typeof v === "string" ? decrypt(v) : v;
    } catch (e) {
      console.error(`[key-encryption] Failed to decrypt entry ${k}: ${e.message}`);
      // Don't drop the entry — return as-is so the caller can decide
      // (probably treat as broken and ignore). Returning empty would
      // silently lose the key.
      out[k] = v;
    }
  }
  return out;
}
