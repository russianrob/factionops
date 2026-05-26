// ==UserScript==
// @name         Torn Auto Gym (warboard fork)
// @namespace    tornwar.com
// @version      1.2.4-wb1
// @description  Fork of Stephen Lynx's Auto Gym Switch (Greasy Fork 480060). Only changes from upstream: UI elements dedup themselves on each runRatioCheck so PDA's repeated script loads don't stack 2-3 copies of the dropdowns and disable checkbox. Math, fetch hook, gym table, and all other behavior preserved.
// @author       Stephen Lynx (warboard maintains fork)
// @license      MIT
// @match        https://www.torn.com/gym.php*
// @match        https://pda.torn.com/gym.php*
// @downloadURL  https://tornwar.com/scripts/torn-auto-gym.user.js
// @updateURL    https://tornwar.com/scripts/torn-auto-gym.meta.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
var lynx = {};

