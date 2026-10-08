/**
 * Faction history — lifetime totals, respect over time, war record, roster churn.
 *
 * Everything here is about the caller's OWN faction. Torn refuses chains,
 * rankedwars, stats and news for anybody else's (code 2 / code 7; only
 * `basic` is public), so this always runs with the viewer's key and can never
 * be pointed at a rival.
 *
 * Three retention floors, which the page is expected to show rather than
 * paper over, measured against faction 42055 on 2026-10-07:
 *
 *   chains        back to the faction's first weeks (nothing before founding)
 *   ranked wars   back to Mar 2022 — when the feature began, not a limit
 *   news          back to Dec 2019 ONLY, and it looks like a rolling window
 *
 * That last one is why captured news is persisted: the faction was provably
 * active through 2019 (chains exist in Mar/Jul/Oct 2019) while both news logs
 * are empty for those months, so the floor is Torn's, it moves, and anything
 * not copied out now is lost for good.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR || "./data";

// Torn's 100 calls/minute is per KEY, and warboard's own pollers spend that
// same budget with the same key — so a build pacing itself to 100/min on its
// own is already over the limit. Measured: 700ms spacing produced a solid wall
// of code 5 "Too many requests", and because each failure returned instantly
// the build raced through years of news recording nothing.
//
// So: a floor well under the cap, and a spacing that BACKS OFF when Torn
// complains and decays back down when it stops. A rate limit is shared state;
// a fixed delay can only ever be a guess about what else is running.
const SPACING_FLOOR_MS = 1100;      // ~54/min, leaving the pollers room
const SPACING_CEIL_MS  = 6000;
let _spacing = SPACING_FLOOR_MS;
let _nextSlot = 0;

async function paced() {
  const now = Date.now();
  const at = Math.max(now, _nextSlot);
  _nextSlot = at + _spacing;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

const RATE_LIMITED = 5;

/**
 * One Torn call, paced, with retries on the rate limit.
 *
 * Retrying matters more than the pacing does: a skipped window is a hole in
 * the history that nothing later fills, and the hole is invisible because the
 * build still reports success. Anything other than a rate limit throws
 * straight through — a bad key should fail loudly on the first call, not
 * after four patient retries.
 */
async function tornGet(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    await paced();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Torn API returned HTTP ${res.status}`);
    const data = await res.json();
    // Both API versions answer a refusal with HTTP 200 and an error body, so
    // the status code alone never proves the call worked.
    if (!data.error) {
      // Sustained success walks the spacing back toward the floor, so one
      // busy minute does not slow the rest of the build to a crawl.
      _spacing = Math.max(SPACING_FLOOR_MS, _spacing - 40);
      return data;
    }
    if (data.error.code !== RATE_LIMITED || attempt >= tries) {
      throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
    }
    _spacing = Math.min(SPACING_CEIL_MS, Math.round(_spacing * 1.8));
    console.warn(`[fachist] rate limited, spacing now ${_spacing}ms (attempt ${attempt}/${tries})`);
    await new Promise((r) => setTimeout(r, _spacing * attempt));
  }
}

const v2 = (path, key, extra = "") =>
  tornGet(`https://api.torn.com/v2/faction/${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}${extra}&comment=wb-fachist`);
const v1 = (params, key) =>
  tornGet(`https://api.torn.com/faction/?${params}&key=${encodeURIComponent(key)}&comment=wb-fachist`);

// ── Fetch layer ────────────────────────────────────────────────────────

export async function fetchStats(key) {
  const s = (await v2("stats", key)).stats;
  // v2 hands back [{name,value}]; normalise to a plain object.
  return Array.isArray(s) ? Object.fromEntries(s.map((x) => [x.name, x.value])) : (s || {});
}

export async function fetchBasic(key) {
  return (await v2("basic", key)).basic || {};
}

/** Every chain, walked backwards with the `to` cursor until Torn runs dry. */
export async function fetchAllChains(key, onProgress) {
  const out = [];
  let to = null;
  for (let page = 0; page < 200; page++) {
    const d = await v2(`chains?limit=100${to ? `&to=${to}` : ""}`, key);
    const rows = d.chains || [];
    if (!rows.length) break;
    out.push(...rows);
    if (onProgress) onProgress(out.length);
    const oldest = Math.min(...rows.map((c) => c.start || 0));
    if (!oldest || oldest === to) break;   // cursor stopped moving
    to = oldest;
  }
  return out;
}

/** Ranked wars, paged by offset. 42055 has 167; offset 200 comes back empty. */
export async function fetchAllRankedWars(key) {
  const out = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const rows = (await v2(`rankedwars?limit=100&offset=${offset}`, key)).rankedwars || [];
    if (!rows.length) break;
    out.push(...rows);
  }
  return out;
}

/** One war's report. Returns the `factions` array (rank + rewards live there). */
export async function fetchWarReport(key, warId) {
  const r = (await v2(`rankedwarreport?id=${encodeURIComponent(warId)}`, key)).rankedwarreport || {};
  return Array.isArray(r.factions) ? r.factions : [];
}

/** Completed OCs, for their timestamped respect rewards. */
export async function fetchCrimeRespect(key, sinceTs) {
  const out = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const rows = (await v2(`crimes?cat=completed&limit=100&offset=${offset}`, key)).crimes || [];
    if (!rows.length) break;
    for (const c of rows) {
      const r = (c.rewards || {}).respect;
      if (r && c.executed_at) out.push({ t: c.executed_at, respect: r });
    }
    if (Math.min(...rows.map((c) => c.executed_at || 0)) < (sinceTs || 0)) break;
  }
  return out;
}

/**
 * Per-member LIFETIME totals for one faction stat, for current members.
 *
 * This is the only lifetime per-member data Torn offers, and it does not
 * include respect: `stat=respect` is rejected outright (code 25). Respect is
 * tracked per faction and per chain, never per person, which is why a
 * per-member respect figure can only ever be summed out of the attack log
 * and is therefore capped at Torn's ~1 year of it.
 *
 * Unlike the gym stats, the combat stats return CURRENT members only — the
 * 97 rows here sum to 45% of the faction's lifetime attacks won, the rest
 * belonging to people who have left.
 */
export async function fetchContributors(key, stat) {
  return (await v2(`contributors?stat=${encodeURIComponent(stat)}`, key)).contributors || [];
}

