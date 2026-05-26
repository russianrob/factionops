// ==UserScript==
// @name         Torn Auto Gym (warboard fork)
// @namespace    tornwar.com
// @version      1.2.4-wb10
// @description  Fork of Stephen Lynx's Auto Gym Switch. v1.2.4-wb10: fix "args[0].indexOf is not a function" crash when navigating to non-gym pages (PDA keeps the fetch hook live across SPA navigation, and other pages pass Request objects to fetch instead of string URLs).
// @author       Stephen Lynx (warboard maintains fork)
// @license      MIT
// @match        https://www.torn.com/gym.php*
// @match        https://pda.torn.com/gym.php*
// @downloadURL  https://tornwar.com/scripts/torn-auto-gym.user.js
// @updateURL    https://tornwar.com/scripts/torn-auto-gym.meta.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
