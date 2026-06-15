// ==UserScript==
// @name         Drink Stats
// @namespace    RussianRob
// @author       RussianRob
// @version      1.2.0
// @description  Shows energy per can and nerve per alcohol inline on the items page (perk-adjusted; forked from TornTools)
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/item.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// ==/UserScript==
(function () {
    "use strict";

    const SCRIPT_VERSION = "1.2.0";
    const KEY_STORE = "ce_apikey";
    const MULT_STORE = "ce_mult";
    const MULT_TTL = 24 * 60 * 60 * 1000;
    const CAL_STORE = "ce_cal";

    const CANS = [
        ["goose juice", 5], ["damp valley", 10], ["crocozade", 15], ["munster", 20],
        ["santa shooters", 20], ["red cow", 25], ["rockstar rudolph", 25],
        ["taurine elite", 30], ["x-mass", 30],
    ];
    const CAN_BASE = { 985: 5, 986: 10, 987: 15, 530: 20, 553: 20, 532: 25, 554: 25, 533: 30, 555: 30 };
    const NERVE_BASE = { 180: 1, 181: 1, 294: 1, 426: 1, 531: 2, 541: 4, 542: 3, 550: 2, 551: 3, 552: 4, 638: 3, 816: 2, 873: 5, 924: 5, 984: 5 };
    const PROVIDERS = [
        { key: "energy", cls: "ce-energy", base: CAN_BASE, tip: "Effective energy (your perks)",
          value: (base, p, ctx) => effectiveEnergy(base, p ? p.energyMult : 1, !!(ctx && ctx.events && ctx.events.caffeineCon)) + "E" },
        { key: "nerve", cls: "ce-nerve", base: NERVE_BASE, tip: "Effective nerve (your perks)",
          value: (base, p, ctx) => {
              const ev = (ctx && ctx.events) || {};
              const id = ctx ? ctx.id : 0;
              const mult = (ev.stPatricks ? 2 : 1) * (ev.beerDay && (id === 180 || id === 816) ? 5 : 1);
              return nerveRange(base, p ? p.alcFaction : 0, p ? p.alcCompany : 0, mult);
          } },
    ];

    let lastError = null;
    let renderTimer = null;

    function digitsPct(s) {
        const n = parseInt(String(s).replace(/\D+/g, ""), 10);
        return Number.isNaN(n) ? 0 : n;
    }

    function alcoholPerks(perks) {
        const faction = (perks.faction_perks || []).find((s) => /alcohol/i.test(s));
        const company = (perks.job_perks || []).find((s) => /alcohol boost|consumable boost/i.test(s));
        return { faction: faction ? digitsPct(faction) : 0, company: company ? digitsPct(company) : 0 };
    }

    function computePerks(payload) {
        const alc = alcoholPerks(payload);
        return { energyMult: perkMultiplier(payload), alcFaction: alc.faction, alcCompany: alc.company };
    }

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

    function nerveRange(base, faction, company, eventMult) {
        const total = base * (1 + faction / 100) * (1 + company / 100) * (eventMult || 1);
        const min = Math.floor(total), max = Math.ceil(total);
        return min === max ? min + " N" : min + " - " + max + " N";
    }

    function eventActive(events, matcher, now) {
        const ev = (events || []).find(matcher);
        if (!ev) return false;
        const start = ev.start * 1000 - 86400000;
        const end = ev.end * 1000 + 86400000;
        return now > start && now < end;
    }

    function computeEvents(events, now) {
        return {
            caffeineCon: eventActive(events, (e) => /caffeinecon/i.test(e.title || ""), now),
            stPatricks: eventActive(events, (e) => /st\.?\s*patrick/i.test(e.title || ""), now),
            beerDay: eventActive(events, (e) => /international beer day/i.test(e.title || ""), now),
        };
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
            if (/(can|bottle|glass) of /i.test(v)) return v;
        }
        const ds = row.getAttribute("data-sort") || "";
        const m = ds.match(/(can|bottle|glass) of .+$/i);
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

    function findRows() {
        const rows = document.querySelectorAll(
            "ul.items-cont > li, ul.items-list > li, li.show-item-info, [data-category='Energy Drink'], [data-category='Alcohol']"
        );
        const out = [];
        const seen = new Set();
        rows.forEach((row) => {
            if (seen.has(row)) return;
            seen.add(row);
            const id = parseInt(row.getAttribute("data-item"), 10);
            let provider = null, base = null;
            for (const p of PROVIDERS) {
                if (p.base[id] != null) { provider = p; base = p.base[id]; break; }
            }
            if (provider == null) {
                const b = canBase((nameElForRow(row) || row).textContent);
                if (b != null) { provider = PROVIDERS[0]; base = b; }
            }
            if (provider == null) return;
            const nameLeaf = findNameTextEl(row, rowFullName(row)) || nameElForRow(row) || row;
            const nameWrap = row.querySelector(".name-wrap");
            out.push({ row: row, id: id, nameLeaf: nameLeaf, nameWrap: nameWrap, provider: provider, base: base });
        });
        return out;
    }

    const getKey = () => (GM_getValue(KEY_STORE, "") || "").trim();

    function cachedPerks() {
        try {
            const m = JSON.parse(GM_getValue(MULT_STORE, ""));
            if (m && typeof m.energyMult === "number" && typeof m.alcFaction === "number" && typeof m.alcCompany === "number") return m;
            return null;
        } catch (e) {
            return null;
        }
    }

    function fetchPerks() {
        const key = getKey();
        if (!key) return;
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://api.torn.com/user/?selections=perks&key=" + encodeURIComponent(key),
            onload: (r) => {
                try {
                    const d = JSON.parse(r.responseText);
                    if (d.error) { lastError = d.error.error; return; }
                    GM_setValue(MULT_STORE, JSON.stringify(Object.assign(computePerks(d), { fetchedAt: Date.now() })));
                    lastError = null;
                    render();
                } catch (e) {
                    lastError = String(e);
                }
            },
            onerror: () => { lastError = "network error"; },
        });
    }

    function cachedCalendar() {
        try {
            const c = JSON.parse(GM_getValue(CAL_STORE, ""));
            if (c && Array.isArray(c.events)) return c;
            return null;
        } catch (e) {
            return null;
        }
    }

    function activeEvents() {
        const c = cachedCalendar();
        return computeEvents(c ? c.events : [], Date.now());
    }

    function fetchCalendar() {
        const key = getKey();
        if (!key) return;
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://api.torn.com/v2/torn?selections=calendar&key=" + encodeURIComponent(key),
            onload: (r) => {
                try {
                    const d = JSON.parse(r.responseText);
                    if (d && d.error) return;
                    const cal = d && d.calendar ? d.calendar : null;
                    const events = cal && Array.isArray(cal.events) ? cal.events : [];
                    GM_setValue(CAL_STORE, JSON.stringify({ events: events, fetchedAt: Date.now() }));
                    render();
                } catch (e) {}
            },
            onerror: () => {},
        });
    }

    function render() {
        const perks = cachedPerks();
        const events = activeEvents();
        const hasKey = !!getKey();
        const rows = findRows();
        rows.forEach((entry) => {
            const row = entry.row;
            let span = row.querySelector(".ce-badge");
            if (!span) {
                span = document.createElement("span");
                span.className = "ce-badge " + entry.provider.cls;
            }
            const priced = !!row.querySelector(".rwp-base-price-tag");
            let ref;
            if (priced && entry.nameLeaf && entry.nameWrap &&
                entry.nameLeaf !== entry.nameWrap && entry.nameWrap.contains(entry.nameLeaf)) {
                ref = entry.nameLeaf;
            } else if (entry.nameWrap) {
                ref = entry.nameWrap;
            } else {
                ref = entry.nameLeaf || row;
            }
            if (ref === row) {
                if (span.parentElement !== ref) ref.appendChild(span);
            } else if (span.previousElementSibling !== ref) {
                ref.insertAdjacentElement("afterend", span);
            }
            const txt = " " + entry.provider.value(entry.base, perks, { id: entry.id, events: events }) + (hasKey ? "" : "*");
            if (span.textContent !== txt) span.textContent = txt;
            const tip = hasKey ? entry.provider.tip
                : (lastError ? "API error: " + lastError : "Base value — tap the cog to add your API key for perk-adjusted values");
            if (span.title !== tip) span.title = tip;
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
        cog.title = "Drink Stats — set your Torn API key for perk-adjusted energy & nerve";
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
            if (k) { fetchPerks(); fetchCalendar(); } else render();
        });
        panel.appendChild(input);
        panel.appendChild(save);
        cog.parentElement.appendChild(panel);
        try { input.focus(); } catch (e) {}
    }

    function boot() {
        const c = cachedPerks();
        if (getKey() && (!c || Date.now() - c.fetchedAt > MULT_TTL)) fetchPerks();
        const cal = cachedCalendar();
        if (getKey() && (!cal || Date.now() - cal.fetchedAt > MULT_TTL)) fetchCalendar();
        render();
    }

    if (typeof document !== "undefined") {
        try { GM_addStyle(".ce-badge{font-weight:600;} .ce-energy{color:#19b34a;} .ce-nerve{color:#e0556b;} .ce-cog{cursor:pointer;margin-left:6px;opacity:.7;} .ce-cog:hover{opacity:1;} #ce-keypanel{margin-left:6px;display:inline-flex;gap:4px;align-items:center;} #ce-keypanel input{width:150px;padding:2px 6px;font-size:.85em;border:1px solid #2a3447;border-radius:6px;background:#1c2030;color:#e6e8ee;} #ce-keypanel button{padding:2px 8px;font-size:.85em;border:1px solid #19b34a;border-radius:6px;background:#19b34a;color:#fff;cursor:pointer;}"); } catch (e) {}
        try { GM_registerMenuCommand("Drink Stats: refresh", function () { fetchPerks(); fetchCalendar(); }); } catch (e) {}
        try { new MutationObserver(scheduleRender).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
        boot();
    }
    if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
        module.exports = { perkMultiplier, effectiveEnergy, alcoholPerks, nerveRange, eventActive, computeEvents, computePerks, PROVIDERS, CAN_BASE, NERVE_BASE };
    }
})();
