// ==UserScript==
// @name         Weav3r Bazaar Deals
// @namespace    russianrob
// @version      2.4.0
// @description  Find real below-market bazaar deals — solo build, fetches weav3r.dev directly, no warboard proxy
// @author       RussianRob
// @match        https://www.torn.com/*
// @updateURL    https://tornwar.com/scripts/weav3r-bazaar-deals.user.js
// @downloadURL  https://tornwar.com/scripts/weav3r-bazaar-deals.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      weav3r.dev
// @connect      www.torn.com
// @connect      api.torn.com
// ==/UserScript==

(function () {
    'use strict';

    // ── Config ─────────────────────────────────────────────────────────────
    const CFG = {
        refreshMs:    5 * 60 * 1000,
        pageSize:     50,
        maxPages:     4,
        dealsBatch:   8,   // parallel marketplace requests
        // minDiscount is user-configurable via Settings tab; loaded lazily
        // so GM_getValue is available. Defaults to 2% so the empty-state
        // isn't the common experience when the market is tight.
        get minDiscount() {
            try { return Number(GM_getValue('w3_min_discount', 2)) || 2; }
            catch { return 2; }
        },
        // When true, $1 listings ("dollar deals") are INCLUDED in the scan.
        // Default OFF because Torn's API doesn't expose a way to distinguish
        // public $1 listings from target-trades (locked to specific buyers).
        // Even with server-side verification via a full-access key, target
        // trades that happen to be aimed at us show up as "verified" false
        // positives. The feature can surface real public $1 steals when they
        // exist but most entries are target trades you can't actually buy.
        // Users can opt in knowing the limitation.
        get includeDollarDeals() {
            try { return GM_getValue('w3_include_dollar', false) === true; }
            catch { return false; }
        },
        // When true, only $1 listings the server verified as still-listed
        // are shown. Hides both "gone" (✗) AND "pending verification" (⋯)
        // entries — the user only sees what's confirmed buyable. Default ON
        // because that's the cleanest experience; flip off in Settings to
        // see unverified + gone listings for debugging.
        get onlyBuyable() {
            try { return GM_getValue('w3_only_buyable', true) === true; }
            catch { return true; }
        },
    };

    // ── Persistent storage helpers ─────────────────────────────────────────
    const store = {
        get: (k, d) => { try { const v = GM_getValue(k); return v === undefined ? d : v; } catch { return d; } },
        set: (k, v) => { try { GM_setValue(k, v); } catch {} },
    };

    // ── Item index: name → id ────────────────────────────────────────────────
    // Seeded with weapons + armour, then enriched by background scan + dollar deals
    const itemIndex = {"Hammer":1,"Baseball Bat":2,"Crowbar":3,"Knuckle Dusters":4,"Pen Knife":5,"Kitchen Knife":6,"Dagger":7,"Axe":8,"Scimitar":9,"Samurai Sword":11,"Glock 17":12,"Raven MP25":13,"Ruger 57":14,"Beretta M9":15,"USP":16,"Beretta 92FS":17,"Fiveseven":18,"Magnum":19,"Desert Eagle":20,"Sawed-Off Shotgun":22,"Benelli M1 Tactical":23,"MP5 Navy":24,"P90":25,"AK-47":26,"M4A1 Colt Carbine":27,"Benelli M4 Super":28,"M16 A2 Rifle":29,"Steyr AUG":30,"M249 SAW":31,"Minigun":63,"Springfield 1911":99,"Egg Propelled Launcher":100,"9mm Uzi":108,"RPG Launcher":109,"Leather Bullwhip":110,"Ninja Claws":111,"Yasukuni Sword":146,"Butterfly Knife":173,"XM8 Rifle":174,"Cobra Derringer":177,"Flak Jacket":178,"S&W Revolver":189,"Claymore Sword":217,"Enfield SA-80":219,"Jackhammer":223,"Swiss Army Knife":224,"Mag 7":225,"Spear":227,"Vektor CR-21":228,"Heckler & Koch SL8":231,"BT MP9":233,"Chain Whip":234,"Wooden Nunchaku":235,"Kama":236,"Kodachi":237,"Sai":238,"Type 98 Anti Tank":240,"Taurus":243,"Bo Staff":245,"Katana":247,"Qsz-92":248,"SKS Carbine":249,"Ithaca 37":252,"Lorcin 380":253,"S&W M29":254,"Dual Axes":289,"Dual Hammers":290,"Hazmat Suit":348,"Macana":391,"Metal Nunchaku":395,"Flail":397,"SIG 552":398,"ArmaLite M-15A4":399,"Guandao":400,"Ice Pick":402,"Cricket Bat":438,"Frying Pan":439,"MP5k":483,"AK74U":484,"Skorpion":485,"TMP":486,"Thompson":487,"MP 40":488,"Luger":489,"Blunderbuss":490,"Tavor TAR-21":612,"Harpoon":613,"Diamond Bladed Knife":614,"Naval Cutlass":615,"Kevlar Gloves":640,"WWII Helmet":641,"Motorcycle Helmet":642,"Construction Helmet":643,"Welding Helmet":644,"Riot Helmet":655,"Riot Body":656,"Riot Pants":657,"Riot Boots":658,"Riot Gloves":659,"Dune Helmet":660,"Dune Vest":661,"Dune Pants":662,"Dune Boots":663,"Dune Gloves":664,"Assault Helmet":665,"Assault Body":666,"Assault Pants":667,"Assault Boots":668,"Assault Gloves":669,"Delta Gas Mask":670,"Delta Body":671,"Delta Pants":672,"Delta Boots":673,"Delta Gloves":674,"Marauder Face Mask":675,"Marauder Body":676,"Marauder Pants":677,"Marauder Boots":678,"Marauder Gloves":679,"EOD Helmet":680,"EOD Apron":681,"EOD Pants":682,"EOD Boots":683,"EOD Gloves":684,"Nock Gun":830,"Beretta Pico":831,"Riding Crop":832,"Rheinmetall MG 3":837,"Homemade Pocket Shotgun":838,"Scalpel":846,"Sledgehammer":850,"Bread Knife":1053,"Poison Umbrella":1055,"SMAW Launcher":1152,"China Lake":1153,"Milkor MGL":1154,"PKM":1155,"Negev NG-5":1156,"Stoner 96":1157,"Meat Hook":1158,"Cleaver":1159,"Golf Club":1231,"Snow Cannon":1232,"Bushmaster Carbon 15":1302,"M'aol Visage":1164,"M'aol Hooves":1167,"Sentinel Helmet":1307,"Sentinel Apron":1308,"Sentinel Pants":1309,"Sentinel Boots":1310,"Sentinel Gloves":1311,"Vanguard Respirator":1355,"Vanguard Body":1356,"Vanguard Pants":1357,"Vanguard Boots":1358,"Vanguard Gloves":1359};

    // Load any previously scanned items from storage
    try { const saved = store.get('w3_index', null); if (saved) Object.assign(itemIndex, JSON.parse(saved)); } catch {}

    function enrichIndex(items) {
        for (const it of items) {
            if (it.itemName && it.itemId && !itemIndex[it.itemName]) {
                itemIndex[it.itemName] = it.itemId;
            }
        }
    }

    function searchIndex(query) {
        if (!query || query.length < 2) return [];
        const q = query.toLowerCase();
        return Object.entries(itemIndex)
            .filter(([name]) => name.toLowerCase().includes(q))
            .sort(([a], [b]) => {
                // Exact prefix matches first
                const aStart = a.toLowerCase().startsWith(q);
                const bStart = b.toLowerCase().startsWith(q);
                if (aStart && !bStart) return -1;
                if (!aStart && bStart) return 1;
                return a.localeCompare(b);
            })
            .slice(0, 12); // max 12 suggestions
    }

    // ── State ──────────────────────────────────────────────────────────────
    const S = {
        tab:            'deals',
        deals:          [],
        dealsTs:        null,
        dealsLoading:   false,
        dealsError:     null,
        filterCat:      store.get('w3_cat', 'All'),
        collapsed:      store.get('w3_collapsed', false),
        minimized:      store.get('w3_minimized', false),
        apiKey:         store.get('w3_apikey', ''),
        settingsOpen:   false,
        realDeals:      [],
        realDealsLoading: false,
        realDealsTs:    null,
        realDealsProgress: { done: 0, total: 0 },   // progressive scan counter
        verified:       {},                          // verification cache: (seller:item:price) → true/false/null
        lookupId:       null,
        lookupName:     '',
        lookupListings: [],
        lookupLoading:  false,
        lookupError:    null,
        lookupQuery:    '',
        acResults:      [],    // autocomplete results
        acOpen:         false,
    };

    // ── Categories ─────────────────────────────────────────────────────────
    const CATS = [
        'All','Alcohol','Armor','Artifact','Booster','Candy','Car',
        'Clothing','Collectible','Drug','Energy Drink','Enhancer',
        'Flower','Jewelry','Medical','Melee','Primary','Secondary',
        'Special','Supply Pack','Temporary','Tool','Virus','Other',
    ];

    // ── Styles ─────────────────────────────────────────────────────────────
    GM_addStyle(`
        #w3b-panel {
            position: fixed; bottom: 70px; right: 16px; width: 370px;
            max-height: 540px; background: #12121e;
            border: 1px solid #1e3a5f; border-radius: 10px;
            font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px;
            color: #dde; z-index: 99999; display: flex; flex-direction: column;
            box-shadow: 0 6px 30px rgba(0,0,0,0.7); overflow: hidden;
            transition: max-height 0.2s ease;
        }
        #w3b-panel.minimized { display: none !important; }
        #w3b-settings {
            background: #0a1628; border-bottom: 1px solid #1e3a5f;
            padding: 8px 10px; display: flex; gap: 6px; align-items: center; flex-shrink: 0;
        }
        #w3b-settings input {
            flex: 1; background: #0f1a2e; border: 1px solid #1e3a5f;
            color: #dde; border-radius: 5px; padding: 4px 7px; font-size: 11px;
            min-width: 0;
        }
        #w3b-settings input:focus { outline: none; border-color: #e05070; }
        .w3b-verified   { color: #4ade80; font-size: 10px; font-weight: 700; margin-left: 4px; }
        .w3b-unverified { color: #888;    font-size: 10px; font-weight: 700; margin-left: 4px; }
        #w3b-minbtn {
            position: fixed; bottom: 70px; right: 16px;
            background: #e05070; color: #fff; border: none;
            border-radius: 8px; padding: 6px 12px;
            font-size: 12px; font-weight: 700; cursor: pointer;
            z-index: 99999; box-shadow: 0 2px 12px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', Arial, sans-serif;
            letter-spacing: .3px;
        }
        #w3b-minbtn:hover { background: #b8304a; }
        #w3b-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; background: #0d2845; flex-shrink: 0; user-select: none;
        }
        #w3b-head-title { font-weight: 700; font-size: 13px; color: #e05070; letter-spacing: .4px; }
        #w3b-head-ctrl  { display: flex; gap: 5px; }
        #w3b-tabs { display: flex; background: #0f1a2e; flex-shrink: 0; }
        .w3b-tab {
            flex: 1; padding: 6px 0; text-align: center; cursor: pointer;
            font-size: 11px; font-weight: 600; color: #556;
            border-bottom: 2px solid transparent; transition: color .15s, border-color .15s;
        }
        .w3b-tab.active { color: #e05070; border-bottom-color: #e05070; }
        .w3b-tab:hover:not(.active) { color: #99a; }
        #w3b-body {
            flex: 1; overflow-y: auto; padding: 8px;
            scrollbar-width: thin; scrollbar-color: #1e3a5f #12121e;
        }
        #w3b-body::-webkit-scrollbar { width: 5px; }
        #w3b-body::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
        #w3b-status {
            font-size: 10px; color: #444; text-align: right;
            padding: 3px 8px; flex-shrink: 0; border-top: 1px solid #1a1a2e;
        }
        .w3b-btn {
            background: #e05070; border: none; color: #fff;
            border-radius: 5px; padding: 4px 9px;
            cursor: pointer; font-size: 11px; font-weight: 700;
            transition: background .15s;
        }
        .w3b-btn:hover { background: #b8304a; }
        .w3b-btn.dim { background: #1e3a5f; }
        .w3b-btn.dim:hover { background: #2a4f7f; }
        .w3b-filter {
            display: flex; gap: 6px; margin-bottom: 8px; align-items: center;
        }
        .w3b-filter select, .w3b-filter input {
            background: #0f1a2e; border: 1px solid #1e3a5f;
            color: #dde; border-radius: 5px; padding: 4px 7px;
            font-size: 11px; flex: 1; min-width: 0;
        }
        /* Autocomplete */
        .w3b-ac-wrap { position: relative; flex: 1; }
        .w3b-ac-input {
            width: 100%; box-sizing: border-box;
            background: #0f1a2e; border: 1px solid #1e3a5f;
            color: #dde; border-radius: 5px; padding: 5px 8px;
            font-size: 11px;
        }
        .w3b-ac-input:focus { outline: none; border-color: #e05070; }
        .w3b-ac-drop {
            position: absolute; top: calc(100% + 3px); left: 0; right: 0;
            background: #0f1a2e; border: 1px solid #1e3a5f;
            border-radius: 5px; z-index: 100001; max-height: 180px;
            overflow-y: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .w3b-ac-item {
            padding: 6px 9px; cursor: pointer; font-size: 11px;
            display: flex; justify-content: space-between; align-items: center;
        }
        .w3b-ac-item:hover, .w3b-ac-item.selected { background: #1e3a5f; }
        .w3b-ac-id { color: #445; font-size: 10px; }
        .w3b-row {
            background: #0f1a2e; border-left: 3px solid #e05070;
            border-radius: 6px; padding: 7px 9px; margin-bottom: 5px;
            display: flex; flex-direction: column; gap: 3px;
        }
        .w3b-row-name  { font-weight: 700; color: #fff; font-size: 12px; }
        .w3b-row-meta  { display: flex; justify-content: space-between; font-size: 11px; color: #8899aa; }
        .w3b-val       { color: #4ade80; font-weight: 700; }
        .w3b-price     { color: #facc15; font-weight: 700; }
        .w3b-seller    { color: #60a5fa; }
        .w3b-badge {
            background: rgba(74,222,128,.12); color: #4ade80;
            border-radius: 3px; padding: 1px 5px; font-size: 10px; font-weight: 700;
        }
        .w3b-links { display: flex; gap: 5px; margin-top: 2px; flex-wrap: wrap; }
        .w3b-links a {
            font-size: 10px; color: #e05070; text-decoration: none;
            background: rgba(224,80,112,.1); padding: 2px 7px; border-radius: 3px;
            transition: background .15s;
        }
        .w3b-links a:hover { background: rgba(224,80,112,.25); }
        .w3b-loading { text-align: center; color: #e05070; padding: 20px; font-size: 12px; }
        .w3b-empty   { text-align: center; color: #445; padding: 20px; font-size: 12px; }
        .w3b-error   { text-align: center; color: #f87171; padding: 12px; font-size: 11px; background: rgba(248,113,113,.07); border-radius: 5px; }
        .w3b-hint    { font-size: 10px; color: #445; margin-bottom: 6px; }
        .w3b-section-label { font-size: 10px; color: #556; margin: 8px 0 4px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
    `);

    // ── Format helpers ─────────────────────────────────────────────────────
    function fmtMoney(n) {
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        return '$' + n.toLocaleString();
    }
    function timeAgo(iso) {
        const d = (Date.now() - new Date(iso).getTime()) / 1000;
        if (d < 60)    return Math.round(d) + 's ago';
        if (d < 3600)  return Math.round(d / 60) + 'm ago';
        if (d < 86400) return Math.round(d / 3600) + 'h ago';
        return Math.round(d / 86400) + 'd ago';
    }
    function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── GM fetch wrappers ──────────────────────────────────────────────────
    function gmJSON(url) {
        return new Promise((res, rej) => {
            GM_xmlhttpRequest({
                method: 'GET', url, headers: { Accept: 'application/json' },
                onload:    r => { try { res(JSON.parse(r.responseText)); } catch { rej(new Error('Parse error')); } },
                onerror:   () => rej(new Error('Network error')),
                ontimeout: () => rej(new Error('Timeout')),
            });
        });
    }
    function gmHTML(url) {
        return new Promise((res, rej) => {
            GM_xmlhttpRequest({
                method: 'GET', url,
                onload:    r => res(r.responseText),
                onerror:   () => rej(new Error('Network error')),
                ontimeout: () => rej(new Error('Timeout')),
            });
        });
    }

    // ── Full item index via Torn API ─────────────────────────────────────────
    // One API call fetches all ~1100+ items and caches them permanently.
    async function buildIndexFromTornAPI() {
        if (!S.apiKey) return;
        if (store.get('w3_torn_index_done', false)) return;
        try {
            const data = await gmJSON(
                `https://api.torn.com/torn/?selections=items&key=${S.apiKey}`
            );
            if (data.error || !data.items) return;
            let added = 0;
            for (const [id, item] of Object.entries(data.items)) {
                if (item.name && !itemIndex[item.name]) {
                    itemIndex[item.name] = parseInt(id);
                    added++;
                }
            }
            store.set('w3_index', JSON.stringify(itemIndex));
            store.set('w3_torn_index_done', true);
            renderStatus();
        } catch {}
    }

    // ── Verify $1 deals via Torn's own bazaar API ────────────────────────────
    // Group all $1 deals by seller, then make ONE API call per seller to fetch
    // their whole bazaar. Mark each deal as verified (✓) or gone (✗) in a
    // single pass. This is 5-10× faster than verifying each listing separately
    // for sellers like Fox12_ who have multiple $1 listings in the dataset.
    async function verifyDeals() {
        if (!S.apiKey || !S.realDeals.length) return;
        const dollarDeals = S.realDeals.filter(d => d.isDollarDeal);
        if (!dollarDeals.length) return;

        // Group by sellerId
        const bySeller = new Map();
        for (const d of dollarDeals) {
            const sid = String(d.playerId);
            if (!bySeller.has(sid)) bySeller.set(sid, []);
            bySeller.get(sid).push(d);
        }

        for (const [sid, deals] of bySeller) {
            // Skip sellers where all their deals are already verified
            if (deals.every(d => S.verified[`${d.playerId}:${d.itemId}:${d.price}`] !== undefined)) continue;
            try {
                const data = await gmJSON(
                    `https://api.torn.com/user/${sid}?selections=bazaar&key=${encodeURIComponent(S.apiKey)}`
                );
                if (data.error) {
                    // Mark all this seller's deals as unknown so we don't retry every render
                    for (const d of deals) {
                        const k = `${d.playerId}:${d.itemId}:${d.price}`;
                        if (S.verified[k] === undefined) S.verified[k] = null;
                    }
                } else {
                    const bazaar = Array.isArray(data.bazaar)
                        ? data.bazaar
                        : (data.bazaar ? Object.values(data.bazaar) : []);
                    for (const d of deals) {
                        const k = `${d.playerId}:${d.itemId}:${d.price}`;
                        if (S.verified[k] !== undefined) continue;
                        S.verified[k] = bazaar.some(b =>
                            String(b.ID ?? b.id) === String(d.itemId) &&
                            Number(b.price) === Number(d.price)
                        );
                    }
                }
            } catch (_) {
                for (const d of deals) {
                    const k = `${d.playerId}:${d.itemId}:${d.price}`;
                    if (S.verified[k] === undefined) S.verified[k] = null;
                }
            }
            render();
            // Smaller pause between sellers now that there are far fewer calls
            await new Promise(r => setTimeout(r, 200));
        }
    }

    // ── Real deals — cheapest bazaar listings below market value ─────────────
    // Progressive: renders after every batch so the user sees deals appearing
    // within ~1s of starting the scan instead of waiting 15-20s for everything.
    async function loadRealDeals() {
        if (S.realDealsLoading || S.deals.length === 0) return;
        S.realDealsLoading = true;
        S.realDeals = [];   // wipe previous list; we rebuild progressively
        S.realDealsProgress = { done: 0, total: 0 };

        const results = [];

        // Seed the results with the $1 listings themselves. The dollar-bazaars
        // endpoint IS the $1 deal list — each entry is a seller+item+market
        // price. Each entry also carries a server-side `verified` field
        // (true/false/null) so we don't need to run our own Torn API calls,
        // which was flooding users' 100-req/min budget.
        if (CFG.includeDollarDeals) {
            for (const item of S.deals) {
                const mp = Number(item.marketPrice) || 0;
                if (!mp) continue;
                results.push({
                    itemId:      item.itemId,
                    itemName:    item.itemName,
                    marketPrice: mp,
                    price:       1,
                    discount:    ((mp - 1) / mp) * 100,
                    playerId:    item.playerId,
                    sellerName:  item.sellerName,
                    quantity:    item.quantity,
                    lastChecked: item.lastUpdated,
                    isDollarDeal: true,
                    verified:    item.verified,   // null | true | false from server
                });
            }
            S.realDeals = results.slice().sort((a, b) => b.discount - a.discount);
        }
        render();

        const uniqueIds = [...new Set(S.deals.map(d => d.itemId))];
        S.realDealsProgress.total = uniqueIds.length;

        for (let i = 0; i < uniqueIds.length; i += CFG.dealsBatch) {
            const batch = uniqueIds.slice(i, i + CFG.dealsBatch);
            const responses = await Promise.all(
                batch.map(id =>
                    gmJSON(`https://weav3r.dev/api/marketplace/${id}`).catch(() => null)
                )
            );
            for (const data of responses) {
                if (!data?.listings?.length || !data.market_price) continue;

                // When Include $1 deals is ON, emit ONE ROW PER $1 LISTING
                // (not just the cheapest per item). If an item has 5 different
                // $1 listings from 5 sellers, the user wants to see all 5 so
                // they can try each one.
                const sorted = data.listings.slice().sort((a, b) => a.price - b.price);
                const dollarListings = sorted.filter(l => l.price <= 1);
                const normalListings = sorted.filter(l => l.price > 1);

                if (CFG.includeDollarDeals) {
                    for (const l of dollarListings) {
                        const discount = ((data.market_price - l.price) / data.market_price) * 100;
                        results.push({
                            itemId:      data.item_id,
                            itemName:    data.item_name,
                            marketPrice: data.market_price,
                            price:       l.price,
                            discount:    discount,
                            playerId:    l.player_id,
                            sellerName:  l.player_name,
                            quantity:    l.quantity,
                            lastChecked: l.last_checked,
                            isDollarDeal: true,
                        });
                    }
                }

                // Also surface the cheapest non-$1 listing if it still beats
                // the minDiscount threshold — captures real deep discounts
                // alongside the $1 grab-bag.
                if (normalListings.length > 0) {
                    const cheapest = normalListings[0];
                    const discount = ((data.market_price - cheapest.price) / data.market_price) * 100;
                    if (discount >= CFG.minDiscount) {
                        results.push({
                            itemId:      data.item_id,
                            itemName:    data.item_name,
                            marketPrice: data.market_price,
                            price:       cheapest.price,
                            discount:    discount,
                            playerId:    cheapest.player_id,
                            sellerName:  cheapest.player_name,
                            quantity:    cheapest.quantity,
                            lastChecked: cheapest.last_checked,
                            isDollarDeal: false,
                        });
                    }
                }
            }
            // Progressive: update visible list after each batch
            S.realDealsProgress.done = Math.min(i + CFG.dealsBatch, uniqueIds.length);
            S.realDeals = results.slice().sort((a, b) => b.discount - a.discount);
            render();

            if (i + CFG.dealsBatch < uniqueIds.length)
                await new Promise(r => setTimeout(r, 400));
        }

        S.realDealsTs  = Date.now();
        S.realDealsLoading = false;
        render();

        // Verification is handled server-side now (warboard's weav3r-cache
        // verifies each seller against Torn's API with the owner key, results
        // arrive in the `verified` field on each item). Clients don't need
        // to verify themselves anymore — saves users' 100-req/min API budget.
    }

    // ── Dollar Deals API ───────────────────────────────────────────────────
    // 2.4.0: direct fetch from weav3r.dev. Pages through dollar-bazaars/items
    // and concatenates results, then filters out listings older than 60 min
    // (weav3r rotates through sellers so very old entries are usually sold).
    // Polled on a setInterval (see init); no SSE — weav3r.dev doesn't
    // expose one, and one-user polling makes the previous server-cache
    // proxy redundant.
    const MAX_ITEM_AGE_MS = 60 * 60 * 1000;

    async function loadDeals() {
        if (S.dealsLoading || S.realDealsLoading) return;
        S.dealsLoading = true;
        S.dealsError = null;
        render();
        try {
            const all = [];
            for (let page = 1; page <= CFG.maxPages; page++) {
                const data = await gmJSON(`https://weav3r.dev/api/dollar-bazaars/items?page=${page}&limit=${CFG.pageSize}`);
                const items = Array.isArray(data.items) ? data.items : [];
                if (items.length === 0) break;
                all.push(...items);
                if (items.length < CFG.pageSize) break;
            }
            const now = Date.now();
            const fresh = all.filter(i => {
                if (!i.lastUpdated) return true;
                const t = new Date(i.lastUpdated).getTime();
                return !Number.isFinite(t) || (now - t) < MAX_ITEM_AGE_MS;
            });
            S.deals = fresh.sort((a, b) => (b.marketPrice||0) - (a.marketPrice||0));
            S.dealsTs = Date.now();
            enrichIndex(fresh);
            loadRealDeals();
        } catch (e) {
            S.dealsError = e.message;
        }
        S.dealsLoading = false;
        render();
    }

    // ── Item Lookup — weav3r marketplace API ─────────────────────────────────
    async function lookupItem(id, name) {
        S.lookupId       = id;
        S.lookupName     = name || '';
        S.lookupListings = [];
        S.lookupLoading  = true;
        S.lookupError    = null;
        S.acOpen         = false;
        render();
        try {
            let data = await gmJSON(`https://weav3r.dev/api/marketplace/${id}`);
            // Retry once if total_listings > 0 but listings came back empty (likely mid-scan rate limit)
            if (data.total_listings > 0 && (!data.listings || data.listings.length === 0)) {
                await new Promise(r => setTimeout(r, 1500));
                data = await gmJSON(`https://weav3r.dev/api/marketplace/${id}`);
            }
            if (data.item_name) {
                // Detect mismatch — Torn API mapped wrong ID to this name
                if (name && data.item_name.toLowerCase() !== name.toLowerCase()) {
                    // Remove the bad mapping, clear stale autocomplete, flag it
                    delete itemIndex[name];
                    S.acResults = [];
                    S.acOpen    = false;
                    S.lookupMismatch = { searched: name, got: data.item_name };
                } else {
                    S.lookupMismatch = null;
                }
                S.lookupName = data.item_name;
                // Correct the index with the real name→id mapping
                itemIndex[data.item_name] = data.item_id;
                store.set('w3_index', JSON.stringify(itemIndex));
            }
            S.lookupTotal = data.total_listings ?? null;
            const listings = (data.listings || []).map(l => ({
                sellerName:  l.player_name,
                playerId:    l.player_id,
                quantity:    l.quantity,
                price:       l.price,
                lastChecked: l.last_checked
                    ? timeAgo(new Date(l.last_checked * 1000).toISOString())
                    : null,
            }));
            listings.sort((a, b) => a.price - b.price);
            S.lookupListings = listings;
        } catch (e) {
            S.lookupError = e.message;
        }
        S.lookupLoading = false;
        render();
    }

    // ── DOM refs ──────────────────────────────────────────────────────────
    let panel, body, statusBar, minBtn;

    // ── Render ─────────────────────────────────────────────────────────────
    function render() {
        if (!panel) return;
        panel.classList.toggle('collapsed', S.collapsed);
        if (S.settingsOpen) {
            body.innerHTML = renderSettings();
        } else {
            body.innerHTML = S.tab === 'deals' ? renderDeals() : renderLookup();
        }
        attachListeners();
        renderStatus();
    }

    function renderSettings() {
        const currentMinDiscount = CFG.minDiscount;
        return `
            <div style="padding:12px;">
                <div class="w3b-section-label">Torn API Key</div>
                <div class="w3b-hint" style="margin-bottom:10px;color:#778;">Use a public-only key. Used to verify which $1 deals are actually buyable.</div>
                <input id="w3b-apikey-input"
                    type="text"
                    inputmode="url"
                    placeholder="Paste your public API key here"
                    value="${esc(S.apiKey)}"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    style="width:100%;box-sizing:border-box;background:#0f1a2e;border:1px solid #1e3a5f;color:#dde;border-radius:5px;padding:10px;font-size:13px;display:block;margin-bottom:10px;">
                <div style="display:flex;gap:8px;">
                    <button class="w3b-btn" id="w3b-apikey-save" style="flex:1;padding:8px;">Save Key</button>
                    ${S.apiKey ? '<button class="w3b-btn dim" id="w3b-apikey-clear" style="flex:1;padding:8px;">Clear Key</button>' : ''}
                </div>
                ${S.apiKey ? '<div style="margin-top:10px;font-size:11px;color:#4ade80">✓ Key saved — tap Save Key to update</div>' : ''}

                <div class="w3b-section-label" style="margin-top:16px;">Minimum Discount %</div>
                <div class="w3b-hint" style="margin-bottom:10px;color:#778;">Only show deals that are at least this % below market price. Lower = more results. Try 2 when the market is tight; raise to 10 for only steep discounts.</div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <input id="w3b-mindiscount-input"
                        type="number" min="0" max="100" step="0.5"
                        value="${currentMinDiscount}"
                        style="width:80px;background:#0f1a2e;border:1px solid #1e3a5f;color:#dde;border-radius:5px;padding:8px;font-size:13px;">
                    <button class="w3b-btn" id="w3b-mindiscount-save" style="flex:1;padding:8px;">Save & Rescan</button>
                </div>

                <div class="w3b-section-label" style="margin-top:16px;">Only Show Buyable $1 Deals</div>
                <div class="w3b-hint" style="margin-bottom:10px;color:#778;">Show only $1 listings the server has confirmed are still publicly listed in the seller's bazaar. Hides: (a) listings already sold/removed, (b) target trades not open to you, and (c) listings not yet verified. Off = show everything including pending and gone ones.</div>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;">
                    <input id="w3b-onlybuyable-input" type="checkbox" ${CFG.onlyBuyable ? 'checked' : ''}
                        style="width:18px;height:18px;cursor:pointer;">
                    <span style="color:#dde;font-size:13px;">Only show verified-buyable</span>
                </label>
                <button class="w3b-btn" id="w3b-onlybuyable-save" style="margin-top:8px;padding:8px;width:100%;">Save</button>

                <div class="w3b-section-label" style="margin-top:16px;">Include $1 Deals</div>
                <div class="w3b-hint" style="margin-bottom:10px;color:#778;">Off by default. Weav3r's $1 listings include many <b>target trades</b> (locked to specific buyers) that Torn's API doesn't flag as non-public. Server-side verification catches sold/removed items but cannot distinguish targets from public listings. Expect a lot of unbuyable results when scanning. Turn on if you want to hunt for the rare real public $1 steals.</div>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;">
                    <input id="w3b-includedollar-input" type="checkbox" ${CFG.includeDollarDeals ? 'checked' : ''}
                        style="width:18px;height:18px;cursor:pointer;">
                    <span style="color:#dde;font-size:13px;">Include $1 listings in deal scan</span>
                </label>
                <button class="w3b-btn" id="w3b-includedollar-save" style="margin-top:8px;padding:8px;width:100%;">Save & Rescan</button>
            </div>`;
    }

    function renderDeals() {
        let out = `
            <div class="w3b-filter">
                <button class="w3b-btn dim" id="w3b-refresh" title="Refresh"
                    ${(S.dealsLoading || S.realDealsLoading) ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>↻</button>
            </div>`;

        // Phase 1: fetching the initial dollar-bazaar list (no deals yet).
        if (S.dealsLoading) {
            out += `<div class="w3b-loading">⏳ Loading items…</div>`;
        } else if (S.dealsError) {
            out += `<div class="w3b-error">⚠ ${esc(S.dealsError)}</div>`;
        } else {
            // Phase 2: scanning marketplaces — show progress bar + deals as
            // they come in. User sees results within ~1s of scan start.
            if (S.realDealsLoading) {
                const p = S.realDealsProgress || { done: 0, total: 0 };
                const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                out += `
                    <div class="w3b-scan" style="margin:4px 0 8px;padding:6px 8px;background:#1a2332;border-radius:4px;font-size:11px;color:#9ca3af;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span>🔍 Scanning bazaars — ${p.done} / ${p.total}</span>
                            <span style="color:#facc15;">${S.realDeals.length} found</span>
                        </div>
                        <div style="background:#0a1018;height:4px;border-radius:2px;overflow:hidden;">
                            <div style="background:#facc15;height:100%;width:${pct}%;transition:width 200ms;"></div>
                        </div>
                    </div>`;
            }
            // Verification runs server-side now — no API key warning needed.

            if (S.realDeals.length === 0 && !S.realDealsLoading) {
                const md = CFG.minDiscount;
                out += `<div class="w3b-empty">No listings ≥${md}% below market right now.<br>Hit ↻ to rescan, or lower the threshold in <b>Settings</b>.</div>`;
            } else {
                let hiddenGone = 0;
                let hiddenPending = 0;
                out += S.realDeals.map(it => {
                    // Server provides `verified`: true = still listed, false
                    // = gone, null/undefined = not yet verified by server.
                    const vStatus = it.isDollarDeal ? it.verified : undefined;
                    // With "only buyable" on, we hide both gone AND pending.
                    if (it.isDollarDeal && CFG.onlyBuyable) {
                        if (vStatus === false) { hiddenGone++; return ''; }
                        if (vStatus !== true)  { hiddenPending++; return ''; }
                    }
                    let vBadge = '';
                    if (it.isDollarDeal) {
                        if (vStatus === true) {
                            vBadge = '<span class="w3b-verified" title="Verified: still listed">✓</span>';
                        } else if (vStatus === false) {
                            vBadge = '<span style="color:#ef4444;font-size:10px;font-weight:700;margin-left:4px;" title="No longer listed — likely already sold or target trade">✗ gone</span>';
                        } else {
                            vBadge = '<span class="w3b-unverified" title="Pending server verification…">⋯</span>';
                        }
                    }
                    return `
                    <div class="w3b-row"${vStatus === false ? ' style="opacity:0.5;"' : ''}>
                        <div class="w3b-row-name">
                            ${esc(it.itemName)}
                            ${it.isDollarDeal ? '<span style="color:#4ade80;font-weight:700;font-size:10px;margin-left:4px;background:#0a1f14;padding:1px 4px;border-radius:3px;">$1</span>' : ''}
                            ${vBadge}
                            <span style="color:#facc15;font-weight:700;font-size:11px;margin-left:4px;">↓${it.discount.toFixed(1)}%</span>
                        </div>
                        <div class="w3b-row-meta">
                            <span class="w3b-price">${fmtMoney(it.price)}</span>
                            <span style="color:#556;">Mkt: ${fmtMoney(it.marketPrice)}</span>
                        </div>
                        <div class="w3b-row-meta">
                            <span class="w3b-seller">🧍 ${esc(it.sellerName)}</span>
                            <span>Qty: ${it.quantity}</span>
                        </div>
                        <div class="w3b-links">
                            <a href="https://www.torn.com/bazaar.php?userId=${it.playerId}&highlightItem=${it.itemId}" target="_blank">Open Bazaar</a>
                            <a href="https://www.torn.com/trade.php#step=start&userID=${it.playerId}" target="_blank">Trade</a>
                            <a href="https://weav3r.dev/item/${it.itemId}" target="_blank">Weav3r</a>
                        </div>
                    </div>`;
                }).join('');
                const hiddenTotal = hiddenGone + hiddenPending;
                if (hiddenTotal > 0) {
                    const parts = [];
                    if (hiddenGone > 0) parts.push(`${hiddenGone} gone`);
                    if (hiddenPending > 0) parts.push(`${hiddenPending} pending verification`);
                    out += `<div style="padding:8px;text-align:center;color:#6b7280;font-size:11px;font-style:italic;">
                        ${parts.join(' · ')} hidden · <span style="cursor:pointer;text-decoration:underline;" id="w3b-show-gone">show all</span>
                    </div>`;
                }
            }
        }
        return out;
    }

    function renderLookup() {
        const acHTML = S.acOpen && S.acResults.length > 0
            ? `<div class="w3b-ac-drop" id="w3b-ac-drop">
                ${S.acResults.map(([name, id], i) => `
                    <div class="w3b-ac-item" data-id="${id}" data-name="${esc(name)}">
                        <span>${esc(name)}</span>
                        <span class="w3b-ac-id">#${id}</span>
                    </div>`).join('')}
               </div>`
            : '';

        let out = `
            <div class="w3b-filter">
                <div class="w3b-ac-wrap">
                    <input class="w3b-ac-input" id="w3b-name-input"
                        type="text"
                        placeholder="Search item name…"
                        value="${esc(S.lookupQuery)}"
                        autocomplete="off">
                    ${acHTML}
                </div>
                <button class="w3b-btn" id="w3b-search">Search</button>
            </div>`;

        if (S.lookupLoading) {
            out += `<div class="w3b-loading">⏳ Fetching from weav3r.dev…</div>`;
        } else if (S.lookupError) {
            out += `<div class="w3b-error">⚠ ${esc(S.lookupError)}</div>`;
            if (S.lookupId) out += `<div class="w3b-hint" style="text-align:center;margin-top:8px;">
                <a href="https://weav3r.dev/item/${S.lookupId}" target="_blank" style="color:#e05070;">View on weav3r.dev →</a></div>`;
        } else if (S.lookupListings.length > 0) {
            const name = S.lookupName || `Item #${S.lookupId}`;
            if (S.lookupMismatch) {
                out += `<div class="w3b-error" style="margin-bottom:6px;">
                    ⚠ "${esc(S.lookupMismatch.searched)}" wasn't found — showing <strong>${esc(S.lookupMismatch.got)}</strong> instead.<br>
                    <span style="font-size:10px">Bad mapping removed from index. Try searching again.</span>
                </div>`;
            }
            out += `<div class="w3b-section-label">Cheapest bazaar listings — ${esc(name)}</div>`;
            out += S.lookupListings.slice(0, 20).map(l => `
                <div class="w3b-row" style="border-left-color:#60a5fa">
                    <div class="w3b-row-meta">
                        <span class="w3b-seller">🧍 ${esc(l.sellerName)}</span>
                        <span class="w3b-price">${l.price ? fmtMoney(l.price) : '—'}</span>
                    </div>
                    <div class="w3b-row-meta">
                        <span>Qty: ${esc(String(l.quantity))}</span>
                        <span>${l.lastChecked ? esc(l.lastChecked) : ''}</span>
                    </div>
                    ${l.playerId ? `<div class="w3b-links">
                        <a href="https://www.torn.com/bazaar.php?userId=${l.playerId}&highlightItem=${S.lookupId}" target="_blank">Open Bazaar</a>
                        <a href="https://www.torn.com/trade.php#step=start&userID=${l.playerId}" target="_blank">Trade</a>
                    </div>` : ''}
                </div>`).join('');
            out += `<div class="w3b-hint" style="text-align:center;margin-top:6px;">
                <a href="https://weav3r.dev/item/${S.lookupId}" target="_blank" style="color:#e05070;">Full data on weav3r.dev →</a></div>`;
        } else if (S.lookupId && !S.lookupLoading) {
            const totalMsg = S.lookupTotal === 0
                ? 'weav3r shows 0 active bazaar listings for this item.'
                : S.lookupTotal != null
                    ? `weav3r found ${S.lookupTotal} listings but none returned.`
                    : 'No bazaar listings found.';
            out += `<div class="w3b-empty">${totalMsg}<br>
                <a href="https://weav3r.dev/item/${S.lookupId}" target="_blank" style="color:#e05070;">Verify on weav3r.dev →</a></div>`;
        } else {
            out += `<div class="w3b-empty" style="color:#556">Type an item name to search.<br>
                <span style="font-size:10px">Index covers ${Object.keys(itemIndex).length} items<br>and grows as deals load.</span></div>`;
        }
        return out;
    }

    function renderStatus() {
        if (!statusBar) return;
        if (S.tab === 'deals') {
            const filtered = S.filterCat === 'All' ? S.deals : S.deals.filter(i => i.itemType === S.filterCat);
            const ts = S.dealsTs ? timeAgo(new Date(S.dealsTs).toISOString()) : '—';
            const n = S.realDeals.length;
            const rStr = S.realDealsLoading ? ' · scanning…' : (n > 0 ? ` · ${n} deals` : '');
            statusBar.textContent = `${filtered.length} items · ${ts}${rStr}`;
            statusBar.style.color = '#444';
        } else {
            statusBar.textContent = S.lookupId
                ? `weav3r.dev/item/${S.lookupId}`
                : `${Object.keys(itemIndex).length} items indexed`;
        }
    }

    // ── Listeners ──────────────────────────────────────────────────────────
    function attachListeners() {
        // Deals tab
        const catSel = body.querySelector('#w3b-cat');
        if (catSel) catSel.addEventListener('change', () => {
            S.filterCat = catSel.value;
            store.set('w3_cat', S.filterCat);
            render();
        });
        const refreshBtn = body.querySelector('#w3b-refresh');
        if (refreshBtn) refreshBtn.addEventListener('click', () => {
            S.realDeals = [];
            loadDeals();
        });

        // Settings body
        const keyInput = body.querySelector('#w3b-apikey-input');
        if (keyInput) {
            ['click','touchstart','touchend','mousedown','keydown','keyup','keypress']
                .forEach(ev => keyInput.addEventListener(ev, e => e.stopPropagation()));
        }
        const saveBtn = body.querySelector('#w3b-apikey-save');
        if (saveBtn) saveBtn.addEventListener('click', () => {
            const val = body.querySelector('#w3b-apikey-input')?.value.trim() || '';
            S.apiKey = val;
            store.set('w3_apikey', val);
            S.verified = {};
            S.settingsOpen = false;
            if (val) {
                buildIndexFromTornAPI();
                if (S.deals.length) verifyDeals();
            }
            render();
        });
        const clearBtn = body.querySelector('#w3b-apikey-clear');
        if (clearBtn) clearBtn.addEventListener('click', () => {
            S.apiKey = '';
            store.set('w3_apikey', '');
            S.verified = {};
            S.settingsOpen = false;
            render();
        });

        // Min-discount input: allow input events through without triggering
        // the panel-level event handlers, then save + rescan on button click.
        const minDiscInput = body.querySelector('#w3b-mindiscount-input');
        if (minDiscInput) {
            ['click','touchstart','touchend','mousedown','keydown','keyup','keypress','input','change']
                .forEach(ev => minDiscInput.addEventListener(ev, e => e.stopPropagation()));
        }
        const minDiscSave = body.querySelector('#w3b-mindiscount-save');
        if (minDiscSave) minDiscSave.addEventListener('click', () => {
            const raw = Number(body.querySelector('#w3b-mindiscount-input')?.value);
            const clean = (isFinite(raw) && raw >= 0 && raw <= 100) ? raw : 2;
            store.set('w3_min_discount', clean);
            S.settingsOpen = false;
            // Rescan with new threshold against already-fetched dollar-bazaar list
            // (avoids re-hitting weav3r's dollar-bazaars endpoint).
            if (S.deals.length > 0) loadRealDeals();
            render();
        });

        const includeDollarSave = body.querySelector('#w3b-includedollar-save');
        if (includeDollarSave) includeDollarSave.addEventListener('click', () => {
            const checked = body.querySelector('#w3b-includedollar-input')?.checked === true;
            store.set('w3_include_dollar', checked);
            S.settingsOpen = false;
            if (S.deals.length > 0) loadRealDeals();
            render();
        });

        const onlyBuyableSave = body.querySelector('#w3b-onlybuyable-save');
        if (onlyBuyableSave) onlyBuyableSave.addEventListener('click', () => {
            const checked = body.querySelector('#w3b-onlybuyable-input')?.checked === true;
            store.set('w3_only_buyable', checked);
            S.settingsOpen = false;
            render();
        });

        // Inline "show all" link on the hidden summary line
        const showGoneLink = body.querySelector('#w3b-show-gone');
        if (showGoneLink) showGoneLink.addEventListener('click', () => {
            store.set('w3_only_buyable', false);
            render();
        });

        // Lookup tab — name search input
        const input   = body.querySelector('#w3b-name-input');
        const srchBtn = body.querySelector('#w3b-search');

        if (input) {
            input.addEventListener('input', () => {
                S.lookupQuery = input.value;
                S.acResults   = searchIndex(input.value);
                S.acOpen      = S.acResults.length > 0 && input.value.length >= 2;
                // Re-render just the autocomplete part
                const existing = body.querySelector('#w3b-ac-drop');
                if (existing) existing.remove();
                const wrap = body.querySelector('.w3b-ac-wrap');
                if (wrap && S.acOpen) {
                    const drop = document.createElement('div');
                    drop.className = 'w3b-ac-drop';
                    drop.id = 'w3b-ac-drop';
                    drop.innerHTML = S.acResults.map(([name, id]) =>
                        `<div class="w3b-ac-item" data-id="${id}" data-name="${esc(name)}">
                            <span>${esc(name)}</span>
                            <span class="w3b-ac-id">#${id}</span>
                        </div>`
                    ).join('');
                    wrap.appendChild(drop);
                    drop.querySelectorAll('.w3b-ac-item').forEach(el => {
                        el.addEventListener('mousedown', (e) => {
                            e.preventDefault();
                            const id = el.dataset.id;
                            const name = el.dataset.name;
                            S.lookupQuery = name;
                            S.acOpen = false;
                            lookupItem(id, name);
                        });
                    });
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    // If autocomplete has results, use first one
                    if (S.acResults.length > 0) {
                        const [name, id] = S.acResults[0];
                        S.lookupQuery = name;
                        S.acOpen = false;
                        lookupItem(id, name);
                    } else if (S.lookupQuery.trim()) {
                        // Try exact match in index
                        const exact = itemIndex[S.lookupQuery.trim()];
                        if (exact) lookupItem(exact, S.lookupQuery.trim());
                    }
                }
                if (e.key === 'Escape') { S.acOpen = false; render(); }
            });

            input.addEventListener('blur', () => {
                setTimeout(() => { S.acOpen = false; const d = body.querySelector('#w3b-ac-drop'); if (d) d.remove(); }, 150);
            });
        }

        if (srchBtn) srchBtn.addEventListener('click', () => {
            if (S.acResults.length > 0) {
                const [name, id] = S.acResults[0];
                lookupItem(id, name);
            } else if (S.lookupQuery.trim()) {
                const exact = itemIndex[S.lookupQuery.trim()];
                if (exact) lookupItem(exact, S.lookupQuery.trim());
                else { S.lookupError = `"${S.lookupQuery}" not found in index. Try a different spelling.`; render(); }
            }
        });

        // Autocomplete item clicks (initial render)
        body.querySelectorAll('.w3b-ac-item').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                lookupItem(el.dataset.id, el.dataset.name);
            });
        });
    }

    // ── Build panel ────────────────────────────────────────────────────────
    function buildPanel() {
        panel = document.createElement('div');
        panel.id = 'w3b-panel';
        panel.classList.toggle('collapsed', S.collapsed);

        const head = document.createElement('div');
        head.id = 'w3b-head';
        head.innerHTML = `
            <span id="w3b-head-title">🔍 Weav3r Deals</span>
            <div id="w3b-head-ctrl">
                <button class="w3b-btn dim" id="w3b-settings-btn" style="padding:2px 7px" title="API Key">⚙️</button>
                <button class="w3b-btn dim" id="w3b-minimize" style="padding:2px 7px" title="Minimize">×</button>
            </div>`;
        head.querySelector('#w3b-settings-btn').addEventListener('click', () => {
            S.settingsOpen = !S.settingsOpen;
            render();
        });
        head.querySelector('#w3b-minimize').addEventListener('click', () => {
            S.minimized = true;
            store.set('w3_minimized', true);
            panel.classList.add('minimized');
            minBtn.style.display = 'block';
        });
        panel.appendChild(head);

        const tabs = document.createElement('div');
        tabs.id = 'w3b-tabs';
        tabs.innerHTML = `
            <div class="w3b-tab${S.tab === 'deals'  ? ' active' : ''}" data-tab="deals">💰 Dollar Deals</div>
            <div class="w3b-tab${S.tab === 'lookup' ? ' active' : ''}" data-tab="lookup">🔎 Item Lookup</div>`;
        tabs.addEventListener('click', e => {
            const t = e.target.closest('.w3b-tab');
            if (!t) return;
            S.tab = t.dataset.tab;
            tabs.querySelectorAll('.w3b-tab').forEach(el =>
                el.classList.toggle('active', el.dataset.tab === S.tab));
            render();
        });
        panel.appendChild(tabs);

        body = document.createElement('div');
        body.id = 'w3b-body';
        // Auto-minimize when an Open Bazaar link is clicked
        body.addEventListener('click', e => {
            const link = e.target.closest('a');
            if (link && link.textContent.trim() === 'Open Bazaar') {
                S.minimized = true;
                store.set('w3_minimized', true);
                panel.classList.add('minimized');
                minBtn.style.display = 'block';
            }
        });
        panel.appendChild(body);

        statusBar = document.createElement('div');
        statusBar.id = 'w3b-status';
        panel.appendChild(statusBar);

        document.body.appendChild(panel);

        // Floating restore button
        minBtn = document.createElement('button');
        minBtn.id = 'w3b-minbtn';
        minBtn.textContent = '🔍 Deals';
        minBtn.style.display = S.minimized ? 'block' : 'none';
        minBtn.addEventListener('click', () => {
            S.minimized = false;
            store.set('w3_minimized', false);
            panel.classList.remove('minimized');
            minBtn.style.display = 'none';
        });
        document.body.appendChild(minBtn);

        // Apply initial minimized state
        if (S.minimized) panel.classList.add('minimized');
    }

    // ── Init ──────────────────────────────────────────────────────────────
    function init() {
        buildPanel();
        render();
        loadDeals();
        // 2.4.0: poll weav3r.dev directly every CFG.refreshMs. Originally
        // an SSE stream from our server fanned out cached results, but
        // weav3r.dev itself exposes no SSE endpoint and this script now
        // runs solo (no server proxy), so polling is the only option.
        setInterval(() => { if (!S.dealsLoading) loadDeals(); }, CFG.refreshMs);
        // Build full item index via Torn API if key is set, else skip
        if (S.apiKey) setTimeout(buildIndexFromTornAPI, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

// ── Bazaar item highlighter ────────────────────────────────────────────────
// When landing on a bazaar page via an Open Bazaar link with ?highlightItem=
// outlines the item in green and scrolls it into view.
;(() => {
    const itemId = new URLSearchParams(window.location.search).get('highlightItem');
    if (!itemId) return;
    let done = false;
    const highlight = () => {
        if (done) return;
        document.querySelectorAll('img').forEach(img => {
            if (done) return;
            if (img.src.includes(`/images/items/${itemId}/`)) {
                const wrap = img.closest('div');
                if (wrap) {
                    wrap.style.setProperty('outline', '3px solid #4ade80', 'important');
                    wrap.style.setProperty('border-radius', '4px', 'important');
                    img.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    done = true;       // scroll once only
                    obs.disconnect();  // stop watching so scroll stays free
                }
            }
        });
    };
    const obs = new MutationObserver(highlight);
    obs.observe(document.body, { childList: true, subtree: true });
    highlight();
})();