/**
 * One window of v1 news. `membershipnews` is **v1 only** — v2 answers it with
 * HTTP 200 and code 22, which parses as an empty success unless the error is
 * checked, exactly like the armoury selections.
 *
 * Torn caps a window at 100 rows with no "there is more" marker, so a window
 * that comes back full is assumed truncated and split in half. Without that,
 * a busy month silently loses everything past the hundredth event.
 */
export async function fetchNewsRange(key, sel, from, to, depth = 0) {
  const rows = Object.entries((await v1(`selections=${sel}&from=${from}&to=${to}`, key))[sel] || {})
    .map(([id, v]) => ({ id, news: v.news || "", timestamp: Number(v.timestamp) || 0 }));
  if (rows.length < 100 || to - from < 3600 || depth > 12) return rows;
  const mid = Math.floor((from + to) / 2);
  const [a, b] = [await fetchNewsRange(key, sel, from, mid, depth + 1),
                  await fetchNewsRange(key, sel, mid + 1, to, depth + 1)];
  return a.concat(b);
}

// ── Captured news store ────────────────────────────────────────────────
// Torn's news floor moves. Once a row is seen it is kept here forever, keyed
// by Torn's own news id so re-capturing a window cannot duplicate it.

const newsFile = (factionId) => join(DATA_DIR, `faction-news-${factionId}.json`);

export function loadCapturedNews(factionId) {
  try {
    const f = newsFile(factionId);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8"));
  } catch (e) {
    console.warn(`[fachist] could not read captured news: ${e.message}`);
  }
  return { rows: {}, capturedThrough: 0, floor: null };
}

export function saveCapturedNews(factionId, store) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(newsFile(factionId), JSON.stringify(store));
  } catch (e) {
    console.error(`[fachist] could not persist captured news: ${e.message}`);
  }
}

/**
 * Bring the captured store up to date. The first run walks month windows back
 * to `earliest`; later runs only re-read from a little before the last
 * capture, so the daily cost is two calls rather than two hundred.
 */
export async function captureNews(key, factionId, { earliest, onProgress } = {}) {
  const store = loadCapturedNews(factionId);
  const now = Math.floor(Date.now() / 1000);
  const first = store.capturedThrough
    // Re-read the last day: an event can land between two builds.
    ? store.capturedThrough - 86400
    : (earliest || now - 8 * 365 * 86400);

  const windows = [];
  for (let a = first; a < now; a += 30 * 86400) windows.push([a, Math.min(a + 30 * 86400, now)]);

  let done = 0;
  const failed = [];
  for (const [a, b] of windows) {
    for (const sel of ["membershipnews", "mainnews"]) {
      try {
        const rows = await fetchNewsRange(key, sel, a, b);
        for (const r of rows) store.rows[`${sel}:${r.id}`] = { s: sel, t: r.timestamp, n: r.news };
      } catch (e) {
        // A window that errored is a HOLE, not an empty month, and nothing
        // later fills it — the next run starts from capturedThrough and never
        // looks back. Record it so the page can say the history is partial
        // instead of drawing a confident line through missing years.
        failed.push({ sel, from: a, to: b, error: e.message });
        console.warn(`[fachist] ${sel} ${a}-${b}: ${e.message}`);
      }
    }
    done++;
    if (onProgress) onProgress(done, windows.length);
  }

  // Only claim coverage up to the last window that actually succeeded,
  // so a retry can pick the holes up rather than skipping past them.
  const firstFail = failed.length ? Math.min(...failed.map((f) => f.from)) : null;
  store.capturedThrough = firstFail ? firstFail - 1 : now;
  store.failedWindows = failed.length;
  const ts = Object.values(store.rows).map((r) => r.t).filter(Boolean);
  if (ts.length) store.floor = Math.min(...ts);
  saveCapturedNews(factionId, store);
  return { ...store, failed };
}

// ── Pure aggregation ───────────────────────────────────────────────────

const GYM_STATS = ["strength", "speed", "defense", "dexterity"];
// Lifetime per-member combat contributions. `respect` is NOT among them —
// the API rejects it, because Torn does not track respect per person.
const COMBAT_STATS = ["attackswon", "attackshosp", "attacksmug", "busts", "revives"];

export function buildLifetime({ stats = {}, basic = {}, contributors = {}, combat = {}, now = Date.now() }) {
  const num = (k) => Number(stats[k]) || 0;

  // The four gym counters are ENERGY SPENT on that stat, not points gained —
  // confirmed against the in-game upgrade challenge, which reads the same
  // 16,734,090 for defense. Each train spends on exactly one stat, so they sum
  // without double counting. `gymenergy` is a dead counter that reads 0.
  const byStat = Object.fromEntries(GYM_STATS.map((s) => [s, num(`gym${s}`)]));
  const trained = GYM_STATS.reduce((a, s) => a + byStat[s], 0);
  const trains = num("gymtrains");

  // Merge the per-stat contributor lists into one row per member.
  const members = new Map();
  let current = 0, departed = 0;
  for (const stat of GYM_STATS) {
    for (const row of contributors[stat] || []) {
      const id = String(row.id);
      if (!members.has(id)) {
        members.set(id, {
          id: row.id, username: row.username, inFaction: !!row.in_faction,
          byStat: Object.fromEntries(GYM_STATS.map((s) => [s, 0])), total: 0,
        });
      }
      const m = members.get(id);
      const v = Number(row.value) || 0;
      m.byStat[stat] = v;
      m.total += v;
      if (row.in_faction) current += v; else departed += v;
    }
  }

  // Fold the combat contributions onto the same member rows. A member who
  // has trained but never attacked (or vice versa) still gets one row.
  for (const stat of COMBAT_STATS) {
    for (const row of combat[stat] || []) {
      const id = String(row.id);
      if (!members.has(id)) {
        members.set(id, {
          id: row.id, username: row.username, inFaction: !!row.in_faction,
          byStat: Object.fromEntries(GYM_STATS.map((s) => [s, 0])), total: 0,
        });
      }
      const m = members.get(id);
      m.combat ||= {};
      m.combat[stat] = Number(row.value) || 0;
    }
  }

  const createdAt = new Date(now - (Number(basic.days_old) || 0) * 86400000)
    .toISOString().slice(0, 10);

  return {
    createdAt,
    daysOld: Number(basic.days_old) || 0,
    respect: {
      total: Number(basic.respect) || 0,
      organisedCrime: num("organisedcrimerespect"),
      territory: num("territoryrespect"),
    },
    attacks: {
      won: num("attackswon"), lost: num("attackslost"), hospitalised: num("attackshosp"),
      leave: num("attacksleave"), runaway: num("attacksrunaway"), mugs: num("attacksmug"),
      damaging: num("attacksdamaging"), damage: num("attacksdamage"),
    },
    trainedEnergy: {
      total: trained, byStat, trains,
      perTrain: trains ? Math.round((trained / trains) * 10) / 10 : 0,
    },
    memberEnergy: { current, departed },
    members: [...members.values()].sort((a, b) => b.total - a.total),
    bestChain: num("bestchain"),
    rank: basic.rank || null,
    rankedWins: (basic.rank || {}).wins ?? null,
  };
}

