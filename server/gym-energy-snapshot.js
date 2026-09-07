// Gym energy is the one number in the slackers report that Torn will not hand
// over historically. /v2/faction/contributors reports a CUMULATIVE total per
// member, and its `timestamp` parameter is a cache-buster rather than a query —
// there is no way to ask what somebody's number was in June. So the history has
// to be ours: one reading a day, kept for 400 days, and the report subtracts
// two of them. Until enough readings exist the report says "avg since joining"
// instead of inventing a window it cannot support.
//
// Two API calls a day in total (contributors takes one stat per call, plus the
// roster for days_in_faction), which is why this runs daily rather than on a
// poll tick.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import { fetchFactionBasic } from "./torn-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "data", "gym-energy");
const RETAIN_DAYS = 400;
const INTERVAL_MS = 24 * 60 * 60 * 1000;
const FACTION = "42055";

function fileFor(factionId) {
  return path.join(DIR, `${factionId}.json`);
}

export function readSnapshots(factionId) {
  try {
    const raw = JSON.parse(fs.readFileSync(fileFor(factionId), "utf8"));
    return Array.isArray(raw.readings) ? raw.readings : [];
  } catch (_) {
    // No file yet is the normal state on day one, not an error.
    return [];
  }
}

function writeSnapshots(factionId, readings) {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  const cut = Date.now() - RETAIN_DAYS * 86400000;
  const kept = readings.filter((r) => Number(r.at) >= cut);
  fs.writeFileSync(fileFor(factionId), JSON.stringify({ factionId: String(factionId), readings: kept }));
}

async function fetchContributors(factionId, apiKey) {
  // cat=current keeps people who have left out of the reading; a board that
  // quietly lists former members is worse than one that asks twice.
  const url = `https://api.torn.com/v2/faction/contributors?stat=gymenergy&cat=current`
            + `&key=${encodeURIComponent(apiKey)}&comment=wb-api`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`contributors HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) {
    const err = new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
    err.code = data.error.code;
    throw err;
  }
  const c = data.contributors;
  if (!c) return [];
  // Tolerate the object-keyed shape as well as the documented array.
  const rows = Array.isArray(c)
    ? c
    : Object.keys(c).map((k) => ({ id: c[k].id ?? k, value: c[k].value, in_faction: c[k].in_faction }));
  return rows.filter((r) => r.in_faction !== false);
}

/**
 * One reading: every current member's cumulative gym energy, plus their days in
 * faction (so the report can show an average since joining before there is
 * enough history for a real window).
 */
export async function snapshotOnce(factionId = FACTION) {
  const apiKey = store.getPollingKey(factionId, "gym-energy");
  if (!apiKey) return { ok: false, reason: "no-key" };

  let rows, basic;
  try {
    rows = await fetchContributors(factionId, apiKey);
    basic = await fetchFactionBasic(factionId, apiKey);
  } catch (err) {
    // A key whose key/info advertises `contributors` can still refuse it in
    // practice. Demoting it here is what stops the same key being picked
    // tomorrow — the same self-healing path chain and xanax-tracker use.
    if (err.code === 16) store.demotePoolKeySelection(apiKey, factionId, "contributors");
    console.error(`[gym-energy] snapshot failed: ${err.message}`);
    return { ok: false, reason: err.message };
  }

  const days = {};
  for (const [id, m] of Object.entries(basic?.members || {})) {
    days[String(id)] = Number(m.days_in_faction) || 0;
  }

  const members = {};
  for (const r of rows) {
    const id = String(r.id);
    members[id] = { energy: Number(r.value) || 0, days: days[id] ?? 0 };
  }

  const readings = readSnapshots(factionId);
  readings.push({ at: Date.now(), members });
  writeSnapshots(factionId, readings);
  return { ok: true, members: Object.keys(members).length };
}

export function start() {
  snapshotOnce().catch(() => {});
  setInterval(() => { snapshotOnce().catch(() => {}); }, INTERVAL_MS);
}
