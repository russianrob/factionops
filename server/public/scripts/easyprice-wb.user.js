// ==UserScript==
// @name         EasyPrice (tornwar fork)
// @namespace    tornwar.com
// @version      0.1.0
// @description  Resilient fork of Gaskarth's EasyPrice — dims items priced higher than a previous better example when sorting by Quality/Accuracy/Damage/Armor DESC. Uses prefix class matchers + content patterns instead of hashed React class names, so it survives Torn React rebuilds.
// @author       Gaskarth (resilience fork by warboard)
// @license      MIT
// @match        https://www.torn.com/page.php?sid=ItemMarket*
// @match        https://pda.torn.com/page.php?sid=ItemMarket*
// @grant        none
// @downloadURL  https://tornwar.com/scripts/easyprice-wb.user.js
// @updateURL    https://tornwar.com/scripts/easyprice-wb.meta.js
// ==/UserScript==

/*
Original credit: Gaskarth (https://greasyfork.org/en/scripts/545434-easyprice)

What it does:
  On Torn Item Market, when you sort weapons/armor by Quality, Accuracy,
  Damage, or Armor in DESCENDING order, this script dims any item whose
  price is HIGHER than a previously-listed better item. Sort by stat desc,
  the best are first, anything pricier-but-worse-than-them = wasted nerve
  hovering over it.

Why this fork exists:
  Upstream pins React-hashed class names like .priceAndTotal___eEVS7 and
  .title___rhtB4. Those hash suffixes change every time Torn rebuilds
  their React bundle (often weekly), breaking the script silently. This
  fork uses prefix matchers (e.g. [class^="priceAndTotal___"]) and
  content patterns (regex for $ amounts) so it keeps working across
  Torn UI rebuilds.

  Other resilience tweaks:
  - Falls back to text-content-based price extraction if class match fails
  - MutationObserver instead of setInterval for lower CPU on PDA
  - Idempotent: re-applies cleanly when React re-renders the list
*/

(function () {
    'use strict';

    var HIDDEN_OPACITY = 0.3;
    var STAT_FIELDS = ['accuracy', 'quality', 'damage', 'armor'];

    // Find the sort dropdown's hidden input (structural selector — survives React hashes).
    // Same logic as upstream: any hidden input whose value contains a colon (e.g. "quality:DESC")
    // and isn't a JSON object.
    function getActiveSort() {
        var inputs = document.querySelectorAll('input[type="hidden"][value*=":"]:not([value*="{"])');
        for (var i = 0; i < inputs.length; i++) {
            var parts = inputs[i].value.split(':');
            if (parts.length !== 2) continue;
            var order = parts[0];
            var direction = parts[1];
            if (STAT_FIELDS.indexOf(order) !== -1) {
                return { order: order, direction: direction };
            }
        }
        return null;
    }

    // Find every price cell. Try the prefix matcher first (survives hash rebuilds);
    // if Torn renames `priceAndTotal` itself we fall through to scanning all <li>s
    // for any descendant with a $-formatted text value.
    function findPriceElements() {
        // Path 1: stable prefix matcher — same CSS module name, hash suffix can change freely
        var prefixed = document.querySelectorAll('[class^="priceAndTotal___"], [class*=" priceAndTotal___"]');
        if (prefixed.length) return Array.from(prefixed);

        // Path 2: content-based fallback — find each <li>'s leaf with `$N,NNN` text
        var fallback = [];
        var lis = document.querySelectorAll('ul[class*="itemsList___"] > li, ul > li');
        for (var i = 0; i < lis.length; i++) {
            var li = lis[i];
            // Walk text nodes to find the price cell
            var walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, {
                acceptNode: function (n) {
                    return /^\s*\$[\d,]+\s*$/.test(n.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            });
            var node = walker.nextNode();
            if (node && node.parentElement) fallback.push(node.parentElement);
        }
        return fallback;
    }

    // Parse the $-amount out of an element's text. Returns NaN if no match.
    function parsePrice(el) {
        if (!el) return NaN;
        var m = el.textContent.replace(/\s/g, '').match(/\$?([\d,]+)/);
        if (!m) return NaN;
        return Number(m[1].replace(/,/g, ''));
    }

    // Find the status display + dropdown container to recolor (purely cosmetic — same
    // intent as upstream, with prefix matchers so the cosmetic update survives rebuilds).
    function findStatusEl() {
        return document.querySelector('[class^="title___"], [class*=" title___"]')
            || document.querySelector('h4, h2, [class*="header"]');
    }
    function findDropdownsEl() {
        var d = document.querySelector('[class^="dropdowns___"], [class*=" dropdowns___"]');
        return d && d.lastElementChild ? d.lastElementChild : null;
    }

    function setStatus(msg, isFail) {
        var el = findStatusEl();
        var dropdown = findDropdownsEl();
        if (el) el.textContent = msg;
        if (dropdown) dropdown.style.backgroundColor = isFail ? 'rgba(231,76,60,0.4)' : 'rgba(110,231,183,0.4)';
    }

    function updateList() {
        var sort = getActiveSort();
        if (!sort) {
            setStatus('EasyPrice: Choose QUAL, ACC, DMG, or ARM', true);
            return;
        }
        if (sort.direction !== 'DESC') {
            setStatus('EasyPrice: choose Descending', true);
            return;
        }
        var priceEls = findPriceElements();
        if (priceEls.length === 0) {
            // Nothing to do (page might not be the right tab yet). Don't show fail
            // because that's confusing — silently no-op.
            return;
        }
        var best = null;
        var dimmed = 0;
        for (var i = 0; i < priceEls.length; i++) {
            var el = priceEls[i];
            var price = parsePrice(el);
            if (!isFinite(price)) continue;
            var li = el.closest('li');
            if (!li) continue;
            if (best === null) best = price;
            if (price > best) {
                li.style.opacity = HIDDEN_OPACITY;
                dimmed++;
            } else {
                li.style.opacity = '';
                if (price < best) best = price;
            }
        }
        setStatus('Item Market : EasyPrice ON (' + dimmed + ' dimmed)', false);
    }

    // Run on a debounced MutationObserver instead of a polling setInterval.
    // Item market re-renders heavily as you scroll / change filters — MO catches
    // every change without burning CPU between renders. Debounce coalesces
    // back-to-back mutations into a single update.
    var debounceTimer = null;
    function debouncedUpdate() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateList, 200);
    }

    function init() {
        updateList();
        var observer = new MutationObserver(debouncedUpdate);
        observer.observe(document.body, { childList: true, subtree: true });
        // Safety net: also tick every 3s in case MO misses something
        // (e.g. cross-iframe re-renders that don't bubble to document.body).
        setInterval(updateList, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