/**
 * The cumulative respect curve.
 *
 * Torn never stored "respect on 3rd March" — only today's total and a stream
 * of timestamped awards. So the curve is a reconstruction, and the part it
 * cannot explain is returned rather than smoothed away: OC respect only
 * exists from OC 2.0 onward, so early years are genuinely incomplete and the
 * page should say so instead of drawing a confident line.
 */
export function buildRespectSeries({ chains = [], warRespect = [], crimeRespect = [], currentTotal = 0 }) {
  const events = [
    ...chains.map((c) => ({ t: c.start, respect: Number(c.respect) || 0, source: "chain" })),
    ...warRespect.map((w) => ({ t: w.t, respect: Number(w.respect) || 0, source: "war" })),
    ...crimeRespect.map((c) => ({ t: c.t, respect: Number(c.respect) || 0, source: "oc" })),
  ].filter((e) => e.t).sort((a, b) => a.t - b.t);

  let run = 0;
  const points = events.map((e) => {
    run += e.respect;
    return { t: e.t, delta: e.respect, source: e.source, cumulative: Math.round(run * 100) / 100 };
  });
  const tracked = Math.round(run * 100) / 100;
  return {
    points, tracked, currentTotal,
    unaccounted: Math.round((currentTotal - tracked) * 100) / 100,
    earliest: points.length ? points[0].t : null,
  };
}

/**
 * Attack respect rolled up from the per-day store into weeks, months, years
 * or all-time.
 *
 * Attacks are kept aggregated PER DAY PER MEMBER rather than as raw rows: a
 * year is roughly 76,000 of them and nothing here ever needs an individual
 * attack back. Days are the finest grain anything asks for, so they are the
 * grain stored, and every other period rolls out of them.
 *
 * Members are keyed by ID, never by name. Torn names are editable, and keying
 * on the name splits one person into two rows and halves their standing; the
 * most recently seen name is the one displayed.
 */
export function bucketAttacks({ days = {}, unattributed = {} } = {}, period = "month") {
  const keyFor = (date) => (period === "all"
    ? "all"
    : periodKey(Date.parse(`${date}T12:00:00Z`) / 1000, period));

  const buckets = new Map();
  const touch = (k) => {
    if (!buckets.has(k)) {
      buckets.set(k, { key: k, total: 0, attacks: 0, _m: new Map(),
                       unattributed: { respect: 0, attacks: 0 } });
    }
    return buckets.get(k);
  };

  for (const [date, members] of Object.entries(days)) {
    const b = touch(keyFor(date));
    for (const [id, v] of Object.entries(members)) {
      if (!b._m.has(id)) b._m.set(id, { id, name: v.n, respect: 0, attacks: 0, _last: "" });
      const m = b._m.get(id);
      m.respect += Number(v.r) || 0;
      m.attacks += Number(v.a) || 0;
      // Latest day wins the display name.
      if (date >= m._last) { m.name = v.n; m._last = date; }
      b.total += Number(v.r) || 0;
      b.attacks += Number(v.a) || 0;
    }
  }
  for (const [date, u] of Object.entries(unattributed)) {
    const b = touch(keyFor(date));
    b.unattributed.respect += Number(u.r) || 0;
    b.unattributed.attacks += Number(u.a) || 0;
    b.total += Number(u.r) || 0;
  }

  return [...buckets.values()]
    .map((b) => ({
      key: b.key,
      total: Math.round(b.total * 100) / 100,
      attacks: b.attacks,
      unattributed: {
        respect: Math.round(b.unattributed.respect * 100) / 100,
        attacks: b.unattributed.attacks,
      },
      members: [...b._m.values()].map((m) => ({
        id: m.id, name: m.name,
        respect: Math.round(m.respect * 100) / 100,
        attacks: m.attacks,
        avg: m.attacks ? Math.round((m.respect / m.attacks) * 100) / 100 : 0,
      })).sort((a, b2) => b2.respect - a.respect),
    }))
    .sort((a, b2) => a.key.localeCompare(b2.key));
}

/**
 * Respect grouped into weeks, months or years — "how are we doing lately",
 * which the cumulative curve cannot answer because it only ever goes up.
 *
 * Every bucket carries its SOURCE SPLIT and a `comparable` flag, because the
 * honest obstacle here is coverage, not arithmetic: war respect only exists
 * from Mar 2022 and OC respect only from OC 2.0, so 2020 is chains-only. A
 * year-on-year chart drawn from totals alone shows coverage arriving and
 * calls it the faction improving. `comparable: false` means the two periods
 * were not even measuring the same things.
 *
 * Empty periods are emitted as zeroes rather than skipped: a missing bar
 * silently shifts every later bar left and turns a quiet month into a
 * continuous run.
 *
 * All bucketing is UTC — local getters file an event near midnight into the
 * wrong period depending on where the server happens to be.
 */
const SOURCES = ["chain", "war", "oc"];

