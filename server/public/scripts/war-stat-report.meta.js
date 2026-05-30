// ==UserScript==
// @name         War Stat Report
// @namespace    tornwar.com
// @version      0.1.8
// @description  Adds an "Enemy Stat Report" button on the faction page: scans the last 24h of your faction's attack log, keeps attacks by the war-opponent faction, and reports how many were made by enemies with FFScouter-estimated stats of 3B or more. By RussianRob.
// @author       RussianRob
// @match        https://www.torn.com/factions.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @connect      api.torn.com
// @connect      ffscouter.com
// @downloadURL  https://tornwar.com/scripts/war-stat-report.user.js
// @updateURL    https://tornwar.com/scripts/war-stat-report.meta.js
// ==/UserScript==
