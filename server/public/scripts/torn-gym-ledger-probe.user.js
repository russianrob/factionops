// ==UserScript==
// @name         Gym Ledger Probe
// @namespace    RussianRob
// @version      1.2.0
// @description  One-shot diagnostic: dumps Gym Coach's own energy ledger so an impossible "Missed today" or a "Spent attacking" figure can be traced to the entry that produced it, and reports which API endpoints your key can actually reach.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/gym.php*
// @match        https://www.torn.com/page.php?sid=gym*
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/torn-gym-ledger-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-gym-ledger-probe.user.js
// ==/UserScript==

/*
 * CHANGELOG
 * 1.2.0 — Asks /key/info once instead of poking five endpoints.
 *
 *         1.1.0 fired five requests back to back and every one came back
 *         "code 5: Too many requests" -- which it printed as DENIED. That is
 *         a rate limit, not an access decision, and reading it as one would
 *         have concluded a Limited key could not reach anything at all. Gym
 *         Coach itself polls hard on gym.php (bars every 8s, seven inventory
 *         calls, the train log), so five more requests tipped the key's
 *         100-a-minute budget over and the probe measured its own noise.
 *
 *         /key/info is available to ANY key and answers the whole question in
 *         one request: the access level, every selection the key may use, and
 *         the exact log ids it may read -- so whether log 5300 (gym training)
 *         is reachable is a fact rather than an inference from a failed call.
 *         Rate limits are now named as rate limits and retried.
 *
 * 1.1.0 — Also reports what the saved key can REACH.
 *
 *         Rebuilding these figures from the API only works if the API answers.
 *         /user/log is documented as needing FULL access while attacks needs
 *         LIMITED and bars needs MINIMAL -- but the script asks v1 for the gym
 *         log, and v1 and v2 do not always agree on access level. Guessing
 *         either way designs the wrong thing, so this asks each endpoint and
 *         reports what came back.
 *
 *         This makes the probe talk to the API, which 1.0.0 deliberately did
 *         not. The key is read from Gym Coach's own storage, never printed
 *         (last four characters and length only), and nothing is sent anywhere
 *         except api.torn.com.
 *
 * 1.0.0 — First cut. Two figures on the Now tab cannot be what they say.
 *
 *         "Missed today 3,462e": missed regen is bounded by how much energy a
 *         day can produce. At 120s a point that is 720e in 24 hours, and a
 *         single catch-up observation is capped at 48 hours, so 1,440e is the
 *         most one reading can add. 3,462 is neither.
 *
 *         "Spent attacking 449e": off-gym spend is booked in WHOLE attacks at
 *         25e each, so every value must divide by 25. 449 does not, which
 *         means it was not written by the code that is running now.
 *
 *         The ledger is device-only and always has been -- it is never sent
 *         anywhere -- so the entries behind those numbers cannot be read from
 *         the server. This prints them: every day bucket, which ones break the
 *         multiple-of-25 rule, which exceed a day's possible regen, and the
 *         last-seen reading the deltas are measured from.
 *
 *         Reads storage only. No API key is touched and no request is made;
 *         the dump leaves the page only when you press Copy.
 */

