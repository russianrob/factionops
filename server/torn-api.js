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
 * Absent-participant sentinel. Torn's v1 attacks feed represents an
 * anonymous attacker (stealthed hit on us, attacker identity hidden) as
 * the EMPTY STRING in all four attacker_* fields — measured on the live
 * war: 64 of 799 rows came back as
 *   { attacker_id: "", attacker_name: "", attacker_faction: "",
 *     attacker_factionname: "", ... stealthed: 1 }
 * Not 0, not null, not undefined. v2 instead sends `attacker: null` for
 * the same rows. We reproduce v1's "" exactly so downstream coercions
 * like `String(atk.attacker_faction || "")` in war-payouts.js behave
 * identically to before.
 */
const V2_ABSENT = "";

/**
 * Second, DIFFERENT absent case: the participant is present and named but
 * belongs to no faction. v1 does NOT use "" here — it emits the NUMBER 0
 * for the faction id (and "" for the faction name). Measured on the live
 * war: 78 rows had a named defender whose v2 `defender.faction` was null
 * and whose v1 `defender_faction` was `0` (type number), with
 * `defender_factionname` still "". Collapsing both cases to "" was a real
 * mismatch against v1, so the two are kept distinct.
 */
const V2_NO_FACTION_ID = 0;

/**
 * Map one v2 `/v2/faction/attacks` row onto the v1
 * `faction/{id}?selections=attacks` row shape, field for field.
 *
 * Every caller (war-payouts.js, attack-ledger.js, routes.js) consumes the
 * v1 shape, so this function is the entire compatibility surface. The v1
 * row has exactly 21 fields — verified by scanning 799 live rows — and we
 * emit all 21, never a subset, so no caller ever reads `undefined` for a
 * field that used to be present.
 */
