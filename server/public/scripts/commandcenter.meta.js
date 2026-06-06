// ==UserScript==
// @name         CommandCenter - Faction War Coordinator
// @namespace    https://tornwar.com
// @version      4.9.28
// @description  Real-time faction war coordination tool for Torn.com (CommandCenter build).
// @author       RussianRob
// @license      MIT (code) — FactionOps™ / CommandCenter™ names are unregistered trademarks of RussianRob; brand use requires permission
// @downloadURL  https://tornwar.com/scripts/commandcenter.user.js
// @updateURL    https://tornwar.com/scripts/commandcenter.meta.js
// @require      https://tornwar.com/socket.io/socket.io.js
// @match        https://www.torn.com/factions.php?step=your*
// @match        https://www.torn.com/factions.php?step=profile*
// @match        https://www.torn.com/loader.php?sid=attack*
// @match        https://torn.com/loader.php?sid=attack*
// @match        https://www.torn.com/page.php?sid=attack*
// @match        https://torn.com/page.php?sid=attack*
// @match        https://www.torn.com/profiles.php?XID=*
// @match        https://torn.com/profiles.php?XID=*
// @match        https://www.torn.com/war.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      tornwar.com
// @connect      localhost
// @connect      *
// @run-at       document-idle
// ==/UserScript==
