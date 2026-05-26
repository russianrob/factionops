// ==UserScript==
// @name         Torn Specialist Gyms (DEV)
// @namespace    tornwar.com/dev
// @version      0.2.6
// @description  DEV FORK. v0.2.6: ROOT CAUSE of captcha — our changeGym URL was missing the rfcv (request verification) token Torn requires. Extract rfcv from the live train URL and reuse it on changeGym; fall back to Torn's getAction helper if available. Should fix autoswitch end-to-end.
// @author       warboard
// @match        https://www.torn.com/gym.php*
// @match        https://pda.torn.com/gym.php*
// @downloadURL  https://tornwar.com/scripts/torn-specialist-gyms-dev.user.js
// @updateURL    https://tornwar.com/scripts/torn-specialist-gyms-dev.meta.js
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

