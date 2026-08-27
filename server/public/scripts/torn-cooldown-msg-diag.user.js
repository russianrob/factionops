// ==UserScript==
// @name         Cooldown Message Diag
// @namespace    RussianRob
// @version      1.0.1
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
// v1.0.1  - Find the TEXT NODE holding "cooldown of" and report its parent,
//           instead of any element whose subtree contains the phrase — the old
//           test bounded child COUNT, not size, so it matched the whole items
//           list. Also drops the bulky outer HTML that was overrunning the 4kb
//           endpoint cap and truncating the useful fields away.
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

  // Walk TEXT NODES, not elements. The previous version tested every div/p/span
  // for a subtree containing "cooldown of" and bounded it by child COUNT, which
  // does not bound SIZE — so it matched the entire items list and reported a
  // kilobyte of unrelated markup. The text node's parent is the smallest element
  // that actually holds the sentence.
  function findCooldownParent() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      if (/cooldown of/i.test(n.nodeValue || "")) return n.parentElement;
    }
    return null;
  }

  function scan() {
    if (reported) return;
    var el = findCooldownParent();
    if (!el) return;
    reported = true;

    // Siblings matter: Torn's duration usually sits in an element NEXT TO the
    // text node, not inside it.
    var parent = el.parentElement || el;
    var sibs = [];
    try {
      var ch = parent.children;
      for (var i = 0; i < ch.length && i < 10; i++) sibs.push(describe(ch[i]));
    } catch (e) {}

    var portals = [];
    try {
      var ps = document.querySelectorAll('[role=tooltip],[class*="tooltipContent"],[class*="tooltipText"],[class*="tooltipActivator"],[class*="tooltipWrap"]');
      for (var q = 0; q < ps.length && q < 6; q++) portals.push(describe(ps[q]));
    } catch (e) {}

    post({
      // Just the sentence, trimmed tight — enough to confirm we found the right node.
      text: (el.textContent || "").trim().slice(-120),
      // The element itself, small by construction now.
      self: describe(el),
      // Its siblings: the likeliest home of the duration.
      siblings: sibs,
      portals: portals
    });
  }

  scan();
  var obs = new MutationObserver(scan);
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });

  // The message only appears on a use; stop watching after a few minutes so an
  // idle item.php tab isn't running an observer forever.
  setTimeout(function () { obs.disconnect(); }, 10 * 60 * 1000);
})();
