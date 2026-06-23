// ==UserScript==
// @name         Torn Green Nav
// @namespace    RussianRob
// @version      1.0.5
// @description  Recolours Torn's blue UI icons + notification dots (the recent green->blue change) back to green.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// @downloadURL  https://tornwar.com/scripts/torn-green-nav.user.js
// @updateURL    https://tornwar.com/scripts/torn-green-nav.meta.js
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "1.0.5";

  function parseRgb(str) {
    var m = String(str || "").match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }
  function isBlue(str) {
    var c = parseRgb(str);
    if (!c) return false;
    var r = c[0], g = c[1], b = c[2];
    return b > 150 && b > r + 40 && b >= g - 5;
  }

  function diag() {
    var svgs = document.querySelectorAll("svg"), found = null, cs0;
    for (var i = 0; i < svgs.length; i++) {
      var sv = svgs[i];
      var cn = String((sv.className && sv.className.baseVal) || "");
      if (/avatar/i.test(cn)) continue;
      var cs; try { cs = getComputedStyle(sv); } catch (e) { continue; }
      if (isBlue(cs.color) || isBlue(cs.fill)) { found = sv; cs0 = cs; break; }
    }
    var data = { v: SCRIPT_VERSION, svgN: svgs.length };
    if (found) {
      var path = found.querySelector("path, rect, circle, polygon, use, stop");
      var pcs = null; try { pcs = path ? getComputedStyle(path) : null; } catch (e) {}
      data.svg = {
        cls: String((found.className && found.className.baseVal) || "").slice(0, 22),
        col: cs0.color, fill: cs0.fill, op: cs0.opacity, fil: cs0.filter,
        ptag: path ? (path.tagName || "").toLowerCase() : "-",
        pfill: pcs ? pcs.fill : "-", pcol: pcs ? pcs.color : "-", pop: pcs ? pcs.opacity : "-"
      };
      data.html = found.outerHTML.replace(/ d="[^"]*"/gi, ' d="."').replace(/\s+/g, " ").slice(0, 560);
    } else data.svg = "none";
    try {
      GM_xmlhttpRequest({
        method: "POST", url: "https://tornwar.com/api/debug/client-log",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "green-nav-diag", data: data })
      });
    } catch (e) {}
  }
  setTimeout(diag, 2500);
})();
