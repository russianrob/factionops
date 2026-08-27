/* Test harness only. Stubs the GM_* surface and the Torn API so the panel can
   be rendered head-first against arbitrary states. Never shipped. */
(function () {
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

  var N = function (v, d) { return v === undefined ? d : v; };
  var STATS = cfg.stats || { str: 614000000, def: 12000000, spe: 9000000, dex: 8000000 };

  function userPayload() {
    var max = N(cfg.energyMax, 150);
    return {
      energy: { current: N(cfg.energy, 100), maximum: max, fulltime: N(cfg.fulltime, 600) },
      happy: { current: N(cfg.happy, 4300), maximum: N(cfg.happyMax, 5000) },
      cooldowns: { drug: N(cfg.drug, 0), booster: N(cfg.booster, 0), medical: 0 },
      strength: STATS.str, defense: STATS.def, speed: STATS.spe, dexterity: STATS.dex,
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
    if (/selections=calendar/.test(url)) return { competitions: [] };
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
  if (!cfg.noPda) window.flutter_inappwebview = {
    callHandler: function (name, payload) {
      window.__pdaCalls.push({ name: name, payload: payload });
      return Promise.resolve();
    }
  };
})();
