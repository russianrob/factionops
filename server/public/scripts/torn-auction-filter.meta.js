// ==UserScript==
// @name         Torn Auction Filter
// @namespace    tornwar.com
// @version      0.6.1
// @description  Filter Torn auction house by rarity (Yellow / Orange / Red), category (Primary / Secondary / Melee), and name. v0.6.1: diagnostic — logs raw API response and shows a rarity breakdown in the panel header so we can pin down why filters return 0. Reuses the rw-pricer API key.
// @author       warboard
// @match        https://www.torn.com/amarket*
// @match        https://www.torn.com/page.php?sid=auctionHouse*
// @match        https://pda.torn.com/amarket*
// @match        https://pda.torn.com/page.php?sid=auctionHouse*
// @downloadURL  https://tornwar.com/scripts/torn-auction-filter.user.js
// @updateURL    https://tornwar.com/scripts/torn-auction-filter.meta.js
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==
