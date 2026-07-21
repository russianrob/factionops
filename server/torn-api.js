/**
 * Torn API helper functions for server-side calls.
 */

/** Mask an API key for safe logging — shows only last 4 chars. */
const maskKey = (key) => key ? `****${String(key).slice(-4)}` : '****';

/**
 * Fetch faction member statuses from the Torn API.
 * Returns a map of memberId → { status, until, lastAction, online, level, name }.
 */
export async function fetchFactionMembers(factionId, apiKey) {
  const url = `https://api.torn.com/faction/${encodeURIComponent(factionId)}?selections=basic&key=${encodeURIComponent(apiKey)}&comment=wb-api`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Torn API returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  }

  // Use Torn's response timestamp to compensate for API cache age.
  // data.timestamp is when Torn generated the response — may be up to 29s
  // stale. Using wallclock (Date.now) as the reference subtracts the
  // cache age automatically, giving the client an already-adjusted value.
  //
  // Keep sub-second precision: Math.floor() here overstates remaining time
  // by up to 1s, which makes the client's local tick reach 0 slightly
  // after the target is actually out of hospital. The client-side
  // interceptor already avoids this by using Date.now()/1000 directly.
  const now = Date.now() / 1000;
  const statuses = {};
  if (data.members) {
    for (const [memberId, member] of Object.entries(data.members)) {
      // Torn API returns `until` as a Unix timestamp; convert to seconds remaining
      // Using wallclock (not data.timestamp) so cache age is already subtracted
      const untilTs = member.status?.until ?? 0;
      const untilRemaining = untilTs > 0 ? Math.max(0, untilTs - now) : 0;
      statuses[memberId] = {
        name: member.name,
        level: member.level,
        status: (member.status?.state ?? "Okay").toLowerCase(),
        description: member.status?.description ?? "",
        until: untilRemaining,
        lastAction: member.last_action?.relative ?? "Unknown",
        activity: (member.last_action?.status ?? "Offline").toLowerCase(),
      };
    }
  }

  return statuses;
}

/**
 * Fetch full faction basic data from the Torn API.
 * Returns the complete basic response including faction-level fields
 * (name, age, best_chain, respect, members) and per-member data.
 */
export async function fetchFactionBasic(factionId, apiKey) {
  const url = `https://api.torn.com/faction/${encodeURIComponent(factionId)}?selections=basic&key=${encodeURIComponent(apiKey)}&comment=wb-api`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Torn API returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  }

  return data;
}

/**
 * Fetch faction chain data from the Torn API.
 * Returns { current, max, timeout, cooldown }.
 */
export async function fetchFactionChain(factionId, apiKey) {
  const url = `https://api.torn.com/faction/${encodeURIComponent(factionId)}?selections=chain&key=${encodeURIComponent(apiKey)}&comment=wb-api`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Torn API returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  }

  const chain = data.chain ?? {};
  return {
    current: chain.current ?? 0,
    max: chain.max ?? 0,
    timeout: chain.timeout ?? 0,
    cooldown: chain.cooldown ?? 0,
    timestamp: data.timestamp ?? 0,
  };
}

/**
 * Fetch a key's own access level + available faction selections.
 * Torn v1: GET /key/?selections=info → { access_level, access_type,
 * selections: { faction: [...], user: [...], ... } }. Used to route
 * pooled keys away from calls they can't serve (e.g. a Custom key
 * without `chain`). Returns { accessLevel:number, factionSelections:string[] }.
 */
export async function fetchKeyInfo(apiKey) {
  const url = `https://api.torn.com/key/?selections=info&key=${encodeURIComponent(apiKey)}&comment=wb-api`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Torn API returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  }

  return {
    accessLevel: Number(data.access_level) || 0,
    factionSelections: Array.isArray(data.selections?.faction)
      ? data.selections.faction.map(String)
      : [],
  };
}

/**
 * Fetch current ranked war data for a faction.
 * Returns { warId, enemyFactionId, enemyFactionName, myScore, enemyScore } or null if no active ranked war.
 *
 * Torn API v1: GET /faction/<factionId>?selections=rankedwars&key=KEY
 */