function periodKey(ts, period) {
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  if (period === "year") return String(y);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  if (period === "month") return `${y}-${m}`;
  // Monday-based week, named by that Monday.
  const monday = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function nextKey(key, period) {
  if (period === "year") return String(Number(key) + 1);
  if (period === "month") {
    const [y, m] = key.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function bucketRespect(points = [], period = "month", now = Date.now() / 1000) {
  const valid = points.filter((p) => p && p.t);
  if (!valid.length) return [];

  const acc = new Map();
  for (const p of valid) {
    const k = periodKey(p.t, period);
    if (!acc.has(k)) {
      acc.set(k, { key: k, total: 0, count: 0,
                   bySource: Object.fromEntries(SOURCES.map((s) => [s, 0])),
                   countBySource: Object.fromEntries(SOURCES.map((s) => [s, 0])) });
    }
    const b = acc.get(k);
    const v = Number(p.delta) || 0;
    b.total += v;
    b.count++;
    if (b.bySource[p.source] !== undefined) {
      b.bySource[p.source] += v;
      b.countBySource[p.source]++;
    }
  }

  // Walk from the first key to the last, minting empty buckets as we go.
  const first = periodKey(Math.min(...valid.map((p) => p.t)), period);
  const last = periodKey(Math.max(...valid.map((p) => p.t)), period);
  const out = [];
  for (let k = first; ; k = nextKey(k, period)) {
    out.push(acc.get(k) || { key: k, total: 0, count: 0,
                             bySource: Object.fromEntries(SOURCES.map((s) => [s, 0])),
                             countBySource: Object.fromEntries(SOURCES.map((s) => [s, 0])) });
    if (k === last || out.length > 5000) break;
  }

  const live = (b) => SOURCES.filter((s) => b.bySource[s] > 0).join(",");
  const nowKey = periodKey(now, period);
  for (let i = 0; i < out.length; i++) {
    const b = out[i];
    b.total = Math.round(b.total * 100) / 100;
    // The period containing "now" has not finished. Seven days into October
    // reads as a 72% collapse against September; it is a month that has not
    // happened yet, and it is the most misleading figure a progress chart can
    // print. It gets no percentage at all.
    b.partial = b.key === nowKey;
    const prev = i ? out[i - 1] : null;
    b.changePct = prev && prev.total > 0 && !b.partial
      ? Math.round(((b.total - prev.total) / prev.total) * 1000) / 10
      : null;
    // Only meaningful against something: the first bucket compares to nothing.
    b.comparable = prev ? live(b) === live(prev) : null;
  }
  return out;
}

export function buildWarRecord({ wars = [], reports = {}, factionId }) {
  const me = String(factionId);
  let won = 0, lost = 0, ongoing = 0;
  for (const w of wars) {
    if (w.winner == null) ongoing++;
    else if (String(w.winner) === me) won++;
    else lost++;
  }
  const rankTimeline = [];
  const warRespect = [];
  for (const w of wars) {
    const sides = reports[w.id];
    if (!sides) continue;
    const mine = sides.find((f) => String(f.id) === me);
    if (!mine) continue;
    if (mine.rank && (mine.rank.before || mine.rank.after)) {
      rankTimeline.push({ t: w.start, warId: w.id, before: mine.rank.before, after: mine.rank.after });
    }
    const r = (mine.rewards || {}).respect;
    if (r) warRespect.push({ t: w.end || w.start, respect: r });
  }
  rankTimeline.sort((a, b) => a.t - b.t);
  return {
    total: wars.length, won, lost, ongoing,
    rankTimeline, warRespect,
    earliest: wars.length ? Math.min(...wars.map((w) => w.start || Infinity)) : null,
  };
}

// Torn writes seven sentences for five events. The real hazard is not
// ordering but WHOSE NAME IS FIRST: in "X has accepted Y's application",
// "X has declined Y's application", "Y was kicked out by X" and "X changed
// Y's position", the leading name is the ADMIN and the member is second. A
// parser that takes the first name counts recruiters as joiners.
//
// The patterns are mutually exclusive — each is anchored on a distinct verb
// phrase ("has applied" / "has accepted" / "left" / "was kicked" / "changed
// Y's position" / "Y's position changed"), and none matches another's
// sentence. Verified by reordering them: no behaviour changes. So first-match
// is safe, and this list may be reordered freely.
/**
 * Leaders, co-leaders and faction names, from mainnews.
 *
 * This is the AUTHORITATIVE source and membershipnews is not. A faction
 * changing hands emits "Leadership was transferred to X" here and produces no
 * position-change row at all — which is why inferring leadership from
 * position changes missed every real handover, left six people reading as
 * current leader at once, and never recorded the sitting one.
 *
 * Torn seats exactly one leader and one co-leader, so a new appointment
 * closes the previous term by definition; no end-date row is needed and none
 * is emitted.
 */
const LEADER_NEWS = [
  [/^Leadership was transferred to (.+?)\.?$/i,
    (m) => [{ role: "Leader", who: m[1] }]],
  [/^Co-leadership of .+? has been transferred from (.+?) to (.+?) by (.+?)\.?$/i,
    (m) => [{ role: "Co-leader", who: m[2], by: m[3] }]],
  [/^Co-leadership of .+? has been given to (.+?) by (.+?)\.?$/i,
    (m) => [{ role: "Co-leader", who: m[1], by: m[2] }]],
  [/^(.+?) has been removed from co-leadership of .+? by (.+?)\.?$/i,
    (m) => [{ role: "Co-leader", who: null, by: m[2] }]],   // seat left empty
];
const NAME_CHANGE = /^(.+?) changed the faction name to:\s*(.+?)\.?$/i;

export function parseLeadershipNews(rows = []) {
  const leaders = [];
  const names = [];
  const seated = { Leader: null, "Co-leader": null };

  for (const row of [...rows].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))) {
    const text = String(row.news || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const t = row.timestamp;

    const nm = text.match(NAME_CHANGE);
    if (nm) { names.push({ t, name: nm[2].trim(), by: nm[1].trim() }); continue; }

    for (const [re, make] of LEADER_NEWS) {
      const m = text.match(re);
      if (!m) continue;
      for (const { role, who, by } of make(m)) {
        if (seated[role]) { seated[role].to = t; seated[role].current = false; }
        seated[role] = null;
        if (who) {
          const term = { who: who.trim(), role, from: t, to: null, current: true,
                         by: by ? by.trim() : null };
          leaders.push(term);
          seated[role] = term;
        }
      }
      break;
    }
  }
  return { leaders, names };
}

const PATTERNS = [
  [/^(\S+) has accepted (.+?)'s application to join the faction/i,
    (m) => ({ type: "joined", who: m[2], by: m[1] })],
  [/^(\S+) has declined (.+?)'s application to join the faction/i,
    (m) => ({ type: "declined", who: m[2], by: m[1] })],
  [/^(\S+) has applied to join the faction/i,
    (m) => ({ type: "applied", who: m[1] })],
  // Same action, Torn's other wording — 37 of 42055's rows use this one.
  [/^(\S+) sent an application to join the faction/i,
    (m) => ({ type: "applied", who: m[1] })],
  [/^(\S+) was kicked out of the faction by (\S+)/i,
    (m) => ({ type: "kicked", who: m[1], by: m[2] })],
  [/^(\S+) left the faction/i,
    (m) => ({ type: "left", who: m[1] })],
  [/^(\S+) changed (.+?)'s position from (.+?) to (.+?)\.?$/i,
    (m) => ({ type: "position", who: m[2], by: m[1], from: m[3], to: m[4] })],
  [/^(.+?)'s position changed from (.+?) to (.+?)\.?$/i,
    (m) => ({ type: "position", who: m[1], from: m[2], to: m[3] })],
];

const isLeadership = (r) => /^(leader|co-leader)$/i.test(String(r || "").trim());

// Recruitment housekeeping, not membership events. Listing them explicitly
// keeps `unparsed` meaning "a sentence we do not understand" — otherwise
// routine noise buries the one shape that genuinely needs handling.
const IGNORED_NEWS = [
  /has (un)?locked applications to join the faction/i,
  /set faction status to /i,
];

export function parseMembershipNews(rows = []) {
  const events = [], unparsed = [];
  let ignored = 0;
  for (const row of rows) {
    const text = String(row.news || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    let hit = null;
    for (const [re, make] of PATTERNS) {
      const m = text.match(re);
      if (m) { hit = { ...make(m), t: row.timestamp, text }; break; }
    }
    if (hit) events.push(hit);
    else if (IGNORED_NEWS.some((re) => re.test(text))) ignored++;
    else unparsed.push(text);
  }
  events.sort((a, b) => a.t - b.t);

  const leadership = events
    .filter((e) => e.type === "position" && (isLeadership(e.from) || isLeadership(e.to)))
    .map((e) => ({ t: e.t, who: e.who, from: e.from, to: e.to, by: e.by || null }));

  // Bucket by UTC month — a local-time getter would file events near midnight
  // into the wrong month depending on where the server happens to be.
  const buckets = new Map();
  for (const e of events) {
    const d = new Date(e.t * 1000);
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(k)) buckets.set(k, { month: k, joined: 0, left: 0, kicked: 0, applied: 0, declined: 0 });
    const b = buckets.get(k);
    if (b[e.type] !== undefined) b[e.type]++;
  }
  const monthly = [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const m of monthly) m.net = m.joined - m.left - m.kicked;

  return { events, leadership, monthly, unparsed, ignored };
}

// ── Member name cache ──────────────────────────────────────────────────
// Chain reports carry ids, never names, and a lifetime table is mostly
// people who have LEFT — so the roster cannot name them and nothing else on
// file does either. Names are resolved one call at a time, cached forever
// (they change rarely), highest-respect first so the visible top of the
// leaderboard fills in on the first run.

const namesFile = (factionId) => join(DATA_DIR, `faction-names-${factionId}.json`);

export function loadNames(factionId) {
  try {
    const f = namesFile(factionId);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8"));
  } catch (e) { console.warn(`[fachist] could not read names: ${e.message}`); }
  return {};
}

export function saveNames(factionId, names) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(namesFile(factionId), JSON.stringify(names));
  } catch (e) { console.error(`[fachist] could not persist names: ${e.message}`); }
}

