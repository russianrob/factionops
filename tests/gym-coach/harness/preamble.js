/* Test harness only. Stubs the GM_* surface and the Torn API so the panel can
   be rendered head-first against arbitrary states. Never shipped. */
(function () {
  // Every URL the script asks for, so a suite can assert on request COUNT --
  // the rate limit is a real constraint and "does it render" cannot see it.
  window.__urls = [];
  var cfg = {};
  try {
    var q = new URLSearchParams(location.search).get("cfg");
    if (q) cfg = JSON.parse(q);
  } catch (e) {}
  var mem = Object.assign({ gcb_v1_api_key: "harness0000000000key" }, cfg.mem || {});
  window.GM_getValue = function (k, d) { return k in mem ? mem[k] : d; };
  window.GM_setValue = function (k, v) { mem[k] = v; };
  window.GM_addStyle = function (css) {
    var s = document.createElement("style"); s.textContent = css;
    document.head.appendChild(s); return s;
  };

  var BOOTED = Date.now();
  var N = function (v, d) { return v === undefined ? d : v; };
  var STATS = cfg.stats || { str: 614000000, def: 12000000, spe: 9000000, dex: 8000000 };

  function userPayload() {
    var max = N(cfg.energyMax, 150);
    return {
      // cfg.energyAfterMs raises the bar part-way through the session, so a
      // test can watch something come DOWN rather than only never go up.
      energy: { current: (cfg.energyAfterMs && Date.now() - BOOTED > cfg.energyAfterMs)
                  ? N(cfg.energyAfter, max) : N(cfg.energy, 100),
                maximum: max, fulltime: N(cfg.fulltime, 600) },
      happy: { current: N(cfg.happy, 4300), maximum: N(cfg.happyMax, 5000) },
      cooldowns: { drug: N(cfg.drug, 0), booster: N(cfg.booster, 0), medical: 0 },
      strength: STATS.str, defense: STATS.def, speed: STATS.spe, dexterity: STATS.dex,
      player_id: N(cfg.playerId, 2598755),
      active_gym: N(cfg.gym, 23),
      faction_perks: N(cfg.factionPerks, ["+ 10% energy drink effect"]),
      job_perks: N(cfg.jobPerks, []), book_perks: [], property_perks: ["+ 2% gym gains"],
      education_perks: ["+ 1% gym gains"], enhancer_perks: [], company_perks: [],
      merit_perks: [], stock_perks: N(cfg.stockPerks, ["+ 100 energy every 7 days"])
    };
  }
  function inventory(cat) {
    // Xanax is a Drug, and ITEM_MAP asks for it by that category. Listing it
    // under Energy Drink meant cat=Drug came back empty and state.items.xanax
    // was 0 in every browser test, so no xanax advice was ever exercised.
    if (cat === "Drug") {
      return { inventory: [
        { ID: 206, name: "Xanax", quantity: N(cfg.xan, 85) },
        { ID: 205, name: "Vicodin", quantity: N(cfg.vicodin, 0) },
        { ID: 203, name: "LSD", quantity: N(cfg.lsd, 0) }
      ] };
    }
    if (cat !== "Energy Drink") return { inventory: [] };
    return { inventory: [
      { ID: 985, name: "Can of Goose Juice", quantity: N(cfg.cans, 21) },
      { ID: 554, name: "Can of Rockstar Rudolph", quantity: N(cfg.rudolph, 0) },
      { ID: 986, name: "Can of Damp Valley", quantity: N(cfg.damp, 0) }
    ] };
  }

  function answer(url) {
    window.__urls.push(url);
    if (/selections=calendar/.test(url)) return { competitions: [] };
    // cfg.failStat makes exactly one contributors stat fail, for the
    // partial-fetch paths. cfg.keyFaction drives /key/info's access.faction.
    if (cfg.failStat && new RegExp("stat=" + cfg.failStat + "(&|$)").test(url)) {
      return { error: { code: 5, error: "Too many requests" } };
    }
    // ---- faction board ----
    if (/v2\/faction\/basic/.test(url)) {
      if (cfg.factionDenied) return { error: { code: 7, error: "Incorrect ID-entity relation value" } };
      return { basic: { id: 42055, name: cfg.factionName || "Dead Fragment", members: 3 } };
    }
    if (/v2\/faction\/contributors/.test(url)) {
      // A key without faction API access is refused for the WHOLE call, which
      // is the case the board's error path exists for.
      if (cfg.boardDenied) return { error: { code: 7, error: "Incorrect ID-entity relation value" } };
      var st = (/[?&]stat=([a-z]+)/.exec(url) || [])[1] || "";
      var tbl = cfg.contributors || {};
      return { contributors: (tbl[st] || []).map(function (r) {
        return { id: r[0], username: r[1], value: r[2], in_faction: r[3] !== false };
      }) };
    }
    if (/\/personalstats/.test(url)) {
      var uid = (/user\/(\d+)\/personalstats/.exec(url) || [])[1] || "0";
      var ts = (/[?&]timestamp=(\d+)/.exec(url) || [])[1];
      var who = (cfg.ps || {})[uid];
      if (!who) return { error: { code: 6, error: "Incorrect ID" } };
      // Torn answers the HISTORIC form as an array of {name,value} and the live
      // form as a flat object. Both shapes are served here on purpose -- the
      // script has to read either or the natural column silently zeroes.
      var pick = ts ? (who.then || {}) : (who.now || {});
      if (ts) {
        return { personalstats: Object.keys(pick).map(function (k) {
          return { name: k, value: pick[k], timestamp: Number(ts) }; }) };
      }
      return { personalstats: pick };
    }
    // Torn's gym train logs, one type per stat. cfg.trainLog is [[tsSeconds,
    // energy], ...]; they all come back on 5300 since the script merges them.
    var lg = /[?&]log=(\d+)/.exec(url);
    if (lg && /selections=log/.test(url)) {
      // An empty log is a real answer ("you trained nothing"); a FAILED call is
      // not, and the two must lead to different figures.
      if (cfg.trainLogFail) return { error: { code: 5, error: "Too many requests" } };
      var rows = {};
      if (lg[1] === "5300") {
        (cfg.trainLog || []).forEach(function (r, i) {
          rows["h" + i] = { log: 5300, title: "Gym train strength", timestamp: r[0],
                            category: "Gym", data: { trains: 1, energy_used: r[1], gym: 24 } };
        });
      }
      return { log: rows };
    }
    if (/\/user\/inventory/.test(url)) {
      var m = /cat=([^&]+)/.exec(url);
      return inventory(m ? decodeURIComponent(m[1]) : "");
    }
    // Its own endpoint, the way the script calls it: a key that cannot read
    // refills must leave the reminder quiet rather than take the panel down.
    if (/selections=refills/.test(url)) {
      if (cfg.refillErr) return { error: { code: 16, error: "Access level of this key is not high enough" } };
      // cfg.refillUsedAfterMs flips the answer part-way through the session,
      // which is the only way to exercise the strip being taken DOWN rather
      // than merely never going up.
      var used = !!cfg.refillUsed;
      if (cfg.refillUsedAfterMs && Date.now() - BOOTED > cfg.refillUsedAfterMs) used = true;
      return { refills: { energy_refill_used: used, nerve_refill_used: false,
                          token_refill_used: false, special_refills_available: 0 } };
    }
    if (/v2\/key\/info/.test(url)) {
      if (cfg.keyErr) return { error: { code: cfg.keyErr, error: "stub" } };
      var lv = N(cfg.keyLevel, 4);
      return { info: { access: { level: lv, type: lv >= 4 ? "Full Access" : "Limited Access",
                                 // "Faction API Access" is a position ability,
                                 // independent of the key's level -- cfg.keyFaction
                                 // is how a suite says a member does not have it.
                                 faction: cfg.keyFaction === undefined ? true : cfg.keyFaction,
                                 company: false,
                                 log: { custom_permissions: false, available: [] } },
                       selections: { user: ["bars", "attacks", "log"] }, user: { id: 2598755 } } };
    }
    if (/v2\/user\/attacks/.test(url)) {
      if (cfg.attacksErr) return { error: { code: 16, error: "Access level of this key is not high enough" } };
      // cfg.attacks is a count; rows are stamped a few hours into the UTC day
      // so the script's own day filter has something real to reject.
      var dayStart = Math.floor(Math.floor(Date.now() / 86400000) * 86400000 / 1000);
      var rows = [];
      for (var ai = 0; ai < N(cfg.attacks, 0); ai++) {
        rows.push({ id: 1000 + ai, started: dayStart + 3600 + ai, ended: dayStart + 3604 + ai,
                    attacker: { id: 2598755 }, defender: { id: 900000 + ai } });
      }
      // Rows from BEFORE today, returned regardless of the `from` the script
      // asked for. Torn is not expected to do this -- the point is that the
      // day window has to be enforced where the counting happens, not merely
      // requested, or a widened window silently swallows yesterday.
      for (var bi = 0; bi < N(cfg.attacksOld, 0); bi++) {
        rows.push({ id: 5000 + bi, started: dayStart - 7200 - bi, ended: dayStart - 7196 - bi,
                    attacker: { id: 2598755 }, defender: { id: 800000 + bi } });
      }
      return { attacks: rows };
    }
    if (/v2\/user\/stocks/.test(url)) {
      return { stocks: cfg.mcsReady === undefined ? [] : [
        { id: 29, shares: 350000, transactions: [],
          bonus: { available: !!cfg.mcsReady, increment: 1, progress: 7, frequency: 7 } }] };
    }
    if (/api\.torn\.com\/user/.test(url)) return userPayload();
    if (/weav3r\.dev/.test(url)) {
      var id = (/marketplace\/(\d+)/.exec(url) || [])[1] || "0";
      // real ballpark figures so the ranking is actually exercised
      var REAL = { 206: 823800, 367: 13549997, 985: 434950, 986: 561000,
                   987: 812000, 530: 1780000, 532: 2140000, 533: 2620000 };
      var p = REAL[id];
      if (!p) return { item_id: +id, item_name: "Unlisted", market_price: 0, listings: [] };
      return { item_id: +id, item_name: "Stub", market_price: Math.round(p * 1.02),
               bazaar_average: p, listings: [{ item_id: +id, price: p, quantity: 5 }] };
    }
    return {};
  }
  window.GM_xmlhttpRequest = function (o) {
    // cfg.hangUrl is a substring; a matching request NEVER settles -- neither
    // onload nor onerror. That is not a hypothetical: PDA's HTTP layer collapses
    // two identical in-flight GETs and orphans the second callback. A feature
    // that only recovers from REJECTION cannot recover from this.
    if (cfg.hangUrl && String(o.url).indexOf(cfg.hangUrl) !== -1) return;
    setTimeout(function () {
      var body = JSON.stringify(answer(o.url));
      if (o.onload) o.onload({ status: 200, responseText: body, response: body });
    }, 0);
  };
  window.GM = { getValue: window.GM_getValue, setValue: window.GM_setValue,
                xmlHttpRequest: window.GM_xmlhttpRequest };

  // Stand in for Torn PDA's notification bridge so scheduling can be observed.
  // cfg.noPda leaves it absent, which is what a desktop browser looks like.
  window.__pdaCalls = [];
  // cfg.host="warboard" stands in for warboard-iOS: its own bridge, no
  // flutter_inappwebview, so nothing mistakes it for Torn PDA.
  if (cfg.host === "warboard") window.__WB_NATIVE_HOST__ = "warboard";
  if (!cfg.noPda || cfg.host === "warboard") window.__WB_BRIDGE__ = {
    callHandler: function (name, payload) {
      window.__pdaCalls.push({ name: name, payload: payload });
      return Promise.resolve();
    }
  };
  if (!cfg.noPda) window.flutter_inappwebview = {
    callHandler: function (name, payload) {
      window.__pdaCalls.push({ name: name, payload: payload });
      return Promise.resolve();
    }
  };
})();
