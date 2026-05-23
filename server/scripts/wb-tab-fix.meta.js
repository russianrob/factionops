// ==UserScript==
// @name         Warboard Tab Fix (PDA Android GM redefine workaround)
// @namespace    tornwar.com
// @version      0.1.0
// @description  Fix Torn PDA Android's "Uncaught TypeError: Cannot redefine property: GM" bug that breaks all userscripts in any tab opened via window.open(url,'_blank') or <a target="_blank">. Patches both APIs to add noopener so the new tab gets a fresh top-level context and Tampermonkey can inject cleanly. Harmless no-op on iOS (WKWebView already isolates child WebContents); active fix on Android/Chromium WebView.
// @author       warboard
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @downloadURL  https://tornwar.com/scripts/wb-tab-fix.user.js
// @updateURL    https://tornwar.com/scripts/wb-tab-fix.meta.js
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==
