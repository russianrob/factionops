// Daily notify-only check: is there a newer TornTools tag than what we serve?
// If so, push a one-time banner to the owner's device. Never builds/ships —
// the actual build + pre-ship audit + publish stays manual. Run by cron daily.
//
//   node bin/torntools-check-update.mjs            # live: push if newer + not yet notified
//   node bin/torntools-check-update.mjs --dry-run  # print the decision, send nothing
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const SERVER = join(dirname(fileURLToPath(import.meta.url)), "..", "server");
const VERSION_JSON = join(SERVER, "public", "ext", "torntools", "version.json");
const STATE_FILE = join(SERVER, "data", "torntools-update-state.json");
const GH_TOKEN_FILE = join(SERVER, "data", ".ghtoken");
const TT_REPO = "Mephiles/torntools_extension";

// ── Pure logic (unit-tested) ─────────────────────────────────────────

/** Compare two dotted versions segment-by-segment, NUMERICALLY (so
 *  "9.0.13" > "9.0.7", not the lexical opposite). Missing trailing
 *  segments count as 0. Returns -1 | 0 | 1. */
export function compareVersions(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** Decide whether to notify. Fire only for a version strictly newer than
 *  BOTH what we serve AND what we last pinged about — so it's once per
 *  release (not daily), and re-fires if an even newer one lands. */
export function pickUpdate({ latest, served, lastNotified }) {
  if (!latest || compareVersions(latest, served) <= 0) {
    return { notify: false, version: latest, reason: "up-to-date" };
  }
  if (lastNotified && compareVersions(latest, lastNotified) <= 0) {
    return { notify: false, version: latest, reason: "already-notified" };
  }
  return { notify: true, version: latest, reason: "update-available" };
}

// ── I/O (verified via --dry-run + a live test) ───────────────────────

function readServedVersion() {
  try { return JSON.parse(readFileSync(VERSION_JSON, "utf8")).version || "0"; }
  catch { return "0"; }
}
function readState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}
function writeState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}
function ghToken() {
  try { return readFileSync(GH_TOKEN_FILE, "utf8").trim(); } catch { return ""; }
}

/** Highest dotted-numeric tag on the repo. Set TT_CHECK_FORCE_LATEST to
 *  override (ops: force a re-notify for a version; test: exercise the
 *  notify branch without waiting on a real release). */
async function fetchLatestTag() {
  if (process.env.TT_CHECK_FORCE_LATEST) return process.env.TT_CHECK_FORCE_LATEST;
  const headers = { "User-Agent": "warboard-tt-checker", Accept: "application/vnd.github+json" };
  const token = ghToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${TT_REPO}/tags?per_page=20`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const versions = (await res.json())
    .map((t) => t.name)
    .filter((n) => /^\d+(\.\d+)*$/.test(n));
  if (versions.length === 0) throw new Error("no numeric tags found");
  return versions.reduce((max, v) => (compareVersions(v, max) > 0 ? v : max), versions[0]);
}

function ownerHasSubscription(ownerId) {
  try {
    const subs = JSON.parse(readFileSync(join(SERVER, "data", "push-subscriptions.json"), "utf8"));
    return Array.isArray(subs[ownerId]) && subs[ownerId].length > 0;
  } catch { return false; }
}

async function notifyOwner(latest, served) {
  // Reuse the exact path the chain alerts use — web push (per-device
  // collapsed) + FCM fanout — via the running server's config. VAPID keys
  // live in server/.env, so load that first.
  process.loadEnvFile(join(SERVER, ".env"));
  const ownerId = process.env.OWNER_PLAYER_ID || "137558";
  if (!ownerHasSubscription(ownerId)) return { reached: false };
  const push = await import(join(SERVER, "push-notifications.js"));
  push.loadSubscriptions();
  // No notifType -> bypass the per-type preference gate (this is a one-off
  // owner ops ping, not a user-configurable category).
  await push.sendToPlayer(ownerId, {
    title: "TornTools update",
    body: `${latest} available (serving ${served}) — tell Claude to ship it`,
    url: "https://tornwar.com/ext/torntools/version.json",
    data: { type: "torntools-update", version: latest },
  }, undefined, { urgency: "low" });
  return { reached: true };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const served = readServedVersion();
  let latest;
  try { latest = await fetchLatestTag(); }
  catch (e) { console.error(`[tt-check] fetch failed: ${e.message} — skipping`); return; }

  const state = readState();
  const lastNotified = state.lastNotifiedVersion || "";
  const decision = pickUpdate({ latest, served, lastNotified });
  const stamp = new Date().toISOString();
  console.log(`[tt-check] ${stamp} latest=${latest} served=${served} lastNotified=${lastNotified || "-"} -> ${decision.reason}`);

  if (!decision.notify) return;
  if (dryRun) {
    console.log(`[tt-check] DRY-RUN: would push "TornTools update — ${latest} available (serving ${served})"`);
    return;
  }
  try {
    const { reached } = await notifyOwner(latest, served);
    if (reached) {
      writeState({ lastNotifiedVersion: latest, lastNotifiedAt: stamp, servedAtNotify: served });
      console.log(`[tt-check] notified owner about ${latest}; state recorded`);
    } else {
      console.warn(`[tt-check] owner has no push subscription — not recording state; will retry next run`);
    }
  } catch (e) {
    console.error(`[tt-check] push failed: ${e.message}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().then(() => process.exit(0));
}