function mapV2AttackToV1(row) {
  const atk = row.attacker || null;
  const def = row.defender || null;
  const m = row.modifiers || {};

  // v2 gives booleans where v1 gives 0/1 ints. The ranked-war filter
  // below does a STRICT `=== 1`, so passing a raw `true` through would
  // match nothing and every payout would compute from an empty attack
  // list. Coerce to 1/0.
  const toInt = (v) => (v === true || v === 1 ? 1 : 0);

  return {
    code: row.code,

    // v1 `timestamp_started` / `timestamp_ended` are v2's `started` / `ended`.
    timestamp_started: Number(row.started) || 0,
    timestamp_ended: Number(row.ended) || 0,

    // v2 nests the participants; v1 flattens them. `attacker`/`defender`
    // are null on anonymous/stealthed rows, so read defensively — a bare
    // `row.attacker.id` throws mid-war on ~8% of rows.
    // Note the two distinct absent cases (see the constants above):
    // no participant object at all ⇒ "" everywhere; participant present
    // but factionless ⇒ faction id 0, faction name "".
    //
    // ONE DELIBERATE DIVERGENCE from v1: v1 HTML-escapes faction names
    // (it returned "Leafy&#039;s Tree" where v2 returns "Leafy's Tree").
    // We pass v2's raw name through rather than re-inserting entities,
    // because the escaped form is a rendering artefact, not the datum,
    // and re-escaping here would double-encode for JSON consumers. No
    // current caller of this function reads *_factionname at all
    // (attack-ledger.js does, but it is fed by the per-member
    // user/attacks feed, not by this one). If a future caller ever
    // interpolates these into HTML it must escape at the render site.
    attacker_id: atk ? atk.id : V2_ABSENT,
    attacker_name: atk ? atk.name : V2_ABSENT,
    attacker_faction: !atk ? V2_ABSENT : (atk.faction ? atk.faction.id : V2_NO_FACTION_ID),
    attacker_factionname: !atk ? V2_ABSENT : (atk.faction ? atk.faction.name : V2_ABSENT),
    defender_id: def ? def.id : V2_ABSENT,
    defender_name: def ? def.name : V2_ABSENT,
    defender_faction: !def ? V2_ABSENT : (def.faction ? def.faction.id : V2_NO_FACTION_ID),
    defender_factionname: !def ? V2_ABSENT : (def.faction ? def.faction.name : V2_ABSENT),

    result: row.result,

    // v1 int flags ← v2 booleans.
    stealthed: toInt(row.is_stealthed),
    raid: toInt(row.is_raid),
    ranked_war: toInt(row.is_ranked_war),

    // v2 has NO `respect` field. Of the rows returned by THIS function
    // exactly one consumer reads `.respect` — routes.js:5025's
    // `(atk.respect_gain || atk.respect || 0)`, and only as a fallback
    // behind `respect_gain`. (The other ~30 `.respect` hits across
    // routes.js are on faction-MEMBER and OC-reward objects, which do not
    // come from here; attack-ledger.js:86 reads the per-member
    // user/attacks feed, also not this one.) Measured on live v1 data:
    // `respect === respect_gain` in 100/100 rows in the reference probe,
    // in all 599 rows of an independent scan, and bucketed by result
    // (Attacked 90/90, Assist 4/4, Lost 3/3, Interrupted 1/1,
    // Stalemate 1/1, Arrested 1/1) including every zero-respect row —
    // zero divergences. So mapping from `respect_gain` is
    // behaviour-identical, not a silent zeroing of that fallback.
    respect: Number(row.respect_gain) || 0,
    respect_gain: Number(row.respect_gain) || 0,
    respect_loss: Number(row.respect_loss) || 0,

    // v1 emits `is_interrupted` as a real boolean (measured: values
    // false/true across 799 live rows, never 0/1), and so does v2 —
    // pass it through unchanged rather than "fixing" it to an int.
    is_interrupted: row.is_interrupted === true,

    chain: Number(row.chain) || 0,

    // The modifier KEY NAMES diverge between versions and this is not
    // cosmetic — war-payouts.js reads the v1 names directly:
    //   v2 `group`   → v1 `group_attack`   (kept as a fair_score bonus)
    //   v2 `chain`   → v1 `chain_bonus`    (divided out of fair_score)
    //   v2 `warlord` → v1 `warlord_bonus`  (divided out of fair_score)
    // Passing v2's object through verbatim would leave those three
    // undefined, and `Number(m.chain_bonus) || 1` would silently fall
    // back to 1, so
    // every chained hit's fair_score would be inflated by the chain
    // multiplier. Both are money errors, so rename explicitly.
    //
    // v1 omits `warlord_bonus` on some rows while v2 always sends
    // `warlord`; emitting it always is a safe superset because every
    // consumer reads it as `Number(m.warlord_bonus) || 1`.
    modifiers: {
      fair_fight: Number(m.fair_fight) || 0,
      war: Number(m.war) || 0,
      retaliation: Number(m.retaliation) || 0,
      group_attack: Number(m.group) || 0,
      overseas: Number(m.overseas) || 0,
      chain_bonus: Number(m.chain) || 0,
      warlord_bonus: Number(m.warlord) || 0,
    },

    // Deliberately NOT emitted, because v1 never had them and no caller
    // reads them: v2's `id` (used only as our dedupe key, kept out of
    // the returned row so the shape stays exactly v1's), `level` on each
    // participant, `is_territory_war`, `territory_war_id` and
    // `finishing_hit_effects`. There is likewise no v2 source for a v1
    // `assist` field, and v1 had none either — an assist is reported in
    // `result`, which IS emitted above. war-payouts.js used to probe a
    // non-existent `atk.assist` and fall back to `group_attack > 1`,
    // which is a different mechanic; it now reads `result === "Assist"`,
    // the same signal TornTools uses.
  };
}

/**
 * Fetch faction attack log for a time period, paginating through all results.
 * Returns array of attack objects in the v1 shape. Filters to ranked_war
 * attacks only unless options.rankedWarOnly === false.
 */
