// ==UserScript==
// @name         Torn Profile Link Formatter
// @namespace    GNSC4 [268863]
// @version      3.6.44
// @description  Copy formatted Torn profile/faction links. Uses BSP prediction TBS when available, falls back to FF Scouter V2 estimated stats. Strips BSP TBS prefixes from copied names, dedupes lines by ID, and uses war JSON faction IDs so your faction (Dead Fragment 42055) is always separated from the enemy in ranked wars. Faction copy includes member level and Xanax taken (via API or Xanax Viewer cache).
// @author       GNSC4
// @match        https://www.torn.com/profiles.php?XID=*
// @match        https://www.torn.com/factions.php*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.torn.com
// @downloadURL  https://tornwar.com/scripts/torn-profile-link-formatter.user.js
// @updateURL    https://tornwar.com/scripts/torn-profile-link-formatter.meta.js