export async function fetchRankedWar(factionId, apiKey) {
  const url = `https://api.torn.com/faction/${encodeURIComponent(factionId)}?selections=rankedwars&key=${encodeURIComponent(apiKey)}&comment=wb-api`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Torn API returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  }

  // rankedwars is an object keyed by war ID
  if (!data.rankedwars || typeof data.rankedwars !== 'object') {
    return null; // no active ranked war
  }

  // Find the active war (winner === 0 means ongoing)
  for (const [warId, warData] of Object.entries(data.rankedwars)) {
    const factions = warData.factions;
    if (!factions || typeof factions !== 'object') continue;

    const factionIds = Object.keys(factions);
    if (factionIds.length !== 2) continue;

    // Check if war is still active (winner is 0 or undefined)
    if (warData.war && warData.war.winner && warData.war.winner !== 0) continue;

    // Find the enemy faction (the one that isn't us)
    const myFid = String(factionId);
    const enemyFid = factionIds.find(fid => String(fid) !== myFid);
    if (!enemyFid) continue;

    return {
      warId: String(warId),
      enemyFactionId: enemyFid,
      enemyFactionName: factions[enemyFid]?.name || null,
      myScore: factions[myFid]?.score || 0,
      enemyScore: factions[enemyFid]?.score || 0,
      warStart: warData.war?.start || 0,
      warTarget: warData.war?.target || 0,
    };
  }

  return null; // no active ranked war found
}

/**
 * Fetch the ranked war report for a faction's most recent ranked war.
 * Returns the raw rankedwarreport data from the Torn API.
 */
export async function fetchRankedWarReport(factionId, apiKey, warId) {
  // v2 endpoint: /v2/faction/rankedwarreport?id=WAR_ID
  // If no warId provided, fetch rankedwars first to find the last completed war.
  // 2026-05-16: also trigger the lookup when warId looks like the warboard's
  // internal 'war_<factionId>' format — that's NOT a Torn rank ID, and passing
  // it straight to Torn returns 0 loot because the rank ID lookup fails.
  let rwId = warId;
  if (rwId && /^war_/i.test(String(rwId))) {
    rwId = null; // force lookup of the actual Torn ranked war ID
  }
  if (!rwId) {
    const rwUrl = `https://api.torn.com/faction/${encodeURIComponent(factionId)}?selections=rankedwars&key=${encodeURIComponent(apiKey)}&comment=wb-api`;
    const rwRes = await fetch(rwUrl);
    if (rwRes.ok) {
      const rwData = await rwRes.json();
      if (rwData.rankedwars) {
        // Find the most recent completed war (winner !== 0)
        let latest = null;
        for (const [id, w] of Object.entries(rwData.rankedwars)) {
          if (w.war && w.war.winner && w.war.winner !== 0) {
            if (!latest || Number(id) > Number(latest)) latest = id;
          }
        }
        // If no completed war, try the most recent active one
        if (!latest) {
          for (const id of Object.keys(rwData.rankedwars)) {
            if (!latest || Number(id) > Number(latest)) latest = id;
          }
        }
        rwId = latest;
      }
    }
  }
  if (!rwId) throw new Error("No ranked war found");
  const url = `https://api.torn.com/v2/faction/rankedwarreport?id=${encodeURIComponent(rwId)}&key=${encodeURIComponent(apiKey)}&comment=wb-api`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Torn API returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  }

  return data.rankedwarreport || data;
}

/**
 * Fetch a single user's profile data.
 * Returns the raw Torn profile response; caller parses status/activity.
 */
export async function fetchUserProfile(userId, apiKey) {
  const url = `https://api.torn.com/user/${encodeURIComponent(userId)}?selections=profile&key=${encodeURIComponent(apiKey)}&comment=wb-api`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Torn API returned HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  }
  return data;
}

/**
 * Fetch recent faction attacks (single page, no pagination).
 * Used by the low-latency attacks-feed watcher for near-real-time hospital
 * detection. `fromTs` is a Unix timestamp in seconds — only attacks newer
 * than that are returned.
 */
/**
 * Fetch faction armoury-category news entries newer than `fromTs`.
 *
 * Returns array of { id, news (HTML), timestamp } sorted ascending. The
 * news string is HTML — extract player name + action via regex on the
 * caller side. Examples of armory entries:
 *   "<a href=...>Foo</a> took 2 x Xanax from the armoury"
 *   "<a href=...>Bar</a> deposited 1 x EPI from the armoury"
 *   "<a href=...>Baz</a> used 1 x SE from the armoury"
 *
 * Pagination: Torn returns up to ~100 entries per call. For long
 * gaps (server downtime, etc.) the caller should walk back in chunks.
 *
 * @param {string} factionId
 * @param {string} apiKey
 * @param {number} fromTs Unix seconds (only news newer than this returned)
 */
export async function fetchFactionArmouryNews(factionId, apiKey, fromTs) {
  return fetchFactionArmouryNewsRange(factionId, apiKey, fromTs, null);
}

