// ==UserScript==
// @name         FFS Cache Bug Repro
// @namespace    RussianRob
// @version      1.0.0
// @description  Standalone, on-demand reproduction of the FFS banner IndexedDB bug: a WebView silently closes the cache connection, the old read pattern hangs forever (estimates blank), the reopen-retry fix recovers. Builds its own throwaway DB — does NOT touch the real FFS banner. Tap the buttons in order.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
