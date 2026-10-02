// ==UserScript==
// @name         Gym Baseline Export
// @namespace    RussianRob
// @author       RussianRob
// @version      1.1.0
// @description  Copies Gym Coach's stored faction-board baseline out, so the Energy Ladder can be scored from the same start line. Reads only.
// @match        https://www.torn.com/*
// @grant        GM_getValue
// @grant        GM_listValues
// @run-at       document-idle
// @license      GPL-3.0-or-later
// @updateURL    https://tornwar.com/scripts/torn-gym-baseline-export.meta.js
// @downloadURL  https://tornwar.com/scripts/torn-gym-baseline-export.user.js
// ==/UserScript==

/* CHANGELOG
 * 1.1.0  Carries the per-stat baselines as well as the total. Without stats in
 *        the BASELINE there is nothing to subtract from, so the ladder's split
 *        column stays blank all week however many per-stat readings follow it.
 * 1.0.0  A userscript rather than a console snippet, because Torn's CSP has no
 *        'unsafe-eval' and refuses anything pasted into the console. Userscripts
 *        run outside the page's CSP — and reach Tampermonkey's own storage,
 *        which is where Gym Coach writes the board. Its localStorage copy is a
 *        mirror written inside a try/catch, so on a full quota it is simply
 *        absent: the place the console could look is the one place it might not be.
 */

(function () {
  "use strict";

  function gv(k) { try { return GM_getValue(k); } catch (e) { return undefined; } }
  function keys() { try { return GM_listValues() || []; } catch (e) { return []; } }

  function parse(v) {
    if (v == null) return null;
    if (typeof v === "object") return v;
    try { return JSON.parse(v); } catch (e) { return null; }
  }

  // GM storage first — it is the authoritative copy. localStorage is a mirror
  // and may never have been written.
  function findBoard() {
    const tried = [];
    const names = keys().filter((k) => /board/i.test(k));
    for (const n of ["gcb_v1_board", "gc_v1_board"]) if (!names.includes(n)) names.unshift(n);
    for (const n of names) {
      const b = parse(gv(n));
      if (!b || typeof b !== "object") { tried.push(n + ":empty"); continue; }
      tried.push(n + ":" + Object.keys(b).join("/"));
      if (b.at && b.stats) return { board: b, from: "GM:" + n, tried };
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const n = localStorage.key(i);
        if (!/board/i.test(n)) continue;
        const b = parse(localStorage.getItem(n));
        if (b && b.at && b.stats) return { board: b, from: "localStorage:" + n, tried };
        tried.push("ls:" + n);
      }
    } catch (e) { tried.push("ls:" + e.message); }
    return { board: null, from: null, tried };
  }

  function payloadFrom(board) {
    const st = board.stats || {};
    const FIELD = { gymstrength: "str", gymdefense: "def", gymspeed: "spe", gymdexterity: "dex" };
    // Per-member per-stat baselines, so the ladder can show "all dex" from the
    // first reading rather than from next Sunday.
    const perStat = {};
    for (const k of Object.keys(FIELD)) {
      const m = st[k];
      if (!m || typeof m !== "object") continue;
      for (const id of Object.keys(m)) {
        const v = Number(m[id]);
        if (!isFinite(v)) continue;
        (perStat[id] = perStat[id] || {})[FIELD[k]] = v;
      }
    }
    const hasPer = Object.keys(perStat).length > 0;

    if (st.gymenergy && Object.keys(st.gymenergy).length) {
      return { at: board.at, stats: hasPer ? { gymenergy: st.gymenergy, perStat } : { gymenergy: st.gymenergy } };
    }
    // No combined total stored? The four per-stat maps sum to it exactly —
    // measured: 70355 + 2310 + 15170 + 52485 = 140320. Summing them is a
    // reconstruction of the same number, not an estimate of it.
    const parts = ["gymstrength", "gymdefense", "gymspeed", "gymdexterity"]
      .map((k) => st[k]).filter((m) => m && typeof m === "object");
    if (parts.length !== 4) return null;
    const total = {};
    for (const m of parts) {
      for (const id of Object.keys(m)) {
        const v = Number(m[id]);
        if (isFinite(v)) total[id] = (total[id] || 0) + v;
      }
    }
    return Object.keys(total).length
      ? { at: board.at, stats: { gymenergy: total, perStat }, summed: true } : null;
  }

  function panel() {
    const found = findBoard();
    const payload = found.board ? payloadFrom(found.board) : null;
    const text = JSON.stringify(payload
      ? { payload, from: found.from }
      : { payload: null, from: found.from, tried: found.tried });

    const box = document.createElement("div");
    box.style.cssText = "position:fixed;left:10px;right:10px;bottom:10px;z-index:2147483647;"
      + "background:#12141a;color:#e8e6dc;border:1px solid #ff9f2e;border-radius:10px;padding:12px;"
      + "font:12px/1.5 -apple-system,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.6);max-width:640px;margin:0 auto";
    const when = payload ? new Date(Number(payload.at)).toUTCString().replace("GMT", "TCT") : null;
    box.innerHTML =
      "<div style='font-weight:700;color:#ff9f2e;margin-bottom:6px'>Gym baseline export</div>"
      + (payload
        ? "<div>Found " + Object.keys(payload.stats.gymenergy).length + " members, taken <b>" + when + "</b>"
          + (payload.summed ? " <span style='color:#9aa0ad'>(summed from the four stats)</span>" : "") + "</div>"
        : "<div style='color:#e0b357'>No baseline found. Send me the line below.</div>")
      + "<textarea readonly style='width:100%;height:70px;margin-top:8px;background:#0c0e13;color:#e8e6dc;"
      + "border:1px solid #2a2f3a;border-radius:8px;padding:8px;font:11px ui-monospace,Menlo,monospace'></textarea>"
      + "<div style='display:flex;gap:8px;margin-top:8px'>"
      + "<button id='gbe-copy' style='flex:1;padding:10px;border:0;border-radius:8px;background:#9fe870;color:#14170f;font-weight:700'>Copy</button>"
      + "<button id='gbe-close' style='padding:10px 14px;border:1px solid #2a2f3a;border-radius:8px;background:transparent;color:#9aa0ad'>Close</button>"
      + "</div>";
    document.body.appendChild(box);
    const ta = box.querySelector("textarea");
    ta.value = text;
    box.querySelector("#gbe-close").addEventListener("click", () => box.remove());
    box.querySelector("#gbe-copy").addEventListener("click", function () {
      // select() first: on iOS the clipboard API needs the gesture, and a
      // selected textarea is the fallback that always works.
      ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
      try { navigator.clipboard.writeText(text); } catch (e) {}
      try { document.execCommand("copy"); } catch (e) {}
      this.textContent = "Copied";
      setTimeout(() => { this.textContent = "Copy"; }, 3000);
    });
  }

  if (document.body) panel();
  else window.addEventListener("DOMContentLoaded", panel);
})();
