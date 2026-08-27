// ==UserScript==
// @name         Gym Unlock Probe
// @namespace    RussianRob
// @version      1.2.0
// @description  One-shot diagnostic: dumps whatever gym.php knows about gym unlock progress, so a "how much energy until the next gym" estimate can be built on real fields instead of guesses. Read-only, no network of its own.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/gym.php*
// @match        https://www.torn.com/page.php?sid=gym*
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/torn-gym-unlock-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-gym-unlock-probe.user.js
// ==/UserScript==

/*
 * CHANGELOG
 * 1.1.0 — Reads the LOG, which is the better question. The DOM can only speak
 *         about gyms still locked, so an account with everything unlocked
 *         looked useless — but its log holds every gym ever bought and, if
 *         Torn records one, every training event. That makes a fully-unlocked
 *         account the BEST source: the thresholds can be derived from the
 *         energy trained between consecutive purchases, rather than trusted
 *         from a wiki.
 *
 *         Finds the numeric log types via torn/?selections=logtypes, greps them
 *         for gym/train, then samples each with user/?selections=log&log=<id>
 *         and prints the raw data shape plus how far back it goes. The shape is
 *         the decision: an entry that says "you trained" with no energy figure
 *         cannot be summed, and Torn's retention decides whether the history
 *         reaches back far enough to matter.
 *
 * 1.0.0 — First cut. Answers one question and then gets uninstalled: does
 *         anything on gym.php expose progress toward the next gym unlock?
 *
 *         Neither Torn's API nor any gym table we hold carries it. GYMS has
 *         Gym/Energy/Str/Spe/Def/Dex and no unlock threshold; user?selections=gym
 *         returns active_gym alone. So an "energy until the next gym" estimate
 *         needs a source that may not exist, and this finds out rather than
 *         shipping a number built on a guess.
 *
 *         Collects, in one panel with a Copy button: every gym button's
 *         aria-label and classes, any progress element, every short leaf text
 *         mentioning energy/unlock/progress or an n/m pair, and React fibre
 *         props hanging off the gym list. If a saved Gym Coach key is present
 *         it also probes personalstats for an energy-trained field — the other
 *         half of the sum, and the half I am least sure about.
 *
 *         No automatic network calls, no beacon. The API probe only runs off a
 *         key this device already stored, and the results only leave the page
 *         when you press Copy.
 */

