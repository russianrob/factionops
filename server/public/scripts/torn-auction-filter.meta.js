// ==UserScript==
// @name         Torn Auction Filter
// @namespace    tornwar.com
// @version      0.6.0
// @description  Filter Torn auction house by rarity (Yellow / Orange / Red), category (Primary / Secondary / Melee), and name. v0.6.0: "Show all" button fetches every auction via Torn API v2 and renders a compact panel — every row is a matching item, no half-empty pages. Reuses the rw-pricer API key if one is saved; otherwise click ⚙ to set one.
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
