// ==UserScript==
// @name         Arson bang for buck (tornwar fork)
// @namespace    tornwar.com
// @version      1.00.056
// @description  Profit-per-nerve + how-to-perform tooltips on the crimes page. Mirror of neth392's 1.00.040-fix3 with download/update URLs pointing at tornwar.com so future patches auto-update. wb2: auto-syncs recipe edits from the tornwar server (written by arsontest) into the tooltip data.
// @author       Para_Thenics, auboli77 (fix3 patches by neth392; mirrored by RussianRob)
// @match        https://www.torn.com/page.php?sid=crimes*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      tornwar.com
// @downloadURL  https://tornwar.com/scripts/arson-bang-for-buck.user.js
// @updateURL    https://tornwar.com/scripts/arson-bang-for-buck.meta.js
// ==/UserScript==
//
// =============================================================================
// CHANGELOG (tornwar fork)
// =============================================================================
// 1.00.040-fix3-wb1 — Replaced wb2 (based on 1.00.037) with neth392's
//   community 1.00.040-fix3 from
//   https://gist.github.com/neth392/756b3de97e27cdae6aecc43895834158
//   Key fix3 improvements over the wb2 fork:
//     - hoverTarget now requires THREE substrings on the same element
//       (crimeOptionSection___ + flexGrow___ + titleSection___) so
//       false matches don't trigger spurious tooltips
//     - Mobile tap attaches to the whole section, not a single hashed
//       child; ignores button/a/input/select/textarea clicks so action
//       buttons still work. Fixes PDA tooltip behavior cleanly.
//     - dataset.tooltipAdded dedup guard so MutationObserver doesn't
//       re-attach handlers on every render
//     - Outside-click auto-closes the tooltip
// =============================================================================
(function() {
    'use strict';
 
    //  Torn API Key handling
    let apiKey = localStorage.getItem('tornApiKey') || "";
 
 
function askForApiKeyInline() {
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: '#222',
        color: '#fff',
        padding: '10px',
        borderRadius: '6px',
        zIndex: '9999',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        fontSize: '14px'
    });
 
    container.innerHTML = `
        <p style="margin:0 0 8px;">Enter your Torn API key:</p>
        <input type="text" id="apiKeyInput" style="width:200px;padding:5px;" placeholder="API key" />
        <button id="saveApiKeyBtn" style="margin-left:8px;padding:5px 10px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;">Save</button>
    `;
 
    document.body.appendChild(container);
 
    document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
        const inputKey = document.getElementById('apiKeyInput').value.trim();
        if (inputKey) {
            localStorage.setItem('tornApiKey', inputKey);
            apiKey = inputKey;
            container.remove();
            alert('API key saved successfully!');
        } else {
            alert('API key cannot be empty.');
        }
    });
}
 
if (!apiKey) {
    askForApiKeyInline();
}
``
 
 
    // Torn API item IDs
    const itemIDs = [742, 172, 1458, 1457, 1264, 1462, 1461, 1219, 1460, 1459, 833, 1463, 1272, 54, 1248, 196, 407, 280, 1089, 1294, 1282, 220, 278, 1085, 259, 200, 265, 358, 1286, 1094, 427, 45, 275, 201, 221];
    let myItemValues = {};
 
 
 
