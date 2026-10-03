#!/usr/bin/env node
// Build a war debrief page from warboard's own archive + Torn's ranked-war
// report.
//
// The previous debriefs (debrief-48164.html, the Sep 20 one) were rendered off
// this box by an R Markdown pipeline that lives somewhere else — no .Rmd, no R,
// no pandoc here. This does not reproduce that pipeline; it builds the same
// report from the data warboard already keeps, which turns out to be most of
// it and in some places more.
//
//   node tools/war-debrief.mjs [warKey] [--out FILE]
//
// Defaults to the most recently archived war.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const outFlag = argv.indexOf('--out');
const OUT = outFlag >= 0 ? argv[outFlag + 1] : null;
const wantKey = argv.find((a, i) => !a.startsWith('--') && a !== OUT
  && argv[i - 1] !== '--id' && argv[i - 1] !== '--torn' && argv[i - 1] !== '--out'
  && argv[i - 1] !== '--target') || null;
// Torn's own ranked-war id. warboard's archive does not always carry it
// (realWarId is null for wars it only ever saw as the reused war_<fid> key),
// and it is the number people actually quote.
const idFlag = argv.indexOf('--id');
const WAR_ID = idFlag >= 0 ? argv[idFlag + 1] : null;
const tFlag = argv.indexOf('--target');
const WAR_TARGET = tFlag >= 0 ? Number(argv[tFlag + 1]) || null : null;

const hist = JSON.parse(readFileSync(join(ROOT, 'data/war-history/42055.json'), 'utf8')).wars;
const key = wantKey || Object.keys(hist)
  .map((k) => [k, hist[k].warEndedAt || hist[k].capturedAt || 0])
  .sort((a, b) => b[1] - a[1])[0][0];
const w = hist[key];
if (!w) { console.error('no such war: ' + key); process.exit(1); }

// Torn's own report, when we have it cached beside this script. Optional: it
// adds the enemy roster and Torn's own per-member score, which is a useful
// second opinion on our scoring but not a dependency.
let torn = null;
try { torn = JSON.parse(readFileSync(join(ROOT, 'data/rwr-' + (w.realWarId || w.tornWarId || '') + '.json'), 'utf8')); } catch (_) {}
const tornArg = argv.indexOf('--torn');
if (tornArg >= 0) { try { torn = JSON.parse(readFileSync(argv[tornArg + 1], 'utf8')); } catch (_) {} }

const members = (w.members || []).slice();
const num = (x) => Number(x || 0);
const sum = (f) => members.reduce((a, m) => a + num(f(m)), 0);
const br = (m, k) => num((m.breakdown || {})[k]);
const sumBr = (k) => members.reduce((a, m) => a + br(m, k), 0);

const started = Number(w.warStart) || 0;
const ended = Number(w.warEndedAt) || Number(w.capturedAt) || 0;
const durMs = started && ended ? ended - started : 0;
const hours = durMs / 3600000;

const stats = {
  result: w.warResult || 'unknown',
  us: num((w.warScores || {}).myScore),
  them: num((w.warScores || {}).enemyScore),
  enemy: w.enemyFactionName || ('faction ' + w.enemyFactionId),
  // NOT w.totalScore -- that is the payout scoring total, not the war target.
  // Using it printed "target 6,600" for a war Torn set at 16,100. The archive
  // does not carry the target, so it is passed in or left out.
  target: WAR_TARGET,
  started, ended, hours,
  roster: members.length,
  warHits: sum((m) => m.warHits),
  attacks: sum((m) => m.totalAttacks),
  xanax: sum((m) => m.xanaxTaken),
  overdoses: sum((m) => m.overdosedThisWar),
  loot: num(w.lootTotal),
  pool: num(w.payoutPool),
  factionShare: num(w.factionShare),
  payoutPct: num(w.payoutPct),
  bd: {
    war_hit: sumBr('war_hit'), retal: sumBr('retal'), assist: sumBr('assist'),
    non_war: sumBr('non_war'), failed: sumBr('failed'),
  },
};
stats.zero = members.filter((m) => num(m.warHits) === 0);
stats.hitters = members.filter((m) => num(m.warHits) > 0);
stats.hitRate = stats.attacks ? stats.bd.war_hit / stats.attacks : 0;
stats.failRate = stats.attacks ? stats.bd.failed / stats.attacks : 0;
stats.perHour = stats.hours ? stats.warHits / stats.hours : 0;

