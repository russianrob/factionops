// ==UserScript==
// @name         Stock Benefit Probe
// @namespace    RussianRob
// @version      1.0.0
// @description  One-shot diagnostic: works out which Torn stock pays the energy benefit, whether you hold enough shares for it, and whether this week's claim is waiting. Built so a "claim your energy" reminder can be wired to real field names instead of a guessed stock id. Read-only.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/gym.php*
// @match        https://www.torn.com/page.php?sid=stocks*
// @match        https://www.torn.com/page.php?sid=gym*
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/torn-stock-benefit-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-stock-benefit-probe.user.js
// ==/UserScript==

/*
 * CHANGELOG
 * 1.0.0 — First cut. Answers one question and then gets uninstalled: can Gym
 *         Coach tell you when your Mc Smoogle energy is ready to claim?
 *
 *         Torn's published schema says yes. /v2/user/stocks gives every
 *         holding a `bonus` object carrying available / increment / progress /
 *         frequency, and `available` is exactly the readiness flag a reminder
 *         needs. What the schema does NOT carry is which stock id is the one
 *         that pays energy -- there is no id enum in it -- so a reminder built
 *         now would have to hardcode a guessed id, and a wrong guess fails
 *         silent: the reminder simply never fires and looks broken.
 *
 *         So this discovers the id instead of assuming it. /v2/torn/stocks
 *         (public access) lists every stock with its acronym and the benefit
 *         description in Torn's own words; anything whose description mentions
 *         energy is the candidate. Cross-referenced against your holdings, that
 *         answers all three parts at once: which id, do you hold enough, and is
 *         this week's claim waiting.
 *
 *         Uses a key this device already saved for Gym Coach -- nothing is
 *         asked for and nothing new is stored. The key is never printed: the
 *         report shows its last four characters and length so you can tell
 *         WHICH key answered without the report carrying the key itself.
 *
 *         No beacon. Results leave the page only when you press Copy.
 */

