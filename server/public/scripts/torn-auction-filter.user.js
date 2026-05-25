// ==UserScript==
// @name         Torn Auction Filter
// @namespace    tornwar.com
// @version      0.5.0
// @description  Filter Torn auction house by rarity (Yellow / Orange / Red), category (Primary / Secondary / Melee), and name. Reads rarity from rw-pricer badges already on the listings — install Torn RW Pricer first for color filters to work. v0.5.0: auto-pagination removed; click Next yourself.
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

(function () {
  'use strict';
  if (window.__tornAuctionFilterInstalled) return;
  window.__tornAuctionFilterInstalled = true;

  var STATE = {
    rarity: 'all',  // 'all' | 'yellow' | 'orange' | 'red'
    category: 'all', // 'all' | 'primary' | 'secondary' | 'melee'
    name: '',
  };

  // v0.4.0: weapon name → category (RW weapons only — covers ~all RW items
  // in Torn). Anything not in the map matches 'all' category and never
  // matches when a specific category filter is active.
  var CATEGORY_MAP = (function () {
    var m = {};
    function add(cat, names) { for (var i = 0; i < names.length; i++) m[names[i].toLowerCase()] = cat; }
    add('primary', [
      'SIG 552','Steyr AUG','MP5 Navy','MP5k','Tavor TAR-21','M16 A2 Rifle','MP 40',
      'Jackhammer','Skorpion','AK74U','TMP','Sawed-Off Shotgun','9mm Uzi',
      'Benelli M1 Tactical','Thompson','Heckler & Koch SL8','Blunderbuss',
      'Benelli M4 Super','P90','Ithaca 37','ArmaLite M-15A4','AK-47','XM8 Rifle',
      'M4A1 Colt Carbine','Stoner 96','Type 98 Anti Tank','China Lake','Negev NG-5',
      'PKM','M249 SAW','RPG Launcher','SMAW Launcher','Milkor MGL','Vektor CR-21',
      'Enfield SA-80','Mag 7','Minigun','Nock Gun','Rheinmetall MG 3','BT MP9',
      'Raven MP25','SKS Carbine',
    ]);
    add('secondary', [
      'Fiveseven','USP','Beretta M9','Beretta 92FS','Desert Eagle','Glock 17',
      'S&W Revolver','Magnum','Ruger 57','Qsz-92','Cobra Derringer','Springfield 1911',
      'Lorcin 380','Taurus','Luger',
    ]);
    add('melee', [
      'Frying Pan','Katana','Claymore Sword','Butterfly Knife','Pen Knife','Kama',
      'Samurai Sword','Naval Cutlass','Bo Staff','Kodachi','Macana','Yasukuni Sword',
      'Bread Knife','Poison Umbrella','Diamond Bladed Knife','Ninja Claws',
      'Kitchen Knife','Guandao','Crowbar','Knuckle Dusters','Sai','Scimitar',
      'Wooden Nunchaku','Cricket Bat','Hammer','Swiss Army Knife','Spear',
      'Sledgehammer','Flail','Leather Bullwhip','Axe','Baseball Bat','Chain Whip',
      'Dagger','Metal Nunchaku',
    ]);
    return m;
  })();

  function lookupCategory(name) {
    if (!name) return null;
    var n = String(name).trim().toLowerCase();
    return CATEGORY_MAP[n] || null;
  }
  // v0.5.0: auto-paginate removed per user — Torn rules forbid programmatic
  // UI clicks (Next button). Manual paging only now.

  function log(m) { try { console.log('[torn-auction-filter] ' + m); } catch (_) {} }
  log('installed v0.4.0');

  // ─── Styles ────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('wb-auc-styles')) return;
    var s = document.createElement('style');
    s.id = 'wb-auc-styles';
    s.textContent = [
      '#wb-auc-bar {',
      '  position: sticky; top: 0; z-index: 9999;',
      '  background: rgba(13,18,28,0.96); border: 1px solid #2a3447;',
      '  border-radius: 8px; padding: 8px 10px; margin: 6px 0 10px;',
      '  display: flex; gap: 6px; align-items: center; flex-wrap: wrap;',
      '  font: 12px/1.3 -apple-system, system-ui, sans-serif; color: #e6e8ee;',
      '  box-shadow: 0 4px 12px rgba(0,0,0,0.4);',
      '}',
      '.wb-auc-chip {',
      '  cursor: pointer; padding: 5px 10px; border-radius: 12px;',
      '  border: 1px solid #2a3447; background: #131722; color: #9ca3af;',
      '  font-weight: 600; user-select: none; transition: all .15s;',
      '}',
      '.wb-auc-chip:hover { border-color: #6ee7b7; color: #e6e8ee; }',
      '.wb-auc-chip.active { background: #6ee7b7; color: #0a0d14; border-color: #6ee7b7; }',
      '.wb-auc-chip.wb-auc-yellow.active { background: #fbbf24; border-color: #fbbf24; color: #0a0d14; }',
      '.wb-auc-chip.wb-auc-orange.active { background: #fb923c; border-color: #fb923c; color: #0a0d14; }',
      '.wb-auc-chip.wb-auc-red.active    { background: #fb7185; border-color: #fb7185; color: #0a0d14; }',
      '.wb-auc-chip.wb-auc-yellow::before { content: "● "; color: #fbbf24; }',
      '.wb-auc-chip.wb-auc-orange::before { content: "● "; color: #fb923c; }',
      '.wb-auc-chip.wb-auc-red::before    { content: "● "; color: #fb7185; }',
      '#wb-auc-search {',
      '  flex: 1; min-width: 120px; background: #0a0d14; color: #e6e8ee;',
      '  border: 1px solid #2a3447; border-radius: 6px;',
      '  padding: 6px 8px; font: 12px ui-monospace, monospace;',
      '}',
      '#wb-auc-search:focus { outline: none; border-color: #6ee7b7; }',
      '#wb-auc-count { font-size: 11px; color: #6b7280; margin-left: auto; }',
      '.wb-auc-hidden { display: none !important; }',
      ''
    ].join('\n');
    document.head.appendChild(s);
  }

  // ─── Find the auction-listing container + each listing ─────────────
  // Torn re-renders heavily so re-detect on every apply rather than caching.
  function findListings() {
    // RW pricer's existing badge has [data-rwp-item] on it — each badge sits
    // inside one listing item. Walk to the nearest <li> ancestor.
    // Fallback: any <li> inside a list that looks like the auction list.
    var listings = [];
    var seen = new Set();

    // Path 1: through rw-pricer badges
    var badges = document.querySelectorAll('[data-rwp-item]');
    for (var i = 0; i < badges.length; i++) {
      var li = badges[i].closest('li');
      if (li && !seen.has(li)) { listings.push(li); seen.add(li); }
    }

    // Path 2: structural — any <ul> with multiple <li> children that contain
    // a $-formatted price text. Catches non-RW listings too (so name filter
    // works on regular items).
    if (listings.length === 0) {
      var lis = document.querySelectorAll('ul li');
      for (var j = 0; j < lis.length; j++) {
        var l = lis[j];
        if (seen.has(l)) continue;
        // Heuristic: listing has both a name and a $ price
        if (/\$[\d,]+/.test(l.textContent) && l.textContent.length < 500) {
          listings.push(l);
          seen.add(l);
        }
      }
    } else {
      // Even with path 1, also pick up sibling <li>s in the same <ul>s so
      // name filter applies to non-RW listings.
      var ulSet = new Set();
      listings.forEach(function (li) { if (li.parentElement) ulSet.add(li.parentElement); });
      ulSet.forEach(function (ul) {
        var sibs = ul.children;
        for (var k = 0; k < sibs.length; k++) {
          if (sibs[k].tagName === 'LI' && !seen.has(sibs[k])) {
            listings.push(sibs[k]);
            seen.add(sibs[k]);
          }
        }
      });
    }

    return listings;
  }

  function listingRarity(li) {
    var b = li.querySelector('[data-rwp-rarity]');
    if (!b) return null;
    return (b.getAttribute('data-rwp-rarity') || '').toLowerCase();
  }

  function listingName(li) {
    var b = li.querySelector('[data-rwp-item]');
    if (b) return b.getAttribute('data-rwp-item') || '';
    // Fallback: extract from text (first non-empty line)
    var text = (li.textContent || '').trim();
    var firstLine = text.split('\n')[0];
    return firstLine.slice(0, 60);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }

  // ─── Apply filter to current DOM ───────────────────────────────────
  function applyFilter() {
    var lis = findListings();
    var shown = 0;
    var nameLower = STATE.name.trim().toLowerCase();
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i];
      var rar = listingRarity(li);
      var rawName = listingName(li);
      var name = rawName.toLowerCase();
      var hideByRarity = false;
      if (STATE.rarity === 'yellow' || STATE.rarity === 'orange' || STATE.rarity === 'red') {
        if (rar !== STATE.rarity) hideByRarity = true;
      }
      // v0.4.0: category filter (primary / secondary / melee).
      // Looks up the listing's weapon name in CATEGORY_MAP.
      var hideByCategory = false;
      if (STATE.category && STATE.category !== 'all') {
        var cat = lookupCategory(rawName);
        if (cat !== STATE.category) hideByCategory = true;
      }
      var hideByName = nameLower && name.indexOf(nameLower) === -1;
      var hide = hideByRarity || hideByCategory || hideByName;
      if (hide) li.classList.add('wb-auc-hidden');
      else { li.classList.remove('wb-auc-hidden'); shown++; }
    }
    var countEl = document.getElementById('wb-auc-count');
    if (countEl) {
      countEl.textContent = shown + ' / ' + lis.length + ' shown';
    }
  }

  // ─── Build the filter bar ──────────────────────────────────────────
  function buildBar() {
    if (document.getElementById('wb-auc-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'wb-auc-bar';
    bar.innerHTML = [
      // Rarity group
      '<span class="wb-auc-chip wb-auc-all active" data-group="rarity" data-value="all">All</span>',
      '<span class="wb-auc-chip wb-auc-yellow" data-group="rarity" data-value="yellow">Yellow</span>',
      '<span class="wb-auc-chip wb-auc-orange" data-group="rarity" data-value="orange">Orange</span>',
      '<span class="wb-auc-chip wb-auc-red" data-group="rarity" data-value="red">Red</span>',
      // Separator
      '<span style="color:#2a3447;margin:0 2px">|</span>',
      // Category group
      '<span class="wb-auc-chip active" data-group="category" data-value="all">Any type</span>',
      '<span class="wb-auc-chip" data-group="category" data-value="primary">Primary</span>',
      '<span class="wb-auc-chip" data-group="category" data-value="secondary">Secondary</span>',
      '<span class="wb-auc-chip" data-group="category" data-value="melee">Melee</span>',
      '<input id="wb-auc-search" type="text" placeholder="Search name…" autocomplete="off" spellcheck="false">',
      '<span id="wb-auc-count"></span>',
    ].join('');

    // Insert at top of main content area (find first <ul> with our listings
    // and put the bar before its container).
    var firstLi = findListings()[0];
    if (firstLi && firstLi.parentElement && firstLi.parentElement.parentElement) {
      firstLi.parentElement.parentElement.insertBefore(bar, firstLi.parentElement);
    } else {
      // Fallback: put it at the top of body
      document.body.insertBefore(bar, document.body.firstChild);
    }

    bar.querySelectorAll('.wb-auc-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var group = chip.getAttribute('data-group');
        var value = chip.getAttribute('data-value');
        // Only deactivate sibling chips in the same group (rarity stays
        // independent of category, so user can combine e.g. Orange + Melee)
        bar.querySelectorAll('.wb-auc-chip[data-group="' + group + '"]').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        if (group === 'rarity') STATE.rarity = value;
        else if (group === 'category') STATE.category = value;
        applyFilter();
      });
    });
    var search = document.getElementById('wb-auc-search');
    var debounceT = null;
    search.addEventListener('input', function () {
      clearTimeout(debounceT);
      debounceT = setTimeout(function () {
        STATE.name = search.value || '';
        applyFilter();
      }, 150);
    });
  }

  // ─── Init + MutationObserver for re-renders ────────────────────────
  function init() {
    injectStyles();
    buildBar();
    applyFilter();
    var debounce = null;
    var obs = new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        // Re-build bar if Torn React stripped it on rerender
        if (!document.getElementById('wb-auc-bar')) buildBar();
        applyFilter();
      }, 200);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Wait a beat so rw-pricer's badges land first
    setTimeout(init, 800);
  }
})();
