// ==UserScript==
// @name         Gym Coach
// @namespace    RussianRob
// @version      0.10.12
// @description  Torn gym coach — training advice, item verdicts, and a progression chart. Fork of AaronPMC [4431836]'s Gym Coach, which this builds on.
// @author       RussianRob
// @license      MIT
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @match        https://www.torn.com/gym.php*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @connect      api.torn.com
// @connect      www.torn.com
// @connect      torn.com
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/gym-coach.user.js
// @updateURL    https://tornwar.com/scripts/gym-coach.meta.js
// ==/UserScript==

/*
 * Gym Coach — free for everyone (MIT)
 * Built for rcexyz [2598755] by AaronPMC [4431836]
 *
 * CHANGELOG
 * 0.10.12 — THE FIX for the script never running under Torn PDA. Line 903 held
 *           a curly apostrophe inside a SINGLE-quoted string:
 *           return \'<span class="chip bad">DON\u2019T</span>\';
 *           GMforPDA normalises typographic quotes to straight ASCII when it
 *           processes the source, which closed the string at DON\' and left T as
 *           a stray token: "SyntaxError: Unexpected identifier \'T\'. Expected a
 *           \';\' following a return statement." The file never parsed, so nothing
 *           ran at all — no button, no error anywhere visible. Only PDA rewrites
 *           the source, hence it worked in Safari and Tampermonkey. All curly
 *           quotes in code are now \\u escapes, so no quote character exists in
 *           the source to normalise. Caught by gym-diag, which registered an
 *           error handler and reported the exception off the device.
 * 0.10.11 — Reverts the @grant unsafeWindow added in the previous version. It was
 *         a guess, and bisection probes carrying it stopped running under PDA
 *         entirely, while the same header without it runs. The body references
 *         unsafeWindow only behind typeof guards, so the grant bought nothing.
 * 0.10.10 — REVERTED in the next version: declared @grant unsafeWindow. The body references unsafeWindow but
 *           the header never granted it, and Torn PDA would not run the file at
 *           all in that state. Works elsewhere, dead only in PDA.
 * 0.10.9 — Fixes the script never running under Torn PDA. The file carried the
 *          API-key placeholder twice — the real one and a decoy split across
 *          two literals on the line above — and PDA rewrites that placeholder
 *          by matching the source before injecting, so a greedy match spanned
 *          both and left an unbalanced bracket. The file failed to parse and
 *          nothing ran: no button, no error. Only PDA rewrites the source,
 *          hence it worked everywhere else. One placeholder now, single-quoted.
 * 0.10.8 — "Full in" was stale. Torn's fulltime is measured at the energy it
 *          was polled at and never ticked down, so it drifted between polls and
 *          was plainly wrong after a xanax — which also mis-scheduled the
 *          bar-full ping, since the notification reads the same value. It is
 *          now a per-point rate derived from that payload, applied to live
 *          energy, and reads zero at or above the cap.
 * 0.10.7 — Progression chart gained its axes: round value labels down the
 *          left, dated labels along the bottom (month + year past 90d), a
 *          grid, an endpoint dot per stat, and a legend carrying each stat's
 *          projected total. All four stats now share one axis anchored at
 *          zero — the per-stat scaling fallback is gone, since a zero anchor
 *          makes a small stat's flat line truthful rather than broken. The
 *          SVG scales uniformly now, so the new labels are not stretched.
 *          Date labels are read back in UTC to match the day they came from.
 * 0.10.4 — Split chart axis: recorded history gets a fixed share of the width
 *          regardless of how little of it there is. Added the 1d range.
 */