const by = (f) => (a, b) => num(f(b)) - num(f(a));
const topScore = members.slice().sort(by((m) => m.score));
const topHits = members.slice().sort(by((m) => m.warHits));
const topNonWar = members.slice().filter((m) => br(m, 'non_war') > 0).sort(by((m) => br(m, 'non_war')));
const topFailed = members.slice().filter((m) => br(m, 'failed') > 0).sort(by((m) => br(m, 'failed')));
const topXan = members.slice().filter((m) => num(m.xanaxTaken) > 0).sort(by((m) => m.xanaxTaken));
// FairFight with a meaningful sample: a 3.00 off four hits says nothing.
const ffMin = 20;
const topFf = members.filter((m) => num(m.warHits) >= ffMin).sort(by((m) => m.avgFf));

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const money = (n) => '$' + fmt(Math.round(num(n)));
const pct = (n, d = 1) => (num(n) * 100).toFixed(d) + '%';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const when = (ms) => ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—';
const dur = (ms) => {
  const h = Math.floor(ms / 3600000), m = Math.round((ms % 3600000) / 60000);
  return h + 'h ' + String(m).padStart(2, '0') + 'm';
};

export { stats, members, topScore, topHits, topNonWar, topFailed, topXan, topFf, w, key };

function row(m, i) {
  const b = m.breakdown || {};
  const flag = m.xanaxFlagged ? ' <span class="chip chip-warn">xan</span>' : '';
  const zero = num(m.warHits) === 0 ? ' chip-row-zero' : '';
  return `<tr class="${zero}">
    <td class="r muted">${i + 1}</td>
    <td class="name">${esc(m.name)}${flag}<span class="lvl">L${num(m.level)}</span></td>
    <td class="r n strong">${fmt(num(m.warHits))}</td>
    <td class="r n">${num(m.score).toFixed(2)}</td>
    <td class="r n">${num(m.sharePct).toFixed(1)}%</td>
    <td class="r n">${fmt(num(b.war_hit))}</td>
    <td class="r n">${fmt(num(b.retal))}</td>
    <td class="r n">${fmt(num(b.assist))}</td>
    <td class="r n ${num(b.non_war) > 10 ? 'bad' : ''}">${fmt(num(b.non_war))}</td>
    <td class="r n ${num(b.failed) > 5 ? 'bad' : ''}">${fmt(num(b.failed))}</td>
    <td class="r n">${num(m.avgFf) ? num(m.avgFf).toFixed(2) : '—'}</td>
    <td class="r n">${fmt(num(m.xanaxTaken))}</td>
    <td class="r n money">${money(m.dollarPayout)}</td>
  </tr>`;
}

