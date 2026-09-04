// ==UserScript==
// @name         FactionOps War Row Diag
// @namespace    RussianRob
// @version      1.1.0
// @description  Temporary diagnostic — reports which selectors match Torn's ranked-war member rows, and whether FactionOps managed to touch them. Safe to remove after.
// @author       RussianRob
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/war.php*
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  var URL_ = "https://tornwar.com/api/debug/client-log";
  var sent = 0, MAX = 10;

  // The endpoint truncates at 1500 chars, so each post carries one small
  // question rather than a dump that gets cut off mid-answer.
  function post(what, data) {
    if (sent >= MAX) return;
    sent++;
    try {
      GM_xmlhttpRequest({
        method: "POST", url: URL_,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "fo-war-row-diag", data: { q: what, d: data } })
      });
    } catch (e) {}
  }

  // Every selector FactionOps tries, plus the ones the recorded DOM says
  // should work. The answer we want is which of these is non-zero.
  var SELECTORS = [
    'ul.f-war-list > li[class*="warListItem"]',
    '[class*="members-list" i] > li[class*="warListItem"]',
    'li[class*="warListItem"]',
    'ul.f-war-list > li',
    '.members-list .table-body > li',
    '.f-war-list .table-body > li',
    '.ranked-war-list li',
    '.war-list li.table-row',
    '.members-list li',
    '[class*="warList"] li'
  ];

  function cls(el) {
    try { return String((el.getAttribute && el.getAttribute("class")) || "").slice(0, 90); }
    catch (_) { return "?"; }
  }

  function run() {
    var counts = {};
    SELECTORS.forEach(function (s) {
      try { counts[s] = document.querySelectorAll(s).length; } catch (_) { counts[s] = "err"; }
    });
    post("selector-counts", { url: location.href.slice(0, 120), counts: counts });

    // Did FactionOps get anywhere on this page at all?
    post("factionops-traces", {
      calledRows: document.querySelectorAll(".fo-called-row").length,
      calledTags: document.querySelectorAll(".fo-called-tag").length,
      wbCells: document.querySelectorAll(".wb-cell-container").length,
      overlay: !!document.getElementById("fo-overlay"),
      activateBtn: !!document.getElementById("fo-activate-btn")
    });

    // The shape of a real row, so a selector can be written against it rather
    // than guessed at. First match from whichever selector found something.
    var row = null;
    for (var i = 0; i < SELECTORS.length && !row; i++) {
      try { row = document.querySelector(SELECTORS[i]); } catch (_) {}
    }
    if (!row) {
      // Nothing matched: describe the biggest list on the page instead, so
      // there is something to write a selector against.
      var best = null, bestN = 0;
      document.querySelectorAll("ul, tbody, div").forEach(function (el) {
        var n = el.children ? el.children.length : 0;
        if (n > bestN && n < 200) { bestN = n; best = el; }
      });
      post("no-match-biggest-list", best ? {
        tag: best.tagName, cls: cls(best), children: bestN,
        childTag: best.firstElementChild ? best.firstElementChild.tagName : null,
        childCls: best.firstElementChild ? cls(best.firstElementChild) : null
      } : { none: true });
      return;
    }

    var links = [];
    try {
      row.querySelectorAll("a[href]").forEach(function (a) {
        if (links.length < 4) links.push(String(a.getAttribute("href")).slice(0, 70));
      });
    } catch (_) {}

    post("row-shape", {
      tag: row.tagName, cls: cls(row),
      parentTag: row.parentElement ? row.parentElement.tagName : null,
      parentCls: row.parentElement ? cls(row.parentElement) : null,
      links: links,
      text: String(row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80)
    });
  }

  // The innards of ONE enemy row: what the children are, and which selector
  // actually finds the name. The tag has to attach beside the name, and
  // guessing where that is has already cost several rounds.
  function probeRow() {
    var row = document.querySelector('.enemy-faction ul.members-list li.enemy')
           || document.querySelector('ul.members-list li.enemy')
           || document.querySelector('.members-list li');
    if (!row) { post("enemy-row", { none: true }); return; }

    var kids = [];
    try {
      Array.prototype.forEach.call(row.children, function (c) {
        if (kids.length >= 8) return;
        kids.push({
          t: c.tagName,
          c: cls(c).slice(0, 46),
          x: String(c.textContent || "").replace(/\s+/g, " ").trim().slice(0, 26)
        });
      });
    } catch (_) {}
    post("enemy-row-children", { cls: cls(row), n: row.children.length, kids: kids });

    // Which of these finds the NAME, and what each returns.
    var NAME_SELS = [
      "a.user.name", ".user.name", ".honorWrap a", "a[href*='profiles.php']",
      ".member .name", ".name-wrap a", ".userName", "[class*='name' i] a",
      "[class*='honor' i]", "span.name"
    ];
    var found = {};
    NAME_SELS.forEach(function (sel) {
      try {
        var el = row.querySelector(sel);
        found[sel] = el ? String(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 22) : 0;
      } catch (_) { found[sel] = "err"; }
    });
    post("enemy-row-name", found);

    // The cells worth surfacing alongside a call marker.
    var cells = {};
    [["lvl", "[class*='level' i]"], ["score", "[class*='score' i]"],
     ["status", "[class*='status' i]"], ["attack", "[class*='attack' i]"]].forEach(function (pair) {
      try {
        var el = row.querySelector(pair[1]);
        cells[pair[0]] = el ? (cls(el).slice(0, 30) + " = " +
          String(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 18)) : 0;
      } catch (_) { cells[pair[0]] = "err"; }
    });
    post("enemy-row-cells", cells);
  }

  // The war list is React-rendered and arrives after load, so one pass at
  // document-idle usually sees an empty page. Sample a few times instead.
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var any = false;
    try { any = document.querySelectorAll('li[class*="warListItem"], .members-list li').length > 0; } catch (_) {}
    if (any || tries >= 10) { clearInterval(t); run(); probeRow(); }
  }, 1500);
})();
