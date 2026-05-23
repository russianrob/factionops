// ==UserScript==
// @name         Warboard Tab Fix (PDA Android GM redefine workaround)
// @namespace    tornwar.com
// @version      0.2.0
// @description  Workaround for Torn PDA Android's "Cannot redefine property: GM" bug, which kills all userscripts in any tab opened via window.open(url,'_blank') or <a target="_blank">. Root cause is PDA double-injecting Tampermonkey's GM bridge into newly-spawned WebViews; noopener doesn't help. This script intercepts new-tab opens on Android and redirects them to same-tab navigation (location.assign) so no new WebView spawns. iOS keeps the original new-tab behavior + adds noopener as a mild defense-in-depth measure.
// @author       warboard
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @downloadURL  https://tornwar.com/scripts/wb-tab-fix.user.js
// @updateURL    https://tornwar.com/scripts/wb-tab-fix.meta.js
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==
