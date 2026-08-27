// ==UserScript==
// @name         Gym Unlock Probe
// @namespace    RussianRob
// @version      1.2.0
// @description  One-shot diagnostic: dumps whatever gym.php knows about gym unlock progress, so a "how much energy until the next gym" estimate can be built on real fields instead of guesses. Read-only, no network of its own.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/gym.php*
// @match        https://www.torn.com/page.php?sid=gym*
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/torn-gym-unlock-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-gym-unlock-probe.user.js
// ==/UserScript==
