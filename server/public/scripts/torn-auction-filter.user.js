// ==UserScript==
// @name         Torn Auction Filter
// @namespace    tornwar.com
// @version      0.2.0
// @description  Filter Torn auction house by rarity (Yellow / Orange / Red) and search by weapon name. Reads rarity from rw-pricer badges already on the listings — install Torn RW Pricer first for color filters to work. Search-by-name works standalone.
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
    rarity: 'all',  // 'all' | 'yellow' | 'orange' | 'red' | 'unbadged'
    name: '',
    // v0.2.0: auto-pagination state. When a color filter is active and
    // visible count drops below threshold, auto-click Next to load more.
    autoPaged: 0,             // pages auto-clicked since filter was last changed
    lastAutoClickTs: 0,       // throttle timestamp
  };
  var AUTO_PAGE_MIN_VISIBLE = 5;       // visible-on-page count triggering Next-click
  var AUTO_PAGE_MAX = 20;              // hard cap per filter session (~400 listings)
  var AUTO_PAGE_MIN_INTERVAL = 1200;   // ms between auto-clicks (lets next page render)

  function log(m) { try { console.log('[torn-auction-filter] ' + m); } catch (_) {} }
  log('installed v0.2.0');

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

  // ─── v0.2.0: Auto-paginate when filtered results run low ──────────
  // Find Torn's auction-list "Next" pagination button. It's React-rendered
  // with hashed class names, so use structural + text-content selectors.
  function findNextPageButton() {
    // Pattern 1: explicit aria-label
    var aria = document.querySelector('button[aria-label*="next" i], a[aria-label*="next" i]');
    if (aria && !aria.disabled) return aria;
    // Pattern 2: text content "Next" inside a button/anchor
    var candidates = document.querySelectorAll('button, a');
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      var t = (c.textContent || '').trim().toLowerCase();
      if (t === 'next' || t === '>' || t === '›' || t === '→') {
        if (!c.disabled && !c.classList.contains('disabled')) return c;
      }
    }
    // Pattern 3: pagination container's last child (Torn often uses » or chevron icons)
    var pagers = document.querySelectorAll('[class*="pagination"]');
    for (var j = 0; j < pagers.length; j++) {
      var lastBtn = pagers[j].querySelector('button:last-child, a:last-child');
      if (lastBtn && !lastBtn.disabled && !lastBtn.classList.contains('disabled')) {
        // Make sure it's not "Last" (could be »» on some skins) — check icon
        if (!/last/i.test(lastBtn.getAttribute('aria-label') || '')) return lastBtn;
      }
    }
    return null;
  }

  function maybeAutoPaginate() {
    // Only auto-page when a color filter is active (not 'all')
    if (STATE.rarity === 'all' && !STATE.name) return;
    if (STATE.autoPaged >= AUTO_PAGE_MAX) return;
    var now = Date.now();
    if (now - STATE.lastAutoClickTs < AUTO_PAGE_MIN_INTERVAL) return;
    // Count visible after filter
    var lis = findListings();
    var visible = 0;
    for (var i = 0; i < lis.length; i++) if (!lis[i].classList.contains('wb-auc-hidden')) visible++;
    if (visible >= AUTO_PAGE_MIN_VISIBLE) return; // enough on screen — don't auto-page
    var nextBtn = findNextPageButton();
    if (!nextBtn) {
      log('auto-paginate: no Next button found (probably last page)');
      return;
    }
    STATE.autoPaged++;
    STATE.lastAutoClickTs = now;
    log('auto-paginate: ' + visible + '/' + AUTO_PAGE_MIN_VISIBLE + ' visible — clicking Next (auto-page ' + STATE.autoPaged + '/' + AUTO_PAGE_MAX + ')');
    try { nextBtn.click(); } catch (e) { log('next-click failed: ' + e.message); }
  }

  // ─── Apply filter to current DOM ───────────────────────────────────
  function applyFilter() {
    var lis = findListings();
    var shown = 0;
    var nameLower = STATE.name.trim().toLowerCase();
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i];
      var rar = listingRarity(li);
      var name = listingName(li).toLowerCase();
      var hideByRarity = false;
      if (STATE.rarity === 'yellow' || STATE.rarity === 'orange' || STATE.rarity === 'red') {
        if (rar !== STATE.rarity) hideByRarity = true;
      } else if (STATE.rarity === 'unbadged') {
        if (rar) hideByRarity = true;
      }
      var hideByName = nameLower && name.indexOf(nameLower) === -1;
      var hide = hideByRarity || hideByName;
      if (hide) li.classList.add('wb-auc-hidden');
      else { li.classList.remove('wb-auc-hidden'); shown++; }
    }
    var countEl = document.getElementById('wb-auc-count');
    if (countEl) {
      var label = shown + ' / ' + lis.length + ' shown';
      if (STATE.autoPaged > 0) label += ' (auto-paged ×' + STATE.autoPaged + ')';
      countEl.textContent = label;
    }
    // v0.2.0: auto-paginate if filter active and visible count too low
    maybeAutoPaginate();
  }

  // ─── Build the filter bar ──────────────────────────────────────────
  function buildBar() {
    if (document.getElementById('wb-auc-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'wb-auc-bar';
    bar.innerHTML = [
      '<span class="wb-auc-chip wb-auc-all active" data-rarity="all">All</span>',
      '<span class="wb-auc-chip wb-auc-yellow" data-rarity="yellow">Yellow</span>',
      '<span class="wb-auc-chip wb-auc-orange" data-rarity="orange">Orange</span>',
      '<span class="wb-auc-chip wb-auc-red" data-rarity="red">Red</span>',
      '<span class="wb-auc-chip" data-rarity="unbadged" title="Items without an RW badge (regular auctions)">No badge</span>',
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
        bar.querySelectorAll('.wb-auc-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        STATE.rarity = chip.getAttribute('data-rarity');
        STATE.autoPaged = 0; // reset cap so user can re-auto-page from scratch
        applyFilter();
      });
    });
    var search = document.getElementById('wb-auc-search');
    var debounceT = null;
    search.addEventListener('input', function () {
      clearTimeout(debounceT);
      debounceT = setTimeout(function () {
        STATE.name = search.value || '';
        STATE.autoPaged = 0;
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
