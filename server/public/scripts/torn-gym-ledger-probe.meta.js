// ==UserScript==
// @name         Gym Ledger Probe
// @namespace    RussianRob
// @version      1.1.0
// @description  One-shot diagnostic: dumps Gym Coach's own energy ledger so an impossible "Missed today" or a "Spent attacking" figure can be traced to the entry that produced it, and reports which API endpoints your key can actually reach.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/gym.php*
// @match        https://www.torn.com/page.php?sid=gym*
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/torn-gym-ledger-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-gym-ledger-probe.user.js
// ==/UserScript==
