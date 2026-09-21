// ==UserScript==
// @name         GM XHR Tracer
// @namespace    RussianRob
// @version      1.0.0
// @description  Wraps GM_xmlhttpRequest and records every call another userscript makes through it — method, URL, headers, body and outcome — so a failing request can be read instead of guessed at
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        GM_setClipboard
// ==/UserScript==