function mini(list, cols, limit = 8) {
  const head = cols.map((c) => `<th class="${c.r ? 'r' : ''}">${esc(c.h)}</th>`).join('');
  const body = list.slice(0, limit).map((m) => '<tr>' + cols.map((c) =>
    `<td class="${c.r ? 'r n' : 'name'}">${c.f(m)}</td>`).join('') + '</tr>').join('');
  return `<div class="scroll"><table class="mini"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

const title = `War Debrief — ${stats.enemy}`;
const verdict = stats.result === 'victory' ? 'VICTORY' : String(stats.result).toUpperCase();

const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{
  --ground:#100f0e; --panel:#191715; --panel2:#1f1c19; --line:#2c2825;
  --ink:#ece6de; --muted:#9b918a; --dim:#6d6560;
  --good:#00b894; --warn:#fdcb6e; --bad:#e17055; --cool:#74b9ff;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--ground); color:var(--ink);
  font:400 15px/1.6 'IBM Plex Sans',system-ui,-apple-system,Segoe UI,sans-serif;
}
.wrap{max-width:1180px;margin:0 auto;padding:0 18px 72px}
h1,h2,h3{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:700;
  letter-spacing:.02em;text-wrap:balance;margin:0}
.n,.money,td.r{font-family:var(--mono);font-variant-numeric:tabular-nums}

/* ── masthead ───────────────────────────────────────────── */
.top{border-bottom:1px solid var(--line);background:
  linear-gradient(180deg,rgba(0,184,148,.07),transparent 70%);}
.top .wrap{padding-top:30px;padding-bottom:26px}
.eyebrow{font:600 11px/1 'IBM Plex Sans';letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
h1{font-size:clamp(30px,6vw,52px);line-height:1;margin:10px 0 14px}
h1 .vs{color:var(--dim);font-weight:500}
.score{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.score .big{font-family:var(--mono);font-weight:600;font-size:clamp(26px,5vw,38px);letter-spacing:-.02em}
.score .us{color:var(--good)} .score .them{color:var(--bad)}
.score .dash{color:var(--dim)}
.verdict{display:inline-block;padding:3px 11px;border-radius:3px;
  font:700 12px/1.7 'Barlow Condensed';letter-spacing:.14em;
  background:rgba(0,184,148,.16);color:var(--good);border:1px solid rgba(0,184,148,.45)}
.meta{margin-top:12px;color:var(--muted);font-size:13px}
.meta b{color:var(--ink);font-weight:500}

/* ── kpi strip ──────────────────────────────────────────── */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(142px,1fr));gap:1px;
  background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:26px 0 8px}
.kpi{background:var(--panel);padding:13px 15px}
.kpi .k{font:600 10px/1 'IBM Plex Sans';letter-spacing:.13em;text-transform:uppercase;color:var(--dim)}
.kpi .v{font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:22px;font-weight:600;margin-top:7px;letter-spacing:-.02em}
.kpi .s{font-size:11.5px;color:var(--muted);margin-top:3px}
.kpi .v.good{color:var(--good)} .kpi .v.warn{color:var(--warn)} .kpi .v.bad{color:var(--bad)}

/* ── sections ───────────────────────────────────────────── */
section{margin-top:40px}
h2{font-size:23px;padding-bottom:9px;border-bottom:1px solid var(--line);
  display:flex;align-items:baseline;gap:10px}
h2 .idx{font-family:var(--mono);font-size:13px;color:var(--good);font-weight:500}
h3{font-size:16px;margin:22px 0 9px;color:var(--ink)}
p{margin:11px 0;color:#cfc7bf}
p.lede{color:var(--ink)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:22px;margin-top:14px}

/* ── tables ─────────────────────────────────────────────── */
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:13px}
th{font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.09em;text-transform:uppercase;
  color:var(--dim);text-align:left;padding:10px 11px;border-bottom:1px solid var(--line);
  white-space:nowrap;position:sticky;top:0;background:var(--panel2)}
td{padding:8px 11px;border-bottom:1px solid rgba(44,40,37,.6);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover td{background:rgba(255,255,255,.025)}
td.r,th.r{text-align:right}
td.name{font-weight:500}
td.lvl,.lvl{color:var(--dim);font-size:11px;margin-left:7px;font-family:var(--mono)}
.strong{color:var(--good);font-weight:600}
.bad{color:var(--bad)}
.muted{color:var(--dim)}
.money{color:var(--muted)}
tr.chip-row-zero td{background:rgba(225,112,85,.06)}
.chip{display:inline-block;padding:0 6px;border-radius:8px;font:600 9.5px/1.6 'IBM Plex Sans';
  letter-spacing:.05em;margin-left:7px;vertical-align:1px}
.chip-warn{background:rgba(253,203,110,.16);color:var(--warn);border:1px solid rgba(253,203,110,.4)}

/* ── callouts ───────────────────────────────────────────── */
.note{border-left:2px solid var(--line);padding:2px 0 2px 15px;margin:16px 0}
.note.good{border-color:var(--good)} .note.warn{border-color:var(--warn)} .note.bad{border-color:var(--bad)}
.note h4{margin:0 0 5px;font:600 13px/1.4 'IBM Plex Sans';color:var(--ink)}
.note p{margin:0;font-size:14px}
ul{margin:10px 0;padding-left:19px;color:#cfc7bf} li{margin:5px 0}
footer{margin-top:52px;padding-top:18px;border-top:1px solid var(--line);
  color:var(--dim);font-size:12px;line-height:1.7}
code{font-family:var(--mono);font-size:12.5px;color:var(--muted)}
</style></head>
<body>

<div class="top"><div class="wrap">
  <div class="eyebrow">Ranked War Debrief${(WAR_ID || w.realWarId) ? ' &middot; #' + esc(WAR_ID || w.realWarId) : ''}</div>
  <h1>Dead Fragment <span class="vs">vs</span> ${esc(stats.enemy)}</h1>
  <div class="score">
    <span class="big us">${fmt(stats.us)}</span>
    <span class="big dash">&ndash;</span>
    <span class="big them">${fmt(stats.them)}</span>
    <span class="verdict">${esc(verdict)}</span>
  </div>
  <div class="meta">
    <b>${when(stats.started)}</b> &rarr; <b>${when(stats.ended)}</b>
    &nbsp;&middot;&nbsp; ${dur(durMs)}
    ${stats.target ? '&nbsp;&middot;&nbsp; target <b>' + fmt(stats.target) + '</b>' : ''}
    &nbsp;&middot;&nbsp; margin <b>${fmt(stats.us - stats.them)}</b>
  </div>
</div></div>

<div class="wrap">

<div class="kpis">
  <div class="kpi"><div class="k">War hits</div><div class="v good">${fmt(stats.warHits)}</div>
    <div class="s">${stats.perHour.toFixed(0)}/hr across the war</div></div>
  <div class="kpi"><div class="k">Total attacks</div><div class="v">${fmt(stats.attacks)}</div>
    <div class="s">${pct(stats.hitRate, 0)} counted as war hits</div></div>
  <div class="kpi"><div class="k">Contributors</div><div class="v">${fmt(stats.hitters.length)}<span class="s" style="font-size:14px;color:var(--dim)"> / ${fmt(stats.roster)}</span></div>
    <div class="s">${stats.zero.length} landed nothing</div></div>
  <div class="kpi"><div class="k">Failed attacks</div><div class="v ${stats.failRate > 0.05 ? 'warn' : ''}">${fmt(stats.bd.failed)}</div>
    <div class="s">${pct(stats.failRate)} of all attacks</div></div>
  <div class="kpi"><div class="k">Xanax</div><div class="v">${fmt(stats.xanax)}</div>
    <div class="s">${stats.overdoses} overdose${stats.overdoses === 1 ? '' : 's'}</div></div>
  <div class="kpi"><div class="k">Payout pool</div><div class="v money" style="font-size:18px">${money(stats.pool)}</div>
    <div class="s">${pct(stats.payoutPct, 0)} of ${money(stats.loot)} loot</div></div>
</div>
<p class="muted" style="font-size:12px;margin-top:9px">
  Faction share ${money(stats.factionShare)} &middot; loot from ${esc(w.lootSource || 'caches')}${
  (w.lootBreakdown && w.lootBreakdown.items) ? ' &middot; ' + w.lootBreakdown.items.map((i) =>
    esc(i.name) + ' &times;' + i.quantity).join(', ') : ''}
</p>

<section>
  <h2><span class="idx">01</span> How the score was made</h2>
  <p class="lede">${fmt(stats.warHits)} war hits from ${fmt(stats.hitters.length)} people over ${dur(durMs)},
  for a final margin of ${fmt(stats.us - stats.them)}. The attack mix matters more than the raw count:</p>
  <div class="cols">
    <div>
      ${mini([
        { l: 'War hits', v: stats.bd.war_hit, c: 'strong' },
        { l: 'Assists', v: stats.bd.assist, c: '' },
        { l: 'Retaliations', v: stats.bd.retal, c: '' },
        { l: 'Non-war attacks', v: stats.bd.non_war, c: stats.bd.non_war > stats.bd.war_hit * 0.15 ? 'bad' : '' },
        { l: 'Failed', v: stats.bd.failed, c: stats.bd.failed > stats.bd.war_hit * 0.08 ? 'bad' : '' },
      ], [
        { h: 'Attack type', f: (x) => esc(x.l) },
        { h: 'Count', r: 1, f: (x) => `<span class="${x.c}">${fmt(x.v)}</span>` },
        { h: 'Share', r: 1, f: (x) => pct(stats.attacks ? x.v / stats.attacks : 0, 1) },
      ], 9)}
    </div>
    <div>
      <h3 style="margin-top:0">Top contributors</h3>
      ${mini(topScore, [
        { h: '#', f: (m) => '<span class="muted">' + (topScore.indexOf(m) + 1) + '</span>' },
        { h: 'Member', f: (m) => esc(m.name) },
        { h: 'Score', r: 1, f: (m) => num(m.score).toFixed(0) },
        { h: 'Hits', r: 1, f: (m) => fmt(num(m.warHits)) },
        { h: 'Share', r: 1, f: (m) => num(m.sharePct).toFixed(1) + '%' },
      ], 6)}
    </div>
  </div>
</section>

<section>
  <h2><span class="idx">02</span> Participation</h2>
  ${stats.zero.length ? `<div class="note bad">
    <h4>${stats.zero.length} of ${stats.roster} landed no war hit</h4>
    <p>${stats.zero.map((m) => esc(m.name)).join(', ')}.
    ${stats.zero.filter((m) => br(m, 'non_war') > 0).length
      ? 'Of those, ' + stats.zero.filter((m) => br(m, 'non_war') > 0).length
        + ' were attacking — just not in the war.' : ''}</p></div>` :
    `<div class="note good"><h4>Everybody scored</h4><p>All ${stats.roster} tracked members landed at least one war hit.</p></div>`}
  ${topNonWar.length ? `<h3>Attacks that did not count</h3>
  <p>Non-war attacks and failures are energy that bought no score. ${fmt(stats.bd.non_war)} non-war
  and ${fmt(stats.bd.failed)} failed, together ${pct((stats.bd.non_war + stats.bd.failed) / (stats.attacks || 1))} of everything thrown.</p>
  ${mini(topNonWar, [
    { h: 'Member', f: (m) => esc(m.name) },
    { h: 'Non-war', r: 1, f: (m) => `<span class="${br(m, 'non_war') > 10 ? 'bad' : ''}">${fmt(br(m, 'non_war'))}</span>` },
    { h: 'Failed', r: 1, f: (m) => fmt(br(m, 'failed')) },
    { h: 'War hits', r: 1, f: (m) => fmt(num(m.warHits)) },
    { h: 'Ratio', r: 1, f: (m) => num(m.warHits) ? (br(m, 'non_war') / num(m.warHits)).toFixed(2) : '&infin;' },
  ], 10)}` : ''}
</section>

<section>
  <h2><span class="idx">03</span> Efficiency</h2>
  <p>Average FairFight, among members with at least ${ffMin} war hits — below that the average is noise.</p>
  <div class="cols">
    <div><h3 style="margin-top:0">Best FairFight</h3>
    ${mini(topFf, [
      { h: 'Member', f: (m) => esc(m.name) },
      { h: 'Avg FF', r: 1, f: (m) => num(m.avgFf).toFixed(2) },
      { h: 'Max', r: 1, f: (m) => num(m.maxFf).toFixed(2) },
      { h: 'Hits', r: 1, f: (m) => fmt(num(m.warHits)) },
    ], 8)}</div>
    <div><h3 style="margin-top:0">Most xanax</h3>
    ${mini(topXan, [
      { h: 'Member', f: (m) => esc(m.name) + (m.xanaxFlagged ? ' <span class="chip chip-warn">flagged</span>' : '') },
      { h: 'Taken', r: 1, f: (m) => fmt(num(m.xanaxTaken)) },
      { h: 'Hits', r: 1, f: (m) => fmt(num(m.warHits)) },
      { h: 'Hits/xan', r: 1, f: (m) => num(m.xanaxTaken) ? (num(m.warHits) / num(m.xanaxTaken)).toFixed(1) : '—' },
    ], 8)}</div>
  </div>
</section>

<section>
  <h2><span class="idx">04</span> Full roster</h2>
  <p>Every tracked member, by score. Rows tinted red landed no war hit.
  <code>non-war</code> and <code>failed</code> are highlighted past 10 and 5 respectively.</p>
  <div class="scroll"><table>
    <thead><tr>
      <th class="r">#</th><th>Member</th><th class="r">Hits</th><th class="r">Score</th>
      <th class="r">Share</th><th class="r">War</th><th class="r">Retal</th><th class="r">Assist</th>
      <th class="r">Non-war</th><th class="r">Failed</th><th class="r">Avg FF</th>
      <th class="r">Xan</th><th class="r">Payout</th>
    </tr></thead>
    <tbody>${topScore.map(row).join('')}</tbody>
  </table></div>
</section>

<footer>
  Generated ${when(Date.now())} from warboard's war archive
  (<code>${esc(key)}</code>) by <code>tools/war-debrief.mjs</code>.
  Scores, FairFight and attack breakdowns are warboard's own per-member tracking;
  payouts reflect the settings in force at archive time
  (${pct(stats.payoutPct, 0)} pool, non-war weight ${num((w.settings || {}).nonWarWeight)},
  assist weight ${num((w.settings || {}).assistWeight)}).
  <br>Not indexed. Earlier wars: <code>debrief-48164.html</code>, <code>debrief-49287.html</code>.
</footer>

</div></body></html>`;

const outPath = OUT || join(ROOT, 'public', 'debrief-' + (WAR_ID || w.realWarId || 'latest') + '.html');
writeFileSync(outPath, html);
console.log('war      ', key, '(' + stats.enemy + ')');
console.log('result   ', stats.result, stats.us + '-' + stats.them);
console.log('members  ', stats.roster, '|', stats.warHits, 'war hits |', stats.zero.length, 'zero');
console.log('wrote    ', outPath, '(' + Math.round(html.length / 1024) + ' KB)');
