// ==UserScript==
// @name         Torn Xanax Reminder
// @namespace    RussianRob
// @version      1.0.0
// @description  A Xanax icon in Torn's row of status icons as soon as your drug cooldown is over. Tap it to open your items on the Drugs tab. With a Public API key, in the 24 hours before your faction's next ranked war, the tap lets you pick the faction armoury or your items.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-xanax-reminder.user.js
// @updateURL    https://tornwar.com/scripts/torn-xanax-reminder.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. A Xanax icon in Torn's row of status icons as soon as your
//           drug cooldown is over, read from Torn's own sidebar data. A tap opens your
//           items on the Drugs tab. With an API key, in the 24 hours before your
//           faction's next ranked war, the tap lets you pick the armoury or your items.

(function () {
  'use strict';

  const VERSION = '1.0.0';

  // Loaded twice on one page (two copies installed, or PDA injecting it again), it runs once.
  // The mark goes on the page itself, which every copy can see; each copy may have its own window.
  const root = document.documentElement;
  if (root.hasAttribute('data-tm-xanax-reminder')) return;
  root.setAttribute('data-tm-xanax-reminder', VERSION);

  const ICON_ID = 'tm-xanax-reminder';
  const STYLE_ID = 'tm-xanax-reminder-styles';
  // The Blood Bag Reminder's icon. When it is in the row, the Xanax goes right after it.
  const BLOODBAG_ID = 'tm-full-life-bloodbag';
  // Torn's own Xanax picture (item 206). It is 100 x 50.
  const XANAX_PNG = 'https://www.torn.com/images/items/206/large.png';
  const ITEMS_URL = 'https://www.torn.com/item.php#drugs-items';
  // The row of status icons. Torn's old sidebar calls it status-icons___ and the Fly-out
  // Sidebar statusIcons___. Only inside #sidebar: Torn's header menu is a list too, and it
  // comes first on every page.
  const ROW_SELECTOR = '#sidebar ul[class*="status-icons"], #sidebar ul[class*="statusIcons___"]';
  const POLL_MS = 2000;
  const LABEL = 'Drug cooldown over: Xanax ready';

  // ===== TORN'S SIDEBAR DATA =====

  // statusIcons.icons from the data both of Torn's sidebars save to sessionStorage on every
  // change. null when the data isn't there, won't parse or has no icons: some pages have no
  // sidebar, and "no data" must never read as "no cooldown".
  function readIcons() {
    try {
      const key = Object.keys(sessionStorage).find((k) => /^sidebarData\d+$/.test(k));
      if (!key) return null;
      const data = JSON.parse(sessionStorage.getItem(key));
      const icons = data && data.statusIcons && data.statusIcons.icons;
      return icons && typeof icons === 'object' ? icons : null;
    } catch (e) {
      return null;
    }
  }

  // True when no drug cooldown entry is still running. An entry is the drug cooldown by its
  // key or by its title (Torn's API calls it "Drug Cooldown"). One without a readable end
  // time counts as running.
  function cooldownOver(icons, nowS) {
    return !Object.keys(icons).some((k) => {
      const entry = icons[k];
      if (!entry || typeof entry !== 'object') return false;
      if (k !== 'drug_cooldown' && !/^drug cooldown/i.test(String(entry.title || ''))) return false;
      const end = Number(entry.timerExpiresAt);
      return !(end > 0) || end > nowS;
    });
  }

  // ===== THE ICON =====

  // The icon's li. It is built once and put back whenever Torn redraws the row.
  let icon = null;

  function buildIcon() {
    const li = document.createElement('li');
    li.id = ICON_ID;
    const a = document.createElement('a');
    a.href = ITEMS_URL;
    const img = document.createElement('img');
    img.src = XANAX_PNG;
    img.alt = 'Xanax';
    img.width = 17;
    img.height = 17;
    a.appendChild(img);
    li.appendChild(a);
    return li;
  }

  // First in the row, or right after the blood bag's icon when that is in the row. The blood
  // bag puts itself first, so the order is the same whichever script adds its icon first.
  function place(row) {
    const bag = document.getElementById(BLOODBAG_ID);
    if (bag && bag.parentNode === row) bag.after(icon);
    else row.insertBefore(icon, row.firstChild);
  }

  function removeIcon() {
    if (icon && icon.parentNode) icon.remove();
  }

  // The icon's label, line by line: for the tooltip, and joined for screen readers.
  function labelLines() {
    return [LABEL];
  }

  function setLabel(lines) {
    const a = icon.firstChild;
    const text = lines.join('. ');
    if (a.getAttribute('aria-label') !== text) a.setAttribute('aria-label', text);
  }

  // ===== STYLES =====

  const ICON_CSS = [
    // Torn's desktop row is a fixed-height grid that hides what doesn't fit, and one more
    // icon can need another line. Only Torn's row, inside #sidebar.
    ROW_SELECTOR + ' { height: auto !important; overflow: visible !important; }',
    // Torn draws its own icons with a sprite and pseudo-elements; none of that on this one.
    '#' + ICON_ID + ', #' + ICON_ID + ' a, #' + ICON_ID + ' img { background: none !important; -webkit-mask: none !important; mask: none !important; box-shadow: none !important; border: none !important; }',
    '#' + ICON_ID + '::before, #' + ICON_ID + '::after, #' + ICON_ID + ' a::before, #' + ICON_ID + ' a::after { content: none !important; }',
    // One pulse when the icon is added.
    '#' + ICON_ID + ' { animation: tm-xanax-pulse 900ms ease-out 1; }',
    '@keyframes tm-xanax-pulse { 0% { transform: scale(0.9); } 60% { transform: scale(1.1); } 100% { transform: scale(1); } }',
    '#' + ICON_ID + ' a { display: block; width: 17px; height: 17px; }',
    // The 100 x 50 picture fits the 17 x 17 box as a pill, with a thin dark edge so it shows
    // in light mode. No max-width or max-height, so no page style can shrink it.
    '#' + ICON_ID + ' img { display: block; width: 17px; height: 17px; max-width: none; max-height: none; object-fit: contain; filter: drop-shadow(0 0 .6px rgba(0,0,0,.85)); }',
  ].join('\n');

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ICON_CSS;
    (document.head || root).appendChild(style);
  }

  // ===== THE CHECK =====

  // Every 2 seconds: is the drug cooldown over, and is the icon where it belongs? The row is
  // found afresh each time, so the icon follows Torn when it redraws the sidebar.
  function check() {
    try {
      const nowMs = Date.now();
      const icons = readIcons();
      const row = icons ? document.querySelector(ROW_SELECTOR) : null;
      if (!row || !cooldownOver(icons, nowMs / 1000)) {
        removeIcon();
        return;
      }
      ensureStyles();
      if (!icon) icon = buildIcon();
      if (icon.parentNode !== row) place(row);
      setLabel(labelLines());
    } catch (e) {
      // A bad value stops this one check. It never reaches Torn's page.
    }
  }

  // ===== START =====

  setInterval(check, POLL_MS);
  check();
  console.log('[Torn Xanax Reminder ' + VERSION + '] running');
})();
