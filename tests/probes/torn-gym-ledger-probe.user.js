// ==UserScript==
// @name         Gym Ledger Probe
// @namespace    RussianRob
// @version      1.0.0
// @description  One-shot diagnostic: dumps Gym Coach's own energy ledger so an impossible "Missed today" or a "Spent attacking" figure that is not a whole number of attacks can be traced to the entry that produced it. Reads local storage only, no network at all.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/gym.php*
// @match        https://www.torn.com/page.php?sid=gym*
// @grant        GM_getValue
// @grant        GM_setClipboard
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/torn-gym-ledger-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-gym-ledger-probe.user.js
// ==/UserScript==

/*
 * CHANGELOG
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

  var SCRIPT_VERSION = "1.0.0";
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
    show();
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
