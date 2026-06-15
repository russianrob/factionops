// ==UserScript==
// @name         Can Energy
// @namespace    RussianRob
// @author       RussianRob
// @version      0.1.6
// @description  Shows each energy can's effective energy inline on the items page (perk-adjusted, matches TornTools)
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/item.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// @connect      tornwar.com
// @downloadURL  https://tornwar.com/scripts/torn-can-energy.user.js
// @updateURL    https://tornwar.com/scripts/torn-can-energy.user.js
// ==/UserScript==
(function () {
    "use strict";

    const SCRIPT_VERSION = "0.1.6";
    const KEY_STORE = "ce_apikey";
    const MULT_STORE = "ce_mult";
    const MULT_TTL = 24 * 60 * 60 * 1000;

    const CANS = [
        ["goose juice", 5], ["damp valley", 10], ["crocozade", 15], ["munster", 20],
        ["santa shooters", 20], ["red cow", 25], ["rockstar rudolph", 25],
        ["taurine elite", 30], ["x-mass", 30],
    ];
    const CAN_BASE = { 985: 5, 986: 10, 987: 15, 530: 20, 553: 20, 532: 25, 554: 25, 533: 30, 555: 30 };

    let lastError = null;
    let renderTimer = null;
    let diagSent = false;

    function perkMultiplier(perks) {
        const arrs = [perks.faction_perks, perks.job_perks, perks.book_perks];
        let mult = 1;
        for (const arr of arrs) {
            for (const s of arr || []) {
                if (!/energy drinks/i.test(s) && !/consumable gain/i.test(s)) continue;
                const n = parseInt(String(s).replace(/\D+/g, ""), 10);
                if (!Number.isNaN(n)) mult *= 1 + n / 100;
            }
        }
        return mult;
    }

    function effectiveEnergy(base, mult, eventActive) {
        return Math.round(base * mult) * (eventActive ? 2 : 1);
    }

    function canBase(text) {
        const t = (text || "").toLowerCase();
        for (const [n, b] of CANS) if (t.indexOf(n) !== -1) return b;
        return null;
    }

    function nameElForRow(row) {
        return row.querySelector(
            ".name-wrap .name, .item-name, .name-wrap, .title-wrap .name, [class*='name___'], [class*='itemName']"
        );
    }

    function rowFullName(row) {
        const al = row.querySelector("[aria-label]");
        if (al) {
            const v = al.getAttribute("aria-label") || "";
            if (/^can of /i.test(v)) return v;
        }
        const ds = row.getAttribute("data-sort") || "";
        const m = ds.match(/can of .+$/i);
        return m ? m[0] : "";
    }

    function findNameTextEl(row, fullName) {
        if (!fullName) return null;
        const cand = row.querySelectorAll("a, span, b, p, div");
        let contains = null;
        for (let i = 0; i < cand.length; i++) {
            const el = cand[i];
            if (el.children.length !== 0) continue;
            const t = (el.textContent || "").trim();
            if (t === fullName) return el;
            if (!contains && t.indexOf(fullName) !== -1 && t.length < fullName.length + 14) contains = el;
        }
        return contains;
    }

    function findCanRows() {
        const rows = document.querySelectorAll(
            "ul.items-cont > li, ul.items-list > li, li.show-item-info, [data-category='Energy Drink']"
        );
        const out = [];
        const seen = new Set();
        rows.forEach((row) => {
            if (seen.has(row)) return;
            seen.add(row);
            const id = parseInt(row.getAttribute("data-item"), 10);
            let base = CAN_BASE[id];
            if (base == null) base = canBase((nameElForRow(row) || row).textContent);
            if (base == null) return;
            const nameEl = findNameTextEl(row, rowFullName(row)) || nameElForRow(row) || row;
            out.push({ row: row, nameEl: nameEl, base: base });
        });
        return out;
    }

    const getKey = () => (GM_getValue(KEY_STORE, "") || "").trim();

    function cachedMult() {
        try {
            const m = JSON.parse(GM_getValue(MULT_STORE, ""));
            return m && typeof m.multiplier === "number" ? m : null;
        } catch (e) {
            return null;
        }
    }

    function fetchMult() {
        const key = getKey();
        if (!key) return;
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://api.torn.com/user/?selections=perks&key=" + encodeURIComponent(key),
            onload: (r) => {
                try {
                    const d = JSON.parse(r.responseText);
                    if (d.error) { lastError = d.error.error; return; }
                    const mult = perkMultiplier(d);
                    GM_setValue(MULT_STORE, JSON.stringify({ multiplier: mult, fetchedAt: Date.now() }));
                    lastError = null;
                    render();
                } catch (e) {
                    lastError = String(e);
                }
            },
            onerror: () => { lastError = "network error"; },
        });
    }

    function render() {
        const cached = cachedMult();
        const mult = cached ? cached.multiplier : 1;
        const hasKey = !!getKey();
        const rows = findCanRows();
        rows.forEach((entry) => {
            let span = entry.row.querySelector(".ce-energy");
            if (!span) {
                span = document.createElement("span");
                span.className = "ce-energy";
                if (entry.nameEl !== entry.row && entry.nameEl.insertAdjacentElement) {
                    entry.nameEl.insertAdjacentElement("afterend", span);
                } else {
                    entry.nameEl.appendChild(span);
                }
            }
            const e = effectiveEnergy(entry.base, mult, false);
            span.textContent = " " + e + "E" + (hasKey ? "" : "*");
            span.title = hasKey
                ? "Effective energy (your perks)"
                : (lastError ? "API error: " + lastError : "Base energy — tap the cog to add your API key for perk-adjusted values");
        });
        injectHeaderCog();
    }

    function scheduleRender() {
        if (renderTimer) return;
        renderTimer = setTimeout(() => { renderTimer = null; render(); }, 200);
    }

    function findHeader() {
        let best = null;
        document.querySelectorAll("h1,h2,h3,h4,h5,div,span,p,a").forEach((el) => {
            const txt = el.textContent || "";
            if (!/your items/i.test(txt)) return;
            if (txt.length > 60) return;
            if (!best || txt.length < (best.textContent || "").length) best = el;
        });
        return best;
    }

    function injectHeaderCog() {
        if (document.querySelector(".ce-cog")) return;
        const h = findHeader();
        if (!h) return;
        const cog = document.createElement("span");
        cog.className = "ce-cog";
        cog.textContent = "⚙";
        cog.title = "Can Energy — set your Torn API key for perk-adjusted energy";
        cog.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleKeyPanel(cog); });
        h.appendChild(cog);
    }

    function toggleKeyPanel(cog) {
        let panel = document.getElementById("ce-keypanel");
        if (panel) { panel.remove(); return; }
        panel = document.createElement("span");
        panel.id = "ce-keypanel";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Torn API key";
        input.value = getKey();
        input.autocomplete = "off";
        input.autocapitalize = "off";
        input.spellcheck = false;
        const save = document.createElement("button");
        save.textContent = "Save";
        save.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const k = input.value.trim();
            GM_setValue(KEY_STORE, k);
            panel.remove();
            if (k) fetchMult(); else render();
        });
        panel.appendChild(input);
        panel.appendChild(save);
        cog.parentElement.appendChild(panel);
        try { input.focus(); } catch (e) {}
    }

    function sendDiag() {
        if (diagSent) return;
        diagSent = true;
        const count = (s) => { try { return document.querySelectorAll(s).length; } catch (e) { return -1; } };
        const rows = findCanRows();
        let sample = "";
        let nameElInfo = "";
        if (rows.length) {
            sample = (rows[0].row.outerHTML || "").slice(0, 1200);
            const ne = rows[0].nameEl;
            nameElInfo = ne === rows[0].row ? "FALLBACK-to-row" : (ne.tagName + "." + (ne.className || "")).slice(0, 80);
        } else {
            const all = document.querySelectorAll("li, div, p, span");
            for (let i = 0; i < all.length; i++) {
                if (canBase(all[i].textContent) != null && all[i].children.length <= 6) {
                    sample = (all[i].outerHTML || "").slice(0, 700);
                    break;
                }
            }
        }
        const data = {
            v: SCRIPT_VERSION,
            url: location.href,
            canRows: rows.length,
            nameEl: nameElInfo,
            counts: {
                itemsCont: count("ul.items-cont > li"),
                itemsList: count("ul.items-list > li"),
                showItem: count("li.show-item-info, [class*='info___'].show-item-info"),
                tile: count("div[class*='itemTile']"),
                react: count("[class*='itemInfoWrapper'], [class*='itemInfo___']"),
                imgWrapItemid: count("div.img-wrap[data-itemid]"),
            },
            sample: sample,
        };
        try {
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://tornwar.com/api/debug/client-log",
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({ tag: "ce-diag", data: data }),
            });
        } catch (e) {}
    }

    function boot() {
        const c = cachedMult();
        if (getKey() && (!c || Date.now() - c.fetchedAt > MULT_TTL)) fetchMult();
        render();
        setTimeout(sendDiag, 3000);
    }

    try { GM_addStyle(".ce-energy{color:#19b34a;font-weight:600;} .ce-cog{cursor:pointer;margin-left:6px;opacity:.7;} .ce-cog:hover{opacity:1;} #ce-keypanel{margin-left:6px;display:inline-flex;gap:4px;align-items:center;} #ce-keypanel input{width:150px;padding:2px 6px;font-size:.85em;border:1px solid #2a3447;border-radius:6px;background:#1c2030;color:#e6e8ee;} #ce-keypanel button{padding:2px 8px;font-size:.85em;border:1px solid #19b34a;border-radius:6px;background:#19b34a;color:#fff;cursor:pointer;}"); } catch (e) {}
    try { GM_registerMenuCommand("Can Energy: refresh perks", fetchMult); } catch (e) {}
    try { new MutationObserver(scheduleRender).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    boot();
})();
