// ==UserScript==
// @name         Torn Flyout Diag
// @namespace    RussianRob
// @version      0.1.0
// @author       RussianRob
// @description  Temporary diagnostic - logs every time Torn's fly-out menu opens, asks whether all its icons drew, and tries one candidate fix per open, to find why the icons go missing on iPhone. Safe to remove once the cause is found.
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @connect      tornwar.com
// @run-at       document-start
// @downloadURL  https://tornwar.com/scripts/torn-flyout-diag.user.js
// @updateURL    https://tornwar.com/scripts/torn-flyout-diag.meta.js
// ==/UserScript==
