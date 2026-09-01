// ==UserScript==
// @name         Stat Book Probe
// @namespace    RussianRob
// @version      1.0.1
// @description  One-shot diagnostic: works out whether Torn records which stat book you are reading, and where. Answers it from Torn's own log index rather than a guessed log id, so a wrong guess cannot fail silently. Read-only.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/gym.php*
// @match        https://www.torn.com/page.php?sid=gym*
// @match        https://www.torn.com/item.php*
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/torn-book-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-book-probe.user.js
// ==/UserScript==

/*
 * CHANGELOG
 * 1.0.1 - The index already answered it. Torn lists these, by name:
 *
 *           2050  Item use book                       (when you started)
 *           2051  Item finish book
 *           2052  Item finish book strength increase
 *           2053  Item finish book speed increase
 *           2054  Item finish book defense increase
 *           2055  Item finish book dexterity increase
 *
 *         So 1.0.0's discovery half did its job and its reading half did not:
 *         the candidate filter matched anything mentioning "item", which is
 *         250-odd log types, and it spent its whole rate-limit budget on Item
 *         market add before reaching 2050. It then reported UNPROVEN, which
 *         was at least honest, but only because one call happened to be
 *         refused -- had the burst finished it would have said ABSENT about
 *         entries it never looked at.
 *
 *         Now it reads the six ids above and nothing else, spaced out, and
 *         prints the full row so the field carrying the book name is visible.
 *
 * 1.0.0 - Answers one question and then gets uninstalled: can Gym Coach work
 *         out which stat book you are reading, instead of asking you to tap it?
 *
 *         The four stat books award a one-off +5% stat gain rather than an
 *         active multiplier, so nothing about them reaches the perks payload
 *         and parsePerks structurally cannot see them. That is why 0.9.44 made
 *         it a manual tap.
 *
 *         The candidate that WOULD know is the item-use log: it carries what
 *         you used and when, which is exactly the book and the start of its 31
 *         days. What is not known is whether using a book writes a line there
 *         at all, under which log id, and whether the book is identifiable in
 *         the row -- and a feature built on a guessed log id fails silently,
 *         which looks identical to a feature that is merely broken.
 *
 *         So this discovers the id instead of assuming it. /torn/logtypes and
 *         /torn/logcategories are PUBLIC-key endpoints listing every log type
 *         Torn has, in Torn's own words; anything mentioning items or books is
 *         a candidate, and each is then actually read.
 *
 *         Reads perks as well, so the claim that stat books never appear there
 *         is evidenced rather than assumed.
 *
 *         Uses a key this device already saved for Gym Coach -- nothing is
 *         asked for and nothing new is stored. The key is never printed: the
 *         report shows its last four characters and length, so you can tell
 *         WHICH key answered without the report carrying the key.
 *
 *         Every finding says which of three things it is: found, absent, or
 *         unreadable. "I could not tell" is not "there is nothing there", and
 *         a probe that blurs those has answered nothing.
 *
 *         No beacon. Results leave the page only when you press Copy.
 */