/**
 * Names harvested from war reports already on disk.
 *
 * Each report lists our side's members with id AND name, and 167 of them are
 * cached from the war phase — so 278 of 335 otherwise-unknown historical
 * members can be named for nothing. Always run this before spending calls on
 * /user: paying to look up somebody whose name is sitting in a file is the
 * sort of waste that only shows up as a slow build.
 */
export function namesFromWarReports(reports = {}, factionId) {
  const me = String(factionId);
  const out = {};
  for (const sides of Object.values(reports)) {
    for (const f of sides || []) {
      if (String(f.id) !== me) continue;
      for (const m of f.members || []) if (m.name) out[String(m.id)] = m.name;
    }
  }
  return out;
}

export async function resolveNames(key, factionId, ids, { budget = 150 } = {}) {
  const names = loadNames(factionId);
  const todo = ids.map(String).filter((id) => !names[id]).slice(0, budget);
  let done = 0;
  for (const id of todo) {
    try {
      const u = await tornGet(`https://api.torn.com/v2/user/${encodeURIComponent(id)}`
        + `?selections=basic&key=${encodeURIComponent(key)}&comment=wb-fachist`);
      const n = (u.basic || u.profile || {}).name;
      if (n) names[id] = n;
    } catch (e) {
      // A deleted account cannot be named; remember that so it is not retried
      // on every build forever.
      names[id] = null;
    }
    if (++done % 25 === 0) saveNames(factionId, names);
  }
  saveNames(factionId, names);
  return { names, resolved: done, remaining: Math.max(0, ids.length - Object.keys(names).length) };
}

// ── Chain reports: lifetime respect per member ─────────────────────────
// The only route to per-member respect that reaches past Torn's one-year
// attack window. /faction/chainreport?id= gives every attacker's respect for
// that chain and reconciles exactly against the chain record. Chains run back
// to the faction's first weeks, and a finished chain never changes — so each
// report is fetched once and kept forever.
//
// It covers CHAIN respect, which is the dominant source and the one the
// respect panel counts; attacks made outside a chain are not in it.

const chainFile = (factionId) => join(DATA_DIR, `faction-chainreports-${factionId}.json`);

export function loadChainReports(factionId) {
  try {
    const f = chainFile(factionId);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8"));
  } catch (e) {
    console.warn(`[fachist] could not read chain reports: ${e.message}`);
  }
  return { chains: {} };
}

export function saveChainReports(factionId, store) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(chainFile(factionId), JSON.stringify(store));
  } catch (e) {
    console.error(`[fachist] could not persist chain reports: ${e.message}`);
  }
}

/**
 * Fold one report in. Keyed by chain id and REPLACED rather than added, so
 * re-fetching immutable data is idempotent — adding would inflate everybody
 * on any re-run.
 */
