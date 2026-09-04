// ==UserScript==
// @name         FO Enemy Row Probe
// @namespace    RussianRob
// @version      1.0.0
// @description  One-shot probe: dumps the internal structure of a single li.enemy war row so a badge can be attached beside the name. Reports to the server. Remove after.
// @author       RussianRob
// @match        https://www.torn.com/factions.php*
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  var URL_ = "https://tornwar.com/api/debug/client-log";
  var sent = 0, MAX = 8;

  // 1500 chars per post, so the outline is chunked rather than truncated.
  function post(q, d) {
    if (sent >= MAX) return;
    sent++;
    try {
      GM_xmlhttpRequest({
        method: "POST", url: URL_,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "fo-enemy-probe", data: { q: q, d: d } })
      });
    } catch (e) {}
  }

  function cls(el) {
    try {
      var c = el.getAttribute && el.getAttribute("class");
      return String(c || "").slice(0, 40);
    } catch (_) { return "?"; }
  }
  function ownText(el) {
    // Only this node's own text, not its descendants' -- otherwise every
    // ancestor reads as the whole row and the outline says nothing.
    var t = "";
    try {
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].nodeValue;
      }
    } catch (_) {}
    return t.replace(/\s+/g, " ").trim().slice(0, 20);
  }

  // Compact outline: one line per element, indented by depth.
  function outline(root, maxDepth) {
    var lines = [];
    (function walk(el, depth) {
      if (depth > maxDepth || lines.length > 40) return;
      var tag = el.tagName.toLowerCase();
      var c = cls(el);
      var t = ownText(el);
      var href = "";
      try {
        if (tag === "a") href = String(el.getAttribute("href") || "").slice(0, 42);
      } catch (_) {}
      lines.push(
        new Array(depth + 1).join("  ") + tag +
        (c ? "." + c : "") + (t ? ' "' + t + '"' : "") + (href ? " -> " + href : "")
      );
      for (var i = 0; i < el.children.length; i++) walk(el.children[i], depth + 1);
    })(root, 0);
    return lines;
  }

  function run() {
    var row = document.querySelector(".enemy-faction ul.members-list li.enemy")
           || document.querySelector("ul.members-list li.enemy")
           || document.querySelector(".members-list li");
    if (!row) { post("no-row", { hint: "no li.enemy found" }); return; }

    post("row", {
      cls: cls(row),
      kids: row.children.length,
      text: String(row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70)
    });

    // The outline is the point of this probe. Sent in slices so nothing is cut.
    var lines = outline(row, 4);
    for (var i = 0; i < lines.length; i += 12) {
      post("outline" + (i / 12), lines.slice(i, i + 12));
    }

    // Which selector finds the NAME, and what it returns.
    var SELS = ["a.user.name", ".user.name", "a[href*='profiles.php']", ".honorWrap a",
                ".name", "[class*='name' i]", "[class*='user' i] a", "span[class*='name' i]"];
    var hits = {};
    SELS.forEach(function (s) {
      try {
        var el = row.querySelector(s);
        hits[s] = el ? (el.tagName.toLowerCase() + "." + cls(el) + ' "' +
          String(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 18) + '"') : 0;
      } catch (_) { hits[s] = "err"; }
    });
    post("name-selectors", hits);
  }

  // React renders the list well after document-idle.
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var ok = false;
    try { ok = !!document.querySelector("ul.members-list li.enemy"); } catch (_) {}
    if (ok || tries >= 12) { clearInterval(t); run(); }
  }, 1500);
})();
