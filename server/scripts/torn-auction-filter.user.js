// ==UserScript==
// @name         Torn Auction Filter
// @namespace    tornwar.com
// @version      0.6.2
// @description  Filter Torn auction house by rarity (Yellow / Orange / Red), category (Primary / Secondary / Melee), and name. v0.6.2: dump first listing as JSON in the panel itself (PDA Dev Tools can't expand objects) so we can see exactly which fields the API returns.
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
      // v0.6.0 — Show-all button, key cog, status, results panel
      '.wb-auc-btn {',
      '  cursor: pointer; padding: 5px 10px; border-radius: 12px;',
      '  border: 1px solid #6ee7b7; background: #0a1f17; color: #6ee7b7;',
      '  font-weight: 600; user-select: none; transition: all .15s;',
      '}',
      '.wb-auc-btn:hover { background: #6ee7b7; color: #0a0d14; }',
      '.wb-auc-cog {',
      '  cursor: pointer; padding: 5px 8px; border-radius: 12px;',
      '  border: 1px solid #2a3447; background: #131722; color: #9ca3af;',
      '  user-select: none;',
      '}',
      '.wb-auc-cog:hover { color: #e6e8ee; border-color: #6ee7b7; }',
      '#wb-auc-status { font-size: 11px; color: #9ca3af; min-width: 80px; }',
      '#wb-auc-results {',
      '  background: rgba(13,18,28,0.96); border: 1px solid #2a3447;',
      '  border-radius: 8px; padding: 8px 10px; margin: 6px 0 12px;',
      '  max-height: 70vh; overflow: auto; color: #e6e8ee;',
      '  font: 12px/1.3 -apple-system, system-ui, sans-serif;',
      '  box-shadow: 0 4px 12px rgba(0,0,0,0.4);',
      '}',
      '.wb-auc-results-head {',
      '  display: flex; justify-content: space-between; align-items: center;',
      '  gap: 12px; padding: 4px 4px 8px; border-bottom: 1px solid #1a2030;',
      '  margin-bottom: 4px; color: #9ca3af; font-size: 11px;',
      '}',
      '.wb-auc-results-head > span:first-child { flex: 1; }',
      '.wb-auc-results-close { cursor: pointer; padding: 0 8px; color: #9ca3af; font-size: 18px; }',
      '.wb-auc-results-close:hover { color: #fb7185; }',
      '.wb-auc-results-empty { padding: 18px 8px; text-align: center; color: #6b7280; }',
      '.wb-auc-sample-dump { margin: 8px 4px; }',
      '.wb-auc-sample-dump summary { cursor: pointer; color: #9ca3af; font-size: 11px; padding: 4px 0; }',
      '.wb-auc-sample-dump pre {',
      '  background: #0a0d14; color: #c4b5fd; padding: 8px;',
      '  border-radius: 6px; font: 10px/1.3 ui-monospace, monospace;',
      '  white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow: auto;',
      '}',
      '.wb-auc-result-row {',
      '  display: flex; gap: 10px; padding: 6px 8px;',
      '  border-bottom: 1px solid #1a2030; align-items: center;',
      '  color: #e6e8ee; text-decoration: none;',
      '}',
      '.wb-auc-result-row:hover { background: #1a2030; }',
      '.wb-auc-result-rarity {',
      '  width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px;',
      '  background: #2a3447;',
      '}',
      '.wb-auc-result-rarity.yellow { background: #fbbf24; }',
      '.wb-auc-result-rarity.orange { background: #fb923c; }',
      '.wb-auc-result-rarity.red    { background: #fb7185; }',
      '.wb-auc-result-name { flex: 1; font-weight: 600; color: #e6e8ee; }',
      '.wb-auc-result-bonus { font-weight: 400; color: #c4b5fd; font-size: 11px; margin-left: 4px; }',
      '.wb-auc-result-bids { color: #9ca3af; font-size: 11px; min-width: 50px; text-align: right; }',
      '.wb-auc-result-price { color: #6ee7b7; font-family: ui-monospace, monospace; min-width: 90px; text-align: right; }',
      '.wb-auc-result-time { color: #fbbf24; font-size: 11px; min-width: 56px; text-align: right; }',
      '.wb-auc-result-seller { color: #9ca3af; font-size: 11px; min-width: 100px; text-align: right; }',
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

  // ─── API key (shared with torn-rw-pricer) ──────────────────────────
  // PDA injects the key by replacing the literal token at install time;
  // on desktop we fall back to the rwp_user_apikey localStorage entry that
  // rw-pricer already owns, so most users won't have to enter a key twice.
  var PDAKey = '###PDA-APIKEY###';
  var pdaApiKey = (PDAKey.charAt(0) !== '#') ? PDAKey : '';
  var APIKEY_LS_KEY = 'rwp_user_apikey';

  function getApiKey() {
    try {
      var saved = localStorage.getItem(APIKEY_LS_KEY) || '';
      if (saved) return saved;
    } catch (_) {}
    return pdaApiKey;
  }
  function setApiKey(k) {
    try { localStorage.setItem(APIKEY_LS_KEY, k || ''); } catch (_) {}
  }

  // ─── Fetch the whole auction house via /v2/market/auctionhouse ─────
  // Walks the cursor at _metadata.links.next until exhausted (or hits the
  // page cap). Returns the flat array; rarity / category / name filtering
  // is then applied client-side.
  var FETCH_PAGE_SIZE = 100;
  var FETCH_MAX_PAGES = 5;        // hard cap (~500 listings) so a stuck loop can't burn API quota
  var FETCH_BASE = 'https://api.torn.com/v2/market/auctionhouse';
  var FETCH_STATE = { running: false, lastError: '', lastListings: null, lastFetchedAt: 0 };

  function fetchAllAuctions(opts, cb) {
    if (FETCH_STATE.running) { cb && cb(new Error('Already fetching — wait for it to finish.'), null); return; }
    var key = getApiKey();
    if (!key) { cb && cb(new Error('No API key. Click ⚙ in the bar to set one.'), null); return; }
    FETCH_STATE.running = true;
    FETCH_STATE.lastError = '';
    var collected = [];
    var pagesFetched = 0;
    var maxPages = (opts && opts.maxPages) || FETCH_MAX_PAGES;

    function step(url) {
      fetch(url, { headers: { 'Authorization': 'ApiKey ' + key, 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.error) {
            FETCH_STATE.running = false;
            FETCH_STATE.lastError = data.error.error || ('API code ' + data.error.code);
            cb && cb(new Error(FETCH_STATE.lastError), null);
            return;
          }
          var batch = (data && data.auctionhouse) || [];
          collected = collected.concat(batch);
          pagesFetched++;
          if (opts && opts.onProgress) opts.onProgress(collected.length, pagesFetched);
          var nextLink = data && data._metadata && data._metadata.links && data._metadata.links.next;
          if (nextLink && pagesFetched < maxPages && batch.length > 0) {
            var u = String(nextLink);
            // Torn's _metadata.links.next is sometimes a full URL, sometimes a
            // bare query string. Normalise both.
            if (u.charAt(0) === '?') u = FETCH_BASE + u;
            else if (!/^https?:/i.test(u)) u = FETCH_BASE + '?' + u.replace(/^\?/, '');
            step(u);
          } else {
            FETCH_STATE.running = false;
            FETCH_STATE.lastListings = collected;
            FETCH_STATE.lastFetchedAt = Date.now();
            // v0.6.1 diagnostics — surface raw response shape so we can
            // tell whether `item.rarity` actually exists and matches
            // 'yellow'/'orange'/'red' literally.
            try {
              window.__wbAucLastFetch = collected;
              window.__wbAucLastRaw = data;
              // PDA Dev Tools Terminal can't expand objects (shows
              // "[object Object]") — stringify so the user can read it.
              var sampleStr = '';
              try { sampleStr = JSON.stringify(collected.slice(0, 2), null, 2); } catch (e) { sampleStr = '<stringify failed: ' + e.message + '>'; }
              FETCH_STATE.lastSampleJson = sampleStr;
              console.log('[torn-auction-filter] fetched ' + collected.length + ' listings');
              console.log('[torn-auction-filter] sample JSON (first 2):\n' + sampleStr);
              console.log('[torn-auction-filter] last page raw response keys:', data ? Object.keys(data) : []);
            } catch (_) {}
            cb && cb(null, { listings: collected, pages: pagesFetched, hasMore: !!nextLink });
          }
        })
        .catch(function (e) {
          FETCH_STATE.running = false;
          FETCH_STATE.lastError = e.message || String(e);
          cb && cb(e, null);
        });
    }
    step(FETCH_BASE + '?limit=' + FETCH_PAGE_SIZE + '&sort=ASC');
  }

  function fmtMoney(n) {
    n = Math.round(Number(n) || 0);
    return '$' + n.toLocaleString('en-US');
  }
  function fmtCountdown(secs) {
    secs = Math.max(0, Math.floor(secs));
    var h = Math.floor(secs / 3600);
    var m = Math.floor((secs % 3600) / 60);
    if (h >= 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  // Apply current STATE filters to the fetched listing array. Returns
  // the subset that matches; ordering preserved from API response (already
  // ASC by time-remaining).
  function applyFiltersToFetched(listings) {
    var nameLower = STATE.name.trim().toLowerCase();
    return listings.filter(function (row) {
      var it = row && row.item;
      if (!it) return false;
      if (STATE.rarity === 'yellow' || STATE.rarity === 'orange' || STATE.rarity === 'red') {
        if ((it.rarity || '').toLowerCase() !== STATE.rarity) return false;
      }
      if (STATE.category && STATE.category !== 'all') {
        var cat = lookupCategory(it.name);
        if (cat !== STATE.category) return false;
      }
      if (nameLower && (it.name || '').toLowerCase().indexOf(nameLower) === -1) return false;
      return true;
    });
  }

  // ─── Compact results panel ────────────────────────────────────────
  function ensureResultsPanel() {
    var panel = document.getElementById('wb-auc-results');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'wb-auc-results';
    panel.style.display = 'none';
    var bar = document.getElementById('wb-auc-bar');
    if (bar && bar.parentElement) {
      bar.parentElement.insertBefore(panel, bar.nextSibling);
    } else {
      document.body.insertBefore(panel, document.body.firstChild);
    }
    return panel;
  }

  // v0.6.1 — rarity breakdown of fetched listings. Helps diagnose "No
  // matches": if the breakdown shows 0 orange but plenty of unknown,
  // the API isn't returning item.rarity (so we'd need to enrich via a
  // separate items lookup, the way rw-pricer does).
  function summarizeRarities(listings) {
    var counts = { yellow: 0, orange: 0, red: 0, none: 0, other: 0 };
    for (var i = 0; i < listings.length; i++) {
      var it = listings[i] && listings[i].item;
      if (!it) { counts.none++; continue; }
      var r = (it.rarity == null ? '' : String(it.rarity)).toLowerCase();
      if (r === 'yellow' || r === 'orange' || r === 'red') counts[r]++;
      else if (!r) counts.none++;
      else counts.other++;
    }
    return counts;
  }

  function renderResults(listings, meta) {
    var panel = ensureResultsPanel();
    var filtered = applyFiltersToFetched(listings);
    var now = Math.floor(Date.now() / 1000);
    var br = summarizeRarities(listings);
    var html = [];
    html.push('<div class="wb-auc-results-head">');
    html.push('<span>Showing ' + filtered.length + ' of ' + listings.length + ' auctions');
    if (meta && meta.hasMore) html.push(' <span style="color:#fbbf24">(capped at ' + meta.pages + ' pages)</span>');
    html.push('</span>');
    html.push('<span class="wb-auc-results-breakdown" style="font-size:11px;color:#9ca3af">');
    html.push('rarity: ');
    html.push('<span style="color:#fbbf24">' + br.yellow + ' Y</span> / ');
    html.push('<span style="color:#fb923c">' + br.orange + ' O</span> / ');
    html.push('<span style="color:#fb7185">' + br.red + ' R</span> / ');
    html.push('<span style="color:#6b7280">' + br.none + ' none</span>');
    if (br.other) html.push(' / <span style="color:#c4b5fd">' + br.other + ' other</span>');
    html.push('</span>');
    html.push('<span class="wb-auc-results-close" title="Close panel">×</span>');
    html.push('</div>');
    // v0.6.2 — raw sample dump (only when we have no matches, so the
    // diagnostic doesn't clutter normal use). Lets us see on PDA which
    // fields the API actually returns.
    if (filtered.length === 0 && FETCH_STATE.lastSampleJson) {
      html.push('<details class="wb-auc-sample-dump"><summary>Show raw sample (first 2 listings)</summary>');
      html.push('<pre>' + escapeHtml(FETCH_STATE.lastSampleJson.slice(0, 4000)) + '</pre>');
      html.push('</details>');
    }
    if (filtered.length === 0) {
      html.push('<div class="wb-auc-results-empty">No matches with current filters. See the rarity breakdown above — if all listings are "none", the API isn\'t tagging rarity and we need an items-lookup pass. Otherwise try a different rarity / category.</div>');
    } else {
      for (var i = 0; i < filtered.length; i++) {
        var row = filtered[i];
        var it = row.item || {};
        var rar = (it.rarity || '').toLowerCase();
        var bonuses = (it.bonuses || []).map(function (b) { return b.title; }).filter(Boolean).join(', ');
        var endsIn = (row.timestamp ? row.timestamp - now : 0);
        var sellerName = row.seller && row.seller.name ? row.seller.name : '';
        var bidUrl = 'https://www.torn.com/amarket.php#/p=item&itemID=' + (it.id || '');
        html.push('<a class="wb-auc-result-row" href="' + bidUrl + '" target="_blank" rel="noopener">');
        html.push('<span class="wb-auc-result-rarity ' + (rar || 'none') + '"></span>');
        html.push('<span class="wb-auc-result-name">' + escapeHtml(it.name || '?'));
        if (bonuses) html.push(' <span class="wb-auc-result-bonus">' + escapeHtml(bonuses) + '</span>');
        html.push('</span>');
        html.push('<span class="wb-auc-result-bids">' + (row.bids || 0) + ' bid' + ((row.bids === 1) ? '' : 's') + '</span>');
        html.push('<span class="wb-auc-result-price">' + fmtMoney(row.price) + '</span>');
        html.push('<span class="wb-auc-result-time">' + fmtCountdown(endsIn) + '</span>');
        if (sellerName) html.push('<span class="wb-auc-result-seller">' + escapeHtml(sellerName) + '</span>');
        html.push('</a>');
      }
    }
    panel.innerHTML = html.join('');
    panel.style.display = 'block';
    var closeBtn = panel.querySelector('.wb-auc-results-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { panel.style.display = 'none'; });
  }

  function setFetchStatus(text, kind) {
    var el = document.getElementById('wb-auc-status');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = (kind === 'err') ? '#fb7185' : (kind === 'ok' ? '#6ee7b7' : '#9ca3af');
  }

  function doFetchAndRender() {
    setFetchStatus('Fetching…', '');
    fetchAllAuctions({
      onProgress: function (n, p) { setFetchStatus('Fetched ' + n + ' (' + p + ' page' + (p === 1 ? '' : 's') + ')…', ''); },
    }, function (err, res) {
      if (err) { setFetchStatus('Error: ' + err.message, 'err'); return; }
      var filtered = applyFiltersToFetched(res.listings);
      setFetchStatus(filtered.length + ' / ' + res.listings.length + ' match', 'ok');
      renderResults(res.listings, res);
    });
  }

  function promptForApiKey() {
    var cur = getApiKey();
    var v = window.prompt('Torn API key (Limited access is enough — needs market: auctionhouse):', cur || '');
    if (v === null) return;
    setApiKey(v.trim());
    setFetchStatus(v.trim() ? 'Key saved.' : 'Key cleared.', 'ok');
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
      // v0.6.0 — fetch-all action
      '<span class="wb-auc-btn" id="wb-auc-fetch" title="Fetch every auction via API and show compact matches">Show all</span>',
      '<span class="wb-auc-cog" id="wb-auc-key" title="Set or update Torn API key">⚙</span>',
      '<span id="wb-auc-status"></span>',
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
        rerenderPanelIfOpen();
      });
    });
    var search = document.getElementById('wb-auc-search');
    var debounceT = null;
    search.addEventListener('input', function () {
      clearTimeout(debounceT);
      debounceT = setTimeout(function () {
        STATE.name = search.value || '';
        applyFilter();
        rerenderPanelIfOpen();
      }, 150);
    });
    var fetchBtn = document.getElementById('wb-auc-fetch');
    if (fetchBtn) fetchBtn.addEventListener('click', doFetchAndRender);
    var keyBtn = document.getElementById('wb-auc-key');
    if (keyBtn) keyBtn.addEventListener('click', promptForApiKey);
  }

  // If the results panel is already showing the most recent fetch, re-apply
  // the active filters to that cached list so chip clicks update both the
  // in-page DOM and our overlay in one step.
  function rerenderPanelIfOpen() {
    var panel = document.getElementById('wb-auc-results');
    if (!panel || panel.style.display === 'none') return;
    if (!FETCH_STATE.lastListings) return;
    renderResults(FETCH_STATE.lastListings, { hasMore: false, pages: 0 });
    var filtered = applyFiltersToFetched(FETCH_STATE.lastListings);
    setFetchStatus(filtered.length + ' / ' + FETCH_STATE.lastListings.length + ' match', 'ok');
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
