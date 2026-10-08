/**
 * Daily advance of the faction-history stores.
 *
 * Without this nothing accumulates unless somebody opens the page, and the
 * two things that need to accumulate are exactly the ones on a clock:
 *
 *   attack backfill   Torn serves ~1 year and the window ROLLS. Every day
 *                     nobody looks, the oldest day we could have captured
 *                     expires unread. The whole point of copying it out is
 *                     to beat that, which only works if it runs.
 *   names             a lifetime table is mostly ex-members; each unknown id
 *                     is one /user call, so they trickle in rather than
 *                     arriving in a burst.
 *   chain reports     new chains only — the history is already held, and a
 *                     finished chain never changes.
 *
 * Owner faction only: a background job has no caller, and faction history is
 * self-only, so the one key it can legitimately use is the owner's.
 */
import * as fh from "./faction-history.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// Well clear of boot: a restart should not spend API budget before the
// pollers that people are actually waiting on have settled.
const BOOT_DELAY_MS = 5 * 60 * 1000;

let timer = null;

async function tick(reason) {
  const factionId = String(process.env.OWNER_FACTION_ID || "42055");
  const key = process.env.OWNER_API_KEY;
  if (!key) return;

  await fh.withStoreLock(async () => {
    const t0 = Date.now();
    const summary = [];
    try {
      const { store, pages } = await fh.captureAttacks(key, factionId, { maxBackfillPages: 120 });
      summary.push(`attacks ${pages}p back to ${store.floor || "?"}`
        + (store.backfillDone ? " (complete)" : ""));
    } catch (e) { summary.push(`attacks failed: ${e.message}`); }

    try {
      const chains = await fh.fetchAllChains(key);
      const { fetched, remaining } = await fh.captureChainReports(key, factionId, chains, { budget: 200 });
      summary.push(`chainreports +${fetched}${remaining ? `, ${remaining} left` : ""}`);
    } catch (e) { summary.push(`chainreports failed: ${e.message}`); }

    try {
      const ranked = fh.lifetimeChainRespect(fh.loadChainReports(factionId), fh.loadNames(factionId));
      const unknown = ranked.members.filter((m) => m.name === String(m.id)).map((m) => m.id);
      if (unknown.length) {
        const { resolved } = await fh.resolveNames(key, factionId, unknown, { budget: 100 });
        summary.push(`names +${resolved}, ${unknown.length - resolved} unnamed`);
      } else {
        summary.push("names complete");
      }
    } catch (e) { summary.push(`names failed: ${e.message}`); }

    console.log(`[fachist/daily] ${reason}: ${summary.join(" | ")} `
      + `in ${((Date.now() - t0) / 60000).toFixed(1)}m`);
  });
}

export function startFactionHistorySchedule() {
  if (process.env.FACHIST_SCHEDULE === "0") {
    console.log("[fachist/daily] disabled by FACHIST_SCHEDULE=0");
    return;
  }
  if (!process.env.OWNER_API_KEY) {
    console.log("[fachist/daily] no OWNER_API_KEY — not scheduling");
    return;
  }
  if (timer) return;
  setTimeout(() => tick("boot"), BOOT_DELAY_MS);
  timer = setInterval(() => tick("daily"), DAY_MS);
  console.log("[fachist/daily] scheduled every 24h");
}

export function stopFactionHistorySchedule() {
  if (timer) { clearInterval(timer); timer = null; }
}