/**
 * Like fetchFactionArmouryNews but also accepts a `toTs` upper bound.
 * Useful for time-window queries (e.g. "all xanax events between
 * warStart-24h and warEnd"). Both bounds inclusive in unix seconds.
 * Pass null/undefined for either bound to leave it open.
 */
export async function fetchFactionArmouryNewsRange(factionId, apiKey, fromTs, toTs) {
  const params = new URLSearchParams({
    selections: "armorynews",
    key: apiKey,
    comment: "wb-armory",
  });
  if (fromTs && Number.isFinite(+fromTs)) params.set("from", String(+fromTs));
  if (toTs   && Number.isFinite(+toTs))   params.set("to",   String(+toTs));
  const url = `https://api.torn.com/faction/${encodeURIComponent(factionId)}?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Torn API returned HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  const raw = data.armorynews || {};
  return Object.entries(raw)
    .map(([id, v]) => ({ id, news: v.news || "", timestamp: Number(v.timestamp) || 0 }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchRecentFactionAttacks(factionId, apiKey, fromTs) {
  const url = `https://api.torn.com/faction/${encodeURIComponent(factionId)}?selections=attacks&from=${encodeURIComponent(fromTs)}&key=${encodeURIComponent(apiKey)}&comment=wb-api`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Torn API returned HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  }
  return Object.values(data.attacks || {});
}

/**
 * Fetch faction attack log for a time period, paginating through all results.
 * Returns array of attack objects. Filters to ranked_war attacks only.
 */
export async function fetchFactionAttacks(factionId, apiKey, fromTs, toTs, options = {}) {
  // v5.0.57: opt-in to ALL attacks (not just ranked_war) so callers
  // that want a war-vs-total split (war-payouts) can compute it.
  // Default stays rankedWarOnly:true so existing callers (post-war
  // bleed analysis, etc.) keep their previous behavior unchanged.
  const rankedWarOnly = options.rankedWarOnly !== false;
  const allAttacks = [];
  let currentFrom = fromTs;
  // v5.0.62: bumped from 30 → 200. Torn returns ≤100 attacks per
  // page; busy ranked wars (e.g. Ringside 41296 had ~3700+ ranked
  // attacks across 90 members) blew past the prior 3000-attack
  // ceiling and Payouts under-counted by 40-60%.
  const MAX_PAGES = 200;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `https://api.torn.com/faction/${encodeURIComponent(factionId)}?selections=attacks&from=${currentFrom}&to=${toTs}&key=${encodeURIComponent(apiKey)}&comment=wb-api`;
    // v5.0.67: retry-with-backoff on transient code 5 (rate limit) so
    // a busy moment in the shared key pool doesn't kill an in-progress
    // multi-page fetch. Only retry code 5 — code 7 (key invalid) is
    // permanent for this key and should propagate so the caller can
    // quarantine + try another key.
    let data;
    let attempt = 0;
    const MAX_ATTEMPTS = 4;
    while (true) {
      const res = await fetch(url);
      if (!res.ok) {
        const e = new Error(`Torn HTTP ${res.status}`);
        e.httpStatus = res.status;
        throw e;
      }
      data = await res.json();
      if (!data.error) break; // success
      if (data.error.code === 5 && attempt < MAX_ATTEMPTS - 1) {
        attempt++;
        const backoffMs = 5000 * attempt; // 5s, 10s, 15s
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      const e = new Error(`Torn API: ${data.error.error} (code ${data.error.code})`);
      e.code = data.error.code;
      throw e;
    }

    const attacks = Object.values(data.attacks || {});
    if (attacks.length === 0) break;

    const filtered = rankedWarOnly
      ? attacks.filter(a => a.ranked_war === 1)
      : attacks;
    allAttacks.push(...filtered);

    // v5.0.63: paginate until we've definitively covered the requested
    // window. Old logic broke on `attacks.length < 100` — but the v1
    // attacks endpoint can return <100 in a partial sub-window even
    // when far more attacks exist after the last batch's maxTs (the
    // Ringside fetch was stopping at page 38 / 99 attacks, missing
    // the next ~8 hours of the 19h war). Now we paginate until either
    // (a) the API returns zero (true end), or (b) the next from would
    // pass our requested toTs.
    const maxTs = Math.max(...attacks.map(a => a.timestamp_ended || a.timestamp_started || 0));
    if (maxTs <= currentFrom) break; // no progress (would infinite-loop)
    currentFrom = maxTs + 1;
    if (currentFrom > toTs) break; // walked past the end of the requested window

    // v5.0.62: pace at ≤100 calls/minute (Torn rate limit per key) so
    // long busy wars (200+ pages) don't trip code 5. 700ms = ~85 RPM.
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  return allAttacks;
}

/**
 * Fetch a player's energy, nerve bars and cooldowns.
 * Returns { energy: { current, maximum, fulltime }, nerve: { current, maximum, fulltime }, cooldowns: { drug, medical, booster } }.
 */
export async function fetchUserBars(apiKey) {
  const url = `https://api.torn.com/user/?selections=bars,cooldowns&key=${encodeURIComponent(apiKey)}&comment=wb-api`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Torn API returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
  }

  return {
    energy: {
      current: data.energy?.current ?? 0,
      maximum: data.energy?.maximum ?? 0,
      fulltime: data.energy?.fulltime ?? 0,
    },
    nerve: {
      current: data.nerve?.current ?? 0,
      maximum: data.nerve?.maximum ?? 0,
      fulltime: data.nerve?.fulltime ?? 0,
    },
    cooldowns: {
      drug: data.cooldowns?.drug ?? 0,
      medical: data.cooldowns?.medical ?? 0,
      booster: data.cooldowns?.booster ?? 0,
    },
  };
}

