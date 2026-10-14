// ==UserScript==
// @name         Torn Chat Probe
// @namespace    RussianRob
// @version      1.0.0
// @description  One-shot diagnostic: reports the STRUCTURE of Torn chat messages so we can tell whether a message carries a stable id worth anchoring an emoji reaction to. Reports no message text at all.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-chat-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-chat-probe.meta.js
// ==/UserScript==