export function foldChainReport(store, report, startTs) {
  store.chains ||= {};
  const m = {};
  for (const a of report.attackers || []) {
    const r = Math.round(((a.respect || {}).total || 0) * 100) / 100;
    m[a.id] = [r, (a.attacks || {}).total || 0];
  }
  store.chains[String(report.id)] = { t: startTs, m };
  return store;
}

/**
 * Lifetime respect per member, optionally also bucketed by period.
 *
 * Names are not in the reports — only ids — so a lookup is passed in and an
 * unknown id renders as the id rather than vanishing. Members who left years
 * ago are exactly the ones a lifetime table should still show.
 */
export function lifetimeChainRespect(store, names = {}, { period = null } = {}) {
  const totals = new Map();
  const periods = new Map();
  let chains = 0;

  for (const [, rec] of Object.entries(store.chains || {})) {
    chains++;
    const pk = period && rec.t ? periodKey(rec.t, period) : null;
    for (const [id, [respect, attacks]] of Object.entries(rec.m || {})) {
      if (!totals.has(id)) totals.set(id, { id, respect: 0, attacks: 0 });
      const t = totals.get(id);
      t.respect += respect;
      t.attacks += attacks;
      if (pk) {
        if (!periods.has(pk)) periods.set(pk, { key: pk, total: 0, m: new Map() });
        const p = periods.get(pk);
        p.total += respect;
        p.m.set(id, (p.m.get(id) || 0) + respect);
      }
    }
  }

  const name = (id) => names[id] || String(id);
  const members = [...totals.values()].map((t) => ({
    id: t.id, name: name(t.id),
    respect: Math.round(t.respect * 100) / 100,
    attacks: t.attacks,
    avg: t.attacks ? Math.round((t.respect / t.attacks) * 100) / 100 : 0,
  })).sort((a, b) => b.respect - a.respect);

  return {
    chains, members,
    total: Math.round(members.reduce((a, m) => a + m.respect, 0) * 100) / 100,
    periods: [...periods.values()].sort((a, b) => a.key.localeCompare(b.key))
      .map((p) => ({
        key: p.key, total: Math.round(p.total * 100) / 100,
        members: [...p.m.entries()].map(([id, r]) => ({
          id, name: name(id), respect: Math.round(r * 100) / 100,
        })).sort((a, b) => b.respect - a.respect),
      })),
  };
}

/**
 * Fetch reports for chains we do not have yet, newest first, on a budget.
 * One call per chain and never repeated, so the cost falls to near zero once
 * the history is in.
 */
export async function captureChainReports(key, factionId, chains, { budget = 300, onProgress } = {}) {
  const store = loadChainReports(factionId);
  store.chains ||= {};
  const todo = chains.filter((c) => !store.chains[String(c.id)]);
  let done = 0;
  for (const c of todo.slice(0, budget)) {
    try {
      const r = (await v2(`chainreport?id=${encodeURIComponent(c.id)}`, key)).chainreport;
      if (r) foldChainReport(store, { id: c.id, attackers: r.attackers }, c.start);
    } catch (e) {
      console.warn(`[fachist] chainreport ${c.id}: ${e.message}`);
    }
    done++;
    if (done % 25 === 0) { saveChainReports(factionId, store); if (onProgress) onProgress({ done, todo: todo.length }); }
  }
  saveChainReports(factionId, store);
  return { store, fetched: done, remaining: Math.max(0, todo.length - done) };
}

// ── Captured attacks ───────────────────────────────────────────────────
// Torn keeps roughly one YEAR of attacks and the window rolls, so the same
// argument as the news applies: anything not copied out is gone. Stored
// aggregated per day per member — a year of raw rows is ~76,000 records and
// nothing needs an individual attack back.

const attackFile = (factionId) => join(DATA_DIR, `faction-attacks-${factionId}.json`);

export function loadCapturedAttacks(factionId) {
  try {
    const f = attackFile(factionId);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8"));
  } catch (e) {
    console.warn(`[fachist] could not read captured attacks: ${e.message}`);
  }
  return { days: {}, unattributed: {}, capturedThrough: 0, floor: null };
}

export function saveCapturedAttacks(factionId, store) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(attackFile(factionId), JSON.stringify(store));
  } catch (e) {
    console.error(`[fachist] could not persist captured attacks: ${e.message}`);
  }
}

/**
 * Fold a page of attacks into the per-day store.
 *
 * Direction matters: the feed carries incoming attacks too, and their
 * respect_gain belongs to the OTHER faction. A stealthed attack has no
 * attacker at all (about one in eight) and is kept as unattributed so the
 * totals still reconcile.
 */
export function foldAttacks(store, attacks, factionId) {
  const me = String(factionId);
  for (const a of attacks) {
    const t = a.started || 0;
    if (!t) continue;
    const date = new Date(t * 1000).toISOString().slice(0, 10);
    const gain = Number(a.respect_gain) || 0;
    const atkr = a.attacker;

    if (!atkr) {
      const u = (store.unattributed[date] ||= { r: 0, a: 0 });
      u.r += gain; u.a++;
      continue;
    }
    if (!atkr.faction || String(atkr.faction.id) !== me) continue;

    const day = (store.days[date] ||= {});
    const id = String(atkr.id);
    const m = (day[id] ||= { n: atkr.name, r: 0, a: 0 });
    m.n = atkr.name;
    m.r = Math.round((m.r + gain) * 100) / 100;
    m.a++;
  }
  return store;
}

/**
 * Was this whole UTC day read, or only clipped by the covered interval?
 *
 * The distinction that the day-key gap check missed: a day can be present in
 * the store and hold a fraction of its attacks, which reads as a quiet day
 * rather than an unread one.
 */
export function dayIsCovered(store, day) {
  if (!store || !store.coveredFrom || !store.coveredTo) return false;
  const start = Date.parse(`${day}T00:00:00Z`) / 1000;
  return start >= store.coveredFrom && start + 86400 <= store.coveredTo;
}

/**
 * Bring the attack store up to date, tracking a CONTIGUOUS covered interval.
 *
 * The earlier version tracked which calendar days it had seen, which is not
 * the same thing and quietly lost data: a day can be present and incomplete.
 * It recorded 69 of ~900 attacks on 2026-10-02 — a 9,200-respect chain nearly
 * all missing — while a gap check over day KEYS reported no holes at all.
 * The leaderboard looked plausible and was wrong.
 *
 * So coverage is an interval [coveredFrom, coveredTo] in seconds, extended
 * only from its own edges and never jumped:
 *
 *   forward   from now back until it REACHES coveredTo. If it cannot get
 *             there within the safety cap it leaves coveredTo alone, because
 *             claiming the new rows without the rows between them is how the
 *             hole got there in the first place.
 *   backfill  from coveredFrom backwards, on a page budget, since Torn's full
 *             year is ~2,470 pages and taking it in one run would hold half
 *             the faction's API budget for 45 minutes.
 */