(function () {
  "use strict";

  var SCRIPT_VERSION = "1.2.0";
  var NS = "gcb_v1";          // the beta's namespace
  var STABLE_NS = "gc_v1";    // the stable script, for comparison
  var ATTACK_ENERGY = 25;
  var out = [];
  function add(label, value) { out.push(label + " :: " + value); }

  // Torn PDA hands stored values back as strings, so everything is parsed
  // rather than trusted to arrive as the type it was written as.
  function read(ns, key) {
    var k = ns + "_" + key, v;
    try { if (typeof GM_getValue === "function") v = GM_getValue(k, undefined); } catch (e) {}
    if (v === undefined || v === null) {
      try { v = localStorage.getItem(k); } catch (e) {}
    }
    if (v === undefined || v === null) return null;
    if (typeof v === "string") { try { return JSON.parse(v); } catch (e) { return v; } }
    return v;
  }

  var DAY = 86400000;
  function dayKey(ms) { return Math.floor(ms / DAY); }
  function iso(d) { return new Date(d * DAY).toISOString().slice(0, 10); }

  // Reuses whatever Gym Coach already stored. Never printed: the report shows
  // the last four characters and the length, enough to tell WHICH key answered
  // without the report carrying the key itself.
  function savedKey() {
    var names = ["gcb_v1_api_key", "gc_v1_api_key"];
    for (var i = 0; i < names.length; i++) {
      var v = read2(names[i]);
      if (v && typeof v === "string" && v.indexOf("###") === -1 && v.trim().length > 8) return v.trim();
    }
    return "";
  }
  function read2(k) {
    var v;
    try { if (typeof GM_getValue === "function") v = GM_getValue(k, undefined); } catch (e) {}
    if (v === undefined || v === null) { try { v = localStorage.getItem(k); } catch (e) {} }
    return v == null ? null : v;
  }

  // One request, and it is available to ANY key: /key/info reports the access
  // level, every selection the key may use, and the exact log ids it may read.
  // 1.1.0 inferred all this from five failing calls and got it wrong, because
  // the failures were rate limits rather than refusals.
  var NEEDED = [
    ["log", "gym training log -- energy trained, and the spend timeline the waste rebuild needs"],
    ["attacks", "attacks made -- energy spent attacking"],
    ["bars", "current energy"],
    ["refills", "whether today's point refill is spent"],
    ["personalstats", "fallback counters"]
  ];
  var GYM_LOG_IDS = [5300, 5301, 5302, 5303]; // strength, defense, speed, dexterity

  function probeAccess(key, done) {
    var url = "https://api.torn.com/v2/key/info?key=" + encodeURIComponent(key) +
              "&comment=gym-ledger-probe";
    var tries = 0;
    function attempt() {
      tries++;
      function handle(text) {
        var d = null;
        try { d = JSON.parse(text); } catch (e) {}
        if (d && d.error && d.error.code === 5 && tries < 3) {
          // Gym Coach is polling the same key. Wait and ask again rather than
          // reporting its own noise as an access decision.
          add("  (rate limited, retrying in 5s)", "attempt " + tries);
          return setTimeout(attempt, 5000);
        }
        if (!d) { add("  key/info", "UNREADABLE answer"); return done(); }
        if (d.error) {
          add("  key/info", (d.error.code === 5 ? "RATE LIMITED" : "FAILED") +
            " -- code " + d.error.code + ": " + d.error.error +
            (d.error.code === 5 ? "  (this says nothing about access; close the Gym Coach panel and retry)" : ""));
          return done();
        }
        var info = d.info || {};
        var acc = info.access || {};
        add("  access", "level " + acc.level + " / " + acc.type +
          " | faction=" + acc.faction + " company=" + acc.company);
        var us = (info.selections && info.selections.user) || [];
        NEEDED.forEach(function (row) {
          add("  selection " + row[0], (us.indexOf(row[0]) !== -1 ? "ALLOWED" : "NOT ALLOWED") + " -- " + row[1]);
        });
        // The selection being allowed is not the same as the individual log
        // being readable: log access is enumerated id by id.
        var avail = (acc.log && acc.log.available) || [];
        var ids = {};
        avail.forEach(function (c) { (c.log_ids || []).forEach(function (n) { ids[n] = 1; }); });
        var have = GYM_LOG_IDS.filter(function (n) { return ids[n]; });
        add("  gym log ids", have.length === GYM_LOG_IDS.length
          ? "ALL FOUR readable (" + GYM_LOG_IDS.join(",") + ") -- trained energy and the spend timeline are available"
          : have.length
            ? "PARTIAL: " + have.join(",") + " of " + GYM_LOG_IDS.join(",") + " -- some stats would be invisible"
            : "NONE of " + GYM_LOG_IDS.join(",") + " readable -- the waste rebuild would have to run attacks-only");
        add("  log permissions", "custom=" + (acc.log && acc.log.custom_permissions) +
          " | " + Object.keys(ids).length + " log ids readable in total");
        done();
      }
      try {
        if (typeof GM_xmlhttpRequest === "function") {
          GM_xmlhttpRequest({ method: "GET", url: url,
            onload: function (r) { handle(r.responseText || r.response || ""); },
            onerror: function () { add("  key/info", "NETWORK ERROR"); done(); } });
          return;
        }
      } catch (e) {}
      fetch(url).then(function (r) { return r.text(); }).then(handle)
        .catch(function () { add("  key/info", "NETWORK ERROR"); done(); });
    }
    attempt();
  }

  function run() {
    var today = dayKey(Date.now());
    add("TODAY", "dayKey " + today + " = " + iso(today) + " (UTC)  |  local now " + new Date().toString().slice(0, 33));

    var ledger = read(NS, "ledger");
    if (!Array.isArray(ledger)) {
      add("LEDGER", "not an array: " + JSON.stringify(ledger) + " -- nothing further can be read");
      return show();
    }
    add("LEDGER", ledger.length + " entries");

    // Duplicate day buckets would be summed twice by the Now tab, which only
    // ever looks at the LAST entry when deciding whether today already exists.
    var seen = {}, dupes = [];
    ledger.forEach(function (e) {
      if (seen[e.d]) dupes.push(e.d); else seen[e.d] = 1;
    });
    add("DUPLICATE DAYS", dupes.length ? dupes.join(", ") + "  <-- these are counted twice" : "none");

    var order = ledger.map(function (e) { return e.d; });
    var sorted = order.slice().sort(function (a, b) { return a - b; });
    add("ORDER", String(order) === String(sorted) ? "ascending" : "OUT OF ORDER  <-- ledgerBucket only checks the LAST entry");

    // The two rules the numbers on screen have to obey.
    var RATE_HINT = 120; // donator seconds-per-energy; 180 if not
    var maxDay = Math.round(DAY / 1000 / RATE_HINT);
    add("RULES", "off must divide by " + ATTACK_ENERGY + "  |  wasted in ONE day cannot exceed ~" +
      maxDay + "e at " + RATE_HINT + "s/e (~" + Math.round(maxDay * 1.5) + "e at 180s/e)");

    var last14 = ledger.filter(function (e) { return e.d > today - 14; });
    add("RECENT", "last 14 days, newest first:");
    last14.slice().reverse().forEach(function (e) {
      var off = Number(e.off) || 0;
      var flags = [];
      if (off % ATTACK_ENERGY !== 0) flags.push("OFF NOT A WHOLE ATTACK (" + (off / ATTACK_ENERGY).toFixed(2) + " attacks)");
      if ((Number(e.wasted) || 0) > maxDay * 2) flags.push("WASTED EXCEEDS A DAY OF REGEN");
      if (e.d > today) flags.push("DAY IS IN THE FUTURE");
      add("  " + iso(e.d) + " (d=" + e.d + ")",
        "used " + Math.round(Number(e.used) || 0) +
        " | wasted " + Math.round(Number(e.wasted) || 0) +
        " | off " + off +
        (flags.length ? "   <-- " + flags.join("; ") : ""));
    });

    var t = ledger.filter(function (e) { return e.d >= today; });
    var sum = t.reduce(function (a, e) {
      return { used: a.used + (Number(e.used) || 0), wasted: a.wasted + (Number(e.wasted) || 0),
               off: a.off + (Number(e.off) || 0) };
    }, { used: 0, wasted: 0, off: 0 });
    add("WHAT THE NOW TAB SUMS", t.length + " entry(s) at or after today: used " + Math.round(sum.used) +
      " | wasted " + Math.round(sum.wasted) + " | off " + sum.off +
      (sum.off % ATTACK_ENERGY !== 0 ? "   <-- off is not a whole number of attacks" : ""));

    var ls = read(NS, "lastSeen");
    if (ls && typeof ls === "object") {
      var ageMin = ls.t ? Math.round((Date.now() - ls.t) / 60000) : null;
      add("LAST SEEN", "e=" + ls.e + " | t=" + (ls.t ? new Date(ls.t).toISOString() : "?") +
        " (" + ageMin + " min ago) | capSince=" +
        (ls.capSince ? new Date(ls.capSince).toISOString() : 0) + " | fullAt=" +
        (ls.fullAt ? new Date(ls.fullAt).toISOString() : 0));
      // The deltas are measured from this. A very old reading means the next
      // observation books the whole gap into WHATEVER day it lands in.
      if (ageMin !== null && ageMin > 60) {
        add("  NOTE", "that reading is " + (ageMin / 60).toFixed(1) + "h old, so the next observation books up to 48h of catch-up into today's bucket");
      }
    } else {
      add("LAST SEEN", "absent");
    }

    ["warStack", "mode", "focus"].forEach(function (k) {
      add("SETTING " + k, JSON.stringify(read(NS, k)));
    });

    var stable = read(STABLE_NS, "ledger");
    add("STABLE SCRIPT", Array.isArray(stable)
      ? stable.length + " entries in its own ledger (separate namespace; the beta never reads it)"
      : "no ledger stored");

    var key = savedKey();
    if (!key) { add("KEY ACCESS", "no saved Gym Coach key on this device -- skipped"); return show(); }
    add("KEY ACCESS", "using saved key ..." + key.slice(-4) + " (" + key.length + " chars)");
    probeAccess(key, show);
  }

  function show() {
    var text = "GYM LEDGER PROBE v" + SCRIPT_VERSION + "\nURL " + location.href + "\n\n" + out.join("\n");
    var box = document.createElement("div");
    box.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;max-height:62vh;z-index:2147483647;" +
      "background:#11151b;color:#c9d1d9;border:1px solid #2b3440;border-radius:10px;padding:10px;" +
      "font:11px/1.5 ui-monospace,Menlo,monospace;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.6)";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px";
    head.innerHTML = '<b style="color:#f2a03d">Gym ledger probe</b>' +
      '<span style="color:#8b98a5">' + out.length + ' lines</span>';

    var copy = document.createElement("button");
    copy.textContent = "Copy";
    copy.style.cssText = "margin-left:auto;background:#2ecc71;color:#08131c;border:0;border-radius:7px;" +
      "padding:6px 14px;font-weight:700;cursor:pointer";
    // PDA only allows a clipboard write inside the tap itself, so the string is
    // built up front and written synchronously.
    copy.onclick = function () {
      var ok = false;
      try { if (typeof GM_setClipboard === "function") { GM_setClipboard(text); ok = true; } } catch (e) {}
      if (!ok) { try { navigator.clipboard.writeText(text); ok = true; } catch (e) {} }
      if (!ok) {
        var ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); ok = true; } catch (e) {}
        ta.remove();
      }
      copy.textContent = ok ? "Copied" : "Select it manually";
    };

    var close = document.createElement("button");
    close.textContent = "×";
    close.style.cssText = "background:none;border:1px solid #2b3440;color:#8b98a5;border-radius:7px;" +
      "padding:5px 11px;cursor:pointer";
    close.onclick = function () { box.remove(); };

    var pre = document.createElement("pre");
    pre.textContent = text;
    pre.style.cssText = "white-space:pre-wrap;word-break:break-word;margin:0;user-select:text";

    head.appendChild(copy); head.appendChild(close);
    box.appendChild(head); box.appendChild(pre);
    document.body.appendChild(box);
  }

  if (document.body) run();
  else document.addEventListener("DOMContentLoaded", run);
})();
