// ==UserScript==
// @name         Can Energy
// @namespace    RussianRob
// @author       RussianRob
// @version      0.1.1
// @description  Shows each energy can's effective energy inline on the items page (perk-adjusted, matches TornTools)
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/item.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// @downloadURL  https://tornwar.com/scripts/torn-can-energy.user.js
// @updateURL    https://tornwar.com/scripts/torn-can-energy.user.js
// ==/UserScript==
(function () {
    "use strict";

    const SCRIPT_VERSION = "0.1.1";
    const KEY_STORE = "ce_apikey";
    const MULT_STORE = "ce_mult";
    const MULT_TTL = 24 * 60 * 60 * 1000;

    const CAN_BASE = {
        985: 5, 986: 10, 987: 15, 530: 20, 553: 20, 532: 25, 554: 25, 533: 30, 555: 30,
    };

    let lastError = null;
    let renderTimer = null;

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
        document.querySelectorAll("div.img-wrap[data-itemid]").forEach((wrap) => {
            const id = parseInt(wrap.getAttribute("data-itemid"), 10);
            if (!(id in CAN_BASE)) return;
            const row = wrap.closest("li, .item, [class*='item']") || wrap.parentElement;
            if (!row) return;
            const name = row.querySelector("[class*='name'], .name-wrap, .title") || row;
            let span = row.querySelector(".ce-energy");
            if (!span) {
                span = document.createElement("span");
                span.className = "ce-energy";
                name.appendChild(span);
            }
            const e = effectiveEnergy(CAN_BASE[id], mult, false);
            span.textContent = " " + e + "E" + (hasKey ? "" : "*");
            span.title = hasKey
                ? "Effective energy (your perks)"
                : (lastError ? "API error: " + lastError : "Base energy — tap the cog to add your API key for perk-adjusted values");
        });
        injectCog();
    }

    function scheduleRender() {
        if (renderTimer) return;
        renderTimer = setTimeout(() => { renderTimer = null; render(); }, 200);
    }

    function injectCog() {
        if (document.querySelector(".ce-cog")) return;
        const anchor = document.querySelector("div.img-wrap[data-itemid]");
        if (!anchor) return;
        const cog = document.createElement("span");
        cog.className = "ce-cog";
        cog.textContent = "⚙";
        cog.title = "Can Energy — set your Torn API key for perk-adjusted energy";
        cog.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleKeyPanel(cog); });
        (anchor.closest("li") || anchor.parentElement).appendChild(cog);
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

    function boot() {
        const c = cachedMult();
        if (getKey() && (!c || Date.now() - c.fetchedAt > MULT_TTL)) fetchMult();
        render();
    }

    GM_addStyle(".ce-energy{color:#19b34a;font-weight:600;} .ce-cog{cursor:pointer;margin-left:6px;opacity:.7;} .ce-cog:hover{opacity:1;} #ce-keypanel{margin-left:6px;display:inline-flex;gap:4px;align-items:center;} #ce-keypanel input{width:150px;padding:2px 6px;font-size:.85em;border:1px solid #2a3447;border-radius:6px;background:#1c2030;color:#e6e8ee;} #ce-keypanel button{padding:2px 8px;font-size:.85em;border:1px solid #19b34a;border-radius:6px;background:#19b34a;color:#fff;cursor:pointer;}");
    GM_registerMenuCommand("Can Energy: refresh perks", fetchMult);
    GM_registerMenuCommand("Can Energy: set API key", () => {
        const k = prompt("Torn API key:", getKey());
        if (k != null) { GM_setValue(KEY_STORE, k.trim()); fetchMult(); }
    });
    new MutationObserver(scheduleRender).observe(document.body, { childList: true, subtree: true });
    boot();
})();
