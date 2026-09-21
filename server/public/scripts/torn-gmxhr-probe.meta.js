// ==UserScript==
// @name         GM XHR Probe
// @namespace    RussianRob
// @version      1.0.0
// @description  Diagnoses why a userscript's cross-origin calls fail in a given runtime — reports whether GM_xmlhttpRequest exists at injection time, then races it against a page-context fetch to the same host
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      api.kalends.dev
// @connect      ffscouter.com
// @downloadURL  https://tornwar.com/scripts/torn-gmxhr-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-gmxhr-probe.meta.js
// ==/UserScript==