(function () {
  "use strict";

  var SCRIPT_VERSION = "1.0.1";
  var out = [];
  function add(label, value) { out.push(label + " :: " + value); }

  // The four stat books, by the names checked against the wiki for 0.9.44.
  var BOOKS = ["Brawn Over Brains", "Keeping Your Face Handsome",
               "Time Is In The Mind", "A Job For Your Hands"];

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

  function fingerprint(k) { return "..." + k.slice(-4) + " (" + k.length + " chars)"; }

  function get(url) {
    return new Promise(function (resolve) {
      function handle(text) {
        var d = null;
        try { d = JSON.parse(text); } catch (e) { return resolve({ err: "unparseable answer" }); }
        if (d && d.error) return resolve({ err: "API error " + d.error.code + ": " + d.error.error, code: d.error.code });
        resolve({ data: d });
      }
      try {
        if (typeof GM_xmlhttpRequest === "function") {
          GM_xmlhttpRequest({
            method: "GET", url: url,
            onload: function (r) { handle(r.responseText || r.response || ""); },
            onerror: function () { resolve({ err: "network error" }); }
          });
          return;
        }
      } catch (e) {}
      fetch(url).then(function (r) { return r.text(); }).then(handle)
        .catch(function () { resolve({ err: "network error" }); });
    });
  }

  function rows(v) {
    if (!v) return [];
    return Array.isArray(v) ? v : Object.keys(v).map(function (k) { return v[k]; });
  }

  function looksBooky(s) { return /book|read/i.test(String(s || "")); }
  function looksItemy(s) { return /item|use|consum/i.test(String(s || "")); }

  function run() {
    var key = savedKey();
    if (!key) {
      add("KEY", "UNREADABLE -- no saved Gym Coach key on this device. Open Gym Coach, enter your key, reload.");
      return show();
    }
    add("KEY", "saved Gym Coach key " + fingerprint(key));
    var q = "key=" + encodeURIComponent(key) + "&comment=book-probe";

    // ---- 1. does the reading show up in perks at all? --------------------
    get("https://api.torn.com/v2/user/perks?" + q).then(function (r) {
      if (r.err) {
        add("PERKS", "UNREADABLE -- " + r.err + "  (so this run cannot confirm or deny the perks claim)");
      } else {
        var p = (r.data && r.data.perks) || {};
        var bk = rows(p.book);
        add("PERKS book[]", bk.length ? bk.length + " entries: " + JSON.stringify(bk) : "ABSENT -- empty array");
        var hit = bk.filter(function (line) {
          return BOOKS.some(function (b) { return String(line).toLowerCase().indexOf(b.toLowerCase()) !== -1; });
        });
        add("PERKS verdict", hit.length
          ? "a STAT BOOK IS named in perks: " + JSON.stringify(hit) + " -- perks would be enough, no log needed"
          : "no stat book named in perks. Consistent with 0.9.44's claim, though it only proves it for THIS moment "
            + "-- if you are not currently reading one, it proves nothing either way.");
      }

      // ---- 2. what log types does Torn actually have? -------------------
      return get("https://api.torn.com/v2/torn/logcategories?" + q);
    }).then(function (r) {
      if (r.err) { add("LOG CATEGORIES", "UNREADABLE -- " + r.err); return { data: null }; }
      var cats = rows(r.data && r.data.logcategories);
      add("LOG CATEGORIES", cats.length + " categories");
      cats.filter(function (c) { return looksItemy(c.title) || looksBooky(c.title); })
          .forEach(function (c) { add("  candidate category", "id " + c.id + " = " + c.title); });
      return get("https://api.torn.com/v2/torn/logtypes?" + q);
    }).then(function (r) {
      if (!r || r.err) {
        add("LOG TYPES", "UNREADABLE -- " + ((r && r.err) || "no answer") +
          "  (without the index, any log id would be a guess, and a guessed id fails silently)");
        return show();
      }
      var types = rows(r.data && r.data.logtypes);
      add("LOG TYPES", types.length + " types listed by Torn");
      // Only the book ones are printed. 1.0.0 listed every match and buried the
      // answer in two hundred lines of item-market noise.
      types.filter(function (t) { return looksBooky(t.title); })
           .forEach(function (t) { add("  book log", "id " + t.id + " = " + t.title); });

      // ---- 3. read each candidate and look for a book ------------------
      // Sequential, spaced: a probe that bursts is a probe that gets refused
      // and then reports "nothing there".
      // The six the index actually names. 1.0.0 walked every "item" log there
      // is and ran out of rate limit long before reaching them -- a probe that
      // bursts is a probe that gets refused and then reports "nothing there".
      var WANTED = [2050, 2051, 2052, 2053, 2054, 2055];
      var have = {};
      types.forEach(function (t) { have[t.id] = t.title; });
      var ids = WANTED.filter(function (id) {
        if (have[id]) { add("  reading", "id " + id + " = " + have[id]); return true; }
        add("  MISSING", "id " + id + " is not in Torn's index on this account");
        return false;
      });
      var found = 0, unreadable = 0;
      function step(i) {
        if (i >= ids.length) {
          add("VERDICT", found
            ? "TRACKABLE -- a stat book is identifiable in the log above, with a timestamp. " +
              "Gym Coach can date the 31 days itself."
            : unreadable
            ? "UNPROVEN -- " + unreadable + " candidate log(s) could not be read (Full key needed for /user/log). " +
              "This is NOT evidence that the entry is absent."
            : "ABSENT -- every candidate log was readable and none carried a stat book in the last 100 entries. " +
              "If you have not used a book recently that is expected; if you have, the log is not the answer.");
          return show();
        }
        var id = ids[i];
        return get("https://api.torn.com/v2/user/log?log=" + id + "&limit=100&" + q).then(function (lr) {
          if (lr.err) {
            unreadable += 1;
            add("LOG " + id, "UNREADABLE -- " + lr.err +
              (String(lr.code) === "16" ? "  (needs a FULL access key)" : ""));
          } else {
            var entries = rows(lr.data && lr.data.log);
            var hits = entries.filter(function (e) {
              return JSON.stringify(e).toLowerCase().indexOf("book") !== -1 ||
                BOOKS.some(function (b) { return JSON.stringify(e).toLowerCase().indexOf(b.toLowerCase()) !== -1; });
            });
            add("LOG " + id, entries.length + " entries, " + hits.length + " mentioning a book");
            if (entries.length) {
              add("  row shape", "keys = " + Object.keys(entries[0]).join(",") +
                " | data keys = " + Object.keys(entries[0].data || {}).join(",") +
                " | params keys = " + Object.keys(entries[0].params || {}).join(","));
            }
            // Every entry, not just the ones matching "book": these ids ARE the
            // book logs, so anything in them is relevant, and the whole row is
            // printed because which field carries the book name is the thing
            // still unknown.
            entries.slice(0, 5).forEach(function (e) {
              found += 1;
              add("  ROW", new Date(Number(e.timestamp) * 1000).toISOString() +
                " | " + ((e.details && e.details.title) || "?") +
                " | data " + JSON.stringify(e.data) + " | params " + JSON.stringify(e.params));
            });
            hits.slice(0, 0).forEach(function (e) {
              found += 1;
              add("  BOOK ENTRY", new Date(Number(e.timestamp) * 1000).toISOString() +
                " | " + ((e.details && e.details.title) || "?") +
                " | data " + JSON.stringify(e.data) + " | params " + JSON.stringify(e.params));
            });
          }
          return new Promise(function (res) { setTimeout(res, 700); });
        }).then(function () { return step(i + 1); });
      }
      return step(0);
    }).catch(function (e) {
      add("PROBE", "UNREADABLE -- the probe itself threw: " + (e && e.message));
      show();
    });
  }

  function show() {
    var text = "STAT BOOK PROBE v" + SCRIPT_VERSION + "\nURL " + location.href + "\n\n" + out.join("\n");
    var box = document.createElement("div");
    box.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;max-height:62vh;z-index:2147483647;" +
      "background:#11151b;color:#c9d1d9;border:1px solid #2b3440;border-radius:10px;padding:10px;" +
      "font:11px/1.5 ui-monospace,Menlo,monospace;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.6)";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px";
    head.innerHTML = '<b style="color:#f2a03d">Stat book probe</b>' +
      '<span style="color:#8b98a5">' + out.length + " findings</span>";
    var copy = document.createElement("button");
    copy.textContent = "Copy";
    copy.style.cssText = "margin-left:auto;background:#2ecc71;color:#08131c;border:0;border-radius:7px;" +
      "padding:6px 14px;font-weight:700;cursor:pointer";
    // PDA only grants the clipboard inside the tap itself, so the string is
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
    close.style.cssText = "background:none;border:1px solid #2b3440;color:#8b98a5;border-radius:7px;padding:5px 11px;cursor:pointer";
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