export async function captureAttacks(key, factionId, { maxBackfillPages = 120, onProgress } = {}) {
  const store = loadCapturedAttacks(factionId);
  store.days ||= {};
  store.unattributed ||= {};

  const now = Math.floor(Date.now() / 1000);
  let pages = 0, rows = 0, phaseName = "recent";
  const page = async (to) => {
    const batch = (await v2(`attacks?limit=100${to ? `&to=${to}` : ""}`, key)).attacks || [];
    if (batch.length) {
      foldAttacks(store, batch, factionId);
      pages++; rows += batch.length;
      if (onProgress) onProgress({ rows, pages, phase: phaseName });
    }
    return batch;
  };

  // ── forward ───────────────────────────────────────────────────────────
  const cold = !store.coveredTo;
  // A cold store has nothing to join up to, so it just takes a recent slice
  // and lets the budgeted backfill do the depth. A warm store MUST reach its
  // own edge, and the gap is normally hours, so the cap is only a backstop.
  const forwardCap = cold ? 30 : 600;
  let to = null, reached = cold, oldestSeen = now;
  for (let i = 0; i < forwardCap; i++) {
    let batch;
    try { batch = await page(to); } catch (e) {
      console.warn(`[fachist] attacks forward: ${e.message}`); break;
    }
    if (!batch.length) { reached = true; break; }
    const oldest = Math.min(...batch.map((x) => x.started || 0));
    oldestSeen = Math.min(oldestSeen, oldest);
    if (!oldest || oldest === to) { reached = true; break; }
    if (!cold && oldest <= store.coveredTo) { reached = true; break; }
    to = oldest;
  }

  if (cold) {
    store.coveredTo = now;
    store.coveredFrom = oldestSeen;
  } else if (reached) {
    store.coveredTo = now;                 // the interval is joined up
  } else {
    // Ran out of pages before meeting the old edge. The new rows are kept —
    // they are real — but coverage is NOT claimed across the gap, so the next
    // run tries again from the same edge rather than stranding a hole.
    console.warn(`[fachist] attacks: forward pass did not reach the covered edge; `
      + `coverage left at ${store.coveredTo}`);
  }

  // ── backfill ──────────────────────────────────────────────────────────
  if (!store.backfillDone && store.coveredFrom) {
    phaseName = "backfill";
    let cursor = store.coveredFrom;
    for (let i = 0; i < maxBackfillPages && cursor; i++) {
      let batch;
      try { batch = await page(cursor); } catch (e) {
        console.warn(`[fachist] attacks backfill: ${e.message}`); break;
      }
      if (!batch.length) { store.backfillDone = true; break; }
      const oldest = Math.min(...batch.map((x) => x.started || 0));
      if (!oldest || oldest === cursor) { store.backfillDone = true; break; }
      cursor = oldest;
      store.coveredFrom = cursor;          // advance only as far as actually read
      // Persist as we go. A full backfill is ~2,470 pages and three quarters
      // of an hour; saving only at the end means a restart, a crash or a
      // rate-limit give-up throws the lot away and starts again tomorrow.
      if (i % 50 === 49) saveCapturedAttacks(factionId, store);
    }
  }

  store.capturedThrough = store.coveredTo || now;
  store.floor = store.coveredFrom
    ? new Date(store.coveredFrom * 1000).toISOString().slice(0, 10) : null;
  saveCapturedAttacks(factionId, store);
  return { store, pages, rows };
}

// ── Built-payload cache ────────────────────────────────────────────────
// A full first build is ~370 paced calls (~4.5 min). Persisting it means a
// restart does not pay that again, and the daily refresh is cheap because the
// news capture is incremental.

const builtFile = (factionId) => join(DATA_DIR, `faction-history-${factionId}.json`);

export function loadBuilt(factionId) {
  try {
    const f = builtFile(factionId);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8"));
  } catch (e) {
    console.warn(`[fachist] could not read built payload: ${e.message}`);
  }
  return null;
}

export function saveBuilt(factionId, payload) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(builtFile(factionId), JSON.stringify(payload));
  } catch (e) {
    console.error(`[fachist] could not persist built payload: ${e.message}`);
  }
}

/**
 * Build the whole history, cheapest phase first.
 *
 * Ordered so the page fills in rather than spinning: the lifetime panel needs
 * six calls and lands in seconds, while the rank timeline needs one call per
 * war and arrives minutes later. `onUpdate` is called after every phase with
 * the payload so far, so a caller can serve partial results.
 */
