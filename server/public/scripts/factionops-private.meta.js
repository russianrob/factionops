// ==UserScript==
// @name         FactionOps Private — war-page call markers
// @namespace    RussianRob.factionops.private
// @version      5.4.4
// @description  Private build: marks war-page rows whose target is already called, without opening the overlay. Run this OR the public FactionOps, not both.
// @author       RussianRob
// @license      MIT (code) — FactionOps™ name and logo are unregistered trademarks of RussianRob; brand use requires permission
// @downloadURL  https://tornwar.com/scripts/factionops-private.user.js
// @updateURL    https://tornwar.com/scripts/factionops-private.meta.js
// @match        https://www.torn.com/factions.php?step=your*
// @match        https://www.torn.com/factions.php?step=profile*
// @match        https://www.torn.com/loader.php?sid=attack*
// @match        https://torn.com/loader.php?sid=attack*
// @match        https://www.torn.com/page.php?sid=attack*
// @match        https://torn.com/page.php?sid=attack*
// @match        https://www.torn.com/profiles.php?XID=*
// @match        https://torn.com/profiles.php?XID=*
// @match        https://www.torn.com/war.php*
// War chat lives in Torn's chat dock, which is on EVERY page — so the script
// has to run everywhere to put a button there. detectPageAndInit's existing
// "unknown page" branch already handles this safely; see the gate in it.
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      tornwar.com
// @connect      localhost
// @connect      *
// @run-at       document-idle
// ==/UserScript==
