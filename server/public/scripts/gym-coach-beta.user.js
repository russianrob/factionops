// ==UserScript==
// @name         Gym Coach Beta
// @namespace    RussianRob
// @version      0.10.0
// @description  Retired — the beta graduated into Gym Coach 0.11.0. This build does nothing; please uninstall it.
// @author       RussianRob
// @license      MIT
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/gym-coach-beta.user.js
// @updateURL    https://tornwar.com/scripts/gym-coach-beta.user.js
// ==/UserScript==

// The beta lane is closed. Everything in it shipped as Gym Coach 0.11.0.
//
// This file is a stub rather than a deletion, because deleting it would leave
// every beta tester running 0.9.91 forever: Tampermonkey only replaces what it
// can still fetch, and a 404 is not an update. They update INTO this, which
// does nothing, and the two scripts stop fighting.
//
// They would otherwise fight properly. 0.11.0 IS this code, sharing the same
// gcb_v1 storage and drawing the same overlay at the same badge positions —
// two instances racing over one namespace, which reads as the script having
// uninstalled itself rather than as a duplicate.
//
// Storage is deliberately untouched. gcb_v1 now belongs to 0.11.0, and a stub
// that tidied up after itself would delete the ledger the real script just
// inherited.
(function () {
  "use strict";
  try { console.log("[Gym Coach Beta] retired — this shipped as Gym Coach 0.11.0. Uninstall this script."); } catch (_) {}

  // Said once per browser, not once per page load. A banner on every Torn page
  // is its own kind of broken, and the person who needs telling only needs
  // telling once.
  var FLAG = "gcb_retired_notice_v1";
  try { if (localStorage.getItem(FLAG)) return; } catch (_) { return; }

  function notice() {
    try {
      localStorage.setItem(FLAG, "1");
      var d = document.createElement("div");
      d.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:18px;"
        + "z-index:2147483647;max-width:92vw;background:#14100e;color:#ffd9c9;"
        + "border:1px solid rgba(253,203,110,.6);border-radius:8px;padding:10px 13px;"
        + "font:600 12px/1.4 Arial,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.6)";
      d.textContent = "Gym Coach Beta has graduated into Gym Coach 0.11.0 — "
        + "your settings and ledger came with it. You can uninstall the beta.";
      document.body.appendChild(d);
      setTimeout(function () { try { d.remove(); } catch (_) {} }, 20000);
    } catch (_) { /* a farewell note must never throw */ }
  }

  if (document.body) notice();
  else document.addEventListener("DOMContentLoaded", notice);
})();