export async function buildAll({ key, factionId, onUpdate = () => {} }) {
  const payload = { factionId, builtAt: Date.now(), phase: null, phases: [] };
  const phase = (name, extra) => {
    payload.phase = name;
    payload.phases.push(name);
    Object.assign(payload, extra || {});
    onUpdate(payload);
  };

  const [stats, basic] = [await fetchStats(key), await fetchBasic(key)];
  const contributors = {};
  for (const s of GYM_STATS) {
    try { contributors[s] = await fetchContributors(key, `gym${s}`); }
    catch (e) { console.warn(`[fachist] contributors gym${s}: ${e.message}`); contributors[s] = []; }
  }
  // The combat side of the same endpoint. These ARE lifetime per member,
  // which the attack-log leaderboard can never be.
  const combat = {};
  for (const s of COMBAT_STATS) {
    try { combat[s] = await fetchContributors(key, s); }
    catch (e) { console.warn(`[fachist] contributors ${s}: ${e.message}`); combat[s] = []; }
  }
  phase("lifetime", { lifetime: buildLifetime({ stats, basic, contributors, combat }) });

  const wars = await fetchAllRankedWars(key);
  phase("wars", { wars: buildWarRecord({ wars, reports: {}, factionId }) });

  const chains = await fetchAllChains(key);
  payload._chains = chains;
  let respectInput = { chains, warRespect: [], crimeRespect: [],
                       currentTotal: Number(basic.respect) || 0 };
  phase("chains", { respect: buildRespectSeries(respectInput), chainCount: chains.length });

  const degraded = [];
  const crimeRespect = await fetchCrimeRespect(key, 0).catch((e) => {
    console.warn(`[fachist] crimes: ${e.message}`);
    degraded.push(`organised-crime respect unavailable: ${e.message}`);
    return [];
  });
  respectInput = { ...respectInput, crimeRespect };
  phase("crimes", { respect: buildRespectSeries(respectInput) });

  // News last-but-one: the first capture is the single most expensive phase,
  // and everything above is useful without it.
  const captured = await captureNews(key, factionId, {
    earliest: Math.floor(Date.now() / 1000) - 8 * 365 * 86400,
    // captureNews reports (done, total) windows, not a payload — wrap it, or
    // the longest phase of the build shows no progress at all.
    onProgress: (done, total) => {
      payload.newsProgress = { done, total };
      onUpdate(payload);
    },
  }).catch((e) => { console.warn(`[fachist] news: ${e.message}`); return { rows: {} }; });
  const memberRows = Object.values(captured.rows || {})
    .filter((r) => r.s === "membershipnews")
    .map((r) => ({ id: r.t, timestamp: r.t, news: r.n }));
  const churn = parseMembershipNews(memberRows);
  // Leadership comes from mainnews, not membershipnews: a handover emits
  // "Leadership was transferred to X" there and no position-change row at all.
  const mainRows = Object.values(captured.rows || {})
    .filter((r) => r.s === "mainnews")
    .map((r) => ({ timestamp: r.t, news: r.n }));
  const { leaders, names } = parseLeadershipNews(mainRows);
  if (captured.failed && captured.failed.length) {
    degraded.push(`${captured.failed.length} news window(s) failed — roster history is incomplete`);
  }
  phase("news", {
    churn: { monthly: churn.monthly,
             leaders, names,
             eventCount: churn.events.length, unparsedCount: churn.unparsed.length,
             ignoredCount: churn.ignored,
             floor: captured.floor || null,
             failedWindows: (captured.failed || []).length },
    degraded,
  });

  // One call per war. Cached reports are reused so a daily rebuild only
  // fetches wars it has never seen.
  const prior = loadBuilt(factionId) || {};
  const reports = { ...(prior.reportsRaw || {}) };
  let done = 0;
  for (const w of wars) {
    if (!reports[w.id]) {
      try { reports[w.id] = await fetchWarReport(key, w.id); }
      catch (e) { console.warn(`[fachist] war ${w.id}: ${e.message}`); reports[w.id] = []; }
    }
    done++;
    if (done % 10 === 0) {
      payload.reportProgress = { done, total: wars.length };
      onUpdate(payload);
    }
  }
  const warRecord = buildWarRecord({ wars, reports, factionId });
  respectInput = { ...respectInput, warRespect: warRecord.warRespect };
  phase("reports", {
    wars: warRecord,
    respect: buildRespectSeries(respectInput),
    reportsRaw: reports,
    reportProgress: { done: wars.length, total: wars.length },
  });

  // Attacks last: the first capture walks Torn's whole ~1 year of log, which
  // is the single most expensive thing here, and everything above is useful
  // without it. Later runs stop at what is already stored.
  let attackStore = { days: {}, unattributed: {} };
  try {
    const res = await captureAttacks(key, factionId, {
      // captureAttacks reports a single object, not (rows, pages) — the
      // two-arg form silently nested it and the phase showed no progress.
      onProgress: (p) => {
        payload.attackProgress = p;
        onUpdate(payload);
      },
    });
    attackStore = res.store;
  } catch (e) {
    console.warn(`[fachist] attacks: ${e.message}`);
    degraded.push(`attack history unavailable: ${e.message}`);
  }
  // Lifetime respect per member. The only source that reaches past Torn's
  // one-year attack window, because a chain report is immutable and chains
  // run back to 2019 — so this is fetched once per chain, forever.
  // Names come from three places, cheapest first: the persistent cache, then
  // anyone seen attacking recently, then the current roster. Only ids none of
  // them know cost an API call.
  // Free sources first, paid lookups only for what is left.
  const nameMap = { ...namesFromWarReports(reports, factionId), ...loadNames(factionId) };
  for (const m of (attackStore.days ? Object.values(attackStore.days) : [])) {
    for (const [id, v] of Object.entries(m)) nameMap[id] ||= v.n;
  }
  for (const m of (payload.lifetime || {}).members || []) nameMap[String(m.id)] ||= m.username;
  let chainRespect = null;
  try {
    const cr = await captureChainReports(key, factionId, chains, {
      budget: 300,
      onProgress: (p2) => { payload.chainReportProgress = p2; onUpdate(payload); },
    });
    // Resolve a few unknown ids per build, richest first, so the top of the
    // table is named even on a faction whose history is mostly ex-members.
    const ranked = lifetimeChainRespect(cr.store, nameMap);
    const unknown = ranked.members.filter((m) => m.name === String(m.id)).map((m) => m.id);
    if (unknown.length) {
      // Persist the free ones too, so a later build never re-derives them.
      saveNames(factionId, { ...namesFromWarReports(reports, factionId), ...loadNames(factionId) });
      const { names } = await resolveNames(key, factionId, unknown, { budget: 60 });
      Object.assign(nameMap, names);
    }
    chainRespect = {
      ...lifetimeChainRespect(cr.store, nameMap),
      remaining: cr.remaining,
      totalChains: chains.length,
      unnamed: unknown.length,
    };
  } catch (e) {
    console.warn(`[fachist] chain reports: ${e.message}`);
    degraded.push(`lifetime respect per member unavailable: ${e.message}`);
  }

  phase("attacks", {
    chainRespect,
    attacks: {
      floor: attackStore.floor || null,
      backfillDone: !!attackStore.backfillDone,
      byWeek: bucketAttacks(attackStore, "week"),
      byMonth: bucketAttacks(attackStore, "month"),
      byYear: bucketAttacks(attackStore, "year"),
      all: bucketAttacks(attackStore, "all")[0] || null,
    },
  });

  delete payload._chains;
  payload.phase = "done";
  payload.builtAt = Date.now();
  saveBuilt(factionId, payload);
  onUpdate(payload);
  return payload;
}