(function () {
  "use strict";

  var PILL_ID = "gc-pill";
  var PANEL_ID = "gc-panel";
  var STYLE_ID = "gc-style";

  function pinFab(fab) {
    if (!fab) return;
    if (fab.getAttribute("data-gc") !== "1") {
      fab.setAttribute("data-gc", "1");
      fab.setAttribute("role", "button");
      fab.textContent = "GYM";
    }
    fab.style.setProperty("position", "fixed", "important");
    fab.style.setProperty("right", "16px", "important");
    fab.style.setProperty("left", "auto", "important");
    fab.style.setProperty("top", "auto", "important");
    fab.style.setProperty("bottom", "calc(120px + env(safe-area-inset-bottom, 0px))", "important");
    fab.style.setProperty("width", "52px", "important");
    fab.style.setProperty("height", "52px", "important");
    fab.style.setProperty("margin", "0", "important");
    fab.style.setProperty("padding", "0", "important");
    fab.style.setProperty("display", "flex", "important");
    fab.style.setProperty("align-items", "center", "important");
    fab.style.setProperty("justify-content", "center", "important");
    fab.style.setProperty("visibility", "visible", "important");
    fab.style.setProperty("opacity", "1", "important");
    fab.style.setProperty("z-index", "2147483646", "important");
    fab.style.setProperty("pointer-events", "auto", "important");
    fab.style.setProperty("background", "#121418", "important");
    fab.style.setProperty("color", "#2ecc71", "important");
    fab.style.setProperty("border", "2px solid #2ecc71", "important");
    fab.style.setProperty("border-radius", "14px", "important");
    fab.style.setProperty("font", "800 12px/1 -apple-system,sans-serif", "important");
    fab.style.setProperty("letter-spacing", "0.08em", "important");
    fab.style.setProperty("-webkit-appearance", "none", "important");
    fab.style.setProperty("touch-action", "manipulation", "important");
  }

  function mountFabNow() {
    try {
      var root = document.body || document.documentElement;
      if (!root) return false;
      var fab = document.getElementById(PILL_ID);
      if (!fab) {
        fab = document.createElement("div");
        fab.id = PILL_ID;
        root.appendChild(fab);
      } else if (fab.parentNode !== root) {
        try {
          root.appendChild(fab);
        } catch (_) {}
      }
      pinFab(fab);
      return true;
    } catch (_) {
      return false;
    }
  }

  var OWNER_TAG = "rcexyz [2598755]";
  var OWNER_ASCII =
    "█▀█ █▀▀ █▀▀ ▀▄▀ █ █ ▀▀█\n" +
    "█▀▄ █   █▀▀  █  ▀▄▀  █ \n" +
    "█ █ █▄▄ █▄▄ ▄▀▄  █  █▄▄";

  var OWNER_NOTICE =
    "Free for everyone. Built for rcexyz [2598755] by AaronPMC [4431836].";

  function ownerBannerHtml() {
    return (
      '<div class="gc-owner"><pre class="gc-ascii">' +
      OWNER_ASCII +
      '</pre><div class="gc-tag">' +
      OWNER_TAG +
      '</div><p class="gc-own">' +
      OWNER_NOTICE +
      "</p></div>"
    );
  }

  var NS = "gc_v1";
  var GC_VERSION = "0.10.12";
  var COMMENT = "GymCoach-AaronPMC";

  // Exactly ONE occurrence of the placeholder in this file, single-quoted, the
  // way the scripts that work under Torn PDA write it. The previous version
  // built a decoy by joining two halves of the token on the line above, to
  // detect whether PDA had substituted a key. That gave the file a second,
  // split occurrence — and PDA rewrites the placeholder by matching the
  // source text, so a greedy match runs from the decoy's opening to the real
  // one's close and deletes everything between, leaving unbalanced brackets.
  // The file then fails to parse and the script never runs at all: no button,
  // no error. Detect substitution from the value itself instead.
  var PDA_INJECTED_KEY = '###PDA-APIKEY###';
  var HAS_PDA_KEY = PDA_INJECTED_KEY.indexOf("##") === -1 && PDA_INJECTED_KEY.length > 8;

  var GYMS = [
    { Gym: "Premier Fitness", Energy: 5, Str: 2, Spe: 2, Def: 2, Dex: 2 },
    { Gym: "Average Joes", Energy: 5, Str: 2.4, Spe: 2.4, Def: 2.8, Dex: 2.4 },
    { Gym: "Woody's Workout", Energy: 5, Str: 2.8, Spe: 3.2, Def: 3, Dex: 2.8 },
    { Gym: "Beach Bods", Energy: 5, Str: 3.2, Spe: 3.2, Def: 3.2, Dex: 0 },
    { Gym: "Silver Gym", Energy: 5, Str: 3.4, Spe: 3.6, Def: 3.4, Dex: 3.2 },
    { Gym: "Pour Femme", Energy: 5, Str: 3.4, Spe: 3.6, Def: 3.6, Dex: 3.8 },
    { Gym: "Davies Den", Energy: 5, Str: 3.7, Spe: 0, Def: 3.7, Dex: 3.7 },
    { Gym: "Global Gym", Energy: 5, Str: 4, Spe: 4, Def: 4, Dex: 4 },
    { Gym: "Knuckle Heads", Energy: 10, Str: 4.8, Spe: 4.4, Def: 4, Dex: 4.2 },
    { Gym: "Pioneer Fitness", Energy: 10, Str: 4.4, Spe: 4.6, Def: 4.8, Dex: 4.4 },
    { Gym: "Anabolic Anomalies", Energy: 10, Str: 5, Spe: 4.6, Def: 5.2, Dex: 4.6 },
    { Gym: "Core", Energy: 10, Str: 5, Spe: 5.2, Def: 5, Dex: 5 },
    { Gym: "Racing Fitness", Energy: 10, Str: 5, Spe: 5.4, Def: 4.8, Dex: 5.2 },
    { Gym: "Complete Cardio", Energy: 10, Str: 5.5, Spe: 5.8, Def: 5.5, Dex: 5.2 },
    { Gym: "Legs Bums and Tums", Energy: 10, Str: 0, Spe: 5.6, Def: 5.6, Dex: 5.8 },
    { Gym: "Deep Burn", Energy: 10, Str: 6, Spe: 6, Def: 6, Dex: 6 },
    { Gym: "Apollo Gym", Energy: 10, Str: 6, Spe: 6.2, Def: 6.4, Dex: 6.2 },
    { Gym: "Gun Shop", Energy: 10, Str: 6.6, Spe: 6.4, Def: 6.2, Dex: 6.2 },
    { Gym: "Force Training", Energy: 10, Str: 6.4, Spe: 6.6, Def: 6.4, Dex: 6.8 },
    { Gym: "Cha Cha's", Energy: 10, Str: 6.4, Spe: 6.4, Def: 6.8, Dex: 7 },
    { Gym: "Atlas", Energy: 10, Str: 7, Spe: 6.4, Def: 6.4, Dex: 6.6 },
    { Gym: "Last Round", Energy: 10, Str: 6.8, Spe: 6.6, Def: 7, Dex: 6.6 },
    { Gym: "The Edge", Energy: 10, Str: 6.8, Spe: 7, Def: 7, Dex: 6.8 },
    { Gym: "George's", Energy: 10, Str: 7.3, Spe: 7.3, Def: 7.3, Dex: 7.3 },
    { Gym: "Balboas Gym", Energy: 25, Str: 0, Spe: 0, Def: 7.5, Dex: 7.5 },
    { Gym: "Frontline Fitness", Energy: 25, Str: 7.5, Spe: 7.5, Def: 0, Dex: 0 },
    { Gym: "Gym 3000", Energy: 50, Str: 8, Spe: 0, Def: 0, Dex: 0 },
    { Gym: "Mr. Isoyamas", Energy: 50, Str: 0, Spe: 0, Def: 8, Dex: 0 },
    { Gym: "Total Rebound", Energy: 50, Str: 0, Spe: 8, Def: 0, Dex: 0 },
    { Gym: "Elites", Energy: 50, Str: 0, Spe: 0, Def: 0, Dex: 8 },
    { Gym: "Sports Science Lab", Energy: 25, Str: 9, Spe: 9, Def: 9, Dex: 9 },
  ];

  var ITEM_MAP = [
    { key: "xanax", test: /xanax/i, cat: "Drug" },
    { key: "lsd", test: /^lsd$/i, cat: "Drug" },
    { key: "ecstasy", test: /ecstasy/i, cat: "Drug" },
    { key: "vicodin", test: /vicodin/i, cat: "Drug" },
    { key: "munster", test: /munster/i, cat: "Energy Drink" },
    { key: "redcow", test: /red cow/i, cat: "Energy Drink" },
    { key: "tourine", test: /tourine|taurine elite/i, cat: "Energy Drink" },
    { key: "cans", test: /can of |bottle of pumpkin|bottle of kandy|bottle of christmas|santa shooters|rockstar rudolph|x-mass/i, cat: "Energy Drink" },
    { key: "fhc", test: /feathery hotel/i },
    { key: "edvd", test: /erotic dvd/i },
    { key: "nandrolone", test: /nandrolone/i },
  ];
  var HAPPY_CANDY =
    /lollipop|bon\s?bon|chocolate|cupcake|pixie|jawbreaker|cotton candy|revels|mints|sweets|toffee|caramel|gingerbread|stollen|easter egg|chocolate egg|honeycomb|doughnut|donut|cookie|brownie|fudge|marshmallow|ice cream|candy apple|candy corn|truffle|praline|macaron|birthday cake|wedding cake|pumpkin pie|humbug|sherbet|tootsie|kisses|sweet hearts|reindeer dropping|bloody eyeball|gobstopper|nougat|liquorice|licorice|wine gum|cola bottle|bubblegum|popcorn|popsicle|sundae|muffin|waffle|pancake|parfait|cheesecake|candy cane|candy/i;
  var FALLBACK_IDS = { xanax: 206, ecstasy: 197, edvd: 366, lsd: 199, munster: 530, redcow: 532, tourine: 533, fhc: 367, vicodin: 205 };
  var H = 3600;
  var M = 60;
  var BOOSTER_CAP = 24 * H;
  var CANDY_FX = {
    35: { happy: 25, boost: 30 * M },
    36: { happy: 35, boost: 30 * M },
    310: { happy: 25, boost: 30 * M },
    366: { happy: 2500, boost: 6 * H },
  };
  function rollDrugCd() {
    return 6 * H + Math.floor(Math.random() * (2 * H + 1));
  }
  function boosterOpen(cd) {
    return (Number(cd) || 0) < BOOSTER_CAP;
  }
  function candyFx(id) {
    return CANDY_FX[Number(id)] || { happy: 25, boost: 30 * M };
  }
  function happyFxText(h) {
    if (!h) return "";
    if (h.kind === "edvd") {
      return "+" + (state.adultNov ? "5,000" : "2,500") + " happy · +6h booster";
    }
    if (h.kind === "drug") return "Doubles current happy · 6–8h drug CD";
    var fx = candyFx(h.id);
    return "+" + fx.happy + " happy · +" + Math.round(fx.boost / 60) + "m booster";
  }
  function itemFxShort(key) {
    var map = {
      xanax: "+250e cap 1,000 · +75 happy · 6–8h drug CD",
      cans: "Munster +20e / Red Cow +25e / Taurine +30e · +2h booster each",
      fhc: "Refills energy · +500 happy · +6h booster",
      nandrolone: "Not part of this gym loop",
      edvd: "+2,500 happy (+5,000 w/ 10★ AN) · +6h booster",
      candy: "Typical +25 happy · +30m booster (Big Box +35)",
      ecstasy: "Doubles happy · 6–8h drug CD",
      lsd: "+50e · +5 nerve · +200–500 happy · 6–8h drug CD",
      vicodin: "+75 happy · +25% battle stats · 6–8h drug CD",
    };
    return map[key] || "";
  }

  var state = {
    tab: "coach",
    open: false,
    warStack: false,
    focus: "str",
    focus2: "none",
    mode: "xan",
    adultNov: false,
    status: "boot",
    statusText: "Starting…",
    lastFetch: 0,
    lastTrain: 0,
    flash: "",
    energy: 0,
    energyMax: 150,
    energyFulltime: 0,
    energySecPerE: 0,
    happy: 0,
    happyMax: 0,
    drugCd: 0,
    boosterCd: 0,
    gymName: "Gym",
    gymEnergy: 25,
    dots: { str: 2, def: 2, spe: 2, dex: 2 },
    stats: { str: 0, def: 0, spe: 0, dex: 0 },
    perks: { str: 1, def: 1, spe: 1, dex: 1, all: 1 },
    perkFaction: [],
    perkCompany: [],
    perkJob: [],
    items: { xanax: 0, lsd: 0, ecstasy: 0, vicodin: 0, munster: 0, redcow: 0, tourine: 0, cans: 0, fhc: 0, edvd: 0, candy: 0, nandrolone: 0 },
    itemIds: {},
    happyList: [],
    log: [],
    invDiag: null,
    invUnavailable: "",
    invTally: null,
    energyDom: "",
    pendingUse: null,
    rawQty: null,
    rawHappy: null,
    invAt: 0,
    toast: null,
    invCatErr: "",
    // Compact daily stat history. One entry per day: {d: days-since-epoch,
    // v: [str, def, spe, dex]}. Arrays rather than named keys because
    // storeSet mirrors into localStorage, which Torn shares across every
    // script on the page — a year of named-key objects is several times
    // the size for no benefit.
    hist: [],
    histRange: 30,
    fetchInFlight: false,
  };

  var lastTickSig = "";
  var pollTimer = null;
  var cdTimer = null;
  var observers = [];
  var clickHandler = null;
  var draftKey = "";
  var keyBoxFocused = false;

  function pdaGlobal(name) {
    try {
      if (name === "PDA_httpGet" && typeof PDA_httpGet === "function") return PDA_httpGet;
      if (name === "PDA_httpPost" && typeof PDA_httpPost === "function") return PDA_httpPost;
    } catch (_) {}
    try {
      if (typeof window !== "undefined" && typeof window[name] === "function") return window[name];
    } catch (_) {}
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow && typeof unsafeWindow[name] === "function") {
        return unsafeWindow[name].bind(unsafeWindow);
      }
    } catch (_) {}
    return null;
  }

  function pdaReady() {
    try {
      if (window.__PDA_platformReadyPromise) return window.__PDA_platformReadyPromise;
    } catch (_) {}
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow && unsafeWindow.__PDA_platformReadyPromise) {
        return unsafeWindow.__PDA_platformReadyPromise;
      }
    } catch (_) {}
    return Promise.resolve();
  }

  function waitMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function pdaText(res) {
    if (res == null) return "";
    if (typeof res === "string") return res;
    if (typeof res !== "object") return String(res);
    if (typeof res.responseText === "string") return res.responseText;
    if (typeof res.data === "string") return res.data;
    if (res.data != null && typeof res.data === "object") {
      try {
        return JSON.stringify(res.data);
      } catch (_) {}
    }
    return "";
  }

  function pdaStatus(res) {
    if (res && typeof res === "object" && isFinite(res.status)) return Number(res.status);
    return 200;
  }

  function gmXhr(opts) {
    try {
      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest(opts);
        return true;
      }
    } catch (_) {}
    try {
      if (typeof GM !== "undefined" && GM && typeof GM.xmlHttpRequest === "function") {
        GM.xmlHttpRequest(opts);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function httpGet(url) {
    return new Promise(function (resolve, reject) {
      function finish(text, next) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          if (next) return next();
          return reject(new Error("Bad JSON"));
        }
        if (data && data.error) {
          var err = new Error(data.error.error || "API error");
          err.code = data.error.code;
          return reject(err);
        }
        resolve(data);
      }

      function viaGm() {
        if (
          gmXhr({
            method: "GET",
            url: url,
            anonymous: true,
            onload: function (res) {
              finish(res && res.responseText != null ? String(res.responseText) : "", null);
            },
            onerror: function () {
              reject(new Error("API request failed"));
            },
          })
        )
          return;
        reject(new Error("API request failed"));
      }

      function viaPda() {
        var get = pdaGlobal("PDA_httpGet");
        if (!get) return viaGm();
        var done = false;
        function onRes(res) {
          if (done) return;
          done = true;
          var text = pdaText(res);
          if (!text) return viaGm();
          finish(text, viaGm);
        }
        try {
          var ret = get(url);
          if (ret && typeof ret.then === "function") {
            ret.then(onRes, function () {
              try {
                get(url, onRes);
              } catch (_) {
                viaGm();
              }
            });
            return;
          }
          if (ret != null && ret !== "") {
            onRes(ret);
            return;
          }
        } catch (_) {}
        try {
          get(url, onRes);
        } catch (_) {
          viaGm();
        }
      }

      fetch(url)
        .then(function (r) {
          return r.text();
        })
        .then(function (t) {
          if (!t) return viaPda();
          finish(t, viaPda);
        })
        .catch(function () {
          viaPda();
        });
    });
  }

  function pdaRequest(kind, url, headers, body) {
    var fn = kind === "POST" ? pdaGlobal("PDA_httpPost") : pdaGlobal("PDA_httpGet");
    if (!fn) return Promise.reject(new Error("no PDA http"));
    function once() {
      var ret;
      try {
        ret = kind === "POST" ? fn(url, headers || {}, body || "") : fn(url);
      } catch (e) {
        return Promise.reject(e);
      }
      if (ret && typeof ret.then === "function") return ret;
      return Promise.resolve(ret);
    }
    return once().then(function (res) {
      if (res == null || res === "") return waitMs(2100).then(once);
      return res;
    });
  }

  function storeGet(key, fallback) {
    var k = NS + "_" + key;
    try {
      if (typeof GM_getValue === "function") {
        var v = GM_getValue(k, fallback);
        if (v !== undefined && v !== null) return v;
      }
    } catch (_) {}
    try {
      if (typeof GM !== "undefined" && GM && typeof GM.getValue === "function") {
        var gv = GM.getValue(k, fallback);
        if (gv && typeof gv.then === "function") {
          /* async GM 4 — localStorage is the sync source of truth */
        } else if (gv !== undefined && gv !== null) return gv;
      }
    } catch (_) {}
    try {
      var raw = localStorage.getItem(k);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return raw;
      }
    } catch (_) {}
    return fallback;
  }

  function storeSet(key, value) {
    var k = NS + "_" + key;
    try {
      if (typeof GM_setValue === "function") GM_setValue(k, value);
    } catch (_) {}
    try {
      if (typeof GM !== "undefined" && GM && typeof GM.setValue === "function") GM.setValue(k, value);
    } catch (_) {}
    try {
      localStorage.setItem(k, typeof value === "string" ? value : JSON.stringify(value));
    } catch (_) {}
  }

  function resolveKey() {
    var injected = String(PDA_INJECTED_KEY || "").trim();
    if (injected && injected.indexOf("###") === -1 && injected.length > 8) return injected;
    return String(storeGet("api_key", "") || "").trim();
  }

  function keySource() {
    if (HAS_PDA_KEY && resolveKey()) return "Torn PDA";
    if (resolveKey()) return "saved key";
    return "none";
  }

  function fmt(n) {
    if (!isFinite(n)) return "—";
    return Math.round(n).toLocaleString("en-US");
  }

  function fmtCd(s) {
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (!s) return "READY";
    if (h && m) return h + "h " + m + "m";
    if (h) return h + "h";
    if (m) return m + "m";
    return s + "s";
  }

  function ROUND(num, places) {
    return +(Math.round(num + "e+" + places) + "e-" + places);
  }

  function httpPost(url, body) {
    var headers = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    };
    return new Promise(function (resolve, reject) {
      function finish(ok, text) {
        var data = {};
        try {
          data = JSON.parse(text || "{}");
        } catch (_) {
          data = { text: text };
        }
        if (!ok && !data.success && !data.items) return reject(new Error("Use failed"));
        resolve(data);
      }

      fetch(url, { method: "POST", credentials: "include", headers: headers, body: body })
        .then(function (r) {
          return r.text().then(function (t) {
            finish(r.ok, t);
          });
        })
        .catch(function () {
          pdaRequest("POST", url, headers, body)
            .then(function (res) {
              var text = pdaText(res);
              var status = pdaStatus(res);
              finish(status >= 200 && status < 300, text);
            })
            .catch(function () {
              if (
                gmXhr({
                  method: "POST",
                  url: url,
                  headers: headers,
                  data: body,
                  onload: function (res) {
                    var status = res && isFinite(res.status) ? Number(res.status) : 0;
                    finish(status >= 200 && status < 300, (res && res.responseText) || "");
                  },
                  onerror: function () {
                    finish(false, "");
                  },
                })
              )
                return;
              finish(false, "");
            });
        });
    });
  }

  var toastTimer = null;
  function showToast(title, body, ms) {
    state.toast = { title: title, body: body, until: Date.now() + (ms || 2600) };
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    var el = panel.querySelector(".gc-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "gc-toast";
      panel.appendChild(el);
    }
    el.innerHTML = "<b>" + title + "</b><span>" + body + "</span>";
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      state.toast = null;
      var p2 = document.getElementById(PANEL_ID);
      var e2 = p2 && p2.querySelector(".gc-toast");
      if (e2) e2.classList.remove("show");
    }, ms || 2600);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function idForKey(key) {
    var ids = state.itemIds || {};
    if (key === "cans") return ids.munster || ids.redcow || ids.tourine || ids.cans || FALLBACK_IDS.munster;
    if (key === "candy") {
      var hit = (state.happyList || []).filter(function (h) {
        return h.kind === "candy" && h.id;
      })[0];
      return (hit && hit.id) || ids.candy;
    }
    return ids[key] || FALLBACK_IDS[key] || 0;
  }

  function itemTip(key) {
    var tick = nextTickSec();
    var drugLeft = fmtCd(state.drugCd);
    var boostLeft = fmtCd(state.boosterCd);
    var map = {
      xanax: [
        "Xanax",
        "+250 energy (caps at 1,000) and +75 happy. Starts a shared drug cooldown of 6–8 hours (random). Side effects while it lasts, including a battle-stat penalty. Overdose can wipe energy, nerve, and happy. Live CD: " + drugLeft + ".",
      ],
      cans: [
        "Energy drinks",
        "Munster +20e, Red Cow +25e, Taurine Elite +30e. Each adds 2 hours to booster CD (you can keep using until that bar is over 24h). No drug CD. Live booster: " + boostLeft + ".",
      ],
      lsd: [
        "Skip LSD",
        "+50 energy, +5 nerve, +200–500 happy. Same 6–8h drug CD as xanax — it would block your xan. Leave it.",
      ],
      fhc: [
        "Don\u2019t use FHC",
        "Feathery Hotel Coupon refills your energy bar, +500 happy, and adds 6 hours booster CD. That\u2019s a travel / refill coupon, not this gym loop.",
      ],
      nandrolone: [
        "Optional",
        "Not part of the xan + gym or happy-jump loop. Leave it.",
      ],
      edvd: [
        "Erotic DVDs",
        state.mode !== "jump"
          ? "Happy jump is off. An e-dvd is +2,500 happy (+5,000 with 10★ Adult Novelties) and +6h booster CD."
          : "Each e-dvd: +2,500 happy (+5,000 with 10★ Adult Novelties) and +6h booster. Use on the :00/:15/:30/:45 tick with candy, before ecstasy. Booster " + boostLeft + ". Next tick " + fmtCd(tick) + ".",
      ],
      candy: [
        "Happy candy",
        state.mode !== "jump"
          ? "Happy jump is off. Typical candy is +25 happy and +30 min booster (Big Box of Chocolate Bars is +35 / 30 min). CD stacks; you can keep using until booster is over 24h."
          : "Typical candy: +25 happy and +30 min booster (Big Box +35). Stacks on the booster bar (max ~24h / ~48 candies). After the tick (" + fmtCd(tick) + "), candy then e-dvds, ecstasy last.",
      ],
      ecstasy: [
        "Ecstasy last",
        "Doubles current happiness. Starts the same 6–8h drug CD as xanax — never take it before the other happy items. Live drug CD: " + drugLeft + ".",
      ],
      vicodin: [
        "Skip vicodin",
        "+75 happy and +25% all battle stats (temporary). Starts a 6–8h drug CD, so it would block xanax / ecstasy. Don\u2019t mix it into this gym loop.",
      ],
    };
    return map[key] || ["Hold", "Not now."];
  }

  function useTornItem(itemId) {
    var body = "step=useItem&id=" + encodeURIComponent(itemId) + "&itemID=" + encodeURIComponent(itemId);
    return httpPost("https://www.torn.com/item.php?rfcv=" + Date.now(), body).then(function (data) {
      if (data && (data.success || data.items || data.text)) return data;
      return httpPost(
        "https://www.torn.com/page.php?sid=itemsUse&rfcv=" + Date.now(),
        "step=useItem&itemID=" + encodeURIComponent(itemId) + "&id=" + encodeURIComponent(itemId)
      );
    });
  }

  // Torn caches the API for ~30s, so re-fetching right after a use returns the
  // PRE-use count and the number appears frozen. We know exactly what we just
  // consumed, so drop it locally and let the next real fetch reconcile. Only
  // ever applied after Torn accepts the use.
  // Decrementing the display is not enough on its own: the refresh that follows
  // a use reads Torn's ~30s cache, which still holds the PRE-use count, and
  // overwrites it — the number drops then springs back. So the use is recorded
  // as PENDING and re-applied to every fetch until the API actually catches up.
  function decrementItemLocal(id) {
    id = Number(id) || 0;
    if (!id) return "";
    var hit = "";
    var ids = state.itemIds || {};
    for (var k in ids) {
      if (Number(ids[k]) === id) {
        hit = k;
        break;
      }
    }
    if (!hit) return "";
    if (!state.rawQty) {
      state.rawQty = {};
      for (var bk in state.items) state.rawQty[bk] = state.items[bk];
    }
    var pend = state.pendingUse || (state.pendingUse = {});
    var cur = pend[id] || { key: hit, n: 0, at: 0 };
    cur.key = hit;
    cur.n += 1;
    cur.at = Date.now();
    pend[id] = cur;
    applyPendingUses();
    return hit;
  }

  // Subtracts still-unconfirmed uses from the counts the API handed us.
  // IDEMPOTENT ON PURPOSE: it always recomputes from the raw API baseline
  // rather than from the current display, because it runs on every use AND on
  // every fetch. Subtracting from the already-adjusted value double-counted —
  // two uses in a row read 44 instead of 45.
  function applyPendingUses() {
    var pend = state.pendingUse;
    if (!pend || !state.rawQty) return;
    var now = Date.now();
    var byKey = {};
    var byId = {};
    for (var id in pend) {
      var p = pend[id];
      // Give up after two minutes. If the API still disagrees by then the use
      // did not land, and holding the adjustment forever would lie the other way.
      if (now - p.at > 1800000) {
        delete pend[id];
        continue;
      }
      byKey[p.key] = (byKey[p.key] || 0) + p.n;
      byId[id] = (byId[id] || 0) + p.n;
    }
    for (var k in byKey) {
      var base = state.rawQty[k];
      if (base === undefined) continue;
      state.items[k] = Math.max(0, Number(base) - byKey[k]);
    }
    var list = state.happyList || [];
    for (var i = 0; i < list.length; i++) {
      var raw = state.rawHappy ? state.rawHappy[list[i].id] : undefined;
      if (raw === undefined) continue;
      var n = byId[list[i].id] || 0;
      list[i].qty = Math.max(0, Number(raw) - n);
    }
  }

  function useItemId(id) {
    id = Number(id) || 0;
    if (!id) {
      showToast("Can\u2019t use", "No item id yet. Refresh, then try again.");
      return;
    }
    if (state.usingItem) return;
    state.usingItem = true;
    useTornItem(id)
      .then(function () {
        decrementItemLocal(id);
        showToast("Used", "Took one. Refreshing bars.");
        state.flash = "USED";
        if (state.open) renderPanel();
        setTimeout(function () {
          state.flash = "";
          if (state.open) renderPanel();
        }, 1200);
        return refresh("items");
      })
      .catch(function () {
        showToast("Didn\u2019t use", "Torn didn\u2019t accept it. Open items and use it there, then refresh.");
      })
      .then(function () {
        state.usingItem = false;
      });
  }

  function useItemKey(key) {
    useItemId(idForKey(key));
  }

  function itemChip(row) {
    var rec = String(row.rec || "");
    if (rec === "USE") return '<button type="button" class="chip use" data-use="' + row.key + '">USE</button>';
    if (/DON/.test(rec)) return '<span class="chip bad">DON\u2019T</span>';
    return '<button type="button" class="chip ' + (row.cls || "muted") + '" data-tip="' + row.key + '">' + rec + "</button>";
  }

  function happyItemChip(h) {
    var jumpGo = state.mode === "jump" && nextTickSec() <= 90;
    var key = h.kind === "edvd" ? "edvd" : h.kind === "drug" ? "ecstasy" : "candy";
    var canBoost = boosterOpen(state.boosterCd);
    if (h.kind === "drug") {
      if (state.mode !== "jump") return itemChip({ key: key, rec: "OFF", cls: "muted" });
      if (jumpGo && state.drugCd <= 0 && h.id) {
        return '<button type="button" class="chip use" data-use-id="' + h.id + '">USE</button>';
      }
      return itemChip({ key: key, rec: "LAST", cls: "warn" });
    }
    if (state.mode !== "jump") return itemChip({ key: key, rec: "OFF", cls: "muted" });
    var canUse = jumpGo && h.id && canBoost;
    if (canUse) return '<button type="button" class="chip use" data-use-id="' + h.id + '">USE</button>';
    return itemChip({ key: key, rec: "HOLD", cls: "muted" });
  }

  function happyKitText() {
    var list = (state.happyList || []).filter(function (h) {
      return h.kind !== "drug";
    });
    if (!list.length) {
      return "every Candy-type item you have (chocolates, lollipops, bags of sweets, cupcakes, eggs, …) plus e-dvds, then ecstasy last";
    }
    return (
      list
        .map(function (h) {
          return h.qty + "× " + h.name;
        })
        .join(", ") + ", then ecstasy last"
    );
  }

  function apiUrl(selections) {
    return (
      "https://api.torn.com/user/?selections=" +
      selections +
      "&key=" +
      encodeURIComponent(resolveKey()) +
      "&comment=" +
      encodeURIComponent(COMMENT)
    );
  }

  var INV_PAGE = 250; // spec maximum; the default of 20 would silently truncate

  // `cat` is REQUIRED in practice. Torn's own OpenAPI spec marks it optional
  // for /user/inventory, but omitting it answers "Incorrect category" — the
  // runtime and the published spec disagree, and the runtime wins. So walk the
  // categories this coach actually reads. Anything outside these (weapons,
  // armour, plushies) is irrelevant here and not worth the requests.
  var INV_CATS = ["Drug", "Energy Drink", "Candy", "Alcohol", "Booster", "Supply Pack", "Enhancer"];

  function invUrlV2(cat, offset) {
    return (
      "https://api.torn.com/v2/user/inventory?cat=" +
      encodeURIComponent(cat) +
      "&limit=" +
      INV_PAGE +
      "&offset=" +
      (offset || 0) +
      "&key=" +
      encodeURIComponent(resolveKey()) +
      "&comment=" +
      encodeURIComponent(COMMENT)
    );
  }

  function fetchInvCat(cat, offset, acc) {
    offset = offset || 0;
    acc = acc || [];
    return httpGet(invUrlV2(cat, offset)).then(function (data) {
      var block = data && data.inventory;
      var rows = block && Array.isArray(block.items) ? block.items : Array.isArray(block) ? block : [];
      for (var ri = 0; ri < rows.length; ri++) {
        if (rows[ri] && typeof rows[ri] === "object") rows[ri]._cat = cat;
      }
      acc = acc.concat(rows);
      if (rows.length === INV_PAGE && acc.length < 2000) return fetchInvCat(cat, offset + INV_PAGE, acc);
      return acc;
    });
  }

  // One category failing must not lose the others, so each resolves to [] on
  // error and the per-category tally is reported for diagnosis.
  function fetchInventoryV2() {
    var tally = {};
    var seq = INV_CATS.reduce(function (chain, cat) {
      return chain.then(function (all) {
        return fetchInvCat(cat, 0, []).then(
          function (rows) {
            tally[cat] = rows.length;
            return all.concat(rows);
          },
          function (err) {
            tally[cat] = "err";
            state.invCatErr = (err && err.message) || "failed";
            return all;
          }
        );
      });
    }, Promise.resolve([]));
    return seq.then(function (all) {
      state.invTally = tally;
      return all;
    });
  }

  // Torn's API caches user bars server-side for ~30s, so no poll rate can make
  // energy current — the API is behind Torn's own page. The header bar is live,
  // so read that and let the API keep supplying everything else. Several
  // selector shapes are tried because Torn's bar markup has changed across
  // versions and the hashed React classes are not stable; whichever hits is
  // reported so a future rebuild is one screenshot away.
  function readEnergyFromDom() {
    var pat = /(\d[\d,]*)\s*\/\s*(\d[\d,]*)/;
    function parse(el, how) {
      if (!el) return null;
      var m = String(el.textContent || "").replace(/\s+/g, " ").match(pat);
      if (!m) return null;
      var cur = Number(String(m[1]).replace(/,/g, ""));
      var max = Number(String(m[2]).replace(/,/g, ""));
      if (!max || max > 5000 || cur > 20000) return null;
      return { cur: cur, max: max, how: how };
    }
    try {
      var byId = document.getElementById("barEnergy");
      var hit = parse(byId, "#barEnergy");
      if (hit) return hit;
      var pre = document.querySelector('[id^="barEnergy"]');
      hit = parse(pre, "[id^=barEnergy]");
      if (hit) return hit;
      // Last resort: the icon/label carries the word energy somewhere above the
      // number, so walk likely containers rather than the whole document.
      var nodes = document.querySelectorAll('[class*="bar"],[id*="energy"],[class*="energy"]');
      for (var i = 0; i < nodes.length && i < 60; i++) {
        var n = nodes[i];
        var txt = String(n.textContent || "");
        if (txt.length > 60) continue;
        if (!/energy/i.test(String(n.className) + " " + String(n.id))) continue;
        hit = parse(n, "scan");
        if (hit) return hit;
      }
    } catch (_) {}
    return null;
  }

  // Adopt the live bar whenever it disagrees with the cached API value.
  function syncEnergyFromDom() {
    var d = readEnergyFromDom();
    if (!d) {
      state.energyDom = "";
      return false;
    }
    state.energyDom = d.how + " " + d.cur + "/" + d.max;
    var changed = false;
    if (d.cur !== state.energy) {
      state.energy = d.cur;
      changed = true;
    }
    if (d.max && d.max !== state.energyMax) {
      state.energyMax = d.max;
      changed = true;
    }
    return changed;
  }

  function countItems(inv) {
    var out = { xanax: 0, lsd: 0, ecstasy: 0, vicodin: 0, munster: 0, redcow: 0, tourine: 0, cans: 0, fhc: 0, edvd: 0, candy: 0, nandrolone: 0 };
    var ids = {};
    var happy = [];
    if (!inv) return { qty: out, ids: ids, happy: happy };
    var list = Array.isArray(inv)
      ? inv
      : Object.keys(inv).map(function (k) {
          return inv[k];
        });
    list.forEach(function (it) {
      if (!it) return;
      var name = String(it.name || "");
      var qty = Number(it.amount != null ? it.amount : it.quantity != null ? it.quantity : it.qty || 0) || 0;
      if (!qty) return;
      var id = Number(it.ID != null ? it.ID : it.id || 0) || 0;
      var type = String(it.type || "").toLowerCase();
      var isCandy = type === "candy" || type.indexOf("candy") !== -1 || HAPPY_CANDY.test(name);
      var key = "";
      var rowCat = it._cat || "";
      ITEM_MAP.forEach(function (m) {
        // When we know the row's real category, a pattern tied to a different
        // one cannot claim it. Falls back to name-only when the category is
        // unknown (a v1-shaped payload).
        if (m.cat && rowCat && m.cat !== rowCat) return;
        if (m.test.test(name)) key = m.key;
      });
      if (!key && isCandy) key = "candy";
      if (key) {
        // Show every row feeding the drink total with its category: either we
        // are adding rows we should not, or the API is reporting a stale amount
        // for the one row that is a real drink. Opposite fixes, identical total.
        out[key] = (out[key] || 0) + qty;
        if (id && !ids[key]) ids[key] = id;
      }
      if (key === "edvd" || key === "candy" || key === "ecstasy" || isCandy) {
        var kind = key === "edvd" ? "edvd" : key === "ecstasy" ? "drug" : "candy";
        happy.push({ id: id, name: name, qty: qty, kind: kind });
      }
    });
    return { qty: out, ids: ids, happy: happy };
  }

  function applyCountedItems(parsed) {
    if (!parsed) return;
    var raw = parsed.qty;
    // A pending use is CONFIRMED once the API's own number falls below what it
    // last reported — that is the cache expiring, not our guess. Clear it then,
    // or the subtraction would be applied twice.
    var pend = state.pendingUse;
    if (pend) {
      // Retire pending uses by how much the API has ACTUALLY come down. Clearing
      // on the first sign of any drop was wrong: three pending uses all vanished
      // the moment the API acknowledged one, and the count sprang back up by two.
      var dropped = {};
      for (var dk in raw) {
        var was = state.rawQty ? state.rawQty[dk] : undefined;
        if (was !== undefined && Number(raw[dk]) < Number(was)) dropped[dk] = Number(was) - Number(raw[dk]);
      }
      for (var id in pend) {
        var k = pend[id].key;
        var credit = dropped[k] || 0;
        if (!credit) continue;
        var take = Math.min(credit, pend[id].n);
        pend[id].n -= take;
        dropped[k] = credit - take;
        if (pend[id].n <= 0) delete pend[id];
      }
    }
    state.rawQty = {};
    for (var rk in raw) state.rawQty[rk] = raw[rk];
    state.items = raw;
    state.itemIds = parsed.ids || {};
    state.happyList = parsed.happy || [];
    state.rawHappy = {};
    for (var hi = 0; hi < state.happyList.length; hi++) {
      state.rawHappy[state.happyList[hi].id] = state.happyList[hi].qty;
    }
    applyPendingUses();
  }

  function extractPercentMult(string) {
    var s = String(string);
    var m = s.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
    if (m) return parseFloat(m[1]) / 100 + 1;
    m = s.toLowerCase().match(/gym\s+gains[^\d]*(\d+(?:\.\d+)?)/) || s.toLowerCase().match(/(\d+(?:\.\d+)?)[^\d]*gym\s+gains/);
    if (m) return parseFloat(m[1]) / 100 + 1;
    return null;
  }

  function isGymPerkLine(s) {
    var lower = String(s || "").toLowerCase();
    if (lower.indexOf("gym") === -1) return false;
    return lower.indexOf("gain") !== -1 || /gym\s+train/.test(lower);
  }

  function parsePerks(data) {
    var mods = { all: 1, str: 1, spe: 1, def: 1, dex: 1 };
    var factionHits = [];
    var companyHits = [];
    var jobHits = [];
    function apply(list, source) {
      if (!list || !list.length) return;
      for (var i = 0; i < list.length; i++) {
        var s = String(list[i] || "");
        var lower = s.toLowerCase();
        if (!isGymPerkLine(s)) continue;
        var n = extractPercentMult(s);
        if (!n) continue;
        if (lower.indexOf("strength") !== -1) mods.str *= n;
        else if (lower.indexOf("speed") !== -1) mods.spe *= n;
        else if (lower.indexOf("defense") !== -1 || lower.indexOf("defence") !== -1) mods.def *= n;
        else if (lower.indexOf("dexterity") !== -1) mods.dex *= n;
        else mods.all *= n;
        if (source === "faction") factionHits.push(s);
        if (source === "company") companyHits.push(s);
        if (source === "job") jobHits.push(s);
      }
    }
    apply(data.job_perks, "job");
    apply(data.property_perks, "property");
    apply(data.education_perks, "education");
    apply(data.merit_perks, "merit");
    apply(data.faction_perks, "faction");
    apply(data.company_perks, "company");
    apply(data.stock_perks, "stock");
    apply(data.book_perks, "book");
    apply(data.enhancer_perks, "enhancer");
    return {
      str: mods.str * mods.all,
      def: mods.def * mods.all,
      spe: mods.spe * mods.all,
      dex: mods.dex * mods.all,
      all: mods.all,
      faction: factionHits,
      company: companyHits,
      job: jobHits,
    };
  }

  function perkPct(mult) {
    var pct = Math.round(((Number(mult) || 1) - 1) * 1000) / 10;
    if (!pct) return "0%";
    return (pct > 0 ? "+" : "") + pct + "%";
  }

  function gainOne(stat, happy, dots, energyP, perk, typ) {
    var S = stat;
    if (S > 5e7) S = 5e7 + (S - 5e7) / (8.77635 * Math.log(S));
    var H = happy || 1;
    var coeffs = { str: [1600, 1700, 700], spe: [1600, 2000, 1350], dex: [1800, 1500, 1000], def: [2100, -600, 1500] }[typ];
    var A = coeffs[0];
    var B = coeffs[1];
    return (
      (S * ROUND(1 + 0.07 * ROUND(Math.log(1 + H / 250), 4), 4) +
        8 * Math.pow(H, 1.05) +
        (1 - Math.pow(H / 99999, 2)) * A +
        B) *
      (1 / 200000) *
      dots *
      energyP *
      perk
    );
  }

  function projectDays(days, energyPerDay, typ) {
    var stat = state.stats[typ] || 0;
    if (!stat) return 0;
    var gym = GYMS.filter(function (g) {
      return g.Gym === state.gymName;
    })[0] || GYMS[GYMS.length - 1];
    var energyP = gym.Energy || 25;
    var dots = Number(gym[{ str: "Str", def: "Def", spe: "Spe", dex: "Dex" }[typ]]) || 0;
    if (!dots) return 0;
    var trains = Math.floor(energyPerDay / energyP) * days;
    var total = 0;
    var happy = state.happyMax || state.happy || 5000;
    for (var i = 0; i < trains; i++) {
      total += gainOne(stat + total, happy, dots, energyP, state.perks[typ] || 1, typ);
    }
    return total;
  }

  function dailyEnergy() {
    var natural = 720;
    var xans = state.warStack ? 0 : 3 * 250;
    return { natural: natural, xan: xans, refill: 0, total: natural + xans };
  }

  var WAIT_FULL_MAX = 45 * 60;

  function timeToFull() {
    var max = state.energyMax || 150;
    var e = state.energy || 0;
    if (e >= max) return 0; // already full, or banked above the cap
    return Math.max(0, Math.round((max - e) * (state.energySecPerE || 120)));
  }

  function nextTickSec() {
    var d = new Date();
    var left = (15 - (d.getMinutes() % 15)) * 60 - d.getSeconds();
    if (left <= 0) left += 15 * 60;
    return left;
  }

  function stepsHtml(steps) {
    if (!steps || !steps.length) return "";
    return (
      '<ol class="steps">' +
      steps
        .map(function (s) {
          return '<li><span class="when">' + s.t + "</span><span>" + s.text + "</span></li>";
        })
        .join("") +
      "</ol>"
    );
  }

  function pickBtn(attr, id, label, on) {
    return (
      '<button class="gc-btn' +
      (on ? "" : " secondary") +
      '" data-' +
      attr +
      '="' +
      id +
      '">' +
      label +
      "</button>"
    );
  }

  function coach() {
    var focus = focusLabel();
    var gym = state.gymName || "your gym";
    var toFull = timeToFull();
    var full = state.energy >= (state.energyMax || 150) - 2;
    var xans = state.items.xanax || 0;
    var afterXan = Math.min(1000, state.energy + 250);
    var cans =
      (state.items.munster || 0) +
      (state.items.redcow || 0) +
      (state.items.tourine || 0) +
      (state.items.cans || 0);

    if (state.warStack) {
      return {
        kind: "stack",
        move: "War stack. Hold energy.",
        why: "Don\u2019t xan. Don\u2019t train. Coach only pings if you hit 1,000e.",
        steps: [
          { t: "NOW", text: "Leave energy alone. " + state.energy + "/" + state.energyMax + "." },
          { t: "AFTER", text: "When the chain is over, turn stack off and go back to your gym loop." },
        ],
      };
    }

    if (state.mode === "jump") return jumpCoach();

    if (!resolveKey() && state.status !== "live") {
      return {
        kind: "wait",
        move: "Connect a key so this can run live.",
        why: "Torn PDA injects your Limited API key. If Set still asks, paste one there.",
        steps: [{ t: "SET", text: "Open Set. If the key isn\u2019t injected, paste a Limited API key." }],
      };
    }

    if (state.drugCd <= 0 && xans <= 0) {
      return {
        kind: "wait",
        move: "Buy xanax. CD is open and you\u2019re empty.",
        why: "Your loop is xan + dump " + focus + ". No xans means you\u2019re only on natural energy.",
        steps: [
          { t: "NOW", text: "Buy at least 3 xanax." },
          {
            t: "THEN",
            text: full
              ? "Bar is full — train " + focus + " so you don\u2019t overflow while shopping."
              : "Wait " + fmtCd(toFull) + " for a full bar, then xan.",
          },
        ],
      };
    }

    if (state.drugCd <= 0) {
      var waitFull = !full && toFull > 0 && toFull <= WAIT_FULL_MAX;
      if (waitFull) {
        var fat = (state.energyMax || 150) + 250;
        return {
          kind: "wait",
          move: "Wait " + fmtCd(toFull) + " for a full bar, then take a xan.",
          why:
            "Xan is ready but you\u2019re at " +
            state.energy +
            "/" +
            state.energyMax +
            ". Waiting lets you dump " +
            fat +
            "e into " +
            focus +
            " instead of " +
            afterXan +
            "e.",
          steps: [
            { t: "NOW", text: "Do not xan. Do not train. Let energy fill. " + fmtCd(toFull) + " left." },
            { t: "+" + fmtCd(toFull), text: "Bar hits " + state.energyMax + ". Take 1 xanax (" + xans + " left)." },
            { t: "THEN", text: "Dump all " + fat + "e into " + focus + " at " + gym + ". One session. Don\u2019t split stats." },
            {
              t: "WAIT",
              text: "Drug CD starts (~6–8h). While it ticks, dump natural energy whenever the bar fills. Never overflow.",
            },
            {
              t: "NEXT",
              text: "CD pops → wait for a full bar if it\u2019s under ~45m → xan → dump " + focus + " again.",
            },
          ],
          waste: "If you xan now you\u2019d only dump " + afterXan + "e. Waiting picks up the rest of the bar.",
        };
      }
      var dumpNow = full ? Math.min(1000, state.energy + 250) : afterXan;
      var canAdd = boosterOpen(state.boosterCd) && cans > 0;
      return {
        kind: "go",
        move: full
          ? "Take a xan now, then dump " + dumpNow + "e " + focus + "."
          : "Take a xan now (" + state.energy + "e → " + afterXan + "e), then dump " + focus + ".",
        why: full
          ? "Bar is full and drug CD is open. Xan first so this session is " + dumpNow + "e, not " + state.energy + "e."
          : "Drug CD is open. Waiting for a full bar would take " +
            fmtCd(toFull) +
            " and delay the next xan. Take it, dump " +
            focus +
            ", CD clock starts.",
        steps: [
          {
            t: "NOW",
            text:
              "Take 1 xanax. You have " +
              xans +
              "." +
              (canAdd ? " Booster is under 24h — cans after the xan if you want a fatter dump." : ""),
          },
          { t: "THEN", text: "Go to " + gym + ". Dump ALL energy into " + focus + "." + leftoverNote() },
          { t: "WAIT", text: "Drug CD ~6–8h. Do not xan until it says READY." },
          {
            t: "BETWEEN",
            text: "When energy fills, train " + focus + " again. Never sit on a full bar while CD is ticking.",
          },
          {
            t: "REPEAT",
            text: "CD pops → wait for full bar if under ~45m → xan → dump " + focus + ".",
          },
        ],
      };
    }

    if (full) {
      return {
        kind: "go",
        move: "Train " + focus + " now. Don\u2019t sit on a full bar.",
        why: "Xan is on cooldown " + fmtCd(state.drugCd) + ". Overflowing energy is stats you never get back.",
        steps: [
          { t: "NOW", text: "Dump " + state.energy + "e into " + focus + " at " + gym + "." },
          { t: "WAIT", text: "Drug CD: " + fmtCd(state.drugCd) + ". Let the bar fill again while it ticks." },
          {
            t: "GOAL",
            text: "Be at a full bar when xan comes off CD, then xan and dump " + focus + " in one go.",
          },
        ],
      };
    }

    if (toFull > 0 && state.drugCd < toFull) {
      var extra = toFull - state.drugCd;
      return {
        kind: "wait",
        move: "Wait " + fmtCd(state.drugCd) + " for xan, then dump " + focus + ".",
        why:
          "Energy is " +
          state.energy +
          "/" +
          state.energyMax +
          " (full in " +
          fmtCd(toFull) +
          "). Drug CD pops first. Don\u2019t train this bar away unless you\u2019re about to overflow.",
        steps: [
          { t: "NOW", text: "Nothing. Bar isn\u2019t full. Xan isn\u2019t ready." },
          {
            t: "+" + fmtCd(state.drugCd),
            text:
              extra <= WAIT_FULL_MAX
                ? "Xan CD pops. Wait the extra " + fmtCd(extra) + " for a full bar, then take a xan."
                : "Xan CD pops. Take a xan now, then dump " + focus + ".",
          },
          { t: "THEN", text: "Dump into " + focus + " at " + gym + "." },
          { t: "LOOP", text: "Wait the next drug CD. Train whenever energy fills so you never overflow." },
        ],
      };
    }

    return {
      kind: "wait",
      move: "Wait " + fmtCd(toFull) + " for full energy, then train " + focus + ".",
      why:
        "Xan still has " +
        fmtCd(state.drugCd) +
        " on CD. Fill the bar, dump it, don\u2019t overflow. Next xan after that.",
      steps: [
        {
          t: "NOW",
          text: "Let energy fill. " + state.energy + "/" + state.energyMax + " · " + fmtCd(toFull) + " left.",
        },
        {
          t: "+" + fmtCd(toFull),
          text: "Bar full. Train " + focus + " at " + gym + ". Don\u2019t wait — overflow is wasted.",
        },
        {
          t: "+" + fmtCd(state.drugCd),
          text: "Xan ready. Prefer a full bar, then xan and dump " + focus + " again.",
        },
      ],
    };
  }

  function jumpCoach() {
    var tick = nextTickSec();
    var focus = focusLabel();
    var xtc = state.items.ecstasy || 0;
    var stacked = state.energy >= 750;
    var edvdHappy = state.adultNov ? 5000 : 2500;

    if (state.drugCd > 0 && state.energy < 1000 && !stacked) {
      return {
        kind: "wait",
        move: "Jump prep. Wait " + fmtCd(state.drugCd) + " then xan to stack energy.",
        why:
          "Happy jump wants a fat energy pool first. You\u2019re at " +
          state.energy +
          "e. Stack xans to ~750–1000e, CDs clear, then hit the :00 / :15 / :30 / :45 tick.",
        steps: [
          { t: "NOW", text: "Don\u2019t train this energy. You\u2019re banking for a jump." },
          { t: "+" + fmtCd(state.drugCd), text: "Take 1 xanax. Repeat until you\u2019re near 1,000e (usually 3–4 xans)." },
          { t: "THEN", text: "Let drug AND booster CDs hit zero." },
          { t: "TICK", text: "Wait for xx:00 / :15 / :30 / :45. Next tick in " + fmtCd(tick) + "." },
          {
            t: "JUMP",
            text:
              "Happy items (" +
              happyKitText() +
              "). E-dvds +" +
              edvdHappy +
              " each. Then dump ALL energy into " +
              focus +
              ", refill if you want a second dump before the next tick.",
          },
        ],
      };
    }

    if (!stacked && state.drugCd <= 0) {
      return {
        kind: "go",
        move: "Xan to stack. Don\u2019t train yet.",
        why: "Jump mode is on. Bank energy to ~1,000 before you touch happy items.",
        steps: [
          { t: "NOW", text: "Take 1 xanax. Energy " + state.energy + " → " + Math.min(1000, state.energy + 250) + "." },
          { t: "REPEAT", text: "Every drug CD, xan again until 750–1000e." },
          { t: "STOP", text: "Do not gym until the jump window." },
        ],
      };
    }

    if (state.drugCd > 0 || state.boosterCd > 30 * 60) {
      return {
        kind: "wait",
        move: "Energy is stacked. Wait CDs, then jump on the tick.",
        why: "Don\u2019t train. Overcap happy dies every 15 minutes. You need CDs clear so you can pop items + ecstasy.",
        steps: [
          { t: "NOW", text: state.energy + "e banked. Hold it." },
          { t: "CD", text: "Drug " + fmtCd(state.drugCd) + " · booster " + fmtCd(state.boosterCd) },
          { t: "TICK", text: "Next happy tick in " + fmtCd(tick) + "." },
          {
            t: "GO",
            text: happyKitText() + ". Dump " + focus + " immediately.",
          },
        ],
      };
    }

    if (tick > 90) {
      return {
        kind: "wait",
        move: "Jump window in " + fmtCd(tick) + ". Don\u2019t use items yet.",
        why:
          "Overcap happy wipes at the quarter hour. Use items right after the tick, ecstasy last, then dump " +
          focus +
          " before the next one.",
        steps: [
          { t: "NOW", text: "Hands off. " + state.energy + "e ready." },
          { t: "+" + fmtCd(tick), text: "Tick. " + happyKitText() + "." },
          { t: "THEN", text: "Ecstasy LAST — it doubles current happy. You have " + xtc + "." },
          {
            t: "DUMP",
            text: "All energy into " + focus + " as fast as you can. Optional points refill + second dump before the next tick.",
          },
        ],
      };
    }

    return {
      kind: "go",
      move: "TICK. Happy items, ecstasy last, dump " + focus + " now.",
      why: "This is the jump. Items → ecstasy → gym → refill if you can before the next wipe.",
      steps: [
        {
          t: "1",
          text: happyKitText() + ". E-dvds +" + edvdHappy + " each. Don\u2019t overcap the booster bar.",
        },
        { t: "2", text: "Ecstasy. Always last. " + xtc + " in inventory." },
        { t: "3", text: "Dump every point of energy into " + focus + "." },
        { t: "4", text: "Points refill if you\u2019ve got it, dump again before the next :15 wipe." },
      ],
    };
  }

  function leftoverNote() {
    if (!state.focus2 || state.focus2 === "none" || state.focus2 === state.focus) return "";
    var labels = { str: "Strength", def: "Defense", spe: "Speed", dex: "Dexterity" };
    return " Leftover energy can go to " + (labels[state.focus2] || "the second skill") + ".";
  }

  function focusLabel() {
    return { str: "Strength", def: "Defense", spe: "Speed", dex: "Dexterity" }[state.focus] || "Strength";
  }

  function applyUserPayload(data, withInv) {
    var e = data.energy || {};
    var h = data.happy || {};
    var cd = data.cooldowns || {};
    var prevE = state.energy;
    var prevStats = {
      str: state.stats.str,
      def: state.stats.def,
      spe: state.stats.spe,
      dex: state.stats.dex,
    };

    state.energy = Number(e.current) || 0;
    state.energyMax = Number(e.maximum) || 150;
    state.energyFulltime = Number(e.fulltime) || 0;
    // fulltime answers "how long from THIS energy", and nothing ticked it down,
    // so between polls it described an energy level that had moved on — and
    // after a xanax it was simply wrong. Convert it to a per-point rate, which
    // stays true as energy changes. Keep the last good rate if this payload
    // cannot supply one (it cannot when already full).
    var eGap = (Number(e.maximum) || 150) - (Number(e.current) || 0);
    if (eGap > 0 && state.energyFulltime > 0) state.energySecPerE = state.energyFulltime / eGap;
    state.happy = Number(h.current) || 0;
    state.happyMax = Number(h.maximum) || 0;
    state.drugCd = Number(cd.drug) || 0;
    state.boosterCd = Number(cd.booster) || 0;
    state.stats = {
      str: Number(data.strength) || 0,
      def: Number(data.defense) || 0,
      spe: Number(data.speed) || 0,
      dex: Number(data.dexterity) || 0,
    };
    if (data.active_gym) {
      var gym = GYMS[data.active_gym - 1] || GYMS[0];
      state.gymName = gym.Gym;
      state.gymEnergy = gym.Energy;
      state.dots = { str: Number(gym.Str) || 0, def: Number(gym.Def) || 0, spe: Number(gym.Spe) || 0, dex: Number(gym.Dex) || 0 };
    }
    var parsed = parsePerks(data);
    state.perks = parsed;
    state.perkFaction = parsed.faction || [];
    state.perkCompany = parsed.company || [];
    state.perkJob = parsed.job || [];
    if (withInv) {
      var invRaw = data.inventory;
      var invRows = !invRaw ? 0 : Array.isArray(invRaw) ? invRaw.length : Object.keys(invRaw).length;
      if (typeof invRaw === "string") {
        // Torn sent a STRING where the item list should be. Object.keys() on a
        // string yields character indices, so countItems was walking it letter
        // by letter — every "row" one char with no name and no quantity, which
        // is why 46 rows matched nothing. Keep the last good counts rather than
        // overwrite them with a fabricated zero.
        state.invUnavailable = invRaw;
        state.invDiag = { at: Date.now(), present: false, rows: 0, matched: 0 };
      } else if (invRaw) {
        state.invUnavailable = "";
        var counted = countItems(invRaw);
        applyCountedItems(counted);
        var matched = 0;
        for (var ck in counted.qty) if (counted.qty[ck]) matched++;
        // Every row came back ?name/?qty, so the field names are not what this
        // parser assumes. Dump the first row verbatim rather than guess which
        // renaming happened.
        var sample = [];
        try {
          var isArr = Array.isArray(invRaw);
          var keys0 = isArr ? null : Object.keys(invRaw).slice(0, 3);
          var rowsArr = isArr ? invRaw : Object.keys(invRaw).map(function (k) { return invRaw[k]; });
          var first = rowsArr[0];
          sample.push((isArr ? "array" : "object keyed " + JSON.stringify(keys0)) + ", row0 is " + typeof first);
          try {
            sample.push(String(JSON.stringify(first)).slice(0, 160));
          } catch (_) {
            sample.push("row0 not serialisable");
          }
        } catch (e) {
          sample.push("diag threw: " + (e && e.message));
        }
        state.invDiag = { at: Date.now(), present: true, rows: invRows, matched: matched, sample: sample };
      } else {
        // Payload came back without an inventory block at all — that is an API
        // or key-scope answer, not a counting bug, and the two look identical
        // from the Items tab.
        state.invDiag = { at: Date.now(), present: false, rows: 0, matched: 0 };
      }
    }
    state.lastFetch = Date.now();
    state.status = "live";
    state.statusText = "Live";
    recordHistory();

    var newTot = state.stats.str + state.stats.def + state.stats.spe + state.stats.dex;
    var prevTot = prevStats.str + prevStats.def + prevStats.spe + prevStats.dex;
    if (prevE && state.energy < prevE - 4) {
      var spent = prevE - state.energy;
      var gained = newTot > prevTot ? newTot - prevTot : 0;
      var skill = inferTrainSkillFromDelta(prevStats, state.stats);
      if (Date.now() - state.lastTrain > 2500) {
        pushLog(
          "Trained " +
            spent +
            "e" +
            (skill ? " " + skill : "") +
            (gained ? "  ·  +" + fmt(gained) : "") +
            "  ·  " +
            fmt(state.happy) +
            " happy @ " +
            (state.gymName || "gym")
        );
      }
      state.flash = "TRAINED";
      state.lastTrain = Date.now();
      setTimeout(function () {
        state.flash = "";
        renderPanel();
      }, 1800);
    }
  }

  function inferTrainSkillFromDelta(prev, next) {
    var keys = ["str", "def", "spe", "dex"];
    var labels = { str: "Strength", def: "Defense", spe: "Speed", dex: "Dexterity" };
    var best = "";
    var bestD = 0;
    keys.forEach(function (k) {
      var d = (next[k] || 0) - (prev[k] || 0);
      if (d > bestD) {
        bestD = d;
        best = labels[k];
      }
    });
    return best;
  }

  var DAY_MS = 86400000;
  var HIST_CAP = 400; // ~13 months; the chart's longest range is 365d

  function dayKey(ms) {
    return Math.floor(ms / DAY_MS);
  }

  // Upsert TODAY's stat snapshot. Last write of a day wins, so a day ends up
  // holding the stats as of its final refresh — which is what a daily
  // progression line wants. Cheap enough to call on every successful fetch.
  function recordHistory() {
    var st = state.stats;
    if (!st) return;
    var v = [st.str | 0, st.def | 0, st.spe | 0, st.dex | 0];
    if (!(v[0] || v[1] || v[2] || v[3])) return; // never record a failed read as a real zero
    var d = dayKey(Date.now());
    var last = state.hist.length ? state.hist[state.hist.length - 1] : null;
    if (last && last.d === d) {
      if (last.v[0] === v[0] && last.v[1] === v[1] && last.v[2] === v[2] && last.v[3] === v[3]) return;
      last.v = v;
    } else if (last && last.d > d) {
      return; // clock went backwards; leave the series alone rather than corrupt it
    } else {
      state.hist.push({ d: d, v: v });
      if (state.hist.length > HIST_CAP) state.hist = state.hist.slice(state.hist.length - HIST_CAP);
    }
    storeSet("hist", state.hist);
  }

  // ── Progression chart ──────────────────────────────────────────────────
  // Inline SVG on purpose: no library (Torn's CSP blocks external script) and
  // no canvas (retina scaling plus PDA's webview is more trouble than paths).
  var HIST_KEYS = ["str", "def", "spe", "dex"];
  var HIST_COLOURS = { str: "#e8a33d", def: "#3d9ae8", spe: "#e85f8a", dex: "#2ecc71" };

  function histWindow(days) {
    var cut = dayKey(Date.now()) - days;
    return state.hist.filter(function (e) {
      return e.d >= cut;
    });
  }

  // Forward projection reuses the script's own gain model, sampled rather than
  // stepped per-day: projectDays already loops every train internally, so a
  // per-day loop over a year would be tens of thousands of gainOne calls on a
  // phone. Eight samples is smooth enough at this size.
  var histProjCache = { key: "", val: null };

  function histProjection(days) {
    var e = dailyEnergy();
    // Measured: 381,176 gainOne calls for the 365d view, and renderPanel runs on
    // the poll timer — so without this the Prog tab recomputes a third of a
    // million gain steps every few seconds and stutters while you scroll it.
    // The curve only moves when the stats, the gym, the energy budget or the
    // range move, so key on exactly those.
    var st = state.stats || {};
    var key = [days, e.total, state.gymName, st.str, st.def, st.spe, st.dex].join("|");
    if (histProjCache.key === key && histProjCache.val) return histProjCache.val;
    var out = {};
    HIST_KEYS.forEach(function (k) {
      var pts = [];
      for (var i = 0; i <= 8; i++) {
        var d = Math.round((days * i) / 8);
        pts.push({ d: d, v: (state.stats[k] || 0) + (d ? projectDays(d, e.total, k) : 0) });
      }
      out[k] = pts;
    });
    histProjCache.key = key;
    histProjCache.val = out;
    return out;
  }

  // Compact axis label: 1.2b / 340m / 12.4k / 850. The gutter is ~34px wide in
  // a 360-unit viewBox, so full comma numbers do not fit on a phone — the delta
  // cards under the chart carry the exact figures.
  function fmtAxis(n) {
    if (!isFinite(n)) return "";
    var a = Math.abs(n);
    var s;
    if (a >= 1e9) s = (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "b";
    else if (a >= 1e6) s = (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "m";
    else if (a >= 1e3) s = (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
    else return String(Math.round(n));
    return s.replace(".0", "");
  }

  // "Aug 22" from an absolute day index (the dayKey integer). Past 90 days the
  // day of the month tells you nothing and two labels a season apart can share
  // it, so long ranges switch to month + year: "Aug '27".
  function fmtDay(d, byYear) {
    var dt = new Date(d * DAY_MS);
    // dayKey counts UTC days, so the label has to be read back in UTC. Reading
    // it with local getters puts everyone west of UTC a day behind their own
    // calendar — UTC midnight of Aug 22 is Aug 21, 8pm in New York.
    var mon = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    if (byYear) return mon + " '" + String(dt.getUTCFullYear()).slice(-2);
    return mon + " " + dt.getUTCDate();
  }

  // Round the axis step to something a person reads without decoding: 1, 2,
  // 2.5 or 5 times a power of ten. Dividing the raw max into four gives
  // gridlines like 433k and 865k, which are numbers nobody asked for.
  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }

  function histChart(days) {
    var win = histWindow(days);
    var proj = histProjection(days);
    var W = 360, H = 176, PADR = 8, PADT = 12, PADB = 30;
    var today = dayKey(Date.now());
    var firstRec = win.length ? win[0].d : today;
    var pastSpan = Math.max(1, today - firstRec); // days of history actually held

    // Every value that will be drawn, per stat, so the scale decision sees the
    // projection too — otherwise the dashed half runs off the top.
    var vals = {};
    HIST_KEYS.forEach(function (k, i) {
      vals[k] = win.map(function (e) { return e.v[i]; }).concat(proj[k].map(function (p) { return p.v; }));
    });

    // One shared axis, anchored at zero. Anchoring there is what makes it safe:
    // a stat that is a thousandth of the biggest draws as a flat line along the
    // floor, which is the truth about it, and its real numbers are in the legend
    // and the cards. Scaling each line to its own range instead would put four
    // unrelated y axes on one picture and there would be no number to print.
    var lo = 0, hi = -Infinity;
    HIST_KEYS.forEach(function (k) {
      vals[k].forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; });
    });
    if (!isFinite(hi)) return { svg: "", empty: true, legend: "" };

    var PADL = 36; // gutter for the value labels
    var SPLIT = PADL + (W - PADL - PADR) * 0.42; // "now" sits here, always
    var sx = function (d) {
      if (d <= today) {
        // Recorded side: map [firstRec .. today] across the left share.
        var t = pastSpan ? (d - firstRec) / pastSpan : 1;
        if (t < 0) t = 0;
        return PADL + t * (SPLIT - PADL);
      }
      // Projected side: map [today .. today+days] across the right share.
      return SPLIT + ((d - today) / days) * (W - PADR - SPLIT);
    };

    // Extend the top to a whole number of steps so every gridline is round.
    var axLo = lo, axHi = hi;
    if (axHi - axLo < 1) axHi = axLo + 1;
    // niceStep rounds up, so step lands between a quarter and a half of the
    // range, which pins the line count to 4 or 5 — no clamp needed, and the top
    // gridline never floats a whole empty step above the data.
    var step = niceStep((axHi - axLo) / 4);
    var GRID = Math.ceil((axHi - axLo) / step);
    axHi = axLo + step * GRID;
    var sy = function (k, v) {
      return PADT + (1 - (v - axLo) / (axHi - axLo)) * (H - PADT - PADB);
    };

    // --- x axis: dates the labels can actually be told apart at ---
    var cand = [];
    var byYear = days > 90;
    if (win.length > 1) cand.push({ x: PADL, t: fmtDay(firstRec, byYear), a: "start" });
    cand.push({ x: SPLIT, t: "now", a: "middle" });
    var steps = days <= 7 ? 1 : days <= 90 ? 2 : 3;
    for (var s = 1; s <= steps; s++) {
      var dd = Math.round((days * s) / steps);
      cand.push({ x: sx(today + dd), t: fmtDay(today + dd, byYear), a: s === steps ? "end" : "middle" });
    }
    // The step counts above are chosen so the labels never crowd: the recorded
    // side is a fixed 42% share and the projected side is cut into at most
    // three, which leaves >=60 units between labels at every range.
    var xl = cand;

    var parts = [];

    // --- grid ---
    for (var g = 0; g <= GRID; g++) {
      var gy = (PADT + (g / GRID) * (H - PADT - PADB)).toFixed(1);
      parts.push('<line x1="' + PADL + '" y1="' + gy + '" x2="' + (W - PADR) + '" y2="' + gy +
        '" stroke="#2a313a" stroke-width="1"/>');
      var gv = axHi - (g / GRID) * (axHi - axLo);
      parts.push('<text x="' + (PADL - 5) + '" y="' + (Number(gy) + 3).toFixed(1) +
        '" fill="#8a93a0" font-size="9" text-anchor="end">' + esc(fmtAxis(gv)) + "</text>");
    }
    xl.forEach(function (c) {
      parts.push('<line x1="' + c.x.toFixed(1) + '" y1="' + PADT + '" x2="' + c.x.toFixed(1) +
        '" y2="' + (H - PADB) + '" stroke="#2a313a" stroke-width="1"/>');
      parts.push('<text x="' + c.x.toFixed(1) + '" y="' + (H - PADB + 13) +
        '" fill="#8a93a0" font-size="9" text-anchor="' + c.a + '">' + esc(c.t) + "</text>");
    });

    // --- the "now" divider, drawn over the grid so it reads as the split ---
    var nowX = sx(today).toFixed(1);
    parts.push('<line x1="' + nowX + '" y1="' + (PADT - 4) + '" x2="' + nowX + '" y2="' + (H - PADB) +
      '" stroke="#9aa3b0" stroke-width="1" stroke-dasharray="3 3"/>');
    parts.push('<text x="' + nowX + '" y="' + (PADT - 6) +
      '" fill="#9aa3b0" font-size="9" text-anchor="middle">now</text>');

    HIST_KEYS.forEach(function (k, i) {
      var c = HIST_COLOURS[k];
      if (win.length > 1) {
        var solid = win.map(function (e, n) {
          return (n ? "L" : "M") + sx(e.d).toFixed(1) + " " + sy(k, e.v[i]).toFixed(1);
        }).join(" ");
        parts.push('<path d="' + solid + '" fill="none" stroke="' + c + '" stroke-width="1.6"/>');
      }
      var dash = proj[k].map(function (p, n) {
        return (n ? "L" : "M") + sx(today + p.d).toFixed(1) + " " + sy(k, p.v).toFixed(1);
      }).join(" ");
      parts.push('<path d="' + dash + '" fill="none" stroke="' + c + '" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.85"/>');
      // A dot on the last projected point so the end of each line is findable
      // even where two of them run together.
      var lastP = proj[k][proj[k].length - 1];
      parts.push('<circle cx="' + sx(today + lastP.d).toFixed(1) + '" cy="' + sy(k, lastP.v).toFixed(1) +
        '" r="2.4" fill="' + c + '"/>');
    });

    // A number per stat, at the end of the projection — the y axis can only be
    // read to the nearest gridline, and a stat sitting on the floor needs its
    // real figure somewhere.
    var legend =
      '<div class="gc-legend">' +
      HIST_KEYS.map(function (k) {
        var pts = proj[k];
        return '<span><i style="background:' + HIST_COLOURS[k] + '"></i>' + k.toUpperCase() +
          " <b>" + esc(fmtAxis(pts[pts.length - 1].v)) + "</b></span>";
      }).join("") +
      '<span class="gc-lkey">solid recorded · dashed projected</span></div>';

    return {
      svg: '<svg class="gc-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Stat progression, recorded and projected">' + parts.join("") + "</svg>",
      empty: win.length < 2,
      points: win.length,
      legend: legend,
    };
  }

  function histDeltaCards(days) {
    var win = histWindow(days);
    return HIST_KEYS.map(function (k, i) {
      var d = null;
      if (win.length > 1) d = win[win.length - 1].v[i] - win[0].v[i];
      return (
        '<div class="gc-dcard"><span style="color:' + HIST_COLOURS[k] + '">' + k.toUpperCase() + "</span>" +
        "<b>" + (d === null ? "—" : (d >= 0 ? "+" : "") + fmt(d)) + "</b>" +
        '<i class="muted">' + fmt(state.stats[k] || 0) + "</i></div>"
      );
    }).join("");
  }

  function pushLog(text) {
    var entry = {
      t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ts: Date.now(),
      text: text,
    };
    state.log.unshift(entry);
    state.log = state.log.slice(0, 80);
    storeSet("log", state.log);
  }

  function refresh(kind) {
    var key = resolveKey();
    if (!key) {
      state.status = "needkey";
      state.statusText = HAS_PDA_KEY ? "Waiting on Torn PDA key" : "Add a Limited API key in Set";
      renderPanel();
      return Promise.resolve();
    }
    if (state.fetchInFlight) return Promise.resolve();
    state.fetchInFlight = true;
    var INV_TTL = 90000; // 7 requests a go — at most one round every 90s
    var invAge = Date.now() - (state.invAt || 0);
    var invForce = kind === "boot" || kind === "manual" || !state.lastFetch;
    var wantInv = invForce || ((kind === "open" || kind === "items" || kind === "train" || state.tab === "items") && invAge > INV_TTL);
    var sel = "bars,cooldowns,battlestats,gym,perks,timestamp";
    return httpGet(apiUrl(sel))
      .then(function (data) {
        applyUserPayload(data, false);
        if (!wantInv) return null;
        return fetchInventoryV2().then(
          function (rows) {
            var tal0 = state.invTally || {};
            var failed = Object.keys(tal0).filter(function (c) { return tal0[c] === "err"; });
            if (failed.length) {
              // A partial round would publish a total that silently omits whole
              // categories — worse than showing the previous, complete numbers.
              state.invUnavailable = "partial (" + failed.join(", ") + ") — kept last good counts";
              state.invDiag = { at: Date.now(), present: false, rows: rows.length, matched: 0,
                sample: [Object.keys(tal0).map(function (c) { return c + ":" + tal0[c]; }).join(" ")] };
              state.invAt = Date.now();
              return null;
            }
            var counted = countItems(rows);
            applyCountedItems(counted);
            var matched = 0;
            for (var ck in counted.qty) if (counted.qty[ck]) matched++;
            state.invUnavailable = "";
            state.invAt = Date.now();
            var tal = state.invTally || {};
            var talStr = Object.keys(tal).map(function (c) { return c + ":" + tal[c]; }).join(" ");
            state.invDiag = { at: Date.now(), present: true, rows: rows.length, matched: matched, sample: talStr ? [talStr] : [] };
            return null;
          },
          function (err) {
            // Non-fatal by design: bars, cooldowns and stats already landed.
            state.invUnavailable = (err && err.message) || "inventory request failed";
            state.invDiag = { at: Date.now(), present: false, rows: 0, matched: 0 };
            // Back off rather than hammer: pretend we just fetched so the TTL
            // holds us off, and keep whatever counts we already had.
            state.invAt = Date.now();
            return null;
          }
        );
      })
      .then(function () {
        armNotifications();
        renderPanel();
      })
      .catch(function (err) {
        state.status = "error";
        state.statusText = err && err.message ? err.message : "API failed";
        renderPanel();
      })
      .then(function () {
        state.fetchInFlight = false;
      });
  }

  var PING_XAN = 2101;
  var PING_ENERGY = 2102;
  var PING_XAN_FULL = 2103;
  var PING_TICK = 2104;

  function flutterHandler() {
    try {
      if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === "function") {
        return window.flutter_inappwebview;
      }
    } catch (_) {}
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow.flutter_inappwebview) return unsafeWindow.flutter_inappwebview;
    } catch (_) {}
    return null;
  }

  function pdaCall(name, payload) {
    pdaReady()
      .then(function () {
        var fl = flutterHandler();
        if (!fl || typeof fl.callHandler !== "function") return;
        return fl.callHandler(name, payload);
      })
      .catch(function () {});
  }

  function cancelPing(id) {
    pdaCall("cancelNotification", { id: id });
  }

  function pingAt(id, subtitle, whenMs) {
    if (!whenMs || whenMs <= Date.now() + 4000) return;
    pdaCall("scheduleNotification", {
      title: "Gym Coach",
      subtitle: subtitle,
      id: id,
      timestamp: whenMs,
      overwriteID: true,
      launchNativeToast: false,
      urlCallback: "https://www.torn.com/gym.php",
    });
  }

  function armNotifications() {
    if (state.warStack) {
      cancelPing(PING_XAN);
      cancelPing(PING_ENERGY);
      cancelPing(PING_XAN_FULL);
      cancelPing(PING_TICK);
      return;
    }
    var now = Date.now();
    var toFull = timeToFull();
    var fullSoon = toFull > 5 && state.energy < (state.energyMax || 150) - 2;
    if (fullSoon) pingAt(PING_ENERGY, "Energy full — dump " + focusLabel(), now + toFull * 1000);
    else cancelPing(PING_ENERGY);

    if (state.mode === "jump") {
      pingAt(PING_TICK, "Happy tick — jump window", now + nextTickSec() * 1000);
    } else {
      cancelPing(PING_TICK);
    }

    if (state.drugCd > 5) {
      var xanAt = now + state.drugCd * 1000;
      if (toFull > state.drugCd && toFull - state.drugCd <= WAIT_FULL_MAX) {
        pingAt(PING_XAN, "Xan is up. Wait for a full bar, then take it.", xanAt);
        pingAt(PING_XAN_FULL, "Bar full. Take a xan, then dump " + focusLabel() + ".", now + toFull * 1000);
      } else {
        pingAt(PING_XAN, "Xan is up. Open gym.", xanAt);
        cancelPing(PING_XAN_FULL);
      }
    } else if (state.drugCd <= 0 && state.items.xanax > 0 && fullSoon && toFull <= WAIT_FULL_MAX) {
      cancelPing(PING_XAN);
      pingAt(PING_XAN_FULL, "Bar full. Take a xan, then dump " + focusLabel() + ".", now + toFull * 1000);
    } else {
      cancelPing(PING_XAN);
      cancelPing(PING_XAN_FULL);
    }
  }

  function css() {
    return (
      "#" + PILL_ID + "{position:fixed !important;z-index:2147483646 !important;right:16px !important;left:auto !important;top:auto !important;" +
      "bottom:calc(120px + env(safe-area-inset-bottom,0px)) !important;" +
      "display:flex !important;visibility:visible !important;opacity:1 !important;align-items:center;justify-content:center;width:52px !important;height:52px !important;padding:0;margin:0;" +
      "border:2px solid #2ecc71 !important;border-radius:14px !important;background:#121418 !important;color:#2ecc71 !important;" +
      "font:800 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:.08em;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.45);-webkit-appearance:none;appearance:none;cursor:pointer;" +
      "-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;pointer-events:auto}" +
      "#" + PILL_ID + " .k{display:none}" +
      "#gc-gym-dock{display:block !important;width:100%;box-sizing:border-box;margin:8px 0;min-height:48px;" +
      "border:2px solid #2ecc71;border-radius:10px;background:#121418;color:#2ecc71;" +
      "font:800 16px/1 -apple-system,sans-serif;letter-spacing:.08em;-webkit-appearance:none;appearance:none;" +
      "touch-action:manipulation}" +
      "#" + PANEL_ID + "{position:fixed;z-index:2147483647;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));top:auto;" +
      "width:auto;max-width:calc(100vw - 16px);height:80vh;height:min(80dvh,calc(100dvh - 64px));max-height:calc(100vh - 24px);min-height:0;background:#1a1d23;color:#f2f4f7;" +
      "display:none;flex-direction:column;font:15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "border:1px solid #2ecc71;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.55);overflow:hidden;-webkit-overflow-scrolling:touch}" +
      "#" + PANEL_ID + ".open{display:flex}" +
      "#" + PANEL_ID + " *{box-sizing:border-box}" +
      "#" + PANEL_ID + " .gc-owner{flex:0 0 auto;max-height:88px;overflow:hidden;padding:8px 12px 8px;background:#121418;border-bottom:1px solid #2e333c;min-width:0}" +
      "#" + PANEL_ID + " .gc-ascii{margin:0;max-width:100%;color:#2ecc71;font:800 11px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre;overflow:visible;text-align:center;letter-spacing:.04em}" +
      "#" + PANEL_ID + " .gc-tag{margin:6px 0 0;color:#2ecc71;font:800 13px/1.2 -apple-system,sans-serif;letter-spacing:.06em;text-align:center}" +
      "#" + PANEL_ID + " .gc-own{display:none}" +
      "#" + PANEL_ID + " .gc-head{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #2e333c;min-width:0;cursor:grab;touch-action:none;user-select:none}" +
      "#" + PANEL_ID + " .gc-owner{cursor:grab;touch-action:none;user-select:none}" +
      "#" + PANEL_ID + " .gc-head>div{min-width:0;flex:1}" +
      "#" + PANEL_ID + " h2{margin:0;font-size:16px;letter-spacing:.08em;font-weight:800}" +
      "#" + PANEL_ID + " .sub{margin:3px 0 0;font-size:11px;color:#94a3b8}" +
      "#" + PANEL_ID + " .live{display:inline-flex;align-items:center;gap:6px;color:#2ecc71;font-size:11px;font-weight:700}" +
      "#" + PANEL_ID + " .dot{width:8px;height:8px;border-radius:50%;background:#2ecc71;box-shadow:0 0 0 4px rgba(46,204,113,.18)}" +
      "#" + PANEL_ID + " .dot.off{background:#e74c3c;box-shadow:none}" +
      "#" + PANEL_ID + " .gc-tuck{border:0;background:#23272f;color:#f2f4f7;border-radius:10px;min-height:40px;padding:0 12px;flex:0 0 auto;font:800 12px -apple-system,sans-serif;letter-spacing:.06em;text-transform:uppercase;-webkit-tap-highlight-color:transparent;touch-action:manipulation;cursor:pointer}" +
      "#" + PANEL_ID + " .gc-body{flex:1 1 0%;height:0;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;padding:10px 12px;padding-bottom:16px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}" +
      "#" + PANEL_ID + " .gc-foot{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px));border-top:1px solid #2e333c;font-size:11px;color:#94a3b8;min-width:0}" +
      "#" + PANEL_ID + " .gc-foot b{color:#2ecc71;font-weight:600}" +
      "#" + PANEL_ID + " .gc-ago{font-weight:inherit;color:inherit}" +
      "#" + PANEL_ID + " .gc-card{margin:0 0 10px;padding:12px;border-radius:12px;background:#23272f;border:1px solid #2e333c;max-width:100%;min-width:0}" +
      "#" + PANEL_ID + " .gc-card h3{margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;font-weight:700}" +
      "#" + PANEL_ID + " .next{border:1px solid #2ecc71;background:#1a1d23;text-align:center}" +
      "#" + PANEL_ID + " .next .move{font-size:18px;line-height:1.25;color:#2ecc71;margin:0 0 8px;font-weight:800;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .next p{margin:0;color:#94a3b8;font-size:14px;text-align:center}" +
      "#" + PANEL_ID + " .steps{list-style:none;margin:12px 0 0;padding:0;text-align:left}" +
      "#" + PANEL_ID + " .steps li{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;padding:10px 0;border-top:1px solid #2e333c}" +
      "#" + PANEL_ID + " .steps .when{color:#2ecc71;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .waste{margin:10px 0 0;color:#e74c3c;font-size:13px;text-align:left;line-height:1.35}" +
      "#" + PANEL_ID + " .pick{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;max-width:100%}" +
      "#" + PANEL_ID + " .pick .gc-btn{flex:1 1 calc(50% - 8px);min-width:0;max-width:100%;padding:0 8px;font-size:13px}" +
      "#" + PANEL_ID + " .next.stack{border-color:#e74c3c}" +
      "#" + PANEL_ID + " .next.stack .move{color:#e74c3c}" +
      "#" + PANEL_ID + " .flash{margin:0 0 10px;padding:10px;border-radius:10px;background:#2ecc71;color:#fff;text-align:center;font-weight:800;letter-spacing:.12em}" +
      "#" + PANEL_ID + " .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;min-width:0}" +
      "#" + PANEL_ID + " .grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}" +
      "#" + PANEL_ID + " .stat{min-width:0}" +
      "#" + PANEL_ID + " .stat label{display:block;font-size:10px;color:#94a3b8;margin-bottom:2px;text-transform:uppercase;letter-spacing:.06em}" +
      "#" + PANEL_ID + " .stat b{font-size:15px;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .ok{color:#2ecc71}" +
      "#" + PANEL_ID + " .bad{color:#e74c3c}" +
      "#" + PANEL_ID + " .warn{color:#e67e22}" +
      "#" + PANEL_ID + " .muted{color:#94a3b8}" +
      "#" + PANEL_ID + " .row{display:flex;justify-content:space-between;gap:8px;align-items:baseline;padding:12px 0;border-bottom:1px solid #2e333c;min-width:0}" +
      "#" + PANEL_ID + " .row:last-child{border-bottom:0}" +
      "#" + PANEL_ID + " .row>div,#" + PANEL_ID + " .row>span:first-child{min-width:0;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .chip{flex:0 0 auto;max-width:46%;text-align:right;overflow-wrap:anywhere;font-size:12px;font-weight:800;color:#2ecc71;border:0;background:transparent;padding:0;font-family:inherit;-webkit-tap-highlight-color:transparent}" +
      "#" + PANEL_ID + " .chip.use,#" + PANEL_ID + " .chip[data-tip]{cursor:pointer}" +
      "#" + PANEL_ID + " .chip.use{background:#2ecc71;color:#fff;border-radius:8px;min-height:36px;padding:0 12px;max-width:100%}" +
      "#" + PANEL_ID + " .chip.bad{color:#e74c3c}" +
      "#" + PANEL_ID + " .chip.warn{color:#e67e22}" +
      "#" + PANEL_ID + " .chip.muted{color:#94a3b8}" +
      "#" + PANEL_ID + " .gc-toast{position:absolute;left:12px;right:12px;bottom:calc(56px + env(safe-area-inset-bottom,0px));z-index:8;background:#23272f;border:1px solid #2ecc71;border-radius:12px;padding:10px 12px;opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .2s,transform .2s}" +
      "#" + PANEL_ID + " .gc-toast.show{opacity:1;transform:translateY(0)}" +
      "#" + PANEL_ID + " .gc-toast b{display:block;color:#2ecc71;font-size:13px;margin-bottom:4px}" +
      "#" + PANEL_ID + " .gc-toast span{display:block;color:#f2f4f7;font-size:13px;line-height:1.35}" +
      "#" + PANEL_ID + " .gc-btn{border:0;border-radius:10px;min-height:44px;padding:0 16px;background:#2ecc71;color:#fff;font-weight:800;font-size:14px;font-family:inherit;max-width:100%;-webkit-tap-highlight-color:transparent}" +
      "#" + PANEL_ID + " .gc-btn.secondary{background:#23272f;color:#f2f4f7;border:1px solid #2e333c}" +
      "#" + PANEL_ID + " .gc-btn{transition:transform .08s ease,filter .08s ease}" +
      "#" + PANEL_ID + " .gc-btn:active{transform:scale(.96);filter:brightness(.88)}" +
      "#" + PANEL_ID + " .chip:active,#" + PANEL_ID + " .gc-tuck:active{transform:scale(.96);filter:brightness(.88)}" +
      "#" + PANEL_ID + " .chip,#" + PANEL_ID + " .gc-tuck{transition:transform .08s ease,filter .08s ease}" +
      "#" + PANEL_ID + " .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;justify-content:center;max-width:100%}" +
      "#" + PANEL_ID + " .actions .gc-btn{flex:1 1 120px;min-width:0}" +
      "#" + PANEL_ID + " .toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}" +
      "#" + PANEL_ID + " .toggle>div:first-child{min-width:0;flex:1}" +
      "#" + PANEL_ID + " .sw{flex:0 0 52px;width:52px;height:32px;border-radius:99px;background:#2a3038;position:relative;border:1px solid #2e333c;-webkit-tap-highlight-color:transparent}" +
      "#" + PANEL_ID + " .sw i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#94a3b8}" +
      "#" + PANEL_ID + " .sw.on{background:#2ecc71;border-color:transparent}" +
      "#" + PANEL_ID + " .sw.on i{left:25px;background:#fff}" +
      "#" + PANEL_ID + " .tabs{display:flex;flex:0 0 auto;width:auto;max-width:100%;min-width:0;gap:0;margin:8px 12px 0;background:#121418;border-radius:10px;overflow:hidden}" +
      "#" + PANEL_ID + " .tabs button{flex:1 1 0;min-width:0;min-height:44px;border:0;background:transparent;color:#94a3b8;padding:0 2px;font:800 10px -apple-system,sans-serif;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-tap-highlight-color:transparent}" +
      "#" + PANEL_ID + " .tabs button.on{background:#2ecc71;color:#fff}" +
      "#" + PANEL_ID + " input.gc-in{width:100%;min-height:44px;padding:10px 12px;border-radius:10px;border:1px solid #2e333c;background:#121418;color:#fff;font-size:16px}" +
      "#" + PANEL_ID + " .timeline{list-style:none;margin:0;padding:0}" +
      "#" + PANEL_ID + " .timeline li{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;margin:0 0 10px}" +
      "#" + PANEL_ID + " .timeline time{color:#2ecc71;font-size:12px;font-weight:800}" +
      "#" + PANEL_ID + " .proj{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:8px;align-items:center;margin:10px 0;min-width:0}" +
      "#" + PANEL_ID + " .proj b{color:#2ecc71;max-width:42vw;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .bar{height:6px;background:#2a3038;border-radius:99px;overflow:hidden}" +
      "#" + PANEL_ID + " .bar i{display:block;height:100%;background:#2ecc71}" +
      "#" + PANEL_ID + " .gc-chart{width:100%;height:auto;aspect-ratio:360/176;display:block;margin:10px 0 4px;background:#12161b;border-radius:8px}"+
      "#" + PANEL_ID + " .gc-legend{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin:2px 0 2px;font-size:10px;color:#8a93a0}"+
      "#" + PANEL_ID + " .gc-legend span{display:inline-flex;align-items:center;gap:4px}"+
      "#" + PANEL_ID + " .gc-legend i{width:9px;height:3px;border-radius:2px;display:inline-block}"+
      "#" + PANEL_ID + " .gc-legend b{color:#e6e9ee;font-size:10px}"+
      "#" + PANEL_ID + " .gc-lkey{opacity:.8}" +
      "#" + PANEL_ID + " .gc-ranges{display:flex;gap:6px;flex-wrap:wrap}" +
      "#" + PANEL_ID + " .gc-ranges button{flex:1 1 0;min-width:0;padding:6px 0;border-radius:8px;border:1px solid #2a3038;background:#1b2027;color:#c7cdd6;font-weight:700;font-size:12px}" +
      "#" + PANEL_ID + " .gc-ranges button.on{background:#2ecc71;border-color:#2ecc71;color:#0d1117}" +
      "#" + PANEL_ID + " .gc-dhead{font-size:10px;margin-top:6px}" +
      "#" + PANEL_ID + " .gc-dcards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:6px}" +
      "#" + PANEL_ID + " .gc-dcard{background:#1b2027;border-radius:8px;padding:6px 4px;text-align:center;min-width:0}" +
      "#" + PANEL_ID + " .gc-dcard span{display:block;font-size:10px;font-weight:800;letter-spacing:.04em}" +
      "#" + PANEL_ID + " .gc-dcard b{display:block;font-size:12px;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .gc-dcard i{display:block;font-size:9px;font-style:normal;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .gc-cap{margin-top:8px;line-height:1.45}"
    );
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = css();
    document.documentElement.appendChild(s);
  }

  function ago() {
    if (!state.lastFetch) return "not yet";
    var s = Math.round((Date.now() - state.lastFetch) / 1000);
    if (s < 5) return "just now";
    return s + "s ago";
  }

  function normalizeKey(raw) {
    return String(raw || "").replace(/[^a-zA-Z0-9]/g, "");
  }

  function trySaveKey(raw) {
    var k = normalizeKey(raw);
    if (k.length < 16) return false;
    k = k.slice(0, 16);
    storeSet("api_key", k);
    draftKey = "";
    keyBoxFocused = false;
    try {
      var el = document.getElementById("gcKey");
      if (el) el.blur();
    } catch (_) {}
    refresh("boot");
    return true;
  }

  function keyBoxBusy() {
    try {
      if (keyBoxFocused) return true;
      var ae = document.activeElement;
      if (ae && ae.id === "gcKey") return true;
    } catch (_) {}
    return false;
  }

  var lastRenderTab = null;
  function renderPanel() {
    syncEnergyFromDom();
    var panel = document.getElementById(PANEL_ID);
    var pill = document.getElementById(PILL_ID);
    if (pill) pinFab(pill);
    if (!panel || !state.open) return;
    if (keyBoxBusy()) return;

    var bodyEl = panel.querySelector(".gc-body");
    var keepScroll = lastRenderTab === state.tab;
    var bodyY = keepScroll && bodyEl ? bodyEl.scrollTop : 0;
    var keyInp = panel.querySelector("#gcKey");
    var keyVal = keyInp ? keyInp.value : "";
    var keyFocus = !!(keyInp && document.activeElement === keyInp);
    var keyStart = keyInp ? keyInp.selectionStart : 0;
    var keyEnd = keyInp ? keyInp.selectionEnd : 0;
    lastRenderTab = state.tab;

    var c = coach();
    var e = dailyEnergy();
    var g7 = projectDays(7, e.total, state.focus);
    var g30 = projectDays(30, e.total, state.focus);
    var g90 = projectDays(90, e.total, state.focus);
    var tot = state.stats.str + state.stats.def + state.stats.spe + state.stats.dex;
    var live = state.status === "live";
    var nextCls = c.kind === "stack" ? "next stack" : "next";
    var xanOk = state.drugCd <= 0 && !state.warStack && state.items.xanax > 0;
    var cans = state.items.munster + state.items.redcow + state.items.tourine + state.items.cans;

    var coachHtml =
      (state.flash ? '<div class="flash">' + state.flash + "</div>" : "") +
      '<div class="gc-card ' + nextCls + '"><div class="move">' + c.move + "</div><p>" + c.why + "</p>" +
      stepsHtml(c.steps) +
      (c.waste ? '<div class="waste">' + c.waste + "</div>" : "") +
      '<div class="actions"><button class="gc-btn" data-act="refresh">Refresh now</button></div></div>' +
      '<div class="gc-card"><h3>Live</h3><div class="grid three">' +
      '<div class="stat"><label>Energy' +
      (state.energyDom ? ' <span style="opacity:.6;font-weight:400">live</span>' : ' <span style="opacity:.6;font-weight:400">api</span>') +
      '</label><b class="' + (state.energy >= state.energyMax - 2 ? "bad" : "ok") + '">' + state.energy + " / " + state.energyMax + "</b></div>" +
      '<div class="stat"><label>Happy</label><b>' + fmt(state.happy) + "</b></div>" +
      '<div class="stat"><label>Drug CD</label><b class="' + (state.drugCd ? "muted" : "ok") + '">' + fmtCd(state.drugCd) + "</b></div>" +
      '<div class="stat"><label>Booster</label><b>' + fmtCd(state.boosterCd) + "</b></div>" +
      '<div class="stat"><label>Gym</label><b>' + (state.gymName || "—") + "</b></div>" +
      '<div class="stat"><label>Focus</label><b>' + focusLabel() + "</b></div></div></div>" +
      '<div class="gc-card"><h3>Gym perks</h3><div class="grid">' +
      '<div class="stat"><label>Str</label><b class="ok">' + perkPct(state.perks.str) + "</b></div>" +
      '<div class="stat"><label>Def</label><b class="ok">' + perkPct(state.perks.def) + "</b></div>" +
      '<div class="stat"><label>Spe</label><b class="ok">' + perkPct(state.perks.spe) + "</b></div>" +
      '<div class="stat"><label>Dex</label><b class="' + ((state.perks.dex || 1) < 1 ? "bad" : "ok") + '">' + perkPct(state.perks.dex) + "</b></div></div>" +
      '<p class="muted" style="margin:8px 0 0">' +
      ([
        state.perkFaction && state.perkFaction.length ? "Faction: " + state.perkFaction.join(" · ") : "",
        state.perkCompany && state.perkCompany.length ? "Company: " + state.perkCompany.join(" · ") : "",
        state.perkJob && state.perkJob.length ? "Job: " + state.perkJob.join(" · ") : "",
      ]
        .filter(Boolean)
        .join(" · ") || "Faction, company, and job gym gains are folded in when Torn sends them.") +
      "</p></div>" +
      '<div class="gc-card toggle"><div><h3 style="margin:0">War stack</h3><div class="muted">Hold energy. Mute dump / xan pings.</div></div>' +
      '<div class="sw' + (state.warStack ? " on" : "") + '" id="stackSw"><i></i></div></div>';

    var boostOk = boosterOpen(state.boosterCd);
    var jumpGo = state.mode === "jump" && nextTickSec() <= 90;
    var invD = state.invDiag;
    // Only speak up when the counts cannot be trusted; a healthy tab is silent.
    var invNote = invD && !invD.present && state.invUnavailable
      ? "Counts may be behind: " + String(state.invUnavailable).slice(0, 90)
      : "";
    var itemsHtml =
      '<div class="gc-card"><h3>Inventory · live</h3>' +
      (invNote ? '<div class="muted" style="margin:-4px 0 8px">' + invNote + "</div>" : "") +
      [
        { key: "xanax", n: "Xanax", v: state.items.xanax, rec: xanOk ? "USE" : state.drugCd ? "WAIT " + fmtCd(state.drugCd) : "BUY", cls: xanOk ? "ok" : "warn" },
        { key: "cans", n: "Energy drinks", v: cans, rec: cans && boostOk ? "USE" : cans ? "HOLD" : "HOLD", cls: cans && boostOk ? "ok" : "muted" },
        { key: "fhc", n: "FHC", v: state.items.fhc, rec: "DON\u2019T", cls: "bad" },
        { key: "nandrolone", n: "Nandrolone", v: state.items.nandrolone, rec: "OPTIONAL", cls: "warn" },
        state.mode !== "jump" ? null : { key: "edvd", n: "Erotic DVDs", v: state.items.edvd, rec: state.mode !== "jump" ? "OFF" : !state.items.edvd ? "NEED" : jumpGo && boostOk ? "USE" : "HOLD", cls: state.mode === "jump" ? "ok" : "muted" },
        state.mode !== "jump" ? null : { key: "candy", n: "Happy candy (all types)", v: state.items.candy, rec: state.mode !== "jump" ? "OFF" : !state.items.candy ? "NEED" : jumpGo && boostOk ? "USE" : "HOLD", cls: state.mode === "jump" ? "ok" : "muted" },
        state.mode !== "jump" ? null : { key: "ecstasy", n: "Ecstasy", v: state.items.ecstasy, rec: state.mode !== "jump" ? "OFF" : jumpGo && state.drugCd <= 0 ? "USE" : "LAST", cls: state.mode === "jump" ? "warn" : "muted" },
        { key: "lsd", n: "LSD", v: state.items.lsd, rec: "SKIP", cls: "muted" },
        { key: "vicodin", n: "Vicodin", v: state.items.vicodin, rec: "SKIP", cls: "muted" },
      ]
        .filter(Boolean)
        .map(function (r) {
          return '<div class="row"><div><b>' + r.n + " ×" + (r.v || 0) + '</b><div class="muted">' + itemFxShort(r.key) + "</div></div>" + itemChip(r) + "</div>";
        })
        .join("") +
      "</div>" +
      (state.mode === "jump" && (state.happyList || []).length
        ? '<div class="gc-card"><h3>Happy items on hand</h3>' +
          state.happyList
            .map(function (h) {
              return (
                '<div class="row"><div><b>' +
                esc(h.name) +
                " ×" +
                h.qty +
                '</b><div class="muted">' +
                happyFxText(h) +
                "</div></div>" +
                happyItemChip(h) +
                "</div>"
              );
            })
            .join("") +
          '<p class="muted" style="margin:8px 0 0">Jump uses every Candy-type item Torn lists, plus e-dvds. Ecstasy last. USE takes one.</p></div>'
        : "");

    var trackHtml =
      '<div class="gc-card"><h3>Battle stats · live</h3>' +
      '<div class="row"><span>Strength</span><b>' + fmt(state.stats.str) + "</b></div>" +
      '<div class="row"><span>Defense</span><b>' + fmt(state.stats.def) + "</b></div>" +
      '<div class="row"><span>Speed</span><b>' + fmt(state.stats.spe) + "</b></div>" +
      '<div class="row"><span>Dexterity</span><b>' + fmt(state.stats.dex) + "</b></div>" +
      '<div class="row"><span>Total</span><b class="ok">' + fmt(tot) + "</b></div></div>" +
      '<div class="gc-card"><h3>Train log</h3>' +
      (state.log.length
        ? state.log
            .slice(0, 24)
            .map(function (l) {
              return '<div class="row"><div><b>' + l.text + '</b><div class="muted">' + l.t + "</div></div></div>";
            })
            .join("")
        : '<div class="muted">Train in the gym. Every session is stored on this phone.</div>') +
      "</div>";

    var maxP = g90 || 1;
    var projHtml =
      '<div class="gc-card"><h3>Projected ' +
      focusLabel() +
      " · " +
      (state.mode === "jump" ? "jump" : "xan + gym") +
      "</h3>" +
      '<div class="muted" style="margin-bottom:8px">' +
      state.gymName +
      " · perks " +
      perkPct(state.perks[state.focus] || 1) +
      " on " +
      focusLabel() +
      (state.perkFaction && state.perkFaction.length ? " · faction applied" : "") +
      (state.perkCompany && state.perkCompany.length ? " · company applied" : "") +
      (state.perkJob && state.perkJob.length ? " · job applied" : "") +
      "</div>" +
      '<div class="proj"><span>7d</span><div class="bar"><i style="width:' + Math.min(100, (g7 / maxP) * 100) + '%"></i></div><b>+' + fmt(g7) + "</b></div>" +
      '<div class="proj"><span>30d</span><div class="bar"><i style="width:' + Math.min(100, (g30 / maxP) * 100) + '%"></i></div><b>+' + fmt(g30) + "</b></div>" +
      '<div class="proj"><span>90d</span><div class="bar"><i style="width:100%"></i></div><b>+' + fmt(g90) + "</b></div>" +
      '<div class="muted" style="margin-top:8px">Now ' + fmt(tot) + "</div></div>";

    var progRange = state.histRange || 30;
    // Only built for the visible tab. histChart -> histProjection runs the gain
    // model thousands of times, renderPanel fires on the poll timer, and paying
    // that on every tab is what made scrolling stutter.
    var chart = state.tab === "prog" ? histChart(progRange) : { svg: "", empty: true, legend: "" };
    var progHtml = state.tab !== "prog" ? "" :
      '<div class="gc-card"><h3>Progression</h3>' +
      '<div class="gc-ranges">' +
      [1, 7, 30, 90, 365].map(function (r) {
        return '<button data-hrange="' + r + '" class="' + (progRange === r ? "on" : "") + '">' + r + "d</button>";
      }).join("") +
      "</div>" +
      chart.svg +
      (chart.legend || "") +
      '<div class="muted gc-dhead">Recorded change over the last ' + progRange + 'd</div>' +
      '<div class="gc-dcards">' + histDeltaCards(progRange) + "</div>" +
      '<div class="muted gc-cap">' +
      (chart.empty
        ? "Solid lines start once there are two days of history. Training is recorded from now on \u2014 the dashed half already works."
        : "Solid = " + chart.points + " day" + (chart.points === 1 ? "" : "s") + " recorded. Dashed = projected at " + fmt(dailyEnergy().total) + "e/day if all of it went to that stat.") +
      " All four share one axis anchored at zero, so heights are comparable \u2014 a stat far below the others really is that small." +
      "</div></div>";

    var setHtml =
      '<div class="gc-card"><h3>API</h3>' +
      (HAS_PDA_KEY
        ? '<p class="ok">Torn PDA injected your Limited key. You don\u2019t need to paste one.</p>'
        : '<p class="muted">This copy is for Torn PDA. Leave the PDA API-key placeholder in the script so the app can inject your Limited key. If it didn\u2019t, paste one below. Needed: bars, cooldowns, battlestats, gym, inventory, perks, timestamp.</p>' +
          '<input class="gc-in" id="gcKey" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Limited API key" value="' +
          esc(draftKey) +
          '">' +
          '<div class="actions"><button class="gc-btn secondary" data-act="pastekey">Paste from clipboard</button><button class="gc-btn" data-act="savekey">Save key</button></div>') +
      '<div class="row"><span>Host</span><b>Torn PDA</b></div>' +
      '<div class="row"><span>Source</span><b>' + keySource() + "</b></div>" +
      '<div class="row"><span>Status</span><b class="' + (live ? "ok" : "bad") + '">' + state.statusText + "</b></div>" +
      '<p class="muted" style="margin:8px 0 0">Pings use Torn PDA notifications and open the gym when they fire.</p>' +
      "</div>" +
      '<div class="gc-card"><h3>Playstyle</h3><div class="pick">' +
      pickBtn("mode", "xan", "Xan + gym", state.mode !== "jump") +
      pickBtn("mode", "jump", "Happy jump", state.mode === "jump") +
      '</div><p class="muted" style="margin:8px 0 0">Xan + gym is your default. Happy jump uses every Candy-type item in inventory — chocolates, lollipops, bags of sweets, cupcakes, eggs, and the rest — plus e-dvds on the :00/:15/:30/:45 tick, ecstasy last.</p></div>' +
      '<div class="gc-card"><h3>Priority skill</h3><p class="muted">Everything the coach says — dump, jump, projections — goes here first.</p><div class="pick">' +
      [
        ["str", "Strength"],
        ["def", "Defense"],
        ["spe", "Speed"],
        ["dex", "Dexterity"],
      ]
        .map(function (p) {
          return pickBtn("focus", p[0], p[1], state.focus === p[0]);
        })
        .join("") +
      "</div></div>" +
      '<div class="gc-card"><h3>Second skill</h3><p class="muted">Optional. After the main dump, leftover energy can go here. Leave none if you only train one stat.</p><div class="pick">' +
      [["none", "None"]]
        .concat([
          ["str", "Strength"],
          ["def", "Defense"],
          ["spe", "Speed"],
          ["dex", "Dexterity"],
        ])
        .map(function (p) {
          return pickBtn("focus2", p[0], p[1], (state.focus2 || "none") === p[0]);
        })
        .join("") +
      "</div></div>" +
      '<div class="gc-card toggle"><div><h3 style="margin:0">10★ Adult Novelties</h3><div class="muted">Doubles e-dvd happy in jump math.</div></div>' +
      '<div class="sw' +
      (state.adultNov ? " on" : "") +
      '" id="novSw"><i></i></div></div>';

    var tab = state.tab;
    panel.innerHTML =
      ownerBannerHtml() +
      '<div class="gc-head"><div><h2>GYM COACH</h2><div class="sub">' +
      (live ? '<span class="live"><i class="dot"></i>LIVE · <b class="gc-ago">' + ago() + "</b></span>" : '<span class="live"><i class="dot off"></i>' + state.statusText + "</span>") +
      '</div></div><button class="gc-tuck" data-act="close">Tuck</button></div>' +
      '<div class="tabs">' +
      ["coach", "items", "track", "prog", "proj", "set"]
        .map(function (id) {
          var labels = { coach: "Coach", items: "Items", track: "Live", prog: "Prog", proj: "Proj", set: "Set" };
          return '<button data-tab="' + id + '" class="' + (tab === id ? "on" : "") + '">' + labels[id] + "</button>";
        })
        .join("") +
      "</div>" +
      '<div class="gc-body">' +
      (tab === "coach" ? coachHtml : tab === "items" ? itemsHtml : tab === "track" ? trackHtml : tab === "prog" ? progHtml : tab === "proj" ? projHtml : setHtml) +
      '</div><div class="gc-foot"><b>Last updated <span class="gc-ago">' + ago() + '</span></b><button class="gc-tuck" data-act="close">Tuck away</button></div>' +
      (state.toast && state.toast.until > Date.now()
        ? '<div class="gc-toast show"><b>' + state.toast.title + "</b><span>" + state.toast.body + "</span></div>"
        : '<div class="gc-toast"></div>');
    restorePanelView(panel, keepScroll, bodyY, keyVal, keyFocus, keyStart, keyEnd);
  }

  function restorePanelView(panel, keepScroll, bodyY, keyVal, keyFocus, keyStart, keyEnd) {
    if (!panel) return;
    if (keepScroll) {
      var body2 = panel.querySelector(".gc-body");
      if (body2) body2.scrollTop = bodyY;
    }
    var key2 = panel.querySelector("#gcKey");
    if (key2) {
      key2.value = keyVal || draftKey || "";
      if (keyFocus) {
        key2.focus();
        try {
          key2.setSelectionRange(keyStart, keyEnd);
        } catch (_) {}
      }
    }
  }

  function setOpen(v) {
    state.open = v;
    var panel = document.getElementById(PANEL_ID);
    var pill = document.getElementById(PILL_ID);
    if (panel) panel.classList.toggle("open", v);
    if (pill) pinFab(pill);
    if (v) {
      renderPanel();
      refresh("open");
    }
  }

  function pageHost() {
    return document.body || document.documentElement;
  }

  function paintPill(pill) {
    pinFab(pill);
  }

  function onGymPage() {
    return /gym\.php/i.test(location.href);
  }

  function ensureUi() {
    // The badge used to mount on every page: @match is torn.com/*, and
    // mountFabNow never looked at the URL. It is a gym coach, so it belongs on
    // the gym page only. The gate lives HERE rather than in mountFabNow
    // because a MutationObserver re-calls ensureUi on every DOM change while
    // the pill is absent — off-gym that is most of the time — so this path has
    // to be cheap, and it has to return true or the boot retry loop spins 80
    // times over.
    if (!onGymPage()) {
      var stray = document.getElementById(PILL_ID);
      if (stray && stray.parentNode) stray.parentNode.removeChild(stray);
      // A fixed-position panel left open would float over every other page for
      // the same reason, so close it too. state.open is cleared with it, so
      // returning to the gym starts tucked rather than half-open.
      var strayPanel = document.getElementById(PANEL_ID);
      if (strayPanel && strayPanel.classList.contains("open")) {
        state.open = false;
        strayPanel.classList.remove("open");
      }
      return true;
    }
    var host = pageHost();
    if (!host) return false;
    ensureStyles();
    mountFabNow();
    var pill = document.getElementById(PILL_ID);
    if (pill && !pill._gcBound) {
      pill._gcBound = true;
      var lastFabTouch = 0;
      function openFab(e) {
        var now = Date.now();
        if (e && e.type === "touchend") {
          lastFabTouch = now;
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
        } else if (now - lastFabTouch < 700) {
          return;
        }
        setOpen(!state.open);
      }
      pill.addEventListener("click", openFab);
      pill.addEventListener("touchend", openFab, { passive: false });
    }
    if (!document.getElementById(PANEL_ID)) {
      var panel = document.createElement("aside");
      panel.id = PANEL_ID;
      host.appendChild(panel);
      applySavedPos(panel, "panel_x", "panel_y");
      bindDrag(panel, {
        xKey: "panel_x",
        yKey: "panel_y",
        handle: function (t) {
          if (!t || !t.closest) return false;
          if (t.closest(".gc-tuck,button,input,.tabs,.gc-body,.gc-foot,.sw,.chip,.gc-btn")) return false;
          return !!t.closest(".gc-head,.gc-owner");
        },
      });
      panel.addEventListener("click", onPanelClick);
      bindKeyFieldGuards(panel);
      bindKeyInputPasteShield();
    }
    dockInGym();
    return true;
  }

  function dockInGym() {
    var root = document.getElementById("gymroot");
    if (!root) return;
    var b = document.getElementById("gc-gym-dock");
    if (b && b.parentNode === root) return;
    if (!b) {
      b = document.createElement("button");
      b.id = "gc-gym-dock";
      b.type = "button";
      b.textContent = "GYM COACH";
      b.setAttribute(
        "style",
        "display:block;width:100%;box-sizing:border-box;margin:8px 0;min-height:48px;border:2px solid #2ecc71;border-radius:10px;background:#121418;color:#2ecc71;font:800 16px/1 -apple-system,sans-serif;letter-spacing:.08em;-webkit-appearance:none;appearance:none;touch-action:manipulation;"
      );
      var lastDockTouch = 0;
      function openDock(e) {
        var now = Date.now();
        if (e && e.type === "touchend") {
          lastDockTouch = now;
          if (e.preventDefault) e.preventDefault();
        } else if (now - lastDockTouch < 700) {
          return;
        }
        setOpen(true);
      }
      b.addEventListener("click", openDock);
      b.addEventListener("touchend", openDock, { passive: false });
    }
    root.appendChild(b);
  }

  // The panel is sized in dvh, which SHRINKS when iOS opens the keyboard — so
  // typing a key collapsed the box to 80% of the sliver above it and cut the
  // text off. While the field is focused, take the whole available strip
  // instead of 80% of it, and keep the input in view.
  function fitPanelToKeyboard(on) {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    if (!on) {
      panel.style.height = "";
      panel.style.maxHeight = "";
      return;
    }
    var vv = window.visualViewport;
    var h = vv && vv.height ? vv.height : window.innerHeight;
    var target = Math.max(240, Math.round(h - 16));
    panel.style.height = target + "px";
    panel.style.maxHeight = target + "px";
    try {
      var inp = document.getElementById("gcKey");
      if (inp && inp.scrollIntoView) inp.scrollIntoView({ block: "center" });
    } catch (_) {}
  }

  function bindKeyFieldGuards(panel) {
    if (!panel || panel._gcKeyGuards) return;
    panel._gcKeyGuards = true;
    function isKey(el) {
      return el && el.id === "gcKey";
    }
    try {
      if (window.visualViewport && !window._gcVV) {
        window._gcVV = true;
        // The keyboard animates in, so the first measurement is wrong; react to
        // the viewport settling rather than guessing a delay.
        window.visualViewport.addEventListener("resize", function () {
          if (keyBoxFocused) fitPanelToKeyboard(true);
        });
      }
    } catch (_) {}
    panel.addEventListener(
      "focusin",
      function (e) {
        if (isKey(e.target)) {
          keyBoxFocused = true;
          fitPanelToKeyboard(true);
          setTimeout(function () {
            if (keyBoxFocused) fitPanelToKeyboard(true);
          }, 300);
        }
      },
      true
    );
    panel.addEventListener(
      "focusout",
      function (e) {
        if (!isKey(e.target)) return;
        draftKey = String(e.target.value || "");
        keyBoxFocused = false;
        fitPanelToKeyboard(false);
      },
      true
    );
    panel.addEventListener(
      "input",
      function (e) {
        if (!isKey(e.target)) return;
        draftKey = String(e.target.value || "");
        trySaveKey(draftKey);
      },
      true
    );
    panel.addEventListener(
      "paste",
      function (e) {
        if (!isKey(e.target)) return;
        setTimeout(function () {
          var el = document.getElementById("gcKey");
          if (!el) return;
          draftKey = String(el.value || "");
          trySaveKey(draftKey);
        }, 0);
      },
      true
    );
    panel.addEventListener(
      "keydown",
      function (e) {
        if (!isKey(e.target)) return;
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          trySaveKey(e.target.value);
        }
      },
      true
    );
    panel.addEventListener(
      "pointerdown",
      function (e) {
        if (isKey(e.target)) e.stopPropagation();
      },
      true
    );
  }

  function bindKeyInputPasteShield() {
    if (window.__GC_PASTE_SHIELD__) return;
    window.__GC_PASTE_SHIELD__ = true;
    function allowInsideCoachField(e) {
      var t = e.target;
      if (!t) return;
      var id = t.id || "";
      var inCoach =
        id === "gcKey" ||
        (t.classList && t.classList.contains("gc-in") && t.closest && t.closest("#" + PANEL_ID));
      if (!inCoach) return;
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }
    ["paste", "copy", "cut"].forEach(function (type) {
      document.addEventListener(type, allowInsideCoachField, true);
    });
  }

  function applyApiKeyText(text, opts) {
    opts = opts || {};
    var inp = document.getElementById("gcKey");
    var k = String(text || "")
      .replace(/^\s+|\s+$/g, "")
      .replace(/^["']|["']$/g, "");
    if (!k) {
      showToast("Clipboard empty", "Copy your Limited API key, then try again.");
      return false;
    }
    if (inp) inp.value = k;
    draftKey = k;
    if (trySaveKey(k)) {
      showToast(opts.savedTitle || "Key saved", opts.savedBody || "Refreshing…");
      return true;
    }
    showToast("Key too short", "Pasted text doesn\u2019t look like a full API key.");
    return false;
  }

  function pasteKeyFromClipboard() {
    function fail(msg) {
      showToast("Clipboard blocked", msg || "Allow clipboard access, or type the key.");
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
        navigator.clipboard
          .readText()
          .then(function (text) {
            applyApiKeyText(text);
          })
          .catch(function () {
            fail("Browser denied clipboard read. Allow it for torn.com.");
          });
        return;
      }
    } catch (_) {}
    try {
      var ta = document.createElement("textarea");
      ta.setAttribute("readonly", "readonly");
      ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
      document.body.appendChild(ta);
      ta.focus();
      var ok = false;
      try {
        ok = document.execCommand("paste");
      } catch (_) {}
      var text = ta.value;
      document.body.removeChild(ta);
      if (ok && text) {
        applyApiKeyText(text);
        return;
      }
    } catch (_) {}
    fail("This browser has no clipboard API.");
  }

  function startUi() {
    if (ensureUi()) return;
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      if (ensureUi() || n > 80) clearInterval(t);
    }, 100);
  }

  function onPanelClick(e) {
    var t = e.target;
    if (!t) return;
    if (t.nodeType !== 1) t = t.parentElement;
    if (!t || typeof t.closest !== "function") return;
    t = t.closest("[data-tab],[data-act],[data-focus],[data-focus2],[data-mode],[data-use],[data-use-id],[data-tip],[data-hrange],#stackSw,#novSw");
    if (!t) return;
    if (t.dataset.hrange) {
      state.histRange = Number(t.dataset.hrange) || 30;
      storeSet("histRange", state.histRange);
      renderPanel();
      return;
    }
    if (t.dataset.useId) {
      useItemId(t.dataset.useId);
      return;
    }
    if (t.dataset.use) {
      useItemKey(t.dataset.use);
      return;
    }
    if (t.dataset.tip) {
      var tip = itemTip(t.dataset.tip);
      showToast(tip[0], tip[1]);
      return;
    }
    if (t.id === "stackSw") {
      state.warStack = !state.warStack;
      storeSet("warStack", state.warStack);
      renderPanel();
      armNotifications();
      return;
    }
    if (t.dataset.tab) {
      state.tab = t.dataset.tab;
      renderPanel();
      return;
    }
    if (t.id === "novSw") {
      state.adultNov = !state.adultNov;
      storeSet("adultNov", state.adultNov);
      renderPanel();
      return;
    }
    if (t.dataset.mode) {
      state.mode = t.dataset.mode;
      storeSet("mode", state.mode);
      renderPanel();
      return;
    }
    if (t.dataset.focus2) {
      state.focus2 = t.dataset.focus2;
      storeSet("focus2", state.focus2);
      renderPanel();
      return;
    }
    if (t.dataset.focus) {
      state.focus = t.dataset.focus;
      storeSet("focus", state.focus);
      renderPanel();
      return;
    }
    if (t.dataset.act === "close") {
      storeSet("user_tucked", true);
      setOpen(false);
    }
    if (t.dataset.act === "refresh") {
      showToast("Refreshing", "Pulling fresh numbers from Torn.", 1600);
      refresh("manual");
    }
    if (t.dataset.act === "savekey") {
      var inp = document.getElementById("gcKey");
      var raw = (inp && inp.value) || draftKey;
      var n = normalizeKey(raw).length;
      if (trySaveKey(raw)) showToast("Key saved", "Loading your data now.", 2600);
      else showToast("Not saved", n ? "That key is " + n + " characters; Torn keys are 16." : "Paste your 16-character Torn API key first.", 3200);
    }
    if (t.dataset.act === "pastekey") {
      pasteKeyFromClipboard();
      return;
    }
  }

  function clampPos(el, x, y) {
    var w = el.offsetWidth || 42;
    var h = el.offsetHeight || 42;
    var maxX = Math.max(8, window.innerWidth - w - 8);
    var maxY = Math.max(8, window.innerHeight - h - 8);
    return {
      x: Math.max(8, Math.min(maxX, x)),
      y: Math.max(8, Math.min(maxY, y)),
    };
  }

  function placeEl(el, x, y) {
    var p = clampPos(el, x, y);
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    return p;
  }

  function applySavedPos(el, xKey, yKey) {
    if (el && el.id === PILL_ID) return;
    var savedX = Number(storeGet(xKey, NaN));
    var savedY = Number(storeGet(yKey, NaN));
    if (isNaN(savedX) || isNaN(savedY)) return;
    var w = el.offsetWidth || 42;
    var h = el.offsetHeight || 42;
    if (savedX > window.innerWidth - 16 || savedY > window.innerHeight - 100 || savedX < -w + 24 || savedY < -h + 24) return;
    placeEl(el, savedX, savedY);
  }

  function bindDrag(el, opts) {
    opts = opts || {};
    var xKey = opts.xKey || "pill_x";
    var yKey = opts.yKey || "pill_y";
    var sx, sy, ox, oy, moving = false, pid = null, lastTap = 0;

    function handleFromEvent(e) {
      var t = e.target;
      if (t && t.nodeType !== 1) t = t.parentElement;
      return t;
    }

    function tap() {
      if (!opts.onTap) return;
      var now = Date.now();
      if (now - lastTap < 400) return;
      lastTap = now;
      opts.onTap();
    }

    el.addEventListener("pointerdown", function (e) {
      if (opts.handle && !opts.handle(handleFromEvent(e))) return;
      if (e.button) return;
      moving = true;
      pid = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
      var r = el.getBoundingClientRect();
      sx = e.clientX;
      sy = e.clientY;
      ox = r.left;
      oy = r.top;
      el.style.width = r.width + "px";
      el.style.height = r.height + "px";
      placeEl(el, r.left, r.top);
      el._dragged = false;
    });
    el.addEventListener("pointermove", function (e) {
      if (!moving) return;
      var dx = e.clientX - sx;
      var dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 12) el._dragged = true;
      var p = placeEl(el, ox + dx, oy + dy);
      if (el._dragged) {
        storeSet(xKey, p.x);
        storeSet(yKey, p.y);
      }
    });
    function endPointer(e) {
      if (!moving) return;
      moving = false;
      try {
        if (pid != null) el.releasePointerCapture(pid);
      } catch (_) {}
      pid = null;
      if (el._dragged) return;
      if (e && e.preventDefault) e.preventDefault();
      tap();
    }
    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointercancel", function () {
      moving = false;
      pid = null;
    });
    el.addEventListener("click", function (e) {
      if (el._dragged) {
        el._dragged = false;
        return;
      }
      if (opts.onTap) {
        e.preventDefault();
        tap();
      }
    });
    el.addEventListener(
      "touchend",
      function (e) {
        if (el._dragged) return;
        if (!opts.onTap) return;
        e.preventDefault();
        tap();
      },
      false
    );
  }

  function trainStatFromEl(el) {
    if (!el || el.nodeType !== 1) return "";
    var n = el.closest ? el.closest("button,[role='button'],input") || el : el;
    var blob = (
      (n.getAttribute && (n.getAttribute("aria-label") || n.getAttribute("data-stat") || n.getAttribute("title") || "")) +
      " " +
      String(n.textContent || "").slice(0, 80) +
      " " +
      (n.className || "")
    ).toLowerCase();
    var hits = [];
    if (blob.indexOf("strength") !== -1) hits.push("Strength");
    if (blob.indexOf("defense") !== -1 || blob.indexOf("defence") !== -1) hits.push("Defense");
    if (blob.indexOf("speed") !== -1) hits.push("Speed");
    if (blob.indexOf("dexterity") !== -1) hits.push("Dexterity");
    return hits.length === 1 ? hits[0] : "";
  }

  function looksLikeTrain(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && el.closest("#" + PANEL_ID + ",#" + PILL_ID)) return false;
    if (trainStatFromEl(el)) return true;
    var btn = el.closest ? el.closest("button,[role='button'],input[type='button'],input[type='submit']") : null;
    if (!btn) return false;
    var t = ((btn.textContent || "") + " " + (btn.className || "") + " " + (btn.getAttribute("aria-label") || "")).toLowerCase();
    return /train|strength|defense|defence|speed|dexterity/.test(t);
  }

  function startWatch() {
    stopWatch();
    clickHandler = function (e) {
      if (!/gym\.php/i.test(location.href)) return;
      var el = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
      if (!el) return;
      if (el.closest && el.closest("#" + PANEL_ID + ",#" + PILL_ID)) return;
      if (!looksLikeTrain(el)) return;
      var skill = trainStatFromEl(el);
      if (Date.now() - state.lastTrain > 1200) {
        pushLog(
          "Trained" +
            (skill ? " " + skill : "") +
            " · " +
            state.energy +
            "e · " +
            fmt(state.happy) +
            " happy @ " +
            (state.gymName || "gym")
        );
        state.lastTrain = Date.now();
        state.flash = "TRAINED";
        if (state.open) renderPanel();
      }
      setTimeout(function () {
        refresh("train");
      }, 600);
      setTimeout(function () {
        refresh("train");
      }, 2200);
    };
    document.addEventListener("click", clickHandler, true);

    var roots = [];
    var gymRoot = document.getElementById("gymroot");
    if (gymRoot) roots.push(gymRoot);
    var energy = document.querySelector('[class*="energy"], #barEnergy, [class*="bar-energy"]');
    if (energy) roots.push(energy);
    roots.forEach(function (root) {
      var obs = new MutationObserver(function () {
        if (!/gym\.php/i.test(location.href)) return;
        clearTimeout(obs._t);
        obs._t = setTimeout(function () {
          refresh("energy");
        }, 500);
      });
      obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
      observers.push(obs);
    });
  }

  function stopWatch() {
    observers.forEach(function (o) {
      try {
        o.disconnect();
      } catch (_) {}
    });
    observers = [];
    if (clickHandler) {
      document.removeEventListener("click", clickHandler, true);
      clickHandler = null;
    }
  }

  function boot() {
    try {
      state.warStack = !!storeGet("warStack", false);
      state.focus = storeGet("focus", "str") || "str";
      state.focus2 = storeGet("focus2", "none") || "none";
      state.mode = storeGet("mode", "xan") || "xan";
      state.adultNov = !!storeGet("adultNov", false);
      state.log = storeGet("log", []) || [];
      if (!Array.isArray(state.log)) state.log = [];
      state.hist = storeGet("hist", []) || [];
      // PDA's storage hands back strings, so a bad read must not take the
      // panel down with it.
      if (typeof state.hist === "string") { try { state.hist = JSON.parse(state.hist); } catch (_) { state.hist = []; } }
      if (!Array.isArray(state.hist)) state.hist = [];
      state.hist = state.hist.filter(function (e) { return e && typeof e.d === "number" && Array.isArray(e.v) && e.v.length === 4; });
      state.histRange = Number(storeGet("histRange", 30)) || 30;
      startUi();
      if (/gym\.php/i.test(location.href) && !storeGet("user_tucked", false)) {
        setOpen(true);
      }
      var gymTries = 0;
      var gymWait = setInterval(function () {
        gymTries += 1;
        dockInGym();
        if (document.getElementById("gc-gym-dock") || gymTries > 80) clearInterval(gymWait);
      }, 300);
      try {
        if (!window._gcDomWatch) {
          window._gcDomWatch = new MutationObserver(function () {
            if (!document.getElementById(PILL_ID)) ensureUi();
          });
          window._gcDomWatch.observe(document.documentElement, { childList: true });
          if (document.body) window._gcDomWatch.observe(document.body, { childList: true });
        }
      } catch (_) {}
      setInterval(function () {
        if (!document.body) return;
        if (!document.getElementById(PILL_ID) || !document.getElementById(PANEL_ID) || !document.getElementById(STYLE_ID)) {
          ensureUi();
          if (state.open) renderPanel();
        }
        dockInGym();
      }, 1500);
      renderPanel();
      refresh("boot");
      startWatch();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(function () {
        if (document.visibilityState !== "visible") return;
        refresh(/gym\.php/i.test(location.href) ? "gym" : "idle");
      }, /gym\.php/i.test(location.href) ? 8000 : 20000);
      if (cdTimer) clearInterval(cdTimer);
      cdTimer = setInterval(function () {
        if (state.drugCd > 0) state.drugCd -= 1;
        if (state.boosterCd > 0) state.boosterCd -= 1;
        if (!state.open) return;
        if (syncEnergyFromDom()) lastTickSig = "";
        var sig = fmtCd(state.drugCd) + "|" + fmtCd(state.boosterCd) + "|" + state.tab + "|" + state.energy;
        if (sig !== lastTickSig) {
          lastTickSig = sig;
          renderPanel();
          return;
        }
        var panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        var txt = ago();
        var labels = panel.querySelectorAll(".gc-ago");
        for (var i = 0; i < labels.length; i++) {
          if (labels[i].textContent !== txt) labels[i].textContent = txt;
        }
      }, 1000);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
          ensureUi();
          refresh("visible");
        }
      });
    } catch (err) {
      try {
        console.log("[Gym Coach] boot failed", err);
      } catch (_) {}
      startUi();
    }
  }

  startUi();
  bindKeyInputPasteShield();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