// "War-effort roster" — how many members ACTUALLY fought, averaged over a
// faction's recent finished ranked wars. This is a far more stable input for
// scout analysis than a live "active in the last 30 min" snapshot, which just
// reflects whatever time of day you happened to open the report. Works for ANY
// faction (their own past wars are readable via the API), so it lets us judge
// an enemy we've never fought. Immutable once a war ends, so results are cached
// aggressively per faction.
const _warEffortCache = new Map(); // factionId -> { ts, value }
const WAR_EFFORT_TTL_MS = 12 * 60 * 60 * 1000; // 12h — finished wars never change
const ENERGY_PER_ATTACK = 25; // Torn: every attack costs 25 energy

export async function fetchFactionWarEffort(factionId, apiKey, opts = {}) {
  const minHits = opts.minHits != null ? opts.minHits : 5; // a "real" participant
  const warCount = opts.warCount != null ? opts.warCount : 3; // average this many recent wars
  const fid = String(factionId);

  const cached = _warEffortCache.get(fid);
  if (cached && (Date.now() - cached.ts) < WAR_EFFORT_TTL_MS) return cached.value;

  const key = encodeURIComponent(apiKey);
  // 1. The faction's ranked-war list, newest finished wars first.
  const listRes = await fetch(`https://api.torn.com/v2/faction/${encodeURIComponent(fid)}/rankedwars?key=${key}&comment=wb-api`);
  if (!listRes.ok) throw new Error(`Torn API returned HTTP ${listRes.status}`);
  const listData = await listRes.json();
  if (listData.error) throw new Error(`Torn API error: ${listData.error.error} (code ${listData.error.code})`);

  const finished = (listData.rankedwars || [])
    .filter((w) => w && w.end > 0)
    .sort((a, b) => b.end - a.end)
    .slice(0, warCount);

  // 2. Per-war report → count this faction's members with >= minHits attacks,
  //    and aggregate each member's attacks so we can rank their top fighters.
  const perWar = [];
  const memberAgg = new Map(); // playerId -> { name, level, totalAttacks, wars }
  for (const w of finished) {
    try {
      const repRes = await fetch(`https://api.torn.com/v2/faction/${encodeURIComponent(w.id)}/rankedwarreport?key=${key}&comment=wb-api`);
      if (!repRes.ok) continue;
      const rep = await repRes.json();
      if (rep.error) continue;
      const facs = (rep.rankedwarreport && rep.rankedwarreport.factions) || rep.factions || [];
      const me = facs.find((f) => String(f.id) === fid);
      const members = (me && me.members) || [];
      if (!members.length) continue;
      const active = members.filter((m) => (m.attacks || 0) >= minHits);
      const hitters = active.length;
      // Energy the active roster spends in a war = their total attacks × 25e.
      const activeAttacks = active.reduce((a, m) => a + (m.attacks || 0), 0);
      const activeEnergy = activeAttacks * ENERGY_PER_ATTACK;
      const opp = (w.factions || []).find((f) => String(f.id) !== fid);
      perWar.push({ warId: w.id, opp: opp ? opp.name : null, roster: members.length, hitters, activeAttacks, activeEnergy });
      for (const m of members) {
        const pid = String(m.id);
        const agg = memberAgg.get(pid) || { id: pid, name: m.name, level: m.level, totalAttacks: 0, wars: 0 };
        agg.name = m.name; agg.level = m.level;
        agg.totalAttacks += (m.attacks || 0);
        if ((m.attacks || 0) > 0) agg.wars += 1;
        memberAgg.set(pid, agg);
      }
    } catch (_) { /* skip a war that won't load; average the rest */ }
  }

  // Top fighters: highest total attacks over the fetched wars, with per-war
  // averages and the energy that implies (attacks × 25e).
  const topFighters = [...memberAgg.values()]
    .filter((m) => m.totalAttacks > 0)
    .sort((a, b) => b.totalAttacks - a.totalAttacks)
    .slice(0, 5)
    .map((m) => {
      const avgAttacks = Math.round(m.totalAttacks / Math.max(1, m.wars));
      return { id: m.id, name: m.name, level: m.level, wars: m.wars, avgAttacks, avgEnergy: avgAttacks * ENERGY_PER_ATTACK };
    });

  const mean = (k) => Math.round(perWar.reduce((a, b) => a + b[k], 0) / perWar.length);
  const value = perWar.length
    ? {
        avg: mean('hitters'), warsUsed: perWar.length, perWar, minHits, source: 'war-effort',
        // Energy the active roster burns per war (avg), and per-fighter.
        avgAttacks: mean('activeAttacks'),
        avgEnergy: mean('activeEnergy'),
        perFighterEnergy: mean('hitters') ? Math.round(mean('activeEnergy') / mean('hitters')) : 0,
        topFighters,
      }
    : { avg: null, warsUsed: 0, perWar: [], minHits, source: 'none', topFighters: [] };

  _warEffortCache.set(fid, { ts: Date.now(), value });
  return value;
}

