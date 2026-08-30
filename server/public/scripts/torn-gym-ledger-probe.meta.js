// ==UserScript==
// @name         Gym Ledger Probe
// @namespace    RussianRob
// @version      1.0.0
// @description  One-shot diagnostic: dumps Gym Coach's own energy ledger so an impossible "Missed today" or a "Spent attacking" figure that is not a whole number of attacks can be traced to the entry that produced it. Reads local storage only, no network at all.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/gym.php*
// @match        https://www.torn.com/page.php?sid=gym*
// @grant        GM_getValue
// @grant        GM_setClipboard
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/torn-gym-ledger-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-gym-ledger-probe.user.js
// ==/UserScript==