(function () {
  "use strict";

  var SCRIPT_VERSION = "1.1.0";
  var out = [];
  function add(label, value) { out.push(label + " :: " + value); }

  // ---- 1. the gym buttons -------------------------------------------------
  // Index is 1:1 with the gym table, and the aria-label is where Torn puts the
  // membership cost and energy-per-train. If an unlock requirement is written
  // anywhere in the markup, this is the likeliest place.
  function probeButtons() {
    var btns = document.querySelectorAll('button[class*="gymButton"]');
    add("BUTTONS", btns.length + " found");
    for (var i = 0; i < btns.length && i < 4; i++) {
      add("BTN[" + i + "] aria", btns[i].getAttribute("aria-label") || "(none)");
      add("BTN[" + i + "] class", btns[i].className);
      add("BTN[" + i + "] text", (btns[i].textContent || "").trim().slice(0, 120));
    }
    // The first LOCKED one is the interesting case — a locked button is where a
    // requirement would have to be stated. On an account with everything
    // unlocked there is nothing to read, and a blank result would look like
    // "Torn exposes nothing" when it really means "ask someone else".
    var locked = [];
    for (var j = 0; j < btns.length; j++) {
      if (/locked/i.test(btns[j].className)) locked.push(j);
    }
    add("LOCKED COUNT", locked.length + " of " + btns.length);
    if (!locked.length) {
      add("!! VERDICT", "EVERY GYM IS UNLOCKED ON THIS ACCOUNT. The unlock-progress " +
        "question CANNOT be answered from this device -- there is nothing left to " +
        "unlock, so Torn has nothing to render. Run this on an account that still " +
        "has gyms locked. The PERSONALSTATS section below is still worth reading: " +
        "it is account-independent.");
    } else {
      var f = btns[locked[0]];
      add("FIRST LOCKED idx", String(locked[0]));
      add("FIRST LOCKED aria", f.getAttribute("aria-label") || "(none)");
      add("FIRST LOCKED html", f.outerHTML.slice(0, 600));
      // Hover/expanded state sometimes carries the requirement where the
      // collapsed button does not.
      add("FIRST LOCKED title", f.getAttribute("title") || "(none)");
      var par = f.parentElement;
      add("FIRST LOCKED parent", par ? (par.className + " | " +
        (par.textContent || "").trim().slice(0, 160)) : "(none)");
    }
  }

  // ---- 2. anything that looks like progress --------------------------------
  function probeProgress() {
    var sel = '[class*="progress" i],progress,[role="progressbar"],[class*="bar" i]';
    var els = document.querySelectorAll(sel);
    add("PROGRESS ELS", String(els.length));
    for (var i = 0; i < els.length && i < 6; i++) {
      add("PROG[" + i + "]", els[i].tagName + "." + els[i].className +
        " val=" + (els[i].getAttribute("value") || els[i].getAttribute("aria-valuenow") || "-") +
        " max=" + (els[i].getAttribute("max") || els[i].getAttribute("aria-valuemax") || "-") +
        " style=" + ((els[i].getAttribute("style") || "").slice(0, 80)) +
        " text=" + (els[i].textContent || "").trim().slice(0, 60));
    }
  }

  // ---- 3. leaf text that mentions the right words --------------------------
  // Leaves only: a container's textContent is every descendant concatenated,
  // which turns one match into a wall of the whole page.
  function probeText() {
    var re = /energy|unlock|progress|next gym|requirement|\d[\d,]*\s*\/\s*\d[\d,]*/i;
    var seen = {}, n = 0;
    var all = document.querySelectorAll("div,span,p,li,b,strong,em,small,td,th,h1,h2,h3,h4,h5");
    for (var i = 0; i < all.length && n < 30; i++) {
      if (all[i].children.length) continue;
      var t = (all[i].textContent || "").trim();
      if (!t || t.length > 140 || !re.test(t) || seen[t]) continue;
      seen[t] = 1; n++;
      add("TEXT", (all[i].className || all[i].tagName) + " | " + t);
    }
    if (!n) add("TEXT", "(nothing matched)");
  }

  // ---- 4. React props ------------------------------------------------------
  // Torn's gym list is React. A value rendered as a bar width often exists as a
  // plain number on the fibre before CSS gets hold of it.
  function probeFibre() {
    var host = document.querySelector('button[class*="gymButton"]');
    if (!host) { add("FIBRE", "(no gym button to read)"); return; }
    var node = host.parentElement || host;
    var key = null, k;
    for (k in node) {
      if (k.indexOf("__reactProps$") === 0 || k.indexOf("__reactFiber$") === 0) { key = k; break; }
    }
    if (!key) { add("FIBRE", "(no react key on the gym list)"); return; }
    try {
      var f = node[key], depth = 0, found = [];
      while (f && depth < 12) {
        var p = f.memoizedProps || f.props || null;
        if (p) {
          for (var pk in p) {
            if (typeof p[pk] === "number" || typeof p[pk] === "string") {
              if (/energy|unlock|progress|require|trained|next/i.test(pk)) {
                found.push(pk + "=" + String(p[pk]).slice(0, 60));
              }
            }
          }
        }
        f = f.return || f._owner || null; depth++;
      }
      add("FIBRE", found.length ? found.join(" | ") : "(walked " + depth + " levels, no matching prop)");
    } catch (e) { add("FIBRE", "error: " + e.message); }
  }

  // ---- 5. the other half of the sum ---------------------------------------
  // Even with a threshold, an estimate needs how much you have ALREADY trained.
  // My note says personalstats has no such field; this checks rather than
  // trusting the note. Uses a key this device already saved for Gym Coach --
  // nothing is asked for and nothing new is stored.
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

  function probeStats(done) {
    var key = savedKey();
    if (!key) { add("PERSONALSTATS", "(no saved Gym Coach key on this device -- skipped)"); return done(); }
    var url = "https://api.torn.com/v2/user/personalstats?cat=all&key=" +
              encodeURIComponent(key) + "&comment=gym-unlock-probe";
    function handle(text) {
      try {
        var d = JSON.parse(text);
        if (d.error) { add("PERSONALSTATS", "API error: " + d.error.error); return done(); }
        var flat = {};
        (function walk(o, pre) {
          for (var k in o) {
            var v = o[k];
            if (v && typeof v === "object") walk(v, pre + k + ".");
            else flat[pre + k] = v;
          }
        })(d, "");
        var hits = [], k2;
        for (k2 in flat) {
          if (/energy|train|gym/i.test(k2)) hits.push(k2 + "=" + flat[k2]);
        }
        add("PERSONALSTATS keys", String(Object.keys(flat).length));
        add("PERSONALSTATS matches", hits.length ? hits.join(" | ") : "(no energy/train/gym field)");
      } catch (e) { add("PERSONALSTATS", "parse error: " + e.message); }
      done();
    }
    if (typeof GM_xmlhttpRequest === "function") {
      GM_xmlhttpRequest({ method: "GET", url: url,
        onload: function (r) { handle(r.responseText || ""); },
        onerror: function () { add("PERSONALSTATS", "request failed"); done(); } });
    } else {
      fetch(url).then(function (r) { return r.text(); }).then(handle)
        .catch(function (e) { add("PERSONALSTATS", "fetch failed: " + e.message); done(); });
    }
  }

  // ---- 6. THE LOG ---------------------------------------------------------
  // The DOM can only speak about gyms still locked. The LOG can speak about
  // every gym ever bought and (if Torn records it) every point of energy ever
  // trained — which makes an account with everything unlocked the BEST source,
  // not the worst: it holds the whole progression.
  //
  // Method is the one that reconstructed nerve history: find the numeric type
  // via torn/?selections=logtypes, then user/?selections=log&log=<id>. Each
  // entry carries a structured `data` payload, and that payload is the thing
  // worth reading — energy spent, gym bought, whatever Torn chose to store.
  function api(path, done) {
    var key = savedKey();
    if (!key) return done(null, "no key");
    var url = "https://api.torn.com/" + path + (path.indexOf("?") === -1 ? "?" : "&") +
              "key=" + encodeURIComponent(key) + "&comment=gym-unlock-probe";
    function ok(t) { try { done(JSON.parse(t), null); } catch (e) { done(null, e.message); } }
    if (typeof GM_xmlhttpRequest === "function") {
      GM_xmlhttpRequest({ method: "GET", url: url,
        onload: function (r) { ok(r.responseText || ""); },
        onerror: function () { done(null, "request failed"); } });
    } else {
      fetch(url).then(function (r) { return r.text(); }).then(ok)
        .catch(function (e) { done(null, e.message); });
    }
  }

  function probeLogs(done) {
    if (!savedKey()) { add("LOGS", "(no saved key -- skipped)"); return done(); }
    api("torn/?selections=logtypes", function (d, err) {
      if (err || !d || d.error) {
        add("LOGTYPES", "failed: " + (err || (d && d.error && d.error.error)));
        return done();
      }
      var types = d.logtypes || d.log || {};
      var gymIds = [], k;
      for (k in types) {
        if (/gym|train/i.test(String(types[k]))) gymIds.push({ id: k, name: types[k] });
      }
      // Which days were war-stack days? The ledger never recorded why a bar sat
      // full, so the only way to reconstruct it for PAST days is from the log.
      // Three candidates, and the winner is whichever is both discriminating
      // and low-volume: a "ranked war" event would be a handful of entries with
      // exact dates, while individual attacks could be hundreds a day and blow
      // straight past the 100-entry page.
      var warIds = [];
      for (k in types) {
        var nm = String(types[k]);
        if (/\b(war|attack|xanax|drug|energy refill|stack)\b/i.test(nm)) {
          warIds.push({ id: k, name: nm });
        }
      }
      add("LOGTYPES war/attack/drug", warIds.length
        ? warIds.map(function (t) { return t.id + "=" + t.name; }).join(" | ")
        : "(none matched)");
      add("LOGTYPES total", String(Object.keys(types).length));
      add("LOGTYPES gym/train", gymIds.length
        ? gymIds.map(function (t) { return t.id + "=" + t.name; }).join(" | ")
        : "(NONE -- Torn logs no gym or training event, so this route is dead)");
      if (!gymIds.length) return done();

      // Pull a sample of each so the DATA SHAPE is visible. The shape decides
      // everything: an entry that says "you trained" without an energy figure
      // cannot be summed, and knowing that now saves building on a hope.
      // Sample the war candidates first -- that is the open question now.
      var probe = warIds.slice(0, 8).concat(gymIds.slice(0, 2));
      var i = 0;
      (function next() {
        if (i >= probe.length) return done();
        var t = probe[i++];
        api("user/?selections=log&log=" + encodeURIComponent(t.id), function (ld, lerr) {
          if (lerr || !ld || ld.error) {
            add("LOG " + t.id, "failed: " + (lerr || (ld && ld.error && ld.error.error)));
            return next();
          }
          var rows = ld.log || {};
          var keys = Object.keys(rows);
          add("LOG " + t.id + " (" + t.name + ")", keys.length + " entries");
          if (keys.length) {
            var first = rows[keys[0]];
            add("LOG " + t.id + " sample", JSON.stringify(first).slice(0, 400));
            // date range tells us how far back Torn keeps this
            var ts = keys.map(function (kk) { return Number(rows[kk].timestamp) || 0; })
                         .filter(Boolean).sort();
            if (ts.length) {
              var days = Math.max(1, (ts[ts.length - 1] - ts[0]) / 86400);
              add("LOG " + t.id + " range",
                new Date(ts[0] * 1000).toISOString().slice(0, 10) + " .. " +
                new Date(ts[ts.length - 1] * 1000).toISOString().slice(0, 10) +
                "  (~" + (keys.length / days).toFixed(1) + " entries/day" +
                (keys.length >= 100 ? ", PAGE FULL so this is a floor" : "") + ")");
            }
          }
          next();
        });
      })();
    });
  }

  // ---- panel ---------------------------------------------------------------
  function show() {
    var text = "GYM UNLOCK PROBE v" + SCRIPT_VERSION + "\nURL " + location.href + "\n\n" + out.join("\n");

    var box = document.createElement("div");
    box.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;max-height:62vh;z-index:2147483647;" +
      "background:#11151b;color:#c9d1d9;border:1px solid #2b3440;border-radius:10px;padding:10px;" +
      "font:11px/1.5 ui-monospace,Menlo,monospace;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.6)";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px";
    head.innerHTML = '<b style="color:#f2a03d">Gym unlock probe</b>' +
      '<span style="color:#8b98a5">' + out.length + ' findings</span>';

    var copy = document.createElement("button");
    copy.textContent = "Copy";
    copy.style.cssText = "margin-left:auto;background:#2ecc71;color:#08131c;border:0;border-radius:7px;" +
      "padding:6px 14px;font-weight:700;cursor:pointer";
    // PDA straightens curly quotes and only allows a clipboard write inside the
    // tap itself, so the string is built up front and written synchronously.
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

  // The gym list is React and arrives late; poll rather than race it.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var ready = document.querySelectorAll('button[class*="gymButton"]').length >= 20;
    if (!ready && tries < 40) return;
    clearInterval(timer);
    add("READY", ready ? "gym list rendered after " + (tries * 400) + "ms"
                       : "gym list NEVER rendered -- probing anyway");
    probeButtons(); probeProgress(); probeText(); probeFibre();
    probeStats(function () { probeLogs(show); });
  }, 400);
})();