// "Attack windows" — WHEN a faction actually hits, profiled from the timestamped
// chains it ran during its recent finished wars. The rankedwarreport has no
// timing and another faction's attack log is blocked, but /v2/faction/{id}/chains
// IS readable for any faction, so chain start times reveal a faction's
// coordinated-push hours. Captures chained hits only (organized pushes), not
// every attack — but that's the most useful thing for war planning. Returns a
// 24-slot UTC histogram of chained hits; the client converts to local time.
const _chainActivityCache = new Map(); // factionId -> { ts, value }

export async function fetchFactionChainActivity(factionId, apiKey, opts = {}) {
  const warCount = opts.warCount != null ? opts.warCount : 3;
  const fid = String(factionId);

  const cached = _chainActivityCache.get(fid);
  if (cached && (Date.now() - cached.ts) < WAR_EFFORT_TTL_MS) return cached.value;

  const key = encodeURIComponent(apiKey);
  const listRes = await fetch(`https://api.torn.com/v2/faction/${encodeURIComponent(fid)}/rankedwars?key=${key}&comment=wb-api`);
  if (!listRes.ok) throw new Error(`Torn API returned HTTP ${listRes.status}`);
  const listData = await listRes.json();
  if (listData.error) throw new Error(`Torn API error: ${listData.error.error} (code ${listData.error.code})`);
  const finished = (listData.rankedwars || [])
    .filter((w) => w && w.end > 0)
    .sort((a, b) => b.end - a.end)
    .slice(0, warCount);

  const hoursUTC = new Array(24).fill(0);
  let totalChains = 0, totalHits = 0, warsUsed = 0;
  for (const w of finished) {
    let warHits = 0;
    const seen = new Set();
    let to = w.end;
    // Chains are immutable; paginate back through the war window (100/page).
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`https://api.torn.com/v2/faction/${encodeURIComponent(fid)}/chains?key=${key}&from=${w.start}&to=${to}&sort=DESC&limit=100&comment=wb-api`);
      if (!res.ok) break;
      const data = await res.json();
      if (data.error) break;
      const chains = data.chains || [];
      if (!chains.length) break;
      for (const ch of chains) {
        if (ch.start >= w.start && ch.start <= w.end && !seen.has(ch.id)) {
          seen.add(ch.id);
          const h = new Date(ch.start * 1000).getUTCHours(); // bucket by chain start hour (UTC)
          hoursUTC[h] += (ch.chain || 0);
          totalHits += (ch.chain || 0);
          warHits += (ch.chain || 0);
          totalChains += 1;
        }
      }
      const minStart = Math.min(...chains.map((c) => c.start));
      if (minStart <= w.start || chains.length < 100) break;
      to = minStart - 1;
    }
    if (warHits > 0) warsUsed += 1;
  }

  const value = totalHits > 0
    ? { hoursUTC, totalChains, totalHits, warsUsed, source: 'chains' }
    : { hoursUTC, totalChains: 0, totalHits: 0, warsUsed, source: 'none' };
  _chainActivityCache.set(fid, { ts: Date.now(), value });
  return value;
}
