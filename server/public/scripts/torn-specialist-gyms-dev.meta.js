// ==UserScript==
// @name         Torn Specialist Gyms (DEV)
// @namespace    tornwar.com/dev
// @version      0.2.1
// @description  DEV FORK of Torn Specialist Gyms. Adds locked-gyms unlock-progress list + optional auto-switch to best gym before training. v0.2.1: fix auto-switch by patching fetch at document-start via unsafeWindow (Torn was capturing fetch reference before our late hook landed).
// @author       warboard
// @match        https://www.torn.com/gym.php*
// @match        https://pda.torn.com/gym.php*
// @downloadURL  https://tornwar.com/scripts/torn-specialist-gyms-dev.user.js
// @updateURL    https://tornwar.com/scripts/torn-specialist-gyms-dev.meta.js
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

