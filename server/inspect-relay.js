// In-memory relay for the wireless WKWebView remote-inspect bridge.
//
// Two queues keyed by ownerId (single owner device for v1):
//   _cmds    — operator → device  (JS to run / screenshot requests)
//   _results — device → operator  (JS results / screenshot file refs)
//
// Mirrors pending-broadcasts.js: in-memory only (ephemeral by design,
// lost on restart), capped per owner, and stale-evicted after 5 min so a
// stale command never fires on a device that reconnects much later.
//
// Auth/gating:
//   operator side  → a shared secret (data/.inspect-token, generated once)
//                    presented as the X-Inspect-Token header, checked with
//                    timingSafeEqual. NOT a localhost check: the app sits
//                    behind nginx, so every proxied request looks like
//                    127.0.0.1 — the token is the real gate.
//   device side    → the owner's JWT (requireAuth + playerId === owner),
//                    enforced in the route.
//   app side       → a default-OFF toggle; the device only polls when on.
//
// Spec: warboard-ios docs/.../2026-06-30-remote-inspect-bridge-design.md

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "data");
export const INSPECT_DIR = resolve(DATA_DIR, "inspect");   // absolute so the operator can Read it from any cwd
const TOKEN_FILE = join(DATA_DIR, ".inspect-token");

const QUEUE_CAP = 50;
const STALE_AFTER_MS = 5 * 60 * 1000;
let _seq = 0;

const _cmds = new Map();     // ownerId → Array<{id, ..., _queuedAt}>
const _results = new Map();  // ownerId → Array<{id, ..., _queuedAt}>

// ── operator token ────────────────────────────────────────────────────────
let _cachedToken = null;
export function operatorToken() {
  if (_cachedToken) return _cachedToken;
  try { if (existsSync(TOKEN_FILE)) { _cachedToken = readFileSync(TOKEN_FILE, "utf8").trim(); return _cachedToken; } } catch {}
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const t = randomBytes(24).toString("hex");
    writeFileSync(TOKEN_FILE, t, { mode: 0o600 });
    _cachedToken = t;
    return t;
  } catch { return null; }
}
export function verifyOperatorToken(presented) {
  const real = operatorToken();
  if (!real || !presented) return false;
  const a = Buffer.from(String(presented));
  const b = Buffer.from(real);
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

// ── queues ──────────────────────────────────────────────────────────────────
function _push(map, ownerId, item) {
  const k = String(ownerId);
  let q = map.get(k);
  if (!q) { q = []; map.set(k, q); }
  q.push({ ...item, _queuedAt: Date.now() });
  if (q.length > QUEUE_CAP) q.splice(0, q.length - QUEUE_CAP);
}
function _drain(map, ownerId) {
  const k = String(ownerId);
  const q = map.get(k);
  if (!q || q.length === 0) return [];
  const cutoff = Date.now() - STALE_AFTER_MS;
  const fresh = q.filter((e) => e._queuedAt >= cutoff);
  map.delete(k);
  return fresh.map(({ _queuedAt, ...rest }) => rest);
}

// operator → device
export function queueCmd(ownerId, cmd) {
  const id = "c" + (++_seq) + "_" + Date.now();
  _push(_cmds, ownerId, { id, ...cmd });
  return id;
}
export function drainCmds(ownerId) { return _drain(_cmds, ownerId); }

// device → operator
export function putResult(ownerId, result) { _push(_results, ownerId, result); }
export function drainResults(ownerId) { return _drain(_results, ownerId); }

// device → operator (screenshot): decode base64 PNG to a file the operator reads.
export function saveScreenshot(ownerId, id, base64) {
  const safe = String(id || ("shot" + Date.now())).replace(/[^a-zA-Z0-9_-]/g, "");
  try {
    mkdirSync(INSPECT_DIR, { recursive: true });
    const file = safe + ".png";
    writeFileSync(join(INSPECT_DIR, file), Buffer.from(base64, "base64"));
    const out = { id: id || null, kind: "screenshot", file, path: join(INSPECT_DIR, file) };
    putResult(ownerId, out);
    return out;
  } catch (e) {
    const out = { id: id || null, kind: "screenshot", error: e.message };
    putResult(ownerId, out);
    return out;
  }
}
