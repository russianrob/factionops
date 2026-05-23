// ==UserScript==
// @name         Warboard Tab Fix (PDA Android GM redefine workaround)
// @namespace    tornwar.com
// @version      0.3.0
// @description  Suppress "Cannot redefine property: GM" errors on Torn PDA Android caused by PDA double-injecting userscript bundles into the same page. Patches Object.defineProperty at document-start so the second GM redefine silently no-ops instead of throwing — downstream scripts then continue past the failure point. Also logs run counts + suppressed redefines to console so you can see what's happening.
// @author       warboard
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @downloadURL  https://tornwar.com/scripts/wb-tab-fix.user.js
// @updateURL    https://tornwar.com/scripts/wb-tab-fix.meta.js
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==