export async function fetchFactionAttacks(factionId, apiKey, fromTs, toTs, options = {}) {
  // v5.0.57: opt-in to ALL attacks (not just ranked_war) so callers
  // that want a war-vs-total split (war-payouts) can compute it.
  // Default stays rankedWarOnly:true so existing callers (post-war
  // bleed analysis, etc.) keep their previous behavior unchanged.
  const rankedWarOnly = options.rankedWarOnly !== false;
  const allAttacks = [];
  // v5.0.69: dedupe key. v2's `from` bound is INCLUSIVE and our cursor
  // deliberately does NOT step past it (see below), so consecutive pages
  // overlap. `id` is the stable per-attack identifier v2 carries (v1 had
  // none, only a `code` hash), so it is what we dedupe on — falling back
  // to `code`, which v2 also sends, if a row ever arrives without an id.
  const seenIds = new Set();
  let currentFrom = fromTs;
  // Guard the `to` bound against nullish/empty callers: Number(null),
  // Number("") and Number(false) are all 0 AND all finite, so a bare
  // Number.isFinite() test would send `to=0` and return an empty walk
  // instead of the intended unbounded one.
  const toNum = (toTs === null || toTs === undefined || toTs === "") ? NaN : Number(toTs);
  const hasTo = Number.isFinite(toNum) && toNum > 0;
  const toBound = hasTo ? toNum : null;
  // v5.0.62: bumped from 30 → 200. Torn returns ≤100 attacks per
  // page; busy ranked wars (e.g. Ringside 41296 had ~3700+ ranked
  // attacks across 90 members) blew past the prior 3000-attack
  // ceiling and Payouts under-counted by 40-60%.
  const MAX_PAGES = 200;
  // Torn's per-page cap. Written once: the "did this page come back
  // FULL?" test below must track whatever we ask for, or a smaller
  // `limit` would stop looking like a full page and the saturated-second
  // branch would never fire.
  const PAGE_LIMIT = 100;

  // Hoisted out of the `for` header so the post-loop truncation check can
  // see how many pages we actually burned.
  let page = 0;
  for (; page < MAX_PAGES; page++) {
    // v5.0.69: moved from v1 `faction/{id}?selections=attacks` to v2
    // `/v2/faction/attacks`. The v1 feed exposes no per-attack id, which
    // forced a timestamp cursor that had to advance to maxTs+1 — and any
    // attack sharing that final second beyond the 100-row page cap was
    // skipped with no error. Measured on a live war window that lost 69
    // of 2790 attacks (~2.5%), mis-allocating real payout money. v2 rows
    // carry `id`, so we can dedupe instead of stepping the clock forward
    // past rows we never saw.
    //
    // Probed against the live API, do not "simplify" any of these:
    //   - `offset` is IGNORED (offset=5 returns page 1), so offset paging
    //     is not an option; `from` is the only usable cursor.
    //   - `from`/`to`/`sort` all key on the `ended` timestamp, NOT
    //     `started`. Our cursor therefore tracks max(ended).
    //   - `sort=ASC` orders by `ended`; `id` is NOT monotonic within that
    //     order, so `id` is a dedupe key only, never the cursor value.
    //
    // `factionId` MUST stay in the path. It is not decorative: it is the
    // key↔faction consistency check that both callers are built around.
    // Probed live with a 42055 pool key:
    //   /v2/faction/42055/attacks → 200, same 100 ids, same order
    //   /v2/faction/38761/attacks → {"code":7,"Incorrect ID-entity relation"}
    //   /v2/faction/attacks       → 200, scoped to the KEY OWNER's faction
    // Dropping the id therefore makes code 7 unreachable. Pool keys are
    // selected by the pool opt's RECORDED factionId (store.js
    // getPooledKeysForFaction), so a key whose owner has left the faction
    // stays in the pool; today it throws code 7 and war-payouts.js:315 /
    // routes.js:5813 quarantine it and rotate. With an id-less URL that
    // same key would return 200 carrying a STRANGER faction's attacks,
    // every row would be dropped by the `attacker_faction === ourFid`
    // guards downstream, and payouts would silently compute zeros forever
    // (the pool picks deterministically, so it would be the same dead key
    // every time). Keep the id; keep the 7.
    const params = new URLSearchParams({
      limit: String(PAGE_LIMIT),
      sort: "ASC",
      from: String(currentFrom),
      key: apiKey,
      comment: "wb-api",
    });
    if (hasTo) params.set("to", String(toBound));
    const url = `https://api.torn.com/v2/faction/${encodeURIComponent(factionId)}/attacks?${params}`;
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

    // v2 returns `attacks` as a JSON ARRAY (v1 returned an id-keyed
    // object). Tolerate both so a future shape change degrades rather
    // than silently yielding zero attacks.
    const rows = Array.isArray(data.attacks)
      ? data.attacks
      : Object.values(data.attacks || {});
    if (rows.length === 0) break; // true end of the feed

    // Walk the page once: advance the cursor over EVERY row (seen or
    // not) but only map/keep ids we have not already taken.
    let maxEnded = currentFrom;
    let idlessRows = 0;
    for (const row of rows) {
      // Cursor stays strictly in the `ended` domain. Probed: from/to/sort
      // all key on `ended`, never `started` — a page fetched with from=T
      // legitimately contains rows whose `started` is minutes before T.
      // Letting a `started` value reach the cursor would mix domains, and
      // an in-progress row with a null `ended` sorted last could push the
      // cursor PAST the page's real end, skipping rows in between — the
      // exact loss shape this rewrite exists to remove. Rows with no
      // `ended` are still mapped and kept; they just don't move the cursor.
      const ended = Number(row.ended) || 0;
      if (ended > maxEnded) maxEnded = ended;

      // `id` is the dedupe key; `code` (the same hash v1 used) is a
      // perfectly good fallback, so fall back rather than silently
      // dropping the row. Numbers and strings never collide in the Set.
      const id = row.id ?? row.code;
      if (id === undefined || id === null) { idlessRows++; continue; } // cannot dedupe safely
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const mapped = mapV2AttackToV1(row);
      // Filter on the MAPPED row, so the strict `=== 1` compares against
      // our int, not v2's raw boolean. Dedupe/cursor above run on the
      // unfiltered page — filtering first would let a page of non-war
      // attacks look "empty" and stall pagination.
      if (rankedWarOnly && mapped.ranked_war !== 1) continue;
      allAttacks.push(mapped);
    }

    if (idlessRows > 0) {
      console.warn(
        `[torn-api] fetchFactionAttacks: ${idlessRows} row(s) at from=${currentFrom} ` +
        `(faction ${factionId}) carried neither \`id\` nor \`code\` and were dropped from ` +
        `the result (undedupable); their \`ended\` still advances the cursor.`
      );
    }

    // ---- Cursor advance / termination ----
    //
    // The point of the rewrite is that we never step the cursor past rows
    // we have not seen, so `from` stays INCLUSIVE at max(ended) — no +1.
    // Repeating a second is safe because `seenIds` absorbs the overlap,
    // whereas v1's `maxTs + 1` silently dropped every attack sharing that
    // second beyond the page cap.
    //
    // Exactly three outcomes, and every one of them either advances
    // `currentFrom` strictly or leaves the loop, so this terminates:
    //
    //  1. Cursor moved  → take it and page on.
    //  2. Cursor did NOT move and the page came back FULL ⇒ (because
    //     `from` is inclusive on `ended`, every row satisfies
    //     ended >= currentFrom, so "maxEnded didn't move" means EVERY row
    //     sits exactly on `currentFrom`) ≥PAGE_LIMIT attacks share that
    //     one second. v2 has no offset paging — `offset` is ignored, and
    //     identical params return the identical page — so the overflow of
    //     that second is unreachable by any query we can make. Skip PAST
    //     the second rather than aborting: aborting would throw away the
    //     entire remainder of the war window (unbounded loss) to avoid
    //     losing one second's tail (bounded loss, and exactly what v1 did
    //     here anyway). Worst case therefore equals v1; every other case
    //     keeps the rewrite's gain — and unlike v1 it is logged.
    //     Note the rows already collected from this page are kept; only
    //     the unreachable 101st-and-beyond of that second are lost.
    //  3. Cursor did not move and the page was SHORT → we are looking at
    //     the tail of the feed we have already taken. Done.
    if (maxEnded > currentFrom) {
      currentFrom = maxEnded; // NOTE: no +1, by design (`from` is inclusive)
    } else if (rows.length >= PAGE_LIMIT) {
      console.warn(
        `[torn-api] fetchFactionAttacks: ≥${PAGE_LIMIT} attacks share ended=${currentFrom} ` +
        `(faction ${factionId}, key ${maskKey(apiKey)}) and v2 has no offset paging — ` +
        `skipping that second's overflow and resuming at ${currentFrom + 1}; ` +
        `${seenIds.size} unique attacks collected so far.`
      );
      currentFrom = currentFrom + 1;
    } else {
      break; // short page that cannot move the cursor = end of the feed
    }

    // v5.0.62: pace at ≤100 calls/minute (Torn rate limit per key) so
    // long busy wars (200+ pages) don't trip code 5. 700ms = ~85 RPM.
    // Deliberately NOT skipped by the saturated-second branch above: that
    // branch fires during the busiest moment of a chain, which is the
    // worst possible time to fire the next request immediately.
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  // Falling out of the loop at the cap is truncation, and truncation that
  // nobody can see is the whole class of bug this rewrite removes. Say so.
  if (page >= MAX_PAGES) {
    console.warn(
      `[torn-api] fetchFactionAttacks: hit MAX_PAGES (${MAX_PAGES}) for faction ${factionId} ` +
      `at from=${currentFrom} — result is TRUNCATED at ${seenIds.size} unique attacks; ` +
      `window [${fromTs},${hasTo ? toBound : "now"}] is NOT fully covered.`
    );
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
  const warCount = opts.warCount != null ? opts.warCount : 5; // average this many recent wars
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

// Share one chain's hits across the UTC hours it actually ran.
//
// Bucketing a whole chain into the hour it STARTED is what the histogram used
// to do, and it is badly wrong for exactly the chains that matter: a 2,617-hit
// chain that ran 37h59m put every one of those hits in the 20:00 bucket, so the
// chart reported a huge 20:00 spike for a faction that in fact chains round the
// clock. It was measuring when chains BEGIN, not when you get hit.
//
// Proportional by time, which assumes an even hit rate. Real chains ramp and
// stall, so this is an approximation — but "spread across the 38 hours it ran"
// is far closer than "all of it in the first minute", and another faction's
// per-attack log is not readable, so this is the best source available.
export function spreadChainHits(startSec, endSec, hits, hoursUTC) {
  if (!(hits > 0)) return;
  const total = endSec - startSec;
  // No usable end (the field is undocumented on this endpoint): fall back to
  // the old start-hour bucket rather than dropping the chain entirely.
  if (!Number.isFinite(total) || total <= 0) {
    hoursUTC[new Date(startSec * 1000).getUTCHours()] += hits;
    return;
  }
  let t = startSec;
  // 24h of hour-boundaries is 25 slices; the bound is a runaway guard for a
  // corrupt timestamp, not an expected path.
  for (let guard = 0; t < endSec && guard < 2000; guard++) {
    const d = new Date(t * 1000);
    const secIntoHour = d.getUTCMinutes() * 60 + d.getUTCSeconds();
    const sliceEnd = Math.min(endSec, t + (3600 - secIntoHour));
    hoursUTC[d.getUTCHours()] += hits * ((sliceEnd - t) / total);
    t = sliceEnd;
  }
}

export async function fetchFactionChainActivity(factionId, apiKey, opts = {}) {
  const warCount = opts.warCount != null ? opts.warCount : 5;
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
  // Per-war chain detail. The histogram sums these into 24 buckets and throws
  // the rest away, which makes it unreadable: eleven chains collapse into eight
  // hour-buckets of which three are tall enough to see, so "peak 20:00" could
  // be one long push or four short ones and the chart cannot say which. Keeping
  // the list costs nothing — every field is already in the payload being
  // paginated for the histogram.
  const wars = [];
  for (const w of finished) {
    let warHits = 0;
    const seen = new Set();
    const warChains = [];
    // Per-war copy of the same histogram, so a bar can say WHICH war its hits
    // came from rather than only how many there were in total.
    const warHours = new Array(24).fill(0);
    const opp = (w.factions || []).find((f) => String(f.id) !== fid);
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
          const chEnd = Number.isFinite(ch.end) && ch.end > ch.start ? ch.end : null;
          spreadChainHits(ch.start, chEnd, ch.chain || 0, hoursUTC);
          spreadChainHits(ch.start, chEnd, ch.chain || 0, warHours);
          totalHits += (ch.chain || 0);
          warHits += (ch.chain || 0);
          totalChains += 1;
          // `end` is not documented on this endpoint and nothing else in the
          // codebase reads it, so it is carried through only when present and
          // the duration is simply omitted when it is not.
          warChains.push({
            start: ch.start,
            end: Number.isFinite(ch.end) && ch.end > ch.start ? ch.end : null,
            hits: ch.chain || 0,
            respect: Number.isFinite(ch.respect) ? Math.round(ch.respect) : null,
          });
        }
      }
      const minStart = Math.min(...chains.map((c) => c.start));
      if (minStart <= w.start || chains.length < 100) break;
      to = minStart - 1;
    }
    if (warHits > 0) warsUsed += 1;
    if (warChains.length) {
      warChains.sort((a, b) => b.hits - a.hits);   // biggest push first
      wars.push({
        start: w.start,
        end: w.end,
        opponent: (opp && opp.name) || null,
        hits: warHits,
        hoursUTC: warHours.map((v) => Math.round(v)),
        chains: warChains,
      });
    }
  }

  // Quiet time between wars: from the previous war ENDING to this one starting.
  // Start-to-start reads as a two-week gap for a war that ran nine days, which
  // is the opposite of idle.
  for (let i = 0; i < wars.length - 1; i++) {
    const prevEnd = wars[i + 1].end;
    if (prevEnd > 0 && wars[i].start > prevEnd) wars[i].idleBefore = wars[i].start - prevEnd;
  }

  // Fractional after the spread — round once, here, so the client never has to.
  for (let i = 0; i < 24; i++) hoursUTC[i] = Math.round(hoursUTC[i]);

  const value = totalHits > 0
    ? { hoursUTC, totalChains, totalHits, warsUsed, wars, source: 'chains' }
    : { hoursUTC, totalChains: 0, totalHits: 0, warsUsed, wars: [], source: 'none' };
  _chainActivityCache.set(fid, { ts: Date.now(), value });
  return value;
}
