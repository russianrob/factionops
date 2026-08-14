/**
 * Regenerates the served Xanax Accountability page (tornwar.com/xanax) from the
 * current war-history, applying the live xanax-model. Run hourly via the box
 * crontab so the page always shows faction 42055's true last-N ranked wars under
 * the current model — no manual step. EVERYTHING shown is derived from the data
 * (counts, names, W/L, the "read" bullets), so it stays correct as wars roll
 * over; there is no hand-written narrative to go stale.
 *
 * Reads:  ../data/war-history/<faction>.json  (+ ../xanax-model.js)
 * Writes: ../public/xanax/index.html
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as xm from "../xanax-model.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, "..");
const FACTION = "42055";
const N_WARS = 4;
const HIST = join(SERVER, "data", "war-history", `${FACTION}.json`);
const OUT_DIR = join(SERVER, "public", "xanax");
const OUT = join(OUT_DIR, "index.html");

// ── Build the last-N wars + per-member cells from war-history ──
const h = JSON.parse(readFileSync(HIST, "utf-8"));
const wars = h.wars || {};
const byWar = {};
for (const [, w] of Object.entries(wars)) {
  const end = w.warEndedAt || 0;
  if (!end || !Array.isArray(w.members) || !w.members.length) continue;
  const xN = w.xanaxStats && w.xanaxStats.taken ? Object.keys(w.xanaxStats.taken).length : 0;
  const id = `${Math.floor(end / 86400000)}_${w.enemyFactionId}`; // one war per enemy per day
  if (!byWar[id] || xN > byWar[id].xN) byWar[id] = { w, end, xN, enemy: w.enemyFactionId, enemyName: w.enemyFactionName, result: w.warResult };
}
const list = Object.values(byWar).sort((a, b) => b.end - a.end).slice(0, N_WARS).reverse(); // oldest→newest
const N = list.length;
const warMeta = list.map(it => ({
  date: new Date(it.end).toISOString().slice(0, 10),
  enemy: it.enemyName || String(it.enemy),
  result: it.result,
  tookXanax: it.xN,
}));
const players = {};
list.forEach((it, ci) => {
  for (const m of it.w.members) {
    if ((m.xanaxTaken || 0) <= 0) continue;
    const p = players[m.playerId] || (players[m.playerId] = { name: m.name, cells: Array(N).fill(null), xanax: 0, deficit: 0, flagged: 0 });
    p.name = m.name;
    const ta = Number(m.totalAttacks) || 0;
    const def = xm.deficit(m.xanaxTaken, ta), flag = xm.flagged(m.xanaxTaken, ta);
    p.cells[ci] = { x: m.xanaxTaken, h: m.warHits, def, flag };
    p.xanax += m.xanaxTaken; p.deficit += def; if (flag) p.flagged++;
  }
});
const playerList = Object.values(players);

// ── Derived (all data-driven) ──
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sev = (def, took) => !took ? "empty" : def <= 0 ? "none" : def <= 8 ? "low" : def <= 20 ? "mid" : "high";
const flagged = playerList.filter(p => p.flagged > 0).sort((a, b) => b.flagged - a.flagged || b.deficit - a.deficit || b.xanax - a.xanax);
const repeat = flagged.filter(p => p.flagged >= 2);
const once = flagged.filter(p => p.flagged === 1);
const clean = playerList.filter(p => p.flagged === 0 && p.deficit === 0).sort((a, b) => b.xanax - a.xanax).slice(0, 5);
const bigWaste = [...flagged].sort((a, b) => b.deficit - a.deficit).slice(0, 3);
const totalDosed = playerList.length;
const wins = warMeta.filter(w => w.result === "victory").length;
const losses = warMeta.filter(w => w.result === "defeat").length;
const updated = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

function cell(c) {
  if (!c) return `<td class="c empty"><span class="dash">·</span></td>`;
  const flag = c.flag ? `<span class="flag" title="flagged">⚑</span>` : "";
  const defTxt = c.def > 0 ? `<b>${c.def}</b>` : `<span class="ok">ok</span>`;
  return `<td class="c ${sev(c.def, true)}">${flag}<span class="xh">${c.x}x→${c.h}h</span><span class="def">${defTxt}</span></td>`;
}
function row(p) {
  const badgeCls = p.flagged >= 2 ? "b-hot" : "b-warn";
  const totCls = p.deficit > 20 ? "high" : p.deficit > 8 ? "mid" : p.deficit > 0 ? "low" : "none";
  return `<tr><th class="name" scope="row">${esc(p.name)}</th>${p.cells.map(cell).join("")}<td class="tot ${totCls}">${p.deficit}</td><td class="fl"><span class="badge ${badgeCls}">${p.flagged}/${N}</span></td></tr>`;
}
function band(label, sub) {
  return `<tr class="band"><th class="name" scope="rowgroup">${label}<small>${sub}</small></th>${warMeta.map(() => '<td></td>').join("")}<td></td><td></td></tr>`;
}
const warHeadCells = warMeta.map(w => `<th class="war ${w.result}"><span class="wres">${w.result === "victory" ? "W" : w.result === "defeat" ? "L" : "="}</span><span class="wdate">${w.date.slice(5)}</span><span class="wenemy" title="${esc(w.enemy)}">${esc(w.enemy)}</span><span class="wtook">${w.tookXanax} dosed</span></th>`).join("");

const readBullets = [
  repeat.length ? `<li><b>${repeat.length}</b> repeat offender${repeat.length === 1 ? "" : "s"} — flagged in 2+ of the last ${N} wars. Worst: <span class="nm">${esc(repeat[0].name)}</span> (${repeat[0].flagged}/${N}, ${repeat[0].deficit} total deficit).</li>` : "",
  bigWaste.length ? `<li>Biggest cumulative waste: ${bigWaste.map(p => `<span class="nm">${esc(p.name)}</span> (${p.deficit})`).join(", ")}.</li>` : "",
  `<li><b>${flagged.length}</b> of ${totalDosed} members who dosed came up short of the xanax + regen bar by more than the ${xm.DEFICIT_GRACE}-attack grace.</li>`,
].filter(Boolean).join("\n      ");

// ── Most-recent-war focus: EVERY member who dosed in the newest war (not just
// the flagged), ranked worst→best. The matrix above is flagged-only across N
// wars; this is the complete picture of the single latest war. ──
const latest = list.length ? list[list.length - 1] : null;
const latestMeta = warMeta.length ? warMeta[warMeta.length - 1] : null;
const latestDosers = (latest ? latest.w.members : [])
  .filter(m => (m.xanaxTaken || 0) > 0)
  .map(m => {
    const ta = Number(m.totalAttacks) || 0;
    return { name: m.name, x: m.xanaxTaken, h: m.warHits, def: xm.deficit(m.xanaxTaken, ta), flag: xm.flagged(m.xanaxTaken, ta) };
  })
  .sort((a, b) => b.def - a.def || b.x - a.x);
const latestFlagged = latestDosers.filter(d => d.flag).length;
const latestDefTotal = latestDosers.reduce((s, d) => s + d.def, 0);
const rescls = r => r === "victory" ? "victory" : r === "defeat" ? "defeat" : "draw";
const latestSection = latest ? `
  <div class="panel latest">
    <div class="lhead">
      <span class="lchip ${rescls(latestMeta.result)}">${latestMeta.result === "victory" ? "W" : latestMeta.result === "defeat" ? "L" : "="}</span>
      <div>
        <h2>Most recent war — <span class="lenemy">${esc(latestMeta.enemy)}</span></h2>
        <span class="lmeta">${latestMeta.date} · ${latestDosers.length} dosed · <b class="${latestFlagged ? "bad" : ""}">${latestFlagged}</b> flagged · ${latestDefTotal} total deficit</span>
      </div>
    </div>
    <div class="lgrid">
      ${latestDosers.length ? latestDosers.map((d, i) => `<div class="lrow ${sev(d.def, true)}">
        <span class="lrank">${i + 1}</span>
        <span class="lname">${d.flag ? '<span class="flag">⚑</span> ' : ""}${esc(d.name)}</span>
        <span class="lxh">${d.x}x → ${d.h}h</span>
        <span class="ldef">${d.def > 0 ? `<b>${d.def}</b> short` : '<span class="ok">on target</span>'}</span>
      </div>`).join("") : '<div class="lrow"><span class="lempty">No members dosed Xanax in the most recent war.</span></div>'}
    </div>
  </div>` : "";

const body = `<div class="wrap"><div class="inner">
  <p class="eyebrow">Dead Fragment · Faction ${FACTION} · Ranked War Xanax Accountability</p>
  <h1>Who's burning Xanax without hitting</h1>
  <p class="sub">Last ${N} ranked wars. <b>Expected</b> = 10 attacks per Xanax (250e) <b>+ 6 for the ~150e of natural regen</b> a member burns over a war, at 25e/attack. <b>Deficit</b> = expected minus attacks actually thrown (war <em>and</em> non-war both count). A cell flags only when the miss clears a <b>${xm.DEFICIT_GRACE}-attack grace</b> — so "did the vial minimum and coasted" shows, but a 1–2 attack miss doesn't.</p>

  <div class="stats">
    <div class="stat"><b>${N}</b><span>wars · ${wins} W / ${losses} L</span></div>
    <div class="stat"><b>${totalDosed}</b><span>members dosed Xanax</span></div>
    <div class="stat bad"><b>${flagged.length}</b><span>flagged ≥1 war</span></div>
    <div class="stat bad"><b>${repeat.length}</b><span>repeat offenders (2+)</span></div>
  </div>

  <div class="read">
    <h2>The read</h2>
    <ul>
      ${readBullets}
    </ul>
    ${clean.length ? `<div style="margin-top:12px;font-size:13px;color:var(--muted)">Took the most and <b style="color:var(--win)">still delivered</b> (0 deficit) — volume isn't abuse:</div>
    <div class="clean">${clean.map(p => `<span class="chip">${esc(p.name)} · ${p.xanax}x → 0 def</span>`).join("")}</div>` : ""}
  </div>

  ${latestSection}

  <div class="panel"><div class="scroll">
  <table>
    <thead><tr>
      <th class="corner">Member<br><span style="font-weight:600;color:var(--faint)">Nx→Mh · deficit</span></th>
      ${warHeadCells}
      <th class="hcol">Total<br>def</th>
      <th class="hcol">Flags</th>
    </tr></thead>
    <tbody>
      ${repeat.length ? band("Repeat offenders", `Flagged in 2 or more of the last ${N} wars`) + repeat.map(row).join("") : ""}
      ${once.length ? band("Flagged once", "One bad war — watch, don't convict") + once.map(row).join("") : ""}
      ${flagged.length === 0 ? `<tr><td colspan="${N + 3}" style="padding:20px;text-align:center;color:var(--faint)">No members flagged in the last ${N} wars.</td></tr>` : ""}
    </tbody>
  </table>
  </div>
  <div class="legend">
    <span class="k"><span class="sw none"></span>dosed &amp; delivered (0)</span>
    <span class="k"><span class="sw low"></span>deficit 1–8</span>
    <span class="k"><span class="sw mid"></span>9–20</span>
    <span class="k"><span class="sw high"></span>21+</span>
    <span class="k">⚑ flagged that war</span>
    <span class="k">· = didn't dose that war</span>
  </div>
  </div>

  <p class="foot"><b>Expected includes a flat ~150e natural-regen credit</b> (+6 attacks) on top of each vial, and a member is flagged only when short by more than a ${xm.DEFICIT_GRACE}-attack grace — 150e is an estimate, so small misses are deliberately ignored. <b>Counts are net of deposits</b> — Xanax a member returns to the armoury is subtracted from what they used (floored at 0). Source: warboard war-history for faction ${FACTION}. Deficit can also be inflated by a member who was hospitalized, travelling, or offline after dosing — the model can't see that, which is why <b>repeat</b> names matter more than any single war. Columns oldest → newest. <b>Updated ${updated}</b> · auto-refreshes hourly.</p>
</div></div>`;

const head = `<title>Xanax Accountability — Last ${N} Wars</title>
<style>
:root{
  --bg:#f4f6f8; --panel:#ffffff; --ink:#171d27; --muted:#606b7a; --faint:#8b96a5;
  --line:#e4e8ee; --line2:#eef1f5; --accent:#2f5d8a; --accent-ink:#2f5d8a;
  --win:#2f7d52; --loss:#b23a2e;
  --none-bg:#e9f1eb; --none-fg:#2f6b46;
  --low-bg:#fbf1d4; --low-fg:#8a6a12;
  --mid-bg:#fadfc2; --mid-fg:#9a4a12;
  --high-bg:#f6ccc5; --high-fg:#a01f13;
  --empty-fg:#c2cad4;
  --hot-bg:#b23a2e; --hot-fg:#fff; --warn-bg:#e7a83a; --warn-fg:#3a2a06;
  --shadow:0 1px 2px rgba(20,30,45,.04),0 8px 24px rgba(20,30,45,.06);
}
@media (prefers-color-scheme:dark){
  :root{
    --bg:#0f131a; --panel:#171c24; --ink:#e7ecf3; --muted:#98a4b3; --faint:#6b7686;
    --line:#252c37; --line2:#1e242d; --accent:#6aa6dd; --accent-ink:#8fbde8;
    --win:#5cc48a; --loss:#e6796b;
    --none-bg:rgba(52,168,110,.14); --none-fg:#73d3a3;
    --low-bg:rgba(214,171,42,.15); --low-fg:#e7c862;
    --mid-bg:rgba(224,122,45,.17); --mid-fg:#f2a967;
    --high-bg:rgba(224,66,52,.20); --high-fg:#f2897c;
    --empty-fg:#3a434f;
    --hot-bg:#c0392b; --hot-fg:#fff; --warn-bg:#c9942f; --warn-fg:#1a1403;
    --shadow:0 1px 2px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="light"]{
  --bg:#f4f6f8; --panel:#ffffff; --ink:#171d27; --muted:#606b7a; --faint:#8b96a5;
  --line:#e4e8ee; --line2:#eef1f5; --accent:#2f5d8a; --accent-ink:#2f5d8a; --win:#2f7d52; --loss:#b23a2e;
  --none-bg:#e9f1eb; --none-fg:#2f6b46; --low-bg:#fbf1d4; --low-fg:#8a6a12; --mid-bg:#fadfc2; --mid-fg:#9a4a12;
  --high-bg:#f6ccc5; --high-fg:#a01f13; --empty-fg:#c2cad4; --hot-bg:#b23a2e; --hot-fg:#fff; --warn-bg:#e7a83a; --warn-fg:#3a2a06;
  --shadow:0 1px 2px rgba(20,30,45,.04),0 8px 24px rgba(20,30,45,.06);
}
:root[data-theme="dark"]{
  --bg:#0f131a; --panel:#171c24; --ink:#e7ecf3; --muted:#98a4b3; --faint:#6b7686;
  --line:#252c37; --line2:#1e242d; --accent:#6aa6dd; --accent-ink:#8fbde8; --win:#5cc48a; --loss:#e6796b;
  --none-bg:rgba(52,168,110,.14); --none-fg:#73d3a3; --low-bg:rgba(214,171,42,.15); --low-fg:#e7c862;
  --mid-bg:rgba(224,122,45,.17); --mid-fg:#f2a967; --high-bg:rgba(224,66,52,.20); --high-fg:#f2897c;
  --empty-fg:#3a434f; --hot-bg:#c0392b; --hot-fg:#fff; --warn-bg:#c9942f; --warn-fg:#1a1403;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
.wrap{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:var(--bg);color:var(--ink);min-height:100vh;padding:clamp(16px,4vw,40px);line-height:1.45;
  font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;}
.inner{max-width:920px;margin:0 auto}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-ink);margin:0 0 6px}
h1{font-size:clamp(24px,4.5vw,36px);line-height:1.1;margin:0 0 8px;letter-spacing:-.02em;text-wrap:balance;font-weight:800}
.sub{color:var(--muted);font-size:15px;margin:0 0 22px;max-width:62ch}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 24px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px;box-shadow:var(--shadow);flex:1 1 130px}
.stat b{display:block;font-size:24px;font-weight:800;letter-spacing:-.02em}
.stat span{font-size:12px;color:var(--muted);font-weight:600}
.stat.bad b{color:var(--loss)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden;margin-bottom:22px}
.scroll{overflow-x:auto}
table{border-collapse:separate;border-spacing:0;width:100%;min-width:640px}
thead th{position:sticky;top:0}
th.corner{text-align:left;padding:14px 14px 12px;font-size:12px;color:var(--faint);font-weight:700;letter-spacing:.04em;vertical-align:bottom;background:var(--panel)}
th.war{padding:10px 8px 12px;text-align:center;background:var(--panel);border-bottom:2px solid var(--line);min-width:96px;vertical-align:bottom}
th.war .wres{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;font-size:12px;font-weight:800;color:#fff;margin-bottom:5px}
th.war.victory .wres{background:var(--win)} th.war.defeat .wres{background:var(--loss)}
th.war .wdate{display:block;font-size:13px;font-weight:800;letter-spacing:-.01em}
th.war .wenemy{display:block;font-size:11px;color:var(--muted);font-weight:600;max-width:96px;margin:1px auto 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
th.war .wtook{display:block;font-size:10px;color:var(--faint);font-weight:600;margin-top:2px}
th.hcol{background:var(--panel);border-bottom:2px solid var(--line);font-size:11px;color:var(--faint);font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:0 8px 12px;vertical-align:bottom;text-align:center}
tbody th.name{text-align:left;font-weight:700;font-size:13.5px;padding:0 14px;white-space:nowrap;border-bottom:1px solid var(--line2);background:var(--panel);position:sticky;left:0}
tr.band th.name{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);font-weight:800;padding:16px 14px 7px;border-bottom:1px solid var(--line);background:var(--panel)}
tr.band small{display:block;text-transform:none;letter-spacing:0;color:var(--faint);font-weight:600;font-size:11px;margin-top:2px}
tr.band td{border-bottom:1px solid var(--line);background:var(--panel)}
td.c{text-align:center;padding:7px 8px;border-bottom:1px solid var(--line2);position:relative;vertical-align:middle;min-width:96px}
td.c .xh{display:block;font-size:11px;font-weight:600;opacity:.85;letter-spacing:-.01em}
td.c .def{display:block;font-size:15px;font-weight:800;line-height:1.15;margin-top:1px}
td.c .def .ok{font-size:11px;font-weight:700;opacity:.7}
td.c .flag{position:absolute;top:3px;right:5px;font-size:9px;opacity:.9}
td.c.none{background:var(--none-bg)} td.c.none .def,td.c.none .flag{color:var(--none-fg)}
td.c.low{background:var(--low-bg)} td.c.low .def,td.c.low .flag{color:var(--low-fg)}
td.c.mid{background:var(--mid-bg)} td.c.mid .def,td.c.mid .flag{color:var(--mid-fg)}
td.c.high{background:var(--high-bg)} td.c.high .def,td.c.high .flag{color:var(--high-fg)}
td.c.empty{color:var(--empty-fg)} td.c.empty .dash{font-size:16px;opacity:.6}
td.tot{text-align:center;font-size:17px;font-weight:800;border-bottom:1px solid var(--line2);border-left:1px solid var(--line)}
td.tot.high{color:var(--high-fg)} td.tot.mid{color:var(--mid-fg)} td.tot.low{color:var(--low-fg)} td.tot.none{color:var(--faint)}
td.fl{text-align:center;border-bottom:1px solid var(--line2);padding:0 10px}
.badge{display:inline-block;font-size:11px;font-weight:800;padding:3px 8px;border-radius:20px;letter-spacing:.02em}
.badge.b-hot{background:var(--hot-bg);color:var(--hot-fg)} .badge.b-warn{background:var(--warn-bg);color:var(--warn-fg)}
tbody tr:not(.band):hover td,tbody tr:not(.band):hover th.name{background:color-mix(in srgb,var(--accent) 7%,var(--panel))}
.legend{display:flex;flex-wrap:wrap;gap:14px 18px;padding:13px 16px;font-size:12px;color:var(--muted);border-top:1px solid var(--line)}
.legend .k{display:inline-flex;align-items:center;gap:6px;font-weight:600}
.sw{width:13px;height:13px;border-radius:4px;display:inline-block;border:1px solid rgba(128,128,128,.25)}
.sw.none{background:var(--none-bg)} .sw.low{background:var(--low-bg)} .sw.mid{background:var(--mid-bg)} .sw.high{background:var(--high-bg)}
.read{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:12px;padding:16px 18px;box-shadow:var(--shadow);margin-bottom:18px}
.read h2{font-size:15px;margin:0 0 10px;letter-spacing:-.01em}
.read ul{margin:0;padding-left:18px} .read li{margin:0 0 7px;font-size:14px;color:var(--ink)}
.read li b{color:var(--loss)} .read .nm{font-weight:800}
.clean{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.chip{font-size:12px;background:var(--none-bg);color:var(--none-fg);border-radius:20px;padding:4px 11px;font-weight:700}
.foot{font-size:12px;color:var(--faint);margin:14px 2px 0;max-width:70ch}
.foot code{background:color-mix(in srgb,var(--accent) 12%,transparent);padding:1px 5px;border-radius:4px;font-size:11px}
.latest{margin-bottom:22px}
.latest .lhead{display:flex;align-items:center;gap:12px;padding:14px 16px 13px;border-bottom:1px solid var(--line)}
.lchip{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;font-size:14px;font-weight:800;color:#fff;flex:none}
.lchip.victory{background:var(--win)} .lchip.defeat{background:var(--loss)} .lchip.draw{background:var(--faint)}
.latest h2{font-size:16px;margin:0 0 2px;letter-spacing:-.01em} .latest h2 .lenemy{color:var(--accent-ink)}
.lmeta{font-size:12px;color:var(--muted);font-weight:600} .lmeta b{color:var(--ink)} .lmeta b.bad{color:var(--loss)}
.lgrid{display:flex;flex-direction:column}
.lrow{display:grid;grid-template-columns:26px 1fr auto minmax(72px,auto);align-items:center;gap:12px;padding:9px 16px;border-bottom:1px solid var(--line2);font-size:14px}
.lrow:last-child{border-bottom:none}
.lrow.none{background:var(--none-bg)} .lrow.low{background:var(--low-bg)} .lrow.mid{background:var(--mid-bg)} .lrow.high{background:var(--high-bg)}
.lrank{font-size:12px;font-weight:800;color:var(--faint);text-align:center}
.lname{font-weight:700} .lname .flag{font-size:11px}
.lxh{font-size:12px;color:var(--muted);font-weight:600}
.ldef{font-size:13px;font-weight:700;text-align:right} .ldef .ok{font-size:12px;font-weight:700}
.lrow.none .ldef .ok{color:var(--none-fg)} .lrow.low .ldef b{color:var(--low-fg)} .lrow.mid .ldef b{color:var(--mid-fg)} .lrow.high .ldef b{color:var(--high-fg)}
.lempty{color:var(--faint);font-weight:600}
</style>`;

const outHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
${head}</head>
<body>
${body}
</body>
</html>`;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, outHtml);
console.log(`[gen-xanax-page] wrote ${OUT} (${outHtml.length}b) — ${N} wars, ${totalDosed} dosed, ${flagged.length} flagged, ${repeat.length} repeat, updated ${updated}`);