(function () {
  "use strict";

  var SCRIPT_VERSION = "1.0.0";
  var out = [];
  function add(label, value) { out.push(label + " :: " + value); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  // Reuses whatever Gym Coach already stored on this device. The PDA build
  // substitutes a placeholder into the key slot, so a value still carrying ###
  // is not a key at all.
  function savedKey() {
    var names = ["gcb_v1_api_key", "gc_v1_api_key"];
    for (var i = 0; i < names.length; i++) {
      try {
        var v = (typeof GM_getValue === "function" ? GM_getValue(names[i], "") : "") ||
                localStorage.getItem(names[i]) || "";
        v = String(v).trim();
        if (v && v.indexOf("###") === -1 && v.length > 8) return v;
      } catch (e) {}
    }
    return "";
  }

  // A key is a credential, so the report gets a fingerprint instead: enough to
  // identify which key answered, useless to anyone who reads it.
  function fingerprint(k) {
    return "..." + k.slice(-4) + " (" + k.length + " chars)";
  }

  function get(url, done) {
    function handle(text) {
      var d = null;
      try { d = JSON.parse(text); } catch (e) { return done(null, "unparseable answer"); }
      if (d && d.error) return done(null, "API error " + d.error.code + ": " + d.error.error);
      done(d, null);
    }
    try {
      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest({
          method: "GET", url: url,
          onload: function (r) { handle(r.responseText || r.response || ""); },
          onerror: function () { done(null, "network error"); }
        });
        return;
      }
    } catch (e) {}
    fetch(url).then(function (r) { return r.text(); }).then(handle)
      .catch(function () { done(null, "network error"); });
  }

  // Both endpoints are documented as returning an array, but an object keyed by
  // id is the older shape and costs one line to tolerate.
  function rows(d) {
    var s = d && d.stocks;
    if (!s) return [];
    return Array.isArray(s) ? s : Object.keys(s).map(function (k) { return s[k]; });
  }

  function run() {
    var key = savedKey();
    if (!key) {
      add("KEY", "no saved Gym Coach key on this device -- open Gym Coach, enter your key, then reload");
      return show();
    }
    add("KEY", "saved Gym Coach key " + fingerprint(key));

    var q = "&key=" + encodeURIComponent(key) + "&comment=stock-benefit-probe";

    get("https://api.torn.com/v2/torn/stocks?" + q.slice(1), function (cat, err) {
      if (err) { add("CATALOG", "FAILED -- " + err); return show(); }
      var all = rows(cat);
      add("CATALOG", all.length + " stocks from /v2/torn/stocks");
      if (all.length) add("CATALOG shape", "keys = " + Object.keys(all[0]).join(","));

      // Torn writes the benefit in plain words, so the energy stock identifies
      // itself. Printing EVERY claimable benefit as well, because if the
      // wording is not what I expect, the right answer is still on screen.
      var energy = [];
      all.forEach(function (s) {
        var b = s.bonus || {};
        var desc = String(b.description || "");
        var line = "id " + s.id + " " + (s.acronym || "?") + ' "' + (s.name || "?") + '"' +
          " | freq " + b.frequency + "d | req " + num(b.requirement) + " shares" +
          " | passive=" + b.passive + ' | "' + desc + '"';
        if (/energy/i.test(desc)) { energy.push(s); add("ENERGY BENEFIT", line); }
      });
      if (!energy.length) {
        add("ENERGY BENEFIT", "NONE matched /energy/i -- every claimable benefit follows so the wording can be read directly");
        all.forEach(function (s) {
          var b = s.bonus || {};
          if (b && b.passive === false) {
            add("CLAIMABLE", "id " + s.id + " " + (s.acronym || "?") +
              ' | freq ' + b.frequency + 'd | "' + String(b.description || "") + '"');
          }
        });
      }

      get("https://api.torn.com/v2/user/stocks?" + q.slice(1), function (mine, err2) {
        if (err2) {
          // Error 16 is the one worth explaining: /torn/stocks answers a
          // public key, so the catalog above will have succeeded and only this
          // half failed, which reads like a bug rather than a key level.
          add("HOLDINGS", "FAILED -- " + err2 +
            (/\b16\b/.test(err2) ? " (this one needs a LIMITED access key -- the catalog above only needs a public one, which is why it worked)" : ""));
          return show();
        }
        var held = rows(mine);
        add("HOLDINGS", held.length + " held");
        if (held.length) {
          add("HOLDINGS shape", "keys = " + Object.keys(held[0]).join(",") +
            " | bonus keys = " + Object.keys(held[0].bonus || {}).join(","));
        }
        held.forEach(function (h) {
          var b = h.bonus || {};
          var meta = all.filter(function (s) { return String(s.id) === String(h.id); })[0] || {};
          add("HELD", "id " + h.id + " " + (meta.acronym || "?") +
            " | shares " + num(h.shares) +
            " | available=" + b.available + " increment=" + b.increment +
            " progress=" + b.progress + " frequency=" + b.frequency);
        });

        // The whole point, stated in one line.
        energy.forEach(function (s) {
          var h = held.filter(function (x) { return String(x.id) === String(s.id); })[0];
          if (!h) {
            add("VERDICT", "energy stock " + s.id + " (" + s.acronym + ") is NOT held on this account");
            return;
          }
          var b = h.bonus || {};
          add("VERDICT", "energy stock " + s.id + " (" + s.acronym + ") IS held, " +
            num(h.shares) + " shares, " + b.increment + " increment(s), and this week's claim is " +
            (b.available === true ? "WAITING NOW" :
             b.available === false ? "not ready (progress " + b.progress + "/" + b.frequency + ")" :
             "UNREADABLE -- bonus.available was " + JSON.stringify(b.available)));
        });
        show();
      });
    });
  }

  // ---- panel ---------------------------------------------------------------
  function show() {
    var text = "STOCK BENEFIT PROBE v" + SCRIPT_VERSION + "\nURL " + location.href + "\n\n" + out.join("\n");

    var box = document.createElement("div");
    box.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;max-height:62vh;z-index:2147483647;" +
      "background:#11151b;color:#c9d1d9;border:1px solid #2b3440;border-radius:10px;padding:10px;" +
      "font:11px/1.5 ui-monospace,Menlo,monospace;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.6)";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px";
    head.innerHTML = '<b style="color:#f2a03d">Stock benefit probe</b>' +
      '<span style="color:#8b98a5">' + out.length + ' findings</span>';

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