async function getPricesFromAPI() {
    if (!apiKey) {
        console.warn("[ArsonBangForBuck] No API key found.");
        return false; // No key, fail
    }
 
    try {
        console.log("[ArsonBangForBuck] Fetching item prices from Torn API...");
        const updatedValues = {};
 
        const requestUrl = `https://api.torn.com/v2/torn/items?cat=All&sort=ASC&key=${apiKey}`;
        const response = await fetch(requestUrl);
        const data = await response.json();
 
        if (data.error) {
            console.error("[ArsonBangForBuck] Torn API error:", data.error.error);
            return false; //  Stop and fail if API error
        }
 
        const wantedItemIdsSet = new Set(itemIDs);
        data.items.forEach(item => {
            if (wantedItemIdsSet.has(item.id)) {
                updatedValues[item.name] = String(item.value.market_price);
            }
        });
 
        if (Object.keys(updatedValues).length > 0) {
            itemValues = { ...itemValues, ...updatedValues };
            saveItemValues();
            console.log("[ArsonBangForBuck] Updated item values from API:", updatedValues);
            return true; //  Success
        } else {
            console.warn("[ArsonBangForBuck] No matching items were updated.");
            return false; // Nothing updated
        }
 
    } catch (error) {
        console.error("[ArsonBangForBuck] Network or fetch error:", error);
        return false; //  Fail on exception
    }
}
 
 
 
 
    //  Call API fetch without blocking UI
    //getPricesFromAPI();

    // ─────────────────────────────────────────────────────────────────
    //  wb2: server-synced recipe overlay
    //  Pulls /api/arson/recipes from tornwar.com (where arsontest writes
    //  recipe edits) and overlays the rows onto `scenarios` so the
    //  community/admin's latest edits show up in the tooltip without
    //  the user needing to update this script. Cache (GM_setValue) for
    //  5 min so we don't hammer the server on every Torn page load.
    // ─────────────────────────────────────────────────────────────────
    const WB_RECIPES_URL   = 'https://tornwar.com/api/arson/recipes';
    const WB_CACHE_KEY     = 'bfb_server_recipes_v1';
    const WB_CACHE_TTL_MS  = 5 * 60 * 1000;

    /** Auto-calc total nerve from a recipe's items/stoke/dampen maps.
     *  Mirrors arsontest's autoCalcArsonNerve — keep these in sync.
     *  Formula: (items_qty + stoke_qty + dampen_qty + (flame?1:0)) × 5 + 5
     *  (5 per item action; flamethrower=true counts as +1 item since
     *  it IS the ignite step; +5 for combined start/end of crime). */
    function wbAutoCalcArsonNerve(r) {
        const sumQty = (obj) => obj && typeof obj === 'object'
            ? Object.values(obj).reduce((s, q) => s + (Number(q) || 0), 0)
            : 0;
        // Count the ignite step once: prefer the explicit `ignite`
        // string (added wb8 / arsontest 0.8.27), fall back to legacy
        // `flamethrower` bool for recipes saved before the schema add.
        const igniteCount = (r.ignite && String(r.ignite).trim()) ? 1
                          : (r.flamethrower ? 1 : 0);
        const totalQty = sumQty(r.items) + sumQty(r.stoke) + sumQty(r.dampen) + igniteCount;
        if (totalQty <= 0) return 0;
        return totalQty * 5 + 5;
    }

    /** Map a server recipe (structured fields) into the line-array shape
     *  the BFB tooltip code expects. Order mirrors upstream's existing
     *  scenario rows so the tooltip layout stays familiar. */
    function wbRecipeToLines(r) {
        if (!r || typeof r !== 'object') return null;
        const lines = [];
        const payout = r.payout != null && r.payout !== '' ? String(r.payout) : '';
        // Use stored nerve when present, otherwise auto-calc so the
        // tooltip can still show Profit/Nerve for recipes whose author
        // skipped the nerve field.
        let nerve = r.nerve  != null && r.nerve  !== '' ? Number(r.nerve)  : null;
        if (!(nerve && nerve > 0)) {
            const auto = wbAutoCalcArsonNerve(r);
            if (auto > 0) nerve = auto;
        }
        if (payout) lines.push('Payout: ' + payout);
        if (nerve && nerve > 0 && /^[\d.,kKmM]+$/.test(payout)) {
            // Best-effort profit/nerve calc only when payout parses cleanly.
            const num = parseFloat(payout.replace(/,/g, ''));
            const mult = /m/i.test(payout) ? 1_000_000 : /k/i.test(payout) ? 1_000 : 1;
            const profitPerNerve = Math.round((num * mult) / nerve);
            lines.push('Profit/Nerve: ' + profitPerNerve.toLocaleString());
        } else {
            lines.push('Profit/Nerve: ');
        }
        lines.push('Flamethrower: ' + (r.flamethrower ? 'Yes' : 'No'));
        // Render the ignite tool when set. Mirrors upstream BFB's
        // "Ignite: Lighter" line so users see the missing ignite info
        // that the 2026-05-16 migration silently dropped.
        if (r.ignite) lines.push('Ignite: ' + r.ignite);
        // Server stores items as { name: qty } (e.g. {"gasoline": 2,
        // "kerosene": 1}). Format as "2 gasoline, 1 kerosene" — matches
        // the way upstream BFB writes its "Place:" lines so the layout
        // stays consistent. Also accept arrays/strings for forward-compat.
        let itemsStr = '';
        if (Array.isArray(r.items)) {
            itemsStr = r.items.join(', ');
        } else if (r.items && typeof r.items === 'object') {
            itemsStr = Object.entries(r.items)
                .map(([name, qty]) => `${qty} ${name}`)
                .join(', ');
        } else if (typeof r.items === 'string') {
            itemsStr = r.items;
        }
        lines.push('Place: ' + itemsStr);
        lines.push('Stoke: '  + (r.stoke  || ''));
        lines.push('Dampen: ' + (r.dampen || ''));
        if (r.location) lines.push('Location: ' + r.location);
        return lines;
    }

    /** Overlay server recipes into the `scenarios` map (defined below).
     *  Mutates in place; safe to call repeatedly. */
    function wbOverlayServerRecipes(serverRecipes) {
        if (!serverRecipes || typeof serverRecipes !== 'object') return 0;
        let n = 0;
        for (const [key, recipe] of Object.entries(serverRecipes)) {
            const lines = wbRecipeToLines(recipe);
            if (!lines) continue;
            scenarios[key] = lines;
            n++;
        }
        // After any overlay, re-derive Profit/Nerve for every recipe
        // (including upstream-hardcoded ones whose authors left the
        // field blank). Idempotent — skips lines that already carry a
        // populated value.
        wbDeriveProfitPerNerveAll();
        return n;
    }

    /** Parse a "Payout: 210K" / "Payout:210K" / "Payout: $1.2M" string
     *  into a raw integer. Returns null on parse failure. */
    function wbParsePayoutString(s) {
        if (!s) return null;
        const m = String(s).match(/Payout\s*:\s*\$?\s*([\d.,]+)\s*([kKmMbB]?)/);
        if (!m) return null;
        const num = parseFloat(m[1].replace(/,/g, ''));
        if (!Number.isFinite(num)) return null;
        const suffix = (m[2] || '').toLowerCase();
        const mult = suffix === 'b' ? 1e9 : suffix === 'm' ? 1e6 : suffix === 'k' ? 1e3 : 1;
        return Math.round(num * mult);
    }

    /** Count item quantities on a "Place: 2 Gasoline, 1 Kerosene" line.
     *  Tolerant of the upstream format (no comma between item +
     *  quantity, mixed whitespace). Returns total quantity. */
    function wbCountItemsOnLine(s) {
        if (!s) return 0;
        // Strip the leading label "Place: " / "Stoke: " / "Dampen: ".
        const body = String(s).replace(/^[A-Za-z/]+:\s*/, '').trim();
        if (!body) return 0;
        let total = 0;
        // Match each leading digit run (each "N <item>" segment).
        // Handles "2 Gasoline, 1 Lighter" and "2 Gasoline 1 Lighter"
        // and stray punctuation upstream sometimes ships ("?1 Flamethrower?").
        const re = /(\d+)\s*[A-Za-z]/g;
        let m;
        while ((m = re.exec(body)) !== null) {
            const n = parseInt(m[1], 10);
            if (Number.isFinite(n) && n > 0) total += n;
        }
        return total;
    }

    /** Mutate a single line-array variant in place: if it has a
     *  "Profit/Nerve: " line with no value, compute one from the
     *  sibling Payout + Place/Stoke/Dampen + Flamethrower lines. */
    function wbDeriveProfitPerNerveForVariant(lines) {
        if (!Array.isArray(lines)) return;
        let payout = null;
        let itemsQty = 0;
        let flamethrowerYes = false;
        let ppnIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            if (typeof ln !== 'string') continue;
            if (/^Payout\s*:/i.test(ln) && payout == null) {
                payout = wbParsePayoutString(ln);
            } else if (/^Profit\s*\/\s*Nerve\s*:/i.test(ln)) {
                // Only auto-fill when the value side is empty/whitespace.
                const valuePart = ln.replace(/^[^:]+:\s*/, '').trim();
                if (!valuePart) ppnIndex = i;
            } else if (/^(Place|Stoke|Dampen)\s*:/i.test(ln)) {
                itemsQty += wbCountItemsOnLine(ln);
            } else if (/^Flamethrower\s*:/i.test(ln)) {
                if (/yes/i.test(ln)) flamethrowerYes = true;
            }
        }
        if (ppnIndex < 0) return;          // nothing to fill
        if (!payout || payout <= 0) return; // can't compute without payout
        const totalQty = itemsQty + (flamethrowerYes ? 1 : 0);
        if (totalQty <= 0) return;
        const nerve = totalQty * 5 + 5;
        const ppn = Math.round(payout / nerve);
        // Format compactly so the tooltip stays narrow: 1234 → "1.2K",
        // 12340 → "12K", 1234567 → "1.2M".
        let formatted;
        if (ppn >= 1e6) formatted = (ppn / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        else if (ppn >= 1e4) formatted = Math.round(ppn / 1e3) + 'K';
        else if (ppn >= 1e3) formatted = (ppn / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        else formatted = String(ppn);
        lines[ppnIndex] = 'Profit/Nerve: ' + formatted;
    }

    /** Walk every recipe in `scenarios` and fill blank Profit/Nerve
     *  lines. Handles both single-variant entries (array of strings)
     *  and multi-variant entries (array of arrays of strings). */
    function wbDeriveProfitPerNerveAll() {
        if (typeof scenarios !== 'object' || !scenarios) return;
        for (const key of Object.keys(scenarios)) {
            const entry = scenarios[key];
            if (!Array.isArray(entry)) continue;
            if (entry.length > 0 && Array.isArray(entry[0])) {
                // Multi-variant
                for (const variant of entry) wbDeriveProfitPerNerveForVariant(variant);
            } else {
                wbDeriveProfitPerNerveForVariant(entry);
            }
        }
    }

    /** Fire-and-forget fetch + cache + overlay. Synchronous overlay
     *  from cache happens at the call site (below) so the first hover
     *  already has fresh-ish data even if the network is slow. */
    function wbRefreshServerRecipes() {
        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: WB_RECIPES_URL,
                timeout: 10000,
                onload: (resp) => {
                    if (resp.status < 200 || resp.status >= 300) return;
                    let body;
                    try { body = JSON.parse(resp.responseText); } catch (_) { return; }
                    const recipes = body && body.recipes;
                    if (!recipes) return;
                    wbOverlayServerRecipes(recipes);
                    // Invalidate lowercase index since overlay added
                    // new keys, then recolor every card. Without this,
                    // first-load cards stay gray until the next DOM
                    // mutation tick — manifesting as "have to refresh
                    // to see colors" for the user.
                    if (scenarios._wbLowerIndex) scenarios._wbLowerIndex = null;
                    if (typeof wbApplyHighlightsToAllCards === 'function') {
                        wbApplyHighlightsToAllCards();
                    }
                    try {
                        GM_setValue(WB_CACHE_KEY, JSON.stringify({
                            ts: Date.now(), recipes
                        }));
                    } catch (_) {}
                },
            });
        } catch (_) { /* GM_xmlhttpRequest unavailable — silent no-op */ }
    }

    // Scenario data
    const scenarios = {
"A Bitter Taste": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"A Black Mark": [
    [
    "Payout:210K",
    "Profit/Nerve: ",
    "Flamethrower:  No",
    "Place: 2 Gasoline ",
    "Stoke: 1 Lighter",
    "Dampen: "
],
      [
    "Payout:210K",
    "Profit/Nerve: 13.9K ",
    "Flamethrower:  Yes",
    "Place: 1 Gasoline ",
    "Stoke: ?1 Flamethrower?",
          ]
  ],
"A Burnt Child Dreads the Fire": [
    [
        "Payout: 190K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Kerosene ",
    "Stoke: 1 Methane Tank",
    "Dampen: "
],
        [
      "Payout: 235K",
    "Profit/Nerve: 7.5K",
    "Flamethrower: Yes",
    "Place: 1 Hydrogen Tank ",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
            ]
],
"A Dirty Job": [
    [
        "Payout:30K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
      "Payout:32K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
        "A Fungus Among Us": [
            [
    "Payout:38K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
[
    "Payout:34K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
    ]
],
"A Hot Lead": [
    "Payout:22K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"A Mug's Game": [
    [
    "Payout:55K",
    "Profit/Nerve: ",
    "Ignite: 1 Molotov Cocktail",
    "Flamethrower: No",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
    ],
    [
    "Payout:55K",
    "Profit/Nerve: 2.7K",
     "Flamethrower: Yes",
     "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
    ]
],
        "A Problem Shared": [
            [
    "Payout: 180K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 6 Gasoline",
    "Stoke: 1 Gasoline",
    "Dampen: "
],
 [
    "Payout: 180K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
     ]
],
"A Rash Decision": [
    "Payout: 11K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"A Treat for the Tricked": [
    "Payout: 71K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Kabuki Mask",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"All Mouth and Trousers": [
    [
    "Payout: 51K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Diamond Ring",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
    "Payout: 56K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Diamond Ring",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
"Always Read the Label": [
    "Payout: 170K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 5 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
],
"Anon Starter": [
    [
        "Payout:1.2K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
        [
          "Payout:31K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
            ]
],
"Apart of the Problem": [
    [
    "Payout:265K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 6 Gasoline",
    "Stoke: ",
    "Dampen: "
],
      [
    "Payout:265K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
          ]
],
"Ash or Credit?": [
    "Payout:180K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Ashes to Ancestors": [
    [
        "Payout:90K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: 1 Gasoline ",
    ],
    [
        "Payout:90K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 5 Gasoline",
    "Stoke: ",
    ]
        ],
"Back, Sack, and Crack": [
    "Payout:300K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Hydrogen Tank",
    "Stoke: ",
    "Dampen: "
],
"Baewatch": [
    "Payout: 13K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Bagged and Tagged": [
    "Payout:1.6K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Bald Faced Destruction": [
    [
        "Payout:230K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Raw Ivory",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
      [
    "Payout:245K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Raw Ivory",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
          ]
],
"Bang For Your Buck": [
    [
        "Payout:21K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Grenade",
    "Place: 2 Gasoline",
   ],
    [
        "Payout:44K",
     "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Grenade",
    "Place: 1 Gasoline",
        ]
   ],
"Banking on It": [
    "Payout:120K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Stapler",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        "Banking on It": [
    "Payout:200K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Stapler",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Beach Bum": [
    [
    "Payout: 20K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Gasoline",
    "Stoke: 1 Gasoline",
    "Dampen: "
],
       [
    "Payout: 19K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
        "Beat the Odds": [
      "Payout: 330K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
                "Beggars Can't be Choosers": [
     "try 5 gasoline, 1 Thermite",
      "Payout: 480K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 5 Gasoline, 2 Thermite",
    "Stoke: ",
    "Dampen: "
],
"Beyond Repair": [
    "Try: 3 gas",
    "Payout: 93.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
],
"Blaze of Glory": [
    [
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Toothbrush",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
     [
         "Payout: 180K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Toothbrush",
    "Place: 2 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
        ]
],
"Blown to High Heaven": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Body of Evidence": [
    [
    "Payout: 105K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 6 Gasoline",
    "Stoke: ",
    "Dampen: "
],
      [
    "Payout: 105K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 5 Gasoline",
    "Stoke: ",
    "Dampen: "
          ]
],
        "Bone of Contention": [
            "Payout: 43K",
            "Profit/Nerve: 2.5K ",
            "ignite: lighter",
            "Place: 1 Gasoline",
            "Stoke: ",
            "Dampen: 1 Blanket"
],
"Boom Industry": [
    [
        "Payout: 130K",
       "Profit/Nerve: 3.6K",
    "Flamethrower: No",
    "Place: 5 Gasoline ",
 
],
        [
            "Payout: 100K",
    "Profit/Nerve: 3.9K",
    "Flamethrower: Yes",
    "Place: 3 Gasoline ",
]
],
"Boxing Clever": [
    "Payout: 325K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Bright Spark": [
    "Try: 1 Hyrdrogen, FT ignite, Metahne stoke",
    "Payout: 275K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 2 Hydrogen Tank",
    "Dampen: "
],
"Bugging Me": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Bummed Out": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Burn After Screening": [
    [
        "Payout: 99K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 100K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
    "Burn Notice": [
        [
    "Payout: 175K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: 3 Gasoline",
    "Dampen: "
],
     [
    "Payout: 175K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 5 Gasoline",
    "Stoke: 1 Flametrhower",
    "Dampen: "
         ]
],
"Burn Rubber": [
    [
      "Payout: 50K",
    "Profit/Nerve: 1.7K",
    "Flamethrower: No",
    "Evidence: 1 Mayan Statue",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
     "Payout: 67K",
    "Profit/Nerve: 2.4K",
    "Flamethrower: Yes",
    "Evidence: 1 Mayan Statue",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
    "Burn the Deck": [
        [
    "Payout: 57K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
     [
         "Payout: 96K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline ",
    "Stoke: ",
    "Dampen: "
         ]
],
"Burned by Stupidity": [
    "Payout: 32K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"Burned Cookies": [
    "Payout: 81K",
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Place: 2 Diesel, 2 Magnesium Shavings",
    "Stoke: 1 Diesel",
    "Dampen: "
],
"Burning Ambition": [
    [
    "Profit/Nerve: ",
    "Flamethrower: No ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
 [
     "Payout: 46K",
    "Profit/Nerve: 2.7K",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
     ]
],
        "Burning Calories": [
            [
    "Try: 5 Gasoline",
    "Payout: 84K",
    "Profit/Nerve: 2.7K",
    "Flamethrower: No",
    "Place: 4 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
     [
         "Payout: 100K",
    "Profit/Nerve: 3.2K",
    "Flamethrower: Yes",
    "Place: 4 Gasoline ",
    "Stoke: ",
    "Dampen: "
         ]
],
"Burning Liability": [
    "Payout: 160K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: 2 Hydrogen Tank",
    "Dampen: "
],
"Burning Memory": [
    [
     "Payout: 32K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
   [
       "Payout: 32K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
       ]
],
"Burning Through Cash": [
    [
    "Payout: 58K",
    "Profit/Nerve: ",
    "Flamethrower: No ",
    "Place: 1 Oxygen Tank",
    "Stoke: ",
    "Dampen: "
],
        [
            "Payout: 105K",
    "Profit/Nerve: Negative",
    "Flamethrower: Yes ",
    "Place: 1 Hydrogen Tank",
    "Stoke: ",
    "Dampen: "
            ]
],
"Burnt Ends": [
    "Might fail, try 5 gas?",
    "Payout:170K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: ?1 Flamethrower?",
    ],
                "Burn up the Dancefloor": [
                    [
    "Payout:150K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    ],
     [
    "Payout:175K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
         ]
    ],
        "Cache and Burn": [
    "Payout: 490K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Kerosene ",
    "Stoke: ",
    "Dampen: "
],
"Camera Tricks": [
    [
        "Payout: 115K",
    "Profit/Nerve: 2.9K",
    "Flamethrower: No",
    "Place: 5 Gasoline ",
    "Stoke: 1 Gasoline",
    "Dampen: "
],
        [
            "Payout: 115K",
    "Profit/Nerve: 3.1K",
    "Flamethrower: Yes",
    "Place: 4 Gasoline ",
    "Stoke:  1 Flamethrower",
    "Dampen: "
            ]
],
"Carrying a Torch": [
    "Payout: 44.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Chance of Redemption": [
    [
        "Payout: 90K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
        [
       "Payout: 59K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
            ]
],
"Charcoal Sketch": [
    [
    "Payout: 49K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
       [
    "Payout: 39K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
           ]
],
"Chasing Targets": [
    "Payout: 24K",
    "Profit/Nerve: 2K",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
        ],
"Checking Out": [
    "Payout: 280K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Child's Play": [
    [
        "Payout: 23K",
    "Profit/Nerve: 1.4K",
    "Flamethrower: No ",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
     [
         "Payout: 23K",
    "Profit/Nerve: 2.2K",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
         ]
],
"Claim to Flame": [
    "Payout: 33.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Clean Sweep": [
    [
        "Payout: 150K",
    "Profit/Nerve:  ",
    "Flamethrower: No",
    "Place: 5 Gasoline",
    "Stoke: 1 Diesel",
    "Dampen: "
],
      [
          "Payout: 150K",
    "Profit/Nerve:  ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
          ]
],
"Cleansed Through Fire": [
    "Payout: 46K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Diesel",
    "Stoke: ",
    "Dampen: "
],
"Clinical Exposure": [
    "Payout: 165K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Evidence:  1 Opium",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Cold Brew Reality": [
    "try stoke 1 Hydrpgen",
    "Payout: 150K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: 2 Hydrogen Tank",
    "Dampen: "
],
"Cold Feet": [
    [
        "Payout: 100K",
    "Profit/Nerve:  ",
    "Flamethrower: No",
    "Place: 6 Gasoline ",
    "Stoke: 1 Diesel ",
    "Dampen: "
],
      [
          "Try 4 gas",
          "Payout: 120K",
    "Profit/Nerve:  ",
    "Flamethrower: yes",
    "Place: 5 Gasoline ",
    "Stoke: 1 Flamethrower ",
    "Dampen: "
          ]
],
"Cook it Rare": [
    "Payout: 330K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 3 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"Cooked and Burned": [
    [
    "Payout: 70K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Ammonia",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
         [
    "Payout: 73K",
    "Profit/Nerve: 2.4K",
    "Flamethrower: Yes",
    "Evidence: 1 Ammonia",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
             ]
],
"Cooking the Books": [
    [
        "Payout: 22K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
        [
            "Payout: 25K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
            ]
],
"Cooking Time": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Cop Some Heat": [
    "Payout:19K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
"Crafty Devil": [
    "Payout: 100K",
    "Profit/Nerve: 10K",
    "Ignite: Lighter ",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Crisp Bills": [
    [
        "Payout: 35K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
        [
            "Payout: 39K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
            ]
],
"Curtain Call": [
    "Payout: 57K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        "Cut Corners": [
       "Payout: 200K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Cut to the Chase": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Daddy's Girl": [
    "Payout: 330K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Kerosene",
    "Stoke: 1 Methane Tank, 1 Hydrogen Tank",
    "Dampen: "
],
"Damned If You Don't": [
    "Payout: 74K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Dead Giveaway": [
    "Payout: 29K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"Dine and Dash": [
    "Payout: 95K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
        "Dirty Money": [
    "Payout: 360K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 3 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"Disco Inferno": [
    "Payout: 48K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: ",
    "Dampen: "
],
"Don't Hate the Player": [
    [
    "Payout: 20K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline",
   ],
      [
    "Payout: 32K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
          ]
   ],
"Doxing Clever": [
    "Try: Needs Thermite",
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Eight Lives": [
    [
    "Payout: 4.2K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
     "Payout: 6K",
    "Profit/Nerve:  ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
    "Emotional Wreck": [
        [
            "Payout: 140K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 6 Gasoline",
    "Stoke: ",
    "Dampen: "
],
    [
        "Payout: 140K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
        ]
],
"End of the Line": [
    [
    "Payout: 100K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 5 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
         [
    "Payout: 78K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline ",
    "Stoke: ",
    "Dampen: "
             ]
],
"Faction Fiction": [
    [
        "Payout: 64.5K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
    [
        "Payout: 64.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
        ]
],
"Family Feud": [
    [
        "Payout: 8K",
    "Profit/Nerve: 1.2K ",
    "Flamethrower: No",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 20K",
    "Profit/Nerve: 1.3K ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
           ]
],
"Fan the Flames": [
    "Payout: 33K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: ",
    "Dampen: "
],
"Fight Fire With Fire": [
    "Payout: 81K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Final Cut": [
    [
    "Payout: 150K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
     [
    "Payout: 150K",
    "Profit/Nerve: 4.9K",
    "Flamethrower: Yes",
    "Place: 4 Gasoline ",
    "Stoke: ",
    "Dampen: "
         ]
],
"Final Markdown": [
    "Payout: 49K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Finish Line": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Fire and Brimstone": [
    "Payout: 125K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        "Fire Burn and Cauldron Bubble": [
            [
    "Payout: 170K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 5 Gasoline",
    "Stoke: ",
    "Dampen: "
],
 [
    "Payout: 170K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
     ]
],
"Fire in the Belly": [
    "Payout: 17K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Fire Kills 99.9% of Bacteria": [
    "Payout: 305K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: ",
    ],
"Fire Sale": [
    "Payout: 10K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
        "Flame and Fortune": [
    "Payout: 680K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"Follow the Leader": [
    "Payout: 69K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Hydrogen Tank",
    "Stoke: ",
    "Dampen: "
],
"For Closure": [
    [
        "Payout: 22K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
  [
      "Payout: 16K",
    "Profit/Nerve: ",
    "Flamethrower: yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
      ]
],
"Foul Play": [
    [
        "Payout: 120K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 5 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
        [
    "Payout: 120K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline ",
    "Stoke: ",
    "Dampen: "
            ]
],
"From the Ashes": [
    [
        "Payout: 120K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 5 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
      [
    "Payout: 170K",
    "Profit/Nerve: 3.3K",
    "Flamethrower: Yes",
    "Place: 4 Gasoline ",
    "Stoke: ",
    "Dampen: "
          ]
],
"Gay Frogs": [
    [
    "Try: 3 Gasoline",
        "Payout: 41K",
    "Profit/Nerve: 1.3K",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
      [
        "Payout: 34K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
          ]
],
        "Gentrifried": [
         "Payout: 230K",
        "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: 2 Potassium Nitrate",
    "Dampen: "
],
"Get Wrecked": [
    [
    "Payout: 90K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
            "Payout: 84K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
        "Going Viral": [
            [
    "Payout: 190K",
    "Profit/Nerve: 4.9K",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
 [
    "Payout: 190K",
    "Profit/Nerve: K",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ?1 Flamethrower?",
    "Dampen: "
     ]
],
"Green With Envy": [
    [
     "Payout: 120K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 6 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
        [
    "Payout: 120K",
    "Profit/Nerve: 4.5K",
    "Flamethrower: Yes",
    "Place: 4 Gasoline ",
    "Stoke: ",
    "Dampen: "
            ]
],
"Gym'll Fix It": [
    [
    "Payout: 62K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
    "Payout: 52K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"Hair Today...": [
    "Payout: 93K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Heat the Rich": [
    [
        "Payout: 34K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 40K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"Hell Fire": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Hide and Seek": [
    [
    "Payout: 33K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
    "Payout: 33K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"High Time": [
    [
        "Payout: 4.3K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
      [
          "Payout: 10K",
    "Profit/Nerve: 650",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
          ]
],
"Hire and Fire": [
    [
     "Payout: 49K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
       "Payout: 57K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"Hold Fire": [
    "Payout: 110K",
    "Profit/Nerve:  ",
    "Ignite: Lighter",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Holy Smokes": [
    "Payout: 56.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Home and Dry": [
    [
        "Payout: 35K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 49K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"Hostile Takeover": [
    "Payout: 300K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Hot Dinners": [
    "Payout:55K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Diesel",
    "Stoke: ",
    "Dampen: "
],
"Hot Dog": [
    [
     "Payout: 38K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 30.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"Hot Gossip": [
    [
        "Payout: 62K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline ",
    "Stoke: ",
    "Dampen: "
        ],
     [
    "Payout: 62K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
         ]
],
"Hot Off the Press": [
    "Payout: 18K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        "Hot on the Trail": [
    "Payout: 390K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Hot out of the Gate": [
    [
    "Payout: 53K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Gold Tooth",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
    "Payout: 96K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Gold Tooth",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
        "Hot Profit": [
    "Payout: 84K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Hot Profit": [
    "Payout: 57.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Hot Pursuit": [
    [
    "Payout: 28K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
      [
    "Payout: 50K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
          ]
],
"Hot Trend": [
    "Payout: 54K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"Hot Under the Collar": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
                "House Edge": [
                    [
            "Payout: 190K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 5 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
            "Payout: 135K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
   "House of Cards": [
    "Payout: 610K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen",
    "Stoke: 2 Hydrogen",
    "Dampen: "
],
    "Igniting Curiosity": [
        [
        "Payout: 100K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Sumo Doll ",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
           [
        "Payout: 260K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Sumo Doll ",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
               ]
],
"Improving the Odds": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"In Your Debt": [
    "Payout: 33K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"Insert Coin to Continue": [
    "Payout: 120K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"It Cuts Both Ways": [
    [
        "Payout: 19K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 20.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"It's a Write Off": [
    "Payout: 225K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"It's Not All White": [
    "Payout: 140K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Kindling Spirits": [
    [
    "Payout: 64K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
      [
    "Payout: 92.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
          ]
],
"Landmark Decision": [
    "Try 4 Gas",
     "Payout: 280K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 5 Gasoline ",
    ],
    "Last Lyft Home": [
        "Payout: 52K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    ],
"Letter of the Law": [
    [
            "Payout:1K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
      [
    "Payout: 360K",
    "Profit/Nerve:",
    "Flamethrower: Yes",
    "Place: 1 Hydrogen Tank",
    "Stoke: 2 Hydrogen Tank",
    "Dampen: "
          ]
],
"Light Fingered": [
    [
    "Payout: 165K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
    "Payout: 165K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"Like for Like": [
    "Payout: 110K",
    "Profit/Nerve: 1.1K",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Liquor on the Back Row": [
    [
        "Payout: 37K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 50K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
      ]
],
"Local Concerns": [
    [
        "Payout: 20K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
            "Payout: 30K",
    "Profit/Nerve: 1.5K",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
"Lock, Stock, and Barrel": [
    "Payout: 210K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank"
   ],
        "Long Pig": [
    "Payout: 130K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Loud and Clear": [
    "Payout: 195K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Lover's Quarrel": [
    "Payout: 39K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        "Low Rent": [
    "Payout: 120K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
        "Make a Killing": [
            [
    "Payout:260K",
    "Profit/Nerve: ",
    "Flametrhower: No",
    "Place: 1 Gasoline, 2 Kerosene",
    "Stoke: ",
    "Dampen: "
            ],
            [
            "Payout: 390k",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline, 2 Kerosene",
    "Stoke: ",
    "Dampen: "
                    ]
],
"Marked for Salvation": [
    [
        "Payout:30K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Hydrogen Tank ",
    "Stoke: ",
    "Dampen: "
],
        [
       "Payout: 80K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
    ]
],
        "Mallrats": [
       "Tip: fast responders",
      "Payout: 410K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline ",
    "Stoke: 1 Flamethrower",
    "Dampen: "
],
"Marx & Sparks": [
    [
    "Payout: 140K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
    "Payout: 125K",
    "Profit/Nerve: ",
    "Flamethrower: yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
"Medium Rare": [
    "Payout: 330K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 4 Diesel",
    "Stoke: ",
    "Dampen: "
],
        "Mental Block": [
    "Payout: 580K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 5 Gasoline, 1 Thermite",
    "Stoke: ?1 Flamethrower?",
    "Dampen: "
],
"Milk Milk, Lemonade": [
    "Payout: 155K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen:  "
],
"Muscling In": [
    "Payout: 90.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Syringe",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Naked Aggression": [
    [
        "Payout:31.5K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 31.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
    ]
],
"Needles to Say": [
    [
    "Payout: 23K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
    "Payout: 39K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
        "Not a Leg to Stand on": [
            [
    "Payout: 150K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 6 Gasoline",
    "Stoke: ",
    "Dampen: "
],
[
    "Payout: 125K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
    ]
],
"Off the Market": [
    [
     "Payout: 30K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
       [
     "Payout: 155K",
    "Profit/Nerve: 4.5K",
    "Flamethrower: Yes",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
           ]
],
"Oh God, Yes": [
    "Payout: 17.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
"Old School": [
    [
    "Payout: 62K",
    "Profit/Nerve: 2K",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
    "Payout: 62.5K",
    "Profit/Nerve: 2.3K",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
"On Fire at the Box Office": [
    [
        "Payout: 10K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Hydrogen Tank",
    "Stoke: ",
    "Dampen: "
],
     [
         "Payout: 14K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Hydrogen Tank",
    "Stoke: ",
    "Dampen: "
         ]
],
"One Rotten Apple": [
    [
        "Payout: 180K",
    "Profit/Nerve: 8.5K",
    "Flamethrower: No",
    "Place: 3 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
     [
     "Payout: 180K",
    "Profit/Nerve: 11.9K",
    "Flamethrower: Yes",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
         ]
],
"Open House": [
    "Payout: 64K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Out in the Wash": [
    [
      "Payout: 235K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
            "Payout: 235K",
     "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
"Out with a Bang": [
    "Payout: 42K",
    "Profit/Nerve: ",
     "Ignite: Lighter ",
    "Place: 1 Gasoline",
    "Dampen: 1 Blanket "
],
"Party Pooper": [
        [
     "Payout: 58K",
    "Profit/Nerve: 2.3K",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
    [
        "Payout: 62K",
    "Profit/Nerve: 3.3K",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
        ]
],
"Pest Control": [
    "Payout: 16K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: ",
    "Dampen: "
],
"Piggy in the Middle": [
    "Payout: 73K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
        "Piggy in the Middle": [
            "Payout: 104K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
"Plane and Simple": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Planted": [
    "Payout: 120K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Evidence: 1 Pele Charm",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        "Playing With Fire": [
            "Payout: 210K",
            "Profit/Nerve: ",
            "Ignite: Lighter",
            "Place: 2 Gasoline ",
            "Stoke: ",
            "Dampen: "
],
"Point of No Return": [
    "Payout: 90K",
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Place: 1 Gasoline, 1 Thermite",
    "Stoke: 2 Magnesium Shavings",
    "Dampen: "
],
"Political Firestorm": [
    [
    "Payout: 22K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
      [
    "Payout: 40K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
          ]
],
        "Pyro for Pornos": [
            "Payout: 65K",
            "Profit/Nerve: ",
            "Flamethrower: Yes",
            "Place: 2 Gasoline",
            ],
        "Raising Hell": [
            [
    "Payout: 170K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 6 Gasoline",
    "Stoke: ",
    "Dampen: "
],
 [
    "Payout: 170K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
     ]
],
"Raze the Roof": [
    "Payout: 90k",
    "Profit/Nerve: 150",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Raze the Steaks": [
    "Payout: 250K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 5 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Read the Room": [
    [
        "Payout: 125K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 5 Gasoline",
    "Stoke: ",
    "Dampen: "
],
 [
     "Payout: 125K",
     "Try: 3 Gas",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
     ]
],
"Remote Possibility": [
    "Payout: 102.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    ],
"Rest in Peace": [
    "Payout: 20.5K",
    "Profit/Nerve: 1.6K",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Ring of Fire": [
    "Payout: 160K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Risky Business": [
    "Payout: 50K",
    "Profit/Nerve: ",
    "Ignition: Lighter ",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"Roast Beef": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
        "Rock the Boat": [
      "Payout: 325K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Diesel",
    "Stoke: ",
    "Dampen: "
],
        "Searing Irony": [
     "Payout: 240K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Second Hand Smoke": [
    "Payout: 37K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"See No Evil": [
    [
    "Payout: 52K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
     [
        "Payout:71K",
    "Profit/Nerve: 3.6K",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
         ]
],
        "Set 'Em Straight": [
    "Payout: 310K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Shaky Investment": [
    "Payout: 80K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Hydrogen Tank",
    "Stoke: ",
    "Dampen: "
],
"Shielded from the Truth": [
    [
    "Payout: 8.9K",
    "Profit/Nerve: 850",
    "Flamethrower: No",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
       [
    "Payout: 16K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
           ]
],
        "Short Shelf Life": [
    "Payout: 395K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
"Sky High Prices": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: Glitter Bomb",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Smoke on the Water": [
    [
        "Payout: 4.2K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
     [
         "Payout: 8.6K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
         ]
],
"Smoke Out": [
    [
        "Payout: 10K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Cannabis",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 21K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Cannabis",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
                "Smoke Signals": [
     "Try: Try 2 Diesel",
    "Payout: 120K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Diesel, 1 Magnesium Shavings",
    "Stoke: ",
    "Dampen: "
],
                        "Smoke Screen": [
    "Payout: 535K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ?1 Flamethrower?",
    "Dampen: "
],
        "Smoke Without Fire": [
    "Payout: 200K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Smoldering Resentment": [
    [
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
        [
     "Payout: 10K",
    "Profit/Nerve: 950",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
"Sofa King Cheap": [
    "Payout: 120K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
"Specter of Destruction": [
    "Payout: 74K",
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: 1 Elephant Statue",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Spirit Level": [
    "Payout: 280k",
    "Profit/Nerve:",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke:",
    "Dampen: "
],
"Stick to the Script": [
    "Payout: 160K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 2 Hydrogen Tank",
    "Dampen: "
],
"Stink to High Heaven": [
    "Payout: 41K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
"Stop, Drop and Lol": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"Strike While it's Hot": [
    "Payout: 265K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Hydrogen Tank",
    "Stoke: 2 Hydrogen Tank",
    "Dampen: "
],
        "Stroke of Fortune": [
            [
    "Payout: 120K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 6 Gasoline",
    "Stoke: ",
    ],
[
    "Payout: 120K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: 1 Flamethrower",
    ]
    ],
        "Supermarket Sweep": [
            [
    "Payout: 265K",
    "Profit/Nerve:",
    "Flamethrower: No",
    "Place: 5 Gasoline",
    "Stoke: 1 Lighter",
    "Dampen: "
],
 [
    "Payout: 265K",
    "Profit/Nerve:",
    "Flamethrower: Yes",
    "Place: 5 Gasoline",
    "Stoke: ",
    "Dampen: "
     ]
],
"Swansong": [
    "Payout: 27K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Kerosene",
    "Stoke: ",
    "Dampen: "
],
                "Taking out the Trash": [
         "Payout:110K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: 1 Hard Drive",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        "That Place Is History": [
            [
         "Payout:90K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
 [
     "Payout: 118.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
     ]
],
    "The Ashes of Empire": [
    "Payout: 175K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 2 Gasoline ",
    "Dampen: "
],
"The Bad Samaritan": [
    "Payout: 22K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
],
"The Bolted Horse": [
    "Profit/Nerve: ",
    "Flamethrower: ",
    "Evidence: ",
    "Place: ",
    "Stoke: ",
    "Dampen: "
],
"The Declaration of Inebrience": [
    [
    "Payout: 115K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
    "Payout: 115K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"The Devil's in the Details": [
    [
        "Payout: 73K",
    "Profit/Nerve: Negative",
    "Flamethrower: No",
    "Place: 3 Diesel",
    "Stoke: ",
    "Dampen: "
],
    [
        "might fail",
        "Payout: 130K",
    "Profit/Nerve: 750",
    "Flamethrower: Yes",
    "Place: 1 Diesel",
    "Stoke: 1 Potassium Nitrate",
    "Dampen: "
        ]
],
"The Empyre Strikes Back": [
    [
        "Payout: 49K",
    "Profit/Nerve: 1.8K",
    "Flamethrower: No",
    "Place: 5 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
     "Payout: 49K",
    "Profit/Nerve: 2.4K",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
     "The Fat is in the Fire": [
     "Payout: 300k",
    "Profit/Nerve: ",
    "Flamethrower: yes",
    "Place: 5 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
],
                "The Fire Chief": [
                    [
        "Payout: 130K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 6 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
        "Payout: 140K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: 1 Flamethrower",
    "Dampen: "
                    ]
],
"The Fried Piper": [
    "Payout: 270K",
    "Profit/Nerve: 14.9K",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank ",
   ],
"The Grass Ain't Greener": [
    [
    "Payout: 85K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: 1 Diesel",
    "Dampen: "
],
        [
    "Payout: 85K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
"The Male Gaze": [
    [
    "Payout: 130K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
     [
    "Payout: 110K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
         ]
],
"The Midnight Oil": [
    [
        "Payout:63K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
      [
          "Payout: 75K",
    "Profit/Nerve: ",
    "Flamethrower: Yes ",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
          ]
],
"The Plane Truth": [
    [
        "Payout: 38K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
            "Payout: 25K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
"The Savage Beast": [
    "Payout: 170K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        "The Smoking Gun": [
    "Payout: 470K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 4 Kerosene",
    "Stoke: ?1 Lighter? ",
    "Dampen: "
],
"The Waiting Game": [
    "Payout: 120K",
    "Profit/Nerve: ",
    "Ignite: Lighter",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Third-Degree Burn": [
    [
        "Payout: 25.5K",
    "Profit/Nerve: 1.6K",
    "Flamethrower: No",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
     [
         "Payout: 29K",
    "Profit/Nerve: 2.2K",
    "Flamethrower: Yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
         ]
],
"To the Manor Scorned": [
    "Payout: 75.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Totally Armless": [
    [
    "Payout: 44K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Kerosene",
    "Stoke: ",
    "Dampen: "
],
      [
    "Payout: 35K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
          ]
],
"Turn up the Heat": [
    [
        "Payout: 90K",
       "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Compass",
    "Place: 4 Gasoline",
   ],
      [
          "Payout: 76K",
    "Profit/Nerve: 1.6K",
    "Flamethrower: Yes",
    "Evidence: 1 Compass",
    "Place: 2 Gasoline",
          ]
   ],
"Twisted Firestarter": [
    [
        "Payout: 32K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
       "Payout: 23K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
"Uber Heats": [
    [
    "Payout: 78K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
        [
    "Payout: 59K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline ",
    "Stoke: ",
    "Dampen: "
    ]
],
     "Under the Table": [
         "Try: gas, lighter, 2 methane",
      "Payout: 400K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline ",
    "Stoke: ?1 Flamethrower?",
    "Dampen: "
],
"Unpopular Mechanics": [
    [
    "Payout: 4.5K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
],
        [
    "Payout: 8.6K",
    "Profit/Nerve: ",
    "Flamethrower: yes",
    "Place: 1 Gasoline ",
    "Stoke: ",
    "Dampen: "
            ]
],
"Unspilled Beans": [
    "Payout: 220K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: 2 Hydrogen Tank",
    "Dampen: "
],
"Visions of the Savory": [
    [
    "Payout: 70K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: 1 Family Photo",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
           "Payout: 110K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence:  1 Family Photo",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"Waist Not, Want Not": [
    "Payout: 210K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
"Wedded to the Lie": [
    [
       "Payout: 81K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        [
      "Payout: 69K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
            ]
],
 "Wet Behind the Ears": [
     [
         "Payout: 240k",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
     [
         "Payout: 200k",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 1 Gasoline",
    "Stoke: ",
    "Dampen: "
         ]
],
"Where There's a Will": [
    [
    "Payout: 23K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Evidence: ",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
],
       [
    "Payout: 52K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Evidence: ",
    "Place: 3 Gasoline",
    "Stoke: ",
    "Dampen: "
           ]
],
"Whiskey Business": [
    "Payout: 90K",
    "Profit/Nerve: ",
    "Ignite: Lighter ",
    "Place: 1 Hydrogen Tank",
    "Stoke: 1 Hydrogen Tank",
    "Dampen: "
],
        "Wired for War": [
     "Payout:430K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 8 Gasoline",
    "Stoke: ",
    "Dampen: "
],
        "Womb With a View": [
            [
    "Payout: 95K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    ],
 [
    "Payout: 78.5K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
     ]
    ],
        "Workplace Burnout": [
            [
    "Payout: 100K",
    "Profit/Nerve: ",
    "Flamethrower: No",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
],
            [
    "Payout: 73K",
    "Profit/Nerve: ",
    "Flamethrower: Yes",
    "Place: 2 Gasoline",
    "Stoke: ",
    "Dampen: "
                ]
],
"You're Fired!": [
    "Payout: 150K",
    "Profit/Nerve: 4.4K",
    "Flamethrower: ",
    "Evidence: 1 Lipstick",
    "Place: 4 Gasoline",
    "Stoke: ",
    "Dampen: "
]
    };

    // wb6: always pre-fill Profit/Nerve on upstream's hardcoded
    // recipes (most of which ship with the field blank). Runs once
    // up-front so the first hover already shows a value even before
    // server overlay completes. The server-overlay path also calls
    // wbDeriveProfitPerNerveAll() at the end so newly-overlaid recipes
    // get the same treatment.
    wbDeriveProfitPerNerveAll();

    // wb2: hydrate from cache synchronously so the first hover gets
    // last-seen server recipes immediately; then async-refresh if the
    // cache is older than TTL.
    try {
        const cached = GM_getValue(WB_CACHE_KEY, '');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.recipes) {
                wbOverlayServerRecipes(parsed.recipes);
            }
            if (!parsed || !parsed.ts || (Date.now() - parsed.ts) > WB_CACHE_TTL_MS) {
                wbRefreshServerRecipes();
            }
        } else {
            wbRefreshServerRecipes();
        }
    } catch (_) {
        // Cache parse failed or GM_getValue unavailable — just fetch fresh.
        wbRefreshServerRecipes();
    }


// Item values persistence
const defaultItemValues = {
    "Molotov Cocktail": "184388",
    Gasoline: "500",
    Diesel: "30K",
    Kerosene: "70K",
    "Potassium Nitrate": "70K",
    "Magnesium Shavings": "80K",
    Thermite: "500K",
    "Oxygen Tank": "125K",
    "Methane Tank": "110K",
    "Hydrogen Tank": "45K",
    Sand: "144993",
    "Fire Extinguisher": "383256"
};
 
const evidenceItemValues = {
Ammonia: "5257",
Cannabis: "5834",
Compass: "11094",
"Diamond Ring": "2732",
"Elephant Statue": "16644",
"Family Photo": "9298",
"Glitter Bomb": "902027",
"Gold Tooth": "18485",
Grenade: "6999",
"Hard Drive": "400",
"Kabuki Mask": "71853",
Lipstick: "228",
"Mayan Statue": "3008",
Opium: "32562",
"Pele Charm": "3081",
"Raw Ivory": "69849",
Stapler: "9078",
"Sumo Doll": "19275",
Syringe: "1507",
Toothbrush: "5030",
};
 
 
 
let itemValues = {};
 
function loadItemValues() {
    const saved = localStorage.getItem('itemValues');
    if (saved) {
        try {
            const loaded = JSON.parse(saved);
            itemValues = { ...defaultItemValues, ...evidenceItemValues, ...loaded };
        } catch (e) {
            console.error("Failed to parse saved item values:", e);
            itemValues = { ...defaultItemValues, ...evidenceItemValues };
        }
    } else {
        itemValues = { ...defaultItemValues, ...evidenceItemValues };
    }
}
 
function saveItemValues() {
    localStorage.setItem('itemValues', JSON.stringify(itemValues));
}
 
//  Call this immediately after defining it
loadItemValues();
 
 
 
 
function calculateMaterialCost(lines) {
    let baseCost = 0;
    let optionalExtra = 0;
 
    const regex = /(\d+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/g;
    const optionalRegex = /\?(\d+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)\?/g;
 
    lines.forEach(line => {
 
        // Remove optional blocks for base calculations
        const cleaned = line.replace(/\?[^?]+\?/g, "");
 
        // Base items
        if (/^(Place|Stoke|Dampen|Evidence)/i.test(line)) {
            let m;
            while ((m = regex.exec(cleaned)) !== null) {
                const qty = parseInt(m[1], 10);
                const item = m[2].trim();
                const key = Object.keys(itemValues).find(k => k.toLowerCase() === item.toLowerCase());
                if (key) {
                    baseCost += qty * parseValue(itemValues[key]);
                }
            }
        }
 
        // Optional items
        let o;
        while ((o = optionalRegex.exec(line)) !== null) {
            const qty = parseInt(o[1], 10);
            const item = o[2].trim();
            const key = Object.keys(itemValues).find(k => k.toLowerCase() === item.toLowerCase());
            if (key) {
                optionalExtra += qty * parseValue(itemValues[key]);
            }
        }
    });
 
    return {
        baseCost,
        optionalCost: baseCost + optionalExtra   // <<< KEY FIX
    };
}
``
 
 
 
 
 
    // Highlight values persistence
    const defaultHighlightValues = {
        LowProfit: 5000,
        HighProfit: 10000
    };
    let highlightValues = { ...defaultHighlightValues };
 
    function loadHighlightValues() {
        const saved = localStorage.getItem('highlightValues');
        if (saved) {
            try { highlightValues = JSON.parse(saved); } catch (e) { console.error("Failed to parse saved highlight values:", e); }
        }
    }
    function saveHighlightValues() { localStorage.setItem('highlightValues', JSON.stringify(highlightValues)); }
    loadHighlightValues();
 
    //  Helpers for cost/profit
    function parseValue(value) {
        return value.toUpperCase().endsWith("K") ? parseFloat(value) * 1000 : parseFloat(value);
    }
 
 
 
 
    function formatProfitNerve(value) {
        // wb7: format negatives with the same K-suffix that positives
        // get. Previous code returned raw "-2000" for negative profit
        // while positive >=1000 got "2.0K" — inconsistent and visually
        // misleading (user reported seeing "0" for net-loss recipes
        // when in practice the formatter was producing a long raw
        // negative integer that the user mis-read).
        const sign = value < 0 ? '-' : '';
        const abs = Math.abs(value);
        const rounded = Math.floor(abs / 100) * 100;
        return rounded >= 1000
            ? `${sign}${(rounded / 1000).toFixed(1)}K`
            : `${sign}${rounded}`;
    }
 
 
 
 
function calculateProfitPerNerve(lines) {
 
    // read payout
    const payoutLine = lines.find(l => l.startsWith("Payout:"));
    if (!payoutLine) return null;
 
    const match = payoutLine.match(/([\d\.]+)\s*K?/i);
    if (!match) return null;
 
    let payout = parseFloat(match[1]);
    if (/K/i.test(payoutLine)) payout *= 1000;
 
    const { baseCost, optionalCost } = calculateMaterialCost(lines);
 
    let itemCount = 0;
    let optionalItemCount = 0;
 
    const regex = /(\d+)\s+[A-Za-z]+/g;
    const optionalRegex = /\?(\d+)\s+[A-Za-z]+/g;
    const optionalAddRegex = /\?\+(\d+)\s+[A-Za-z]+/g;
 
    lines.forEach(line => {
 
        // 1. Remove optional before counting base items
        const cleaned = line.replace(/\?[^?]+\?/g, "");
        let m;
 
        if (/^(Place|Stoke|Dampen|Evidence)/i.test(line)) {
            while ((m = regex.exec(cleaned)) !== null) {
                itemCount += parseInt(m[1], 10);
            }
        }
 
        // 2. Optional full items
        let o;
        while ((o = optionalRegex.exec(line)) !== null) {
            optionalItemCount += parseInt(o[1], 10);
        }
 
        // 3. Optional additions "?+1 Gasoline?"
        let o2;
        while ((o2 = optionalAddRegex.exec(line)) !== null) {
            optionalItemCount += parseInt(o2[1], 10);
        }
    });
 
    // correct nerve formula
    const baseNerve = 10 + (itemCount * 5);
    const optionalNerve = baseNerve + (optionalItemCount * 5);
 
    const baseProfit = (payout - baseCost) / baseNerve;
    const optionalProfit = (payout - optionalCost) / optionalNerve;
 
    const hasOptional = optionalItemCount > 0;
 
    return {
        profitText: hasOptional
            ? `<span style="color: orange;">${formatProfitNerve(optionalProfit)}</span> – ${formatProfitNerve(baseProfit)}`
            : formatProfitNerve(baseProfit),
        nerveText: hasOptional
            ? `${baseNerve} – <span style="color: orange;">${optionalNerve}</span>`
            : `${baseNerve}`,
        hasOptional
    };
}
 
 
 
    //  CSS for highlights (aligned colors)
 
 
// Remove any old highlight CSS from previous runs
document.querySelectorAll('style').forEach(s => {
    if (s.textContent.includes('.highlight-negative')) {
        s.remove();
    }
});
 
// Create style element for dynamic theme-aware CSS
const style = document.createElement('style');
document.head.appendChild(style);
 
// Universal Dark Mode detection
function isDarkModeEnabled() {
    // 1. Torn checkbox
    const checkbox = document.getElementById('dark-mode-state');
    if (checkbox) return checkbox.checked;
 
    // 2. Body or HTML class
    const bodyClasses = document.body.className.toLowerCase();
    const htmlClasses = document.documentElement.className.toLowerCase();
    if (bodyClasses.includes('dark') || htmlClasses.includes('dark')) return true;
 
    // 3. Computed background brightness
    const bgColor = getComputedStyle(document.body).backgroundColor;
    const rgbMatch = bgColor.match(/\d+/g);
    if (rgbMatch) {
        const [r, g, b] = rgbMatch.map(Number);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        return brightness < 128; // Dark if brightness is low
    }
 
    // 4. Fallback to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
 
// Apply theme-aware colors
 
function applyThemeColors() {
    const isDarkMode = isDarkModeEnabled();
    const isColorblind = localStorage.getItem('colorblindMode') === 'true';
 
    const darkColors = isColorblind ? {
        negative: 'rgba(40, 40, 40, 0.7)',
        low:      'rgba(100, 100, 100, 0.3)',
        high:     'rgba(255, 215, 0, 0.45)',
        jackpot:  'rgba(70, 130, 180, 0.3)'
    } : {
        negative: 'rgba(81, 55, 55, 1.0)',
        low: 'rgba(200, 185, 30, 0.15)',
        high: 'rgba(40, 144, 69, 0.15)',
        jackpot: 'rgba(20, 255, 20, 0.20)'
    };
 
    const lightColors = isColorblind ? {
        negative: 'rgba(100, 100, 100, 0.4)',
        low:      'rgba(140, 140, 140, 0.3)',
        high:     'rgba(235, 205, 0, 0.45)',
        jackpot:  'rgba(70, 130, 180, 0.35)'
    } : {
        negative: 'rgba(255, 200, 200, 1.0)',
        low: 'rgba(255, 255, 150, 0.4)',
        high: 'rgba(150, 255, 150, 0.4)',
        jackpot: 'rgba(100, 255, 100, 0.5)'
    };
 
    const colors = isDarkMode ? darkColors : lightColors;
 
    style.textContent = `
        /* Tooltip styling */
        .custom-tooltip {
            position: absolute;
            background: ${isDarkMode ? '#333' : '#fff'};
            color: ${isDarkMode ? '#fff' : '#000'};
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            display: none;
            flex-direction: column;
            gap: 4px;
            z-index: 9999;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            transition: opacity 0.2s ease;
            opacity: 0;
            pointer-events: none;
        }
 
        /* Highlight colors */
        .highlight-negative { background-color: ${colors.negative} !important; }
        .highlight-low { background-color: ${colors.low} !important; }
        .highlight-high { background-color: ${colors.high} !important; }
        .highlight-jackpot { background-color: ${colors.jackpot} !important; }
 
        /* Settings button */
        #itemValuesButton {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: #28a745;
            color: #fff;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            z-index: 9999;
        }
 
        /* Settings panel */
        #settingsPanel {
            position: absolute;
            top: 100%;
            right: 10px;
            background: #222;
            color: #fff;
            padding: 10px;
            border-radius: 6px;
            z-index: 9998;
            display: none;
            width: 260px; /* Compact width */
        }
 
        #settingsPanel h4 {
            margin: 6px 0;
            font-size: 13px;
            font-weight: bold;
        }
 
        /* Rows for label + input */
        #settingsPanel .item-row {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            margin-bottom: 3px;
        }
 
        #settingsPanel label {
            width: 120px; /* Fixed width for alignment */
            text-align: left;
            font-size: 12px;
            white-space: nowrap;
        }
 
        #settingsPanel input {
            width: 60px; /* Smaller box */
            text-align: right;
            padding: 2px;
            font-size: 12px;
            margin-left: auto; /* Push input to far right */
        }
    `;
}
 
 
 
// Initial apply
applyThemeColors();
 
// Reapply when DOM changes (theme toggle or page updates)
const themeObserver = new MutationObserver(applyThemeColors);
themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
 
// Debug log
console.log('Dark Mode detected:', isDarkModeEnabled());
 
 
 
    //  Settings UI
 
 
function createSettingsUI() {
    // FIX: hashed class `appHeader___gUnYC` → attribute substring match.
    // The header element also has the stable class `crimes-app-header`,
    // which is the most reliable selector. Fall back to the hash-prefix match.
    const header = document.querySelector('#react-root .crimes-app-header')
                || document.querySelector('#react-root [class*="appHeader___"]');
    if (!header) return;
 
    const hasArson = header.textContent.includes('Arson');
    const existingButton = document.querySelector('#itemValuesButton');
    const existingPanel = document.querySelector('#settingsPanel');
 
    if (hasArson) {
        if (!existingButton) {
            header.style.position = 'relative';
 
            const newButton = document.createElement('button');
            newButton.id = 'itemValuesButton';
            newButton.textContent = 'Settings';
 
            const newPanel = document.createElement('div');
            newPanel.id = 'settingsPanel';
 
            // Tabs
            const tabContainer = document.createElement('div');
            tabContainer.style.marginBottom = '10px';
            tabContainer.style.display = 'flex';
            tabContainer.style.justifyContent = 'space-between';
            tabContainer.style.alignItems = 'center';
 
            const fuelTab = document.createElement('button');
            fuelTab.textContent = 'Fuel';
            const evidenceTab = document.createElement('button');
            evidenceTab.textContent = 'Evidence';
            const highlightTab = document.createElement('button');
            highlightTab.textContent = 'Highlight';
 
            [fuelTab, evidenceTab, highlightTab].forEach(btn => {
                btn.style.background = '#444';
                btn.style.color = '#fff';
                btn.style.border = 'none';
                btn.style.padding = '5px 10px';
                btn.style.cursor = 'pointer';
            });
 
            // API Button
            const apiButton = document.createElement('button');
            apiButton.textContent = 'API';
            Object.assign(apiButton.style, {
                background: '#444',
                color: '#fff',
                border: 'none',
                padding: '5px 10px',
                cursor: 'pointer'
            });
            apiButton.onclick = () => {
                const newKey = prompt('Enter your new Torn API key:');
                if (newKey && newKey.trim() !== '') {
                    localStorage.setItem('tornApiKey', newKey.trim());
                    apiKey = newKey.trim();
                    alert('API key updated successfully!');
                } else {
                    alert('API key not changed.');
                }
            };
 
            // Help link
            const helpLink = document.createElement('a');
            helpLink.href = 'https://www.torn.com/forums.php#/p=threads&f=67&t=16518811&b=0&a=0';
            helpLink.textContent = 'Help';
            Object.assign(helpLink.style, {
                color: '#007bff',
                textDecoration: 'none',
                fontSize: '12px'
            });
            helpLink.target = '_blank';
            helpLink.rel = 'noopener noreferrer';
 
            tabContainer.appendChild(fuelTab);
            tabContainer.appendChild(evidenceTab);
            tabContainer.appendChild(highlightTab);
            tabContainer.appendChild(apiButton);
            tabContainer.appendChild(helpLink);
            newPanel.appendChild(tabContainer);
 
            const contentDiv = document.createElement('div');
            newPanel.appendChild(contentDiv);
 
            // Colorblind toggle
            const colorblindContainer = document.createElement('div');
            colorblindContainer.className = 'item-row';
            const colorblindLabel = document.createElement('label');
            colorblindLabel.textContent = 'Colorblind Mode';
            const colorblindCheckbox = document.createElement('input');
            colorblindCheckbox.type = 'checkbox';
            colorblindCheckbox.checked = localStorage.getItem('colorblindMode') === 'true';
            colorblindCheckbox.onchange = () => {
                localStorage.setItem('colorblindMode', colorblindCheckbox.checked);
                applyThemeColors();
            };
            colorblindContainer.appendChild(colorblindLabel);
            colorblindContainer.appendChild(colorblindCheckbox);
            newPanel.appendChild(colorblindContainer);
 
            // Render functions
            function renderFuelItems() {
                contentDiv.innerHTML = '<h4>Fuel Items</h4>';
                for (const item in defaultItemValues) {
                    const row = document.createElement('div');
                    row.className = 'item-row';
                    const label = document.createElement('label');
                    label.textContent = item;
                    const input = document.createElement('input');
                    input.value = itemValues[item];
                    input.onchange = () => { itemValues[item] = input.value; saveItemValues(); };
                    row.appendChild(label);
                    row.appendChild(input);
                    contentDiv.appendChild(row);
                }
                updateActionButton();
            }
 
            function renderEvidenceItems() {
                contentDiv.innerHTML = '<h4>Evidence Items</h4>';
                for (const item in evidenceItemValues) {
                    const row = document.createElement('div');
                    row.className = 'item-row';
                    const label = document.createElement('label');
                    label.textContent = item;
                    const input = document.createElement('input');
                    input.value = itemValues[item];
                    input.onchange = () => { itemValues[item] = input.value; saveItemValues(); };
                    row.appendChild(label);
                    row.appendChild(input);
                    contentDiv.appendChild(row);
                }
                updateActionButton();
            }
 
            function renderHighlightValues() {
                contentDiv.innerHTML = '<h4>Highlight Values</h4>';
                ['LowProfit', 'HighProfit'].forEach(key => {
                    const row = document.createElement('div');
                    row.className = 'item-row';
                    const label = document.createElement('label');
                    label.textContent = key;
                    const input = document.createElement('input');
                    input.value = highlightValues[key];
                    input.onchange = () => { highlightValues[key] = parseInt(input.value, 10); saveHighlightValues(); };
                    row.appendChild(label);
                    row.appendChild(input);
                    contentDiv.appendChild(row);
                });
                updateActionButton();
            }
 
            function updateActionButton() {
                const existingActionBtn = document.querySelector('#settingsPanel button.action-btn');
                if (existingActionBtn) existingActionBtn.remove();
 
                const actionButton = document.createElement('button');
                actionButton.className = 'action-btn';
                Object.assign(actionButton.style, {
                    color: '#fff',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '10px',
                    width: '100%',
                    background: '#dc3545'
                });
 
                if (contentDiv.innerHTML.includes('Fuel Items') || contentDiv.innerHTML.includes('Evidence Items')) {
                    actionButton.textContent = 'Item Market Values';
                    actionButton.onclick = async () => {
                        if (confirm('Update item values from Torn API? This will overwrite your current settings.')) {
                            alert('Fetching latest item prices from Torn API...');
                            const success = await getPricesFromAPI();
                            if (success) {
                                loadItemValues();
                                addTooltips();
                                if (contentDiv.innerHTML.includes('Fuel Items')) {
                                    renderFuelItems();
                                } else {
                                    renderEvidenceItems();
                                }
                                alert('Item values updated successfully!');
                            } else {
                                alert('Failed to update item values. Check your API key or Torn API status.');
                            }
                        }
                    };
                } else {
                    actionButton.textContent = 'Reset to Defaults';
                    actionButton.onclick = () => {
                        if (confirm('Reset highlight values to defaults?')) {
                            highlightValues = { ...defaultHighlightValues };
                            saveHighlightValues();
                            renderHighlightValues();
                            alert('Highlight values reset to defaults.');
                        }
                    };
                }
 
                newPanel.appendChild(actionButton);
            }
 
            fuelTab.onclick = renderFuelItems;
            evidenceTab.onclick = renderEvidenceItems;
            highlightTab.onclick = renderHighlightValues;
 
            renderFuelItems(); // Default view
 
            header.appendChild(newButton);
            header.appendChild(newPanel);
 
            newButton.addEventListener('click', () => {
                newPanel.style.display = (newPanel.style.display === 'none' || newPanel.style.display === '') ? 'block' : 'none';
            });
 
            document.addEventListener('click', (e) => {
                if (!newPanel.contains(e.target) && e.target !== newButton) {
                    newPanel.style.display = 'none';
                }
            });
        }
    } else {
        if (existingButton) existingButton.remove();
        if (existingPanel) existingPanel.remove();
    }
}
 
 
 
    // Helper CreateTooltip
function formatPlaceholders(text) {
    return text.replace(/\?(.*?)\?/g, '<span style="color: orange; font-weight: bold;">$1</span>');
}
 
    //  Tooltip creation + highlight logic
 
 
 
 
 
function createTooltip(lines, section, highlightTarget) {
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    let ranges = null;
 
    lines.forEach(line => {
        const div = document.createElement('div');
        let content = line;
 
        if (line.startsWith("Profit/Nerve")) {
            ranges = calculateProfitPerNerve(lines);
            if (ranges) content = `Profit/Nerve: ${ranges.profitText}`;
        }
 
        div.innerHTML = `• ${formatPlaceholders(content)}`;
        tooltip.appendChild(div);
    });
 
    if (ranges) {
        const nerveDiv = document.createElement('div');
        nerveDiv.innerHTML = `• Total Nerve: ${ranges.nerveText}`;
        tooltip.appendChild(nerveDiv);
 
        // ✅ Always highlight based on base profit (even if optional exists)
        const baseProfitValue = ranges.profitText.replace(/<[^>]*>/g, '') // remove HTML tags
            .split('–').pop().trim(); // take the base value (right side)
        const numericValue = parseFloat(baseProfitValue.replace(/K/i, '')) * (baseProfitValue.includes('K') ? 1000 : 1);
 
        if (numericValue <= 0) {
            highlightTarget.classList.add('highlight-negative');
        } else if (numericValue <= highlightValues.LowProfit) {
            highlightTarget.classList.add('highlight-low');
        } else if (numericValue <= highlightValues.HighProfit) {
            highlightTarget.classList.add('highlight-high');
        } else {
            highlightTarget.classList.add('highlight-jackpot');
        }
    }
 
    document.body.appendChild(tooltip);
    return tooltip;
}
 
 
 
 
    function showTooltip(tooltip, target) {
        const visibleTooltip = document.querySelector('.custom-tooltip[style*="display: flex"]');
        if (visibleTooltip && visibleTooltip !== tooltip) {
            visibleTooltip.style.opacity = '0';
            setTimeout(() => visibleTooltip.style.display = 'none', 200);
        }
 
        tooltip.style.display = 'flex';
        tooltip.style.visibility = 'hidden';
        positionTooltip(tooltip, target);
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
    }
 
    function hideTooltip(tooltip) {
        tooltip.style.opacity = '0';
        setTimeout(() => tooltip.style.display = 'none', 200);
    }
 
    function positionTooltip(tooltip, target) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportW = document.documentElement.clientWidth;
        const margin = 6;
 
        // Vertical: place above the target by default. If there isn't room above
        // (common on mobile when the target is near the top), flip below.
        let top = rect.top + window.scrollY - tooltipRect.height - 10;
        if (rect.top - tooltipRect.height - 10 < 0) {
            top = rect.bottom + window.scrollY + 10;
        }
 
        // Horizontal: center on the target, but clamp so the tooltip doesn't
        // overflow the viewport on narrow screens.
        let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);
        const minLeft = window.scrollX + margin;
        const maxLeft = window.scrollX + viewportW - tooltipRect.width - margin;
        if (left < minLeft) left = minLeft;
        if (left > maxLeft) left = maxLeft;
 
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }
 
    function getSkillValue() {
        const skillButton = document.querySelector('button[aria-label^="Skill:"]');
        if (!skillButton) return 0;
        const match = skillButton.getAttribute('aria-label').match(/Skill:\s*([\d\.]+)/);
        return match ? parseFloat(match[1]) : 0;
    }
 
    function shouldShowScenario(lines, hasFlamethrower) {
        const flamethrowerLine = lines.find(line => line.trim().toLowerCase().startsWith('flamethrower:'));
        if (!flamethrowerLine) return true;
        if (hasFlamethrower && flamethrowerLine.toLowerCase().includes('no')) return false;
        if (!hasFlamethrower && flamethrowerLine.toLowerCase().includes('yes')) return false;
        return true;
    }
 
 
function addTooltips() {
    const skillValue = getSkillValue();
    const hasFlamethrower = skillValue >= 80;
 
    // FIX: hashed class `sections___tZPkg` → attribute substring match.
    document.querySelectorAll('[class*="sections___"]').forEach(section => {
        if (section.dataset.tooltipAdded) return;
 
        // FIX: hashed class `scenario___msSka` → attribute substring match.
        const scenarioName = section.querySelector('[class*="scenario___"]')?.textContent?.trim();
        if (!scenarioName) return;
        // wb17: case-insensitive lookup. Torn renders scenario names in
        // arbitrary casing across builds, and server-overlay writes
        // lowercase keys. Strict-case lookup missed both — leaving
        // crimes gray. Build a lowercase index on first use, lazy.
        let lookupKey = scenarios[scenarioName] ? scenarioName : null;
        if (!lookupKey) {
            if (!scenarios._wbLowerIndex) {
                scenarios._wbLowerIndex = Object.create(null);
                for (const k of Object.keys(scenarios)) {
                    if (k.startsWith('_wb')) continue;
                    scenarios._wbLowerIndex[k.toLowerCase()] = k;
                }
            }
            lookupKey = scenarios._wbLowerIndex[scenarioName.toLowerCase()];
        }
        if (!lookupKey || !scenarios[lookupKey]) return;

        const variants = scenarios[lookupKey];
        // wb22: pick the most useful variant. Some scenarios (Blaze
        // of Glory, Smoldering Resentment, Body of Evidence...) have
        // a no-flame variant that's a placeholder with no Payout —
        // wb20 picked that for no-flame viewers, leaving the tooltip
        // empty and the card uncolored. wbPickUsefulVariant prefers
        // matched-flame AND has-Payout; falls back to any variant
        // with Payout; last resort the matched one.
        const selectedVariant = wbPickUsefulVariant(variants, hasFlamethrower);

        if (!selectedVariant) return;
 
        const tooltip = createTooltip(selectedVariant, section, section);
 
        // FIX: hashed compound `crimeOptionSection___hslpu.flexGrow___S5IUQ.titleSection___CiZ8O`
        // → attribute substring match on each hash prefix (all three must be present on the same element).
        // This may not match on mobile (Torn PDA) if the DOM splits these classes across elements.
        const hoverTarget = section.querySelector(
            '[class*="crimeOptionSection___"][class*="flexGrow___"][class*="titleSection___"]'
        );
 
        // Desktop hover: attach to the title-section block when it exists.
        if (hoverTarget) {
            hoverTarget.addEventListener('mouseenter', () => showTooltip(tooltip, hoverTarget));
            hoverTarget.addEventListener('mouseleave', () => hideTooltip(tooltip));
        }
 
        // Mobile click: tap anywhere on the crime card (the info / empty area)
        // to toggle the tooltip. We attach to the whole `section` and ignore
        // clicks that originated inside a button, link, or input — that way
        // the "commit crime" buttons (Ignite/Stoke/Collect) still work normally
        // and don't trigger the tooltip. The original code attached this to a
        // single hashed element (`title___lw1Jr`), which broke when the hash
        // rotated or when substring matching pulled in an action-button class.
        section.addEventListener('click', (e) => {
            // Ignore taps on interactive elements (commit/collect buttons, inputs, links, etc.)
            if (e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
 
            if (tooltip.style.display === 'flex') {
                hideTooltip(tooltip);
            } else {
                // Position the tooltip relative to the section so it appears next to the card.
                showTooltip(tooltip, section);
            }
        });
 
        // Hide tooltip when tapping outside the card.
        document.addEventListener('click', (e) => {
            if (!tooltip.contains(e.target) && !section.contains(e.target)) {
                hideTooltip(tooltip);
            }
        });
 
        section.dataset.tooltipAdded = "true";
    });
}
 
 
 
// wb22: shared variant picker — prefer matched flame state AND a
// usable Payout line; fall back to any variant with Payout; last
// resort the matched one. Used by both addTooltips (so the tooltip
// has data to show) and wbApplyHighlightsToAllCards (so the color
// has data to compute). Returns null only when input is invalid.
function wbPickUsefulVariant(variants, hasFlame) {
    if (!variants) return null;
    if (!Array.isArray(variants[0])) return variants;
    const hasPayout = v => Array.isArray(v)
        && v.some(line => typeof line === 'string' && /^Payout\s*:/i.test(line) && /\d/.test(line));
    const matchedWithData = variants.find(v => shouldShowScenario(v, hasFlame) && hasPayout(v));
    if (matchedWithData) return matchedWithData;
    const anyWithData = variants.find(hasPayout);
    if (anyWithData) return anyWithData;
    return variants.find(v => shouldShowScenario(v, hasFlame)) || variants[0];
}

// wb18: proactively color EVERY crime card from BFB's scenarios data
// (which is upstream-hardcoded + server-overlayed). Bypasses
// shouldShowScenario — that filter only decides whether to bind a
// hover/click tooltip, but cards should still be colored so the
// user sees at-a-glance profitability even on crimes they can't do
// (e.g. flame-required scenarios for no-flame viewers). Eliminates
// the need for arsontest's applyHighlightsFromRecipes — BFB is now
// self-sufficient for coloring.
function wbApplyHighlightsToAllCards() {
    document.querySelectorAll('[class*="sections___"]').forEach(section => {
        try {
            // wb23: per-card dedup. Skip cards whose scenario name +
            // flame state haven't changed since last successful color
            // pass. On Torn PDA the chain bar / live timers fire
            // mutations multiple times per second, and re-running
            // querySelectorAll + calculateProfitPerNerve per card on
            // every tick was the leading suspect for 46% screentime
            // CPU. Stamp `dataset.wbHighlightKey` after coloring;
            // bail early if the stamp still matches the current key.
            const actionEl = section.querySelector('[class*="scenario___"]');
            if (!actionEl) return;
            const scenarioName = actionEl.textContent.trim();
            if (!scenarioName) return;
            const flame = getSkillValue() >= 80;
            const dedupKey = scenarioName + '|' + (flame ? '1' : '0');
            if (section.dataset.wbHighlightKey === dedupKey) return;
            // Case-insensitive lookup mirrors addTooltips at line 4250.
            let lookupKey = scenarios[scenarioName] ? scenarioName : null;
            if (!lookupKey) {
                if (!scenarios._wbLowerIndex) {
                    scenarios._wbLowerIndex = Object.create(null);
                    for (const k of Object.keys(scenarios)) {
                        if (k.startsWith('_wb')) continue;
                        scenarios._wbLowerIndex[k.toLowerCase()] = k;
                    }
                }
                lookupKey = scenarios._wbLowerIndex[scenarioName.toLowerCase()];
            }
            if (!lookupKey || !scenarios[lookupKey]) return;
            const variants = scenarios[lookupKey];
            const variant = wbPickUsefulVariant(variants, flame);
            if (!variant) return;
            const ranges = calculateProfitPerNerve(variant);
            if (!ranges) return;
            const baseProfitValue = ranges.profitText.replace(/<[^>]*>/g, '').split('–').pop().trim();
            const numericValue = parseFloat(baseProfitValue.replace(/K/i, '')) * (baseProfitValue.includes('K') ? 1000 : 1);
            if (!Number.isFinite(numericValue)) return;
            section.classList.remove('highlight-negative','highlight-low','highlight-high','highlight-jackpot');
            const cls = numericValue <= 0 ? 'highlight-negative'
                      : numericValue <= highlightValues.LowProfit ? 'highlight-low'
                      : numericValue <= highlightValues.HighProfit ? 'highlight-high'
                      : 'highlight-jackpot';
            section.classList.add(cls);
            section.dataset.wbHighlightKey = dedupKey;
        } catch (_) {}
    });
}

// wb23: also debounce the entire observer callback. Without this each
// micro-mutation triggers addTooltips + wbApplyHighlightsToAllCards +
// createSettingsUI + two more querySelectorAll loops. Coalescing them
// into one 150ms tick cuts work by orders of magnitude while still
// feeling instant. Critical for PDA battery.
let _wbObserverTimer = null;
function wbObserverTick() {
    addTooltips();
    wbApplyHighlightsToAllCards();
    createSettingsUI();

    // Remove Torn's highlight
    document.querySelectorAll('[class*="crimeOptionWrapper___"].pending-collect').forEach(el => {
        el.classList.remove('pending-collect');
    });

    // Highlight Collect-and-2 buttons softly
    document.querySelectorAll('[class*="childrenWrapper___"]').forEach(btn => {
        const text = btn.textContent.trim();
        if (text.includes('Collect') && text.includes('2')) {
            btn.style.color = '#28a745';
            btn.style.fontWeight = 'bold';
        } else {
            btn.style.color = '';
            btn.style.fontWeight = '';
        }
    });
}

const observer = new MutationObserver(() => {
    if (_wbObserverTimer) return;
    _wbObserverTimer = setTimeout(() => { _wbObserverTimer = null; wbObserverTick(); }, 150);
});

// wb23: original inline observer body folded into wbObserverTick().
// The MutationObserver above now schedules a debounced 150ms tick
// instead of running everything synchronously on every mutation.
 
//  Observe without delay
observer.observe(document.body, { childList: true, subtree: true });
 
 
    addTooltips();
})();