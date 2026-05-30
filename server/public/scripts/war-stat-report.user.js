// ==UserScript==
// @name         War Stat Report
// @namespace    tornwar.com
// @version      0.1.1
// @description  Adds an "Enemy Stat Report" button on the faction page: scans the last 24h of your faction's attack log, keeps attacks by the war-opponent faction, and reports how many were made by enemies with FFScouter-estimated stats of 3B or more. By RussianRob.
// @author       RussianRob
// @match        https://www.torn.com/factions.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @connect      api.torn.com
// @connect      ffscouter.com
// @connect      tornwar.com
// @downloadURL  https://tornwar.com/scripts/war-stat-report.user.js
// @updateURL    https://tornwar.com/scripts/war-stat-report.meta.js
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_VERSION = '0.1.1';
  const THRESHOLD = 3_000_000_000;  // 3B estimated total stats
  const WINDOW_SEC = 24 * 60 * 60;  // last 24 hours
  const PAGE_LIMIT = 100;           // attacks per page
  const MAX_PAGES = 30;             // cap (≈3000 attacks) to bound API calls / time
  const REQ_GAP_MS = 150;           // polite gap between API calls

  // ── API key (FFScouter-registered Torn key; used for the attack log + stats) ──
  function getKey() {
    let k = GM_getValue('wsr_key', '');
    if (!k) {
      k = (prompt('War Stat Report — enter your FFScouter / Torn API key\n(used to read the faction attack log and look up stat estimates):', '') || '').trim();
      if (k) GM_setValue('wsr_key', k);
    }
    return k;
  }

  // ── helpers ──
  function httpJSON(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 20000,
        onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(new Error('Bad JSON')); } },
        onerror: () => reject(new Error('Request failed')),
        ontimeout: () => reject(new Error('Request timed out')),
      });
    });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function wsrDiag(data) {
    try {
      GM_xmlhttpRequest({
        method: 'POST', url: 'https://tornwar.com/api/debug/client-log',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ tag: 'wsr', data: Object.assign({ v: SCRIPT_VERSION }, data) }),
        onload: function () {}, onerror: function () {},
      });
    } catch (e) {}
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function human(n) {
    if (n == null) return '?';
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'b';
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'k';
    return String(n);
  }

  // ── resolve own faction + current ranked-war opponent ──
  async function resolveFactions(key) {
    const basic = await httpJSON(`https://api.torn.com/v2/faction?selections=basic&key=${encodeURIComponent(key)}`);
    if (basic && basic.error) throw new Error('Torn API: ' + (basic.error.error || 'basic'));
    const ownId = String(basic?.basic?.id ?? basic?.id ?? '');

    const wars = await httpJSON(`https://api.torn.com/v2/faction?selections=wars&key=${encodeURIComponent(key)}`);
    if (wars && wars.error) throw new Error('Torn API: ' + (wars.error.error || 'wars'));
    const w = wars?.wars || wars;
    const ranked = w?.ranked;
    const entries = Array.isArray(ranked) ? ranked : (ranked ? [ranked] : []);
    let enemyId = null, enemyName = null;
    for (const entry of entries) {
      const facs = entry?.factions;
      if (!Array.isArray(facs)) continue;
      for (const f of facs) {
        if (f?.id != null && String(f.id) !== ownId) { enemyId = String(f.id); enemyName = f.name || ('Faction ' + f.id); }
      }
    }
    return { ownId, enemyId, enemyName };
  }

  // ── fetch last-24h faction attacks, keep ones BY the enemy faction ──
  async function fetchEnemyAttacks(key, enemyId) {
    const now = Math.floor(Date.now() / 1000);
    const from = now - WINDOW_SEC;
    let url = `https://api.torn.com/v2/faction/attacks?key=${encodeURIComponent(key)}&limit=${PAGE_LIMIT}&sort=DESC&from=${from}&to=${now}`;
    const out = [];
    let pages = 0, truncated = false, scanned = 0, withAttacker = 0;
    const facCounts = {};
    while (url && pages < MAX_PAGES) {
      const data = await httpJSON(url);
      if (data && data.error) throw new Error('Torn API: ' + (data.error.error || 'attacks'));
      const atks = Array.isArray(data?.attacks) ? data.attacks : (data?.attacks ? Object.values(data.attacks) : []);
      for (const a of atks) {
        scanned++;
        const attacker = a?.attacker;
        if (!attacker || attacker.id == null) continue; // stealthed / unknown attacker
        withAttacker++;
        const afid = attacker?.faction?.id ?? a?.attacker_faction;
        const fkey = String(afid);
        facCounts[fkey] = (facCounts[fkey] || 0) + 1;
        if (fkey !== String(enemyId)) continue;
        out.push({ id: String(attacker.id), name: attacker.name || ('ID ' + attacker.id), result: a?.result || '' });
      }
      pages++;
      const next = data?._metadata?.links?.next;
      const oldest = atks.length ? (atks[atks.length - 1]?.started ?? 0) : 0;
      if (!next || (atks.length && oldest && oldest < from)) { url = null; }
      else { url = next.includes('key=') ? next : next + (next.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key); }
      await sleep(REQ_GAP_MS);
    }
    if (pages >= MAX_PAGES && url) truncated = true;
    const topFacs = Object.entries(facCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { attacks: out, truncated, meta: { scanned, withAttacker, pages, topFacs } };
  }

  // ── FFScouter batch lookup → { id: bs_estimate|null } ──
  async function ffscouterStats(key, ids) {
    const map = {};
    const uniq = [...new Set(ids)];
    for (let i = 0; i < uniq.length; i += 100) {
      const chunk = uniq.slice(i, i + 100);
      const res = await httpJSON(`https://ffscouter.com/api/v1/get-stats?key=${encodeURIComponent(key)}&targets=${chunk.join(',')}`);
      if (res && res.error) throw new Error('FFScouter: ' + res.error);
      if (Array.isArray(res)) for (const r of res) {
        if (r && r.player_id != null) {
          const est = (r.bs_estimate == null) ? null : Number(r.bs_estimate);
          map[String(r.player_id)] = Number.isFinite(est) ? est : null;
        }
      }
      await sleep(REQ_GAP_MS);
    }
    return map;
  }

  // ── aggregate ──
  function aggregate(attacks, statsMap) {
    const per = {};
    for (const a of attacks) {
      if (!per[a.id]) per[a.id] = { id: a.id, name: a.name, count: 0, est: (a.id in statsMap ? statsMap[a.id] : null) };
      per[a.id].count++;
    }
    const all = Object.values(per);
    const heavy = all.filter((p) => p.est != null && p.est >= THRESHOLD).sort((x, y) => y.count - x.count);
    const unknown = all.filter((p) => p.est == null).length;
    const heavyAttacks = heavy.reduce((s, p) => s + p.count, 0);
    return { total: attacks.length, attackers: all.length, heavy, heavyAttacks, unknown };
  }

  function reportText(agg, enemyName, truncated) {
    const lines = [`Enemy ${enemyName} — last 24h, 3B+ hitters:`];
    if (agg.heavy.length) for (const p of agg.heavy) lines.push(`- ${p.name} [${p.id}]: ${human(p.est)} — ${p.count} atk`);
    else lines.push('- none');
    lines.push(`Total: ${agg.heavyAttacks} attacks by ${agg.heavy.length} enemies >=3B (of ${agg.total} enemy attacks${agg.unknown ? `, ${agg.unknown} unknown est` : ''}).${truncated ? ' [truncated]' : ''}`);
    return lines.join('\n');
  }

  // ── UI ──
  GM_addStyle(`
    #wsr-btn { position: fixed; bottom: 16px; right: 16px; z-index: 2147483600; background:#7a1f1f; color:#fff; border:1px solid #b34a4a; border-radius:8px; padding:8px 12px; font:600 13px Arial,sans-serif; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,.5); }
    #wsr-btn:hover { background:#992525; }
    #wsr-overlay { position: fixed; inset:0; z-index:2147483601; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; padding:16px; }
    #wsr-modal { background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:10px; max-width:560px; width:100%; max-height:80vh; overflow:auto; padding:16px; font:13px Arial,sans-serif; box-shadow:0 12px 40px rgba(0,0,0,.6); }
    #wsr-modal h2 { margin:0 0 8px; font-size:16px; color:#ffd700; }
    #wsr-modal table { width:100%; border-collapse:collapse; margin:8px 0; }
    #wsr-modal th, #wsr-modal td { text-align:left; padding:3px 6px; border-bottom:1px solid #333; }
    #wsr-modal th { color:#aaa; font-weight:600; }
    .wsr-sum { background:#23233a; border-radius:6px; padding:8px 10px; margin:6px 0; line-height:1.5; }
    .wsr-row { display:flex; gap:8px; margin-top:12px; }
    .wsr-act { background:#2a2a44; color:#fff; border:1px solid #555; border-radius:6px; padding:6px 12px; cursor:pointer; font:600 13px Arial,sans-serif; }
    .wsr-act:hover { background:#3a3a5a; }
    .wsr-foot { color:#888; font-size:11px; margin-top:10px; }
  `);

  function closeModal() { const o = document.getElementById('wsr-overlay'); if (o) o.remove(); }
  function showModal(html) {
    closeModal();
    const ov = document.createElement('div'); ov.id = 'wsr-overlay';
    ov.innerHTML = `<div id="wsr-modal">${html}</div>`;
    ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(); });
    document.body.appendChild(ov);
    const c = ov.querySelector('#wsr-close'); if (c) c.addEventListener('click', closeModal);
    return ov;
  }

  function renderReport(agg, enemyName, truncated, text, dbg) {
    let rows = agg.heavy.map((p) =>
      `<tr><td><a href="https://www.torn.com/profiles.php?XID=${p.id}" target="_blank" style="color:#9cf;text-decoration:none">${escapeHtml(p.name)}</a> [${p.id}]</td><td>${human(p.est)}</td><td style="text-align:right">${p.count}</td></tr>`
    ).join('');
    if (!agg.heavy.length) rows = '<tr><td colspan="3" style="color:#888">No 3B+ enemies in the last 24h.</td></tr>';
    showModal(`
      <h2>Enemy Stat Report — ${escapeHtml(enemyName)}</h2>
      <div class="wsr-sum"><b>${agg.heavyAttacks}</b> attacks by <b>${agg.heavy.length}</b> enemies &ge;3B — of <b>${agg.total}</b> enemy attacks (last 24h)${agg.unknown ? `, <span style="color:#caa">${agg.unknown} unknown est</span>` : ''}.${truncated ? ' <span style="color:#fa6">[truncated]</span>' : ''}</div>
      <table><thead><tr><th>3B+ attacker</th><th>est stats</th><th style="text-align:right">attacks</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="wsr-row"><button class="wsr-act" id="wsr-copy">📋 Copy for chat</button><button class="wsr-act" id="wsr-close">Close</button></div>
      <div class="wsr-foot">War Stat Report v${SCRIPT_VERSION} · 3B threshold · FFScouter estimates</div>
      <div class="wsr-foot" style="opacity:.7;word-break:break-word">${escapeHtml(dbg || '')}</div>`);
    const copyBtn = document.getElementById('wsr-copy');
    copyBtn.addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(text).then(
          () => { copyBtn.textContent = '✅ Copied'; },
          () => { window.prompt('Copy this:', text); }
        );
      } catch (e) { window.prompt('Copy this:', text); }
    });
  }

  async function runReport() {
    const key = getKey();
    if (!key) return;
    showModal('<h2>Enemy Stat Report</h2><div>Resolving war &amp; scanning the attack log…</div>');
    try {
      const { ownId, enemyId, enemyName } = await resolveFactions(key);
      if (!enemyId) {
        showModal('<h2>Enemy Stat Report</h2><div>No active ranked war found for your faction.</div><div class="wsr-row"><button class="wsr-act" id="wsr-close">Close</button></div>');
        return;
      }
      showModal(`<h2>Enemy Stat Report</h2><div>Scanning last 24h of attacks from <b>${escapeHtml(enemyName)}</b>…</div>`);
      const { attacks, truncated, meta } = await fetchEnemyAttacks(key, enemyId);
      const stats = attacks.length ? await ffscouterStats(key, attacks.map((a) => a.id)) : {};
      const agg = aggregate(attacks, stats);
      const dbg = `own ${ownId} · enemy ${enemyId} · scanned ${meta.scanned} (${meta.withAttacker} w/atk, ${meta.pages}p) · matched ${attacks.length} · attacker-factions: ${meta.topFacs.map(([f, c]) => f + '×' + c).join(', ') || 'none'}`;
      wsrDiag({ ownId, enemyId, enemyName, scanned: meta.scanned, withAttacker: meta.withAttacker, matched: attacks.length, pages: meta.pages, topFacs: meta.topFacs, truncated });
      renderReport(agg, enemyName, truncated, reportText(agg, enemyName, truncated), dbg);
    } catch (e) {
      showModal(`<h2>Enemy Stat Report</h2><div style="color:#ff8">Error: ${escapeHtml(String(e && e.message || e))}</div><div class="wsr-foot">If this is an access error, the key may need faction-attacks permission. Clear it and re-enter with <code>localStorage</code>? Use a full/faction key.</div><div class="wsr-row"><button class="wsr-act" id="wsr-close">Close</button></div>`);
    }
  }

  function addButton() {
    if (document.getElementById('wsr-btn')) return;
    const b = document.createElement('button');
    b.id = 'wsr-btn';
    b.textContent = '📊 Enemy Stat Report';
    b.addEventListener('click', runReport);
    document.body.appendChild(b);
  }
  if (document.body) addButton();
  else document.addEventListener('DOMContentLoaded', addButton);
})();
