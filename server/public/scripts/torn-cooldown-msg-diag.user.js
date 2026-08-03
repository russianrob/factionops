// ==UserScript==
// @name         Cooldown Message Diag
// @namespace    RussianRob
// @version      1.0.0
// @author       RussianRob
// @description  Temporary diagnostic — reports how Torn renders the cooldown duration in the item-use message, which shows up blank on mobile. Safe to remove once the cause is found.
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/item.php*
// @match        https://pda.torn.com/item.php*
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-cooldown-msg-diag.user.js
// @updateURL    https://tornwar.com/scripts/torn-cooldown-msg-diag.meta.js
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - Initial release. Captures the item-use result message the moment it
//           appears and reports its markup, so the missing cooldown duration can
//           be traced without spending another item to reproduce it.
// =============================================================================

(function () {
  "use strict";

  var DIAG_URL = "https://tornwar.com/api/debug/client-log";
  var sent = 0, MAX = 6;

  // The endpoint caps bodies at 4kb, so everything below is budgeted tightly.
  function post(payload) {
    if (sent >= MAX) return;
    sent++;
    try {
      GM_xmlhttpRequest({
        method: "POST", url: DIAG_URL,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "cooldown-msg-diag", data: payload })
      });
    } catch (e) {}
  }

  function clean(html) {
    return String(html)
      .replace(/<svg[\s\S]*?<\/svg>/gi, "<svg/>")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\s+/g, " ").trim();
  }

  function describe(el) {
    var attrs = [];
    try {
      var names = el.getAttributeNames();
      for (var i = 0; i < names.length && i < 8; i++) {
        attrs.push(names[i] + "=" + String(el.getAttribute(names[i])).slice(0, 60));
      }
    } catch (e) {}
    return {
      tag: el.tagName,
      cls: String(el.className || "").slice(0, 80),
      text: (el.textContent || "").trim().slice(0, 60),
      attrs: attrs
    };
  }

  var reported = false;

  // The message is transient and is re-rendered by Torn's React tree, so poll
  // via MutationObserver rather than looking once at load.
  function scan() {
    if (reported) return;
    var all = document.querySelectorAll("div, p, span");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length > 12) continue;
      var txt = el.textContent || "";
      if (!/cooldown of/i.test(txt)) continue;

      reported = true;
      var kids = [];
      try {
        var ks = el.querySelectorAll("*");
        for (var k = 0; k < ks.length && k < 12; k++) kids.push(describe(ks[k]));
      } catch (e) {}

      // Torn portals its tooltip bodies elsewhere in the DOM, so grab those too.
      var portals = [];
      try {
        var ps = document.querySelectorAll('[role=tooltip],[class*="tooltipContent"],[class*="tooltipText"],[class*="tooltipActivator"]');
        for (var p = 0; p < ps.length && p < 6; p++) portals.push(describe(ps[p]));
      } catch (e) {}

      post({
        msgText: txt.trim().slice(-180),
        msgHTML: clean(el.innerHTML).slice(-1200),
        kids: kids,
        portals: portals
      });
      return;
    }
  }

  scan();
  var obs = new MutationObserver(scan);
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });

  // The message only appears on a use; stop watching after a few minutes so an
  // idle item.php tab isn't running an observer forever.
  setTimeout(function () { obs.disconnect(); }, 10 * 60 * 1000);
})();
