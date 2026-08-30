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
