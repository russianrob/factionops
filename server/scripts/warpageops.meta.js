// ==UserScript==
// @name         WarPageOps (fork — solo test branch)
// @namespace    tornwar.com/warpageops
// @version      0.1.0
// @description  Real-time faction war coordination tool for Torn.com
// @author       RussianRob
// @copyright    2024-2026, RussianRob (https://tornwar.com)
// @license      MIT (code) — FactionOps™ name and logo are unregistered trademarks of RussianRob; brand use requires permission
// @downloadURL  https://tornwar.com/scripts/warpageops.user.js
// @updateURL    https://tornwar.com/scripts/warpageops.meta.js
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
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @connect      tornwar.com
// @connect      localhost
// @connect      *
// @run-at       document-idle
// ==/UserScript==
