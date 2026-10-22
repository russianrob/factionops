// ==UserScript==
// @name         Torn Xanax Reminder
// @namespace    RussianRob
// @version      1.0.1
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
// v1.0.1  - The menu entry names the script: "Xanax Reminder: Set API key", so it
//           stands out in a menu that lists every script's entries together.
// v1.0.0  - First release. A Xanax icon in Torn's row of status icons as soon as your
//           drug cooldown is over, read from Torn's own sidebar data. A tap opens your
//           items on the Drugs tab. With an API key, in the 24 hours before your
//           faction's next ranked war, the tap lets you pick the armoury or your items.

(function () {
  'use strict';

  const VERSION = '1.0.1';

  // Loaded twice on one page (two copies installed, or PDA injecting it again), it runs once.
  // The mark goes on the page itself, which every copy can see; each copy may have its own window.
  const root = document.documentElement;
  if (root.hasAttribute('data-tm-xanax-reminder')) return;
  root.setAttribute('data-tm-xanax-reminder', VERSION);

  const ICON_ID = 'tm-xanax-reminder';
  const STYLE_ID = 'tm-xanax-reminder-styles';
  const TIP_ID = 'tm-xanax-reminder-tip';
  const CHOICE_ID = 'tm-xanax-reminder-choice';
  const KEYBOX_ID = 'tm-xanax-reminder-key';
  // The Blood Bag Reminder's icon. When it is in the row, the Xanax goes right after it.
  const BLOODBAG_ID = 'tm-full-life-bloodbag';
  // Torn's own Xanax picture (item 206). It is 100 x 50.
  const XANAX_PNG = 'https://www.torn.com/images/items/206/large.png';
  const ITEMS_URL = 'https://www.torn.com/item.php#drugs-items';
  // The faction armoury's Drugs tab.
  const ARMOURY_URL = 'https://www.torn.com/factions.php?step=your&type=1#/tab=armoury&start=0&sub=drugs';
  // The row of status icons. Torn's old sidebar calls it status-icons___ and the Fly-out
  // Sidebar statusIcons___. Only inside #sidebar: Torn's header menu is a list too, and it
  // comes first on every page.
  const ROW_SELECTOR = '#sidebar ul[class*="status-icons"], #sidebar ul[class*="statusIcons___"]';
  const POLL_MS = 2000;
  // A press this long opens the key box, as the blood bag's settings do.
  const LONG_PRESS_MS = 500;
  const LABEL = 'Drug cooldown over: Xanax ready';
  // GM storage: the key from the key box, and what Torn last said about the war.
  const KEY_STORE = 'tm-xanax-reminder-key';
  const WAR_STORE = 'tm-xanax-reminder-war';
  // Torn is asked at most this often, across all tabs.
  const CALL_EVERY_MS = 30 * 60 * 1000;
  // The war window: the 24 hours before the start.
  const WINDOW_S = 24 * 60 * 60;
  // PDA puts your API key in place of this placeholder when it loads the script. The file must
  // hold the placeholder once only: PDA finds it by its text, and a second copy breaks the swap.
  const PDA_KEY = '###PDA-APIKEY###';
  // Still the placeholder (it has the #s) means PDA didn't swap it, or this isn't PDA.
  const HAS_PDA_KEY = PDA_KEY.indexOf('##') === -1 && PDA_KEY.length > 8;

  // ===== GM STORAGE =====

  // Every GM_* call is guarded, because hosts differ in what they give a script. Values are
  // stored as strings, because PDA hands stored values back as strings.
  function gmGet(name) {
    try {
      return typeof GM_getValue === 'function' ? GM_getValue(name, '') : '';
    } catch (e) {
      return '';
    }
  }

  // True when the value was saved. A full localStorage, where PDA keeps GM values, throws.
  function gmSet(name, value) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(name, value);
        return true;
      }
    } catch (e) {
      // Not saved: the caller decides what to do without it.
    }
    return false;
  }

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

  // ===== THE WAR TIME =====

  // The key for Torn's API: one saved in the key box beats the one PDA gives. '' means none.
  function apiKey() {
    const saved = gmGet(KEY_STORE);
    if (typeof saved === 'string' && saved.trim()) return saved.trim();
    return HAS_PDA_KEY ? PDA_KEY : '';
  }

  // What Torn last said about your faction's ranked war, shared by every tab: at = when a tab
  // last asked (ms), start and end = the war's times (Unix seconds, 0 for none), error = why
  // the last ask failed ('' if it didn't).
  function readWar() {
    const shared = parseWar(gmGet(WAR_STORE));
    // The tab's own copy, kept only while storage won't save (see writeWar). It wins unless
    // storage holds a newer ask, such as one from another tab.
    let tab = null;
    try {
      const own = sessionStorage.getItem(WAR_STORE);
      if (own) tab = parseWar(own);
    } catch (e) {
      tab = null;
    }
    return tab && tab.at >= shared.at ? tab : shared;
  }

  // A stored war record, read with Number(), as PDA hands back strings. A value that won't
  // parse reads as nothing saved.
  function parseWar(v) {
    try {
      if (typeof v === 'string') v = v ? JSON.parse(v) : null;
    } catch (e) {
      v = null;
    }
    if (!v || typeof v !== 'object') v = {};
    return {
      at: Number(v.at) || 0,
      start: Number(v.start) || 0,
      end: Number(v.end) || 0,
      error: typeof v.error === 'string' ? v.error : '',
    };
  }

  // Storage is shared by every tab. When it won't save (PDA keeps GM values in localStorage,
  // and a full localStorage throws on every write), the record goes into this tab's
  // sessionStorage instead, which lasts from page to page; without it, every page would ask
  // Torn again and lose the answer. Once storage saves again, the tab's copy goes.
  function writeWar(war) {
    const text = JSON.stringify(war);
    const saved = gmSet(WAR_STORE, text);
    try {
      if (saved) sessionStorage.removeItem(WAR_STORE);
      else sessionStorage.setItem(WAR_STORE, text);
    } catch (e) {
      // Without either, askedAt still keeps each page to one ask every 30 minutes.
    }
  }

  // This tab's own last call (ms), or null. It keeps the 30 minutes even when storage won't
  // save: PDA keeps GM values in localStorage, and a full localStorage throws on every write.
  let askedAt = null;

  // Asks Torn about the war, at most once every 30 minutes across all tabs. The time goes into
  // storage before the call, so another tab sees it and waits. Only called while the icon shows.
  function maybeAsk(nowMs) {
    const key = apiKey();
    if (!key) return;
    const war = readWar();
    // A saved time in the future means the clock moved back: ask now rather than wait for it.
    if (war.at <= nowMs && nowMs - war.at < CALL_EVERY_MS) return;
    if (askedAt !== null && askedAt <= nowMs && nowMs - askedAt < CALL_EVERY_MS) return;
    askedAt = nowMs;
    war.at = nowMs;
    writeWar(war);
    askTorn(key).then((ranked) => {
      const now = readWar();
      now.start = ranked ? Number(ranked.start) || 0 : 0;
      now.end = ranked ? Number(ranked.end) || 0 : 0;
      now.error = '';
      writeWar(now);
    }, (message) => {
      // Keep the last good answer, and say why this one failed.
      const now = readWar();
      now.error = message;
      writeWar(now);
    });
  }

  // GET your faction's wars. Resolves with wars.ranked (null when no ranked war is set), or
  // rejects with words for the tooltip: Torn's own error text, or a fixed message. The key is
  // in the request and nowhere else.
  function askTorn(key) {
    const url = 'https://api.torn.com/v2/faction/wars?key=' + encodeURIComponent(key) + '&comment=xanax-reminder';
    return new Promise((resolve, reject) => {
      const answered = (text) => {
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          reject('no answer from Torn');
          return;
        }
        if (data && data.error) {
          reject(hideKey(String(data.error.error || 'error ' + data.error.code), key));
        } else if (data && data.wars && typeof data.wars === 'object') {
          resolve(data.wars.ranked && typeof data.wars.ranked === 'object' ? data.wars.ranked : null);
        } else {
          reject('unexpected answer from Torn');
        }
      };
      const failed = () => reject('no answer from Torn');
      // GM_xmlhttpRequest where the host has it: it isn't held to the page's rules on what the
      // page may fetch. fetch where it doesn't.
      if (typeof GM_xmlhttpRequest === 'function') {
        try {
          GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            anonymous: true,
            timeout: 20000,
            onload: (res) => answered(res && res.responseText != null ? String(res.responseText) : ''),
            onerror: failed,
            ontimeout: failed,
            onabort: failed,
          });
          return;
        } catch (e) {
          // Fall through to fetch.
        }
      }
      try {
        fetch(url, { credentials: 'omit' }).then((res) => res.text()).then(answered, failed);
      } catch (e) {
        failed();
      }
    });
  }

  // Torn's messages don't hold the key, but the tooltip must never show it, so make sure.
  function hideKey(text, key) {
    return text.split(key).join('****');
  }

  // Seconds until the war starts, in the 24 hours before it (start - 24h <= now < start), or 0
  // outside them. Needs a key: without one, the tap always opens your items. A war with an end
  // time is over.
  function warSecondsLeft(nowMs) {
    if (!apiKey()) return 0;
    const war = readWar();
    const nowS = nowMs / 1000;
    if (!(war.start > 0) || war.end > 0) return 0;
    if (nowS < war.start - WINDOW_S || nowS >= war.start) return 0;
    return war.start - nowS;
  }

  // "5h 12m", or "45m" under an hour. Minutes round up, so it never says 0m.
  function untilText(seconds) {
    const mins = Math.max(1, Math.ceil(seconds / 60));
    const h = Math.floor(mins / 60);
    return h > 0 ? h + 'h ' + (mins % 60) + 'm' : mins + 'm';
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
    // The tooltip opens on a mouse hover or on focus, never on a touch. On an iPhone, a page
    // that changes when a finger "hovers" turns the first tap into a hover, and the tap goes
    // nowhere; so there is no mouseenter or mouseover handler at all.
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') showTip();
    });
    a.addEventListener('pointerleave', hideTip);
    a.addEventListener('focus', () => {
      if (keyboardFocus(a)) showTip();
    });
    a.addEventListener('blur', hideTip);
    // The tap, and the long press that opens the key box.
    a.addEventListener('click', onTap);
    a.addEventListener('touchstart', startPress, { passive: true });
    a.addEventListener('touchend', endPress);
    a.addEventListener('touchmove', cancelPress, { passive: true });
    a.addEventListener('touchcancel', cancelPress);
    a.addEventListener('mousedown', startPress);
    a.addEventListener('mouseup', endPress);
    a.addEventListener('mouseleave', cancelPress);
    a.addEventListener('contextmenu', onContextMenu);
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
    hideTip();
    closeChoice();
    if (icon && icon.parentNode) icon.remove();
  }

  // The icon's label, line by line: for the tooltip, and joined for screen readers. With no key
  // there is never a war line or an error line.
  function labelLines(nowMs) {
    const lines = [LABEL];
    const left = warSecondsLeft(nowMs);
    if (left) lines.push('War starts in ' + untilText(left) + ': tap to pick the armoury or your items');
    const error = apiKey() ? readWar().error : '';
    if (error) lines.push('Couldn\'t check the war time: ' + error);
    return lines;
  }

  function setLabel(lines) {
    tipLines = lines;
    const a = icon.firstChild;
    const text = lines.join('. ');
    if (a.getAttribute('aria-label') !== text) a.setAttribute('aria-label', text);
    if (tip) fillTip();
  }

  // ===== THE TOOLTIP =====

  // The open tooltip, if any, and the label it shows, line by line.
  let tip = null;
  let tipLines = [LABEL];

  // A tooltip like Torn's own, over the icon: the first line in bold, the others under it.
  function showTip() {
    if (!icon || !icon.parentNode) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.id = TIP_ID;
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
    }
    fillTip();
  }

  function fillTip() {
    tip.textContent = '';
    tipLines.forEach((line, i) => {
      const el = document.createElement(i === 0 ? 'b' : 'div');
      el.textContent = line;
      tip.appendChild(el);
    });
    placeNear(tip, icon, true);
  }

  function hideTip() {
    if (!tip) return;
    tip.remove();
    tip = null;
  }

  // Focus from the keyboard, not from a tap: on a phone a tap focuses the link too, and the
  // tooltip would linger after it. A browser that can't tell the two apart says yes.
  function keyboardFocus(el) {
    try {
      return el.matches(':focus-visible');
    } catch (e) {
      return true;
    }
  }

  // Puts one of the script's boxes over the icon (above) or under it, inside the screen. With
  // no room above, it goes under. The arrow (a CSS ::after) points at the icon's middle.
  function placeNear(el, anchor, above) {
    try {
      const r = anchor.getBoundingClientRect();
      const width = el.offsetWidth || 0;
      const height = el.offsetHeight || 0;
      const middle = r.left + r.width / 2;
      const left = Math.max(8, Math.min(Math.round(middle - width / 2), (window.innerWidth || 0) - width - 8));
      let top = Math.round(r.top - height - 10);
      const under = !above || top < 8;
      if (under) top = Math.round(r.bottom + 10);
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.setProperty('--tm-xanax-arrow', Math.round(middle - left) + 'px');
      el.classList.toggle('tm-xanax-under', under);
    } catch (e) {
      // It stays where the stylesheet puts it.
    }
  }

  // ===== THE TAP =====

  // The open Armoury/Items box, if any.
  let choice = null;
  // A long press: its timer while the finger is down, and whether it fired, so the tap that
  // ends it goes nowhere.
  let pressTimer = null;
  let longPressed = false;

  // The icon's link opens your items. In the war window the tap opens the box instead, and a
  // second tap closes it. The script never clicks anything itself.
  function onTap(e) {
    if (longPressed) {
      longPressed = false;
      e.preventDefault();
      return;
    }
    if (choice) {
      e.preventDefault();
      closeChoice();
      return;
    }
    const left = warSecondsLeft(Date.now());
    if (!left) return;
    e.preventDefault();
    openChoice(left);
  }

  // A box under the icon: when the war starts, and two plain links, Armoury and Items.
  function openChoice(left) {
    closeChoice();
    hideTip();
    choice = document.createElement('div');
    choice.id = CHOICE_ID;
    const title = document.createElement('b');
    title.textContent = 'War starts in ' + untilText(left);
    choice.appendChild(title);
    [['Armoury', ARMOURY_URL], ['Items', ITEMS_URL]].forEach((pair) => {
      const link = document.createElement('a');
      link.textContent = pair[0];
      link.href = pair[1];
      // Close once the tap has gone through, so the link still opens.
      link.addEventListener('click', () => setTimeout(closeChoice, 0));
      choice.appendChild(link);
    });
    document.body.appendChild(choice);
    placeNear(choice, icon, false);
  }

  function closeChoice() {
    if (!choice) return;
    choice.remove();
    choice = null;
  }

  // Each check: the box closes when the window does, and its time stays current.
  function syncChoice(nowMs) {
    if (!choice) return;
    const left = warSecondsLeft(nowMs);
    if (!left) closeChoice();
    else choice.firstChild.textContent = 'War starts in ' + untilText(left);
  }

  function startPress(e) {
    longPressed = false;
    // A finger, or the main mouse button. A right-click keeps its menu.
    if (e.type === 'mousedown' && e.button !== 0) return;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      pressTimer = null;
      longPressed = true;
      openKeyBox();
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  // On a phone, stopping the touchend of a long press stops its click too.
  function endPress(e) {
    cancelPress();
    if (longPressed && e.cancelable) e.preventDefault();
  }

  // The phone's own long-press menu for links would cover the key box.
  function onContextMenu(e) {
    if (pressTimer || longPressed) e.preventDefault();
  }

  function onPointerDown(e) {
    if (!choice) return;
    if (choice.contains(e.target) || (icon && icon.contains(e.target))) return;
    closeChoice();
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    closeChoice();
    closeKeyBox();
  }

  // A scroll of the page, or of anything that holds the icon, would leave the box and the
  // tooltip behind. Other parts of the page scroll by themselves (a chat keeping up with new
  // messages), and those leave both open.
  function onScroll(e) {
    const target = e && e.target;
    if (target && target.nodeType === 1 && !(icon && target.contains(icon))) return;
    hideTip();
    closeChoice();
  }

  // ===== THE KEY BOX =====

  // Opens from the menu ("Xanax Reminder: Set API key") or a long press on the icon, over
  // everything else. The field is a plain text field (a password field sets off password
  // managers) that starts empty: the saved key is never shown.
  function openKeyBox() {
    closeKeyBox();
    closeChoice();
    hideTip();
    ensureStyles();
    const overlay = document.createElement('div');
    overlay.id = KEYBOX_ID;
    const panel = document.createElement('div');
    panel.className = 'tm-xanax-panel';
    const title = document.createElement('b');
    title.textContent = 'Torn Xanax Reminder';
    const about = document.createElement('p');
    about.textContent = 'With your API key, the script checks when your faction\'s next ranked war starts. '
      + 'In the 24 hours before it, a tap on the icon lets you pick the armoury or your items. '
      + 'A Public-level key is enough.';
    const status = document.createElement('p');
    status.textContent = keyStatus();
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Your API key';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveKey(input.value);
    });
    const buttons = document.createElement('div');
    buttons.className = 'tm-xanax-buttons';
    buttons.appendChild(button('Save', () => saveKey(input.value)));
    buttons.appendChild(button('Clear', () => setKey('')));
    buttons.appendChild(button('Cancel', closeKeyBox));
    [title, about, status, input, buttons].forEach((el) => panel.appendChild(el));
    overlay.appendChild(panel);
    // A tap on the dark area around the box is Cancel.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeKeyBox();
    });
    document.body.appendChild(overlay);
    try {
      input.focus();
    } catch (e) {
      // Some hosts can't focus from here; the field is still there to tap.
    }
  }

  // Whether a key is saved, or PDA's is in use, never the key itself. With a key in use, it
  // also says why the last check failed: on a phone the tooltip never opens, so this is where
  // a bad key shows.
  function keyStatus() {
    const saved = gmGet(KEY_STORE);
    let text = 'No key saved.';
    if (typeof saved === 'string' && saved.trim()) text = 'A key is saved.';
    else if (HAS_PDA_KEY) text = 'Using the key Torn PDA gives the script.';
    const error = apiKey() ? readWar().error : '';
    return error ? text + ' Couldn\'t check the war time: ' + error : text;
  }

  // Save with an empty field changes nothing: only Clear removes a key.
  function saveKey(value) {
    const key = String(value || '').trim();
    if (key) setKey(key);
    else closeKeyBox();
  }

  // Saves the key ('' for none) and forgets what Torn said with the old one, so the next check
  // asks again straight away.
  function setKey(value) {
    gmSet(KEY_STORE, String(value || '').trim());
    writeWar({ at: 0, start: 0, end: 0, error: '' });
    askedAt = null;
    closeKeyBox();
  }

  function button(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function closeKeyBox() {
    const box = document.getElementById(KEYBOX_ID);
    if (box) box.remove();
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

  // Torn's own tooltip look: dark grey, light text, a small arrow at the icon.
  const TIP_CSS = [
    '#' + TIP_ID + ' { position: fixed; z-index: 99999; pointer-events: none; box-sizing: border-box; max-width: 240px; padding: 8px; border-radius: 4px; background: #444; color: #ddd; box-shadow: 0 0 2px 0 rgba(0,0,0,.65); font: 400 12px/14px Arial, sans-serif; text-align: left; }',
    '#' + TIP_ID + ' b { display: block; font-weight: 700; }',
    '#' + TIP_ID + ' div { margin-top: 2px; }',
    '#' + TIP_ID + '::after { content: ""; position: absolute; bottom: -4px; left: var(--tm-xanax-arrow, 50%); width: 8px; height: 8px; margin-left: -4px; background: #444; transform: rotate(45deg); }',
    '#' + TIP_ID + '.tm-xanax-under::after { top: -4px; bottom: auto; }',
  ].join('\n');

  // The Armoury/Items box in Torn's tooltip look, and the key box.
  const BOX_CSS = [
    // No text selection and no iPhone link menu on a long press of the icon.
    '#' + ICON_ID + ' a { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }',
    '#' + CHOICE_ID + ' { position: fixed; z-index: 99999; box-sizing: border-box; padding: 8px; border-radius: 4px; background: #444; color: #ddd; box-shadow: 0 0 2px 0 rgba(0,0,0,.65); font: 400 12px/14px Arial, sans-serif; text-align: center; white-space: nowrap; }',
    '#' + CHOICE_ID + ' b { display: block; margin-bottom: 6px; font-weight: 700; }',
    '#' + CHOICE_ID + ' a { display: inline-block; margin: 0 3px; padding: 6px 12px; border: 1px solid #666; border-radius: 4px; background: #2e2e2e; color: #fff; font-weight: 700; text-decoration: none; }',
    '#' + KEYBOX_ID + ' { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.7); }',
    '#' + KEYBOX_ID + ' .tm-xanax-panel { box-sizing: border-box; width: 320px; max-width: calc(100vw - 32px); padding: 14px; border-radius: 8px; background: #2e2e2e; color: #ddd; font: 400 13px/17px Arial, sans-serif; text-align: left; }',
    '#' + KEYBOX_ID + ' p { margin: 8px 0; }',
    // 16px, or an iPhone zooms in when the field is tapped.
    '#' + KEYBOX_ID + ' input { box-sizing: border-box; width: 100%; padding: 6px 8px; border: 1px solid #666; border-radius: 4px; background: #1d1d1d; color: #fff; font: 16px monospace; }',
    '#' + KEYBOX_ID + ' .tm-xanax-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }',
    '#' + KEYBOX_ID + ' button { padding: 6px 12px; border: 1px solid #666; border-radius: 4px; background: #444; color: #fff; font: 700 12px Arial, sans-serif; cursor: pointer; }',
  ].join('\n');

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ICON_CSS + '\n' + TIP_CSS + '\n' + BOX_CSS;
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
      maybeAsk(nowMs);
      setLabel(labelLines(nowMs));
      syncChoice(nowMs);
    } catch (e) {
      // A bad value stops this one check. It never reaches Torn's page.
    }
  }

  // ===== START =====

  // The script's menu, where the host has one. A long press on the icon opens the key box too.
  try {
    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Xanax Reminder: Set API key', openKeyBox);
  } catch (e) {
    // PDA once crashed here. Without a menu, the long press still works.
  }
  // A tap anywhere but the box or the icon closes the box. These run before the click, so the
  // tap that opens the box can't close it: the box isn't there yet.
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('touchstart', onPointerDown, { capture: true, passive: true });
  document.addEventListener('keydown', onKeyDown, true);
  // Scrolling moves the icon, and the tooltip and the box would float away from it.
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  setInterval(check, POLL_MS);
  check();
  console.log('[Torn Xanax Reminder ' + VERSION + '] running');
})();
