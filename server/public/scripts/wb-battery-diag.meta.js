// ==UserScript==
// @name         Warboard Battery Diag
// @namespace    tornwar.com
// @version      0.2.9
// @description  Live overlay of what's consuming CPU/network inside the WebView — fetch / XHR / GM_xhr counts by host + caller, mutation rate, setInterval handles, page nav rate, plus per-key api.torn.com req/min. Diagnostic only, no side effects.
// @author       warboard
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @downloadURL  https://tornwar.com/scripts/wb-battery-diag.user.js
// @updateURL    https://tornwar.com/scripts/wb-battery-diag.meta.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// @connect      tornwar.com
// ==/UserScript==
