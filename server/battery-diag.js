/**
 * Battery diag receiver — accepts periodic POSTs from wb-battery-diag
 * userscript and persists a rolling buffer of recent samples. Read-only
 * dashboard at /diag/battery shows the timeline + lets the user see
 * what was loud over the last hour without having to watch the overlay.
 *
 * No auth: this is private-server data, only the owner uses it. Add a
 * shared-secret query param later if multiple users start posting.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "data", "battery-diag.json");
const MAX_SAMPLES = 500;        // rolling buffer; ~8h at 60s cadence
let _samples = null;
let _saveTimer = null;

function load() {
  if (_samples) return _samples;
  try {
    if (existsSync(FILE)) _samples = JSON.parse(readFileSync(FILE, "utf8"));
  } catch (_) {}
  if (!Array.isArray(_samples)) _samples = [];
  return _samples;
}

function persist() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      mkdirSync(dirname(FILE), { recursive: true });
      writeFileSync(FILE, JSON.stringify(_samples || [], null, 0));
    } catch (e) { console.warn("[battery-diag] persist failed:", e.message); }
  }, 2000);
}

export function registerRoutes(app, express) {
  // POST: userscript pushes a snapshot every ~60s. Body is a flat
  // object with the counters since last POST (script resets after).
  app.post("/api/diag/battery", express.json({ limit: "32kb" }), (req, res) => {
    const body = req.body || {};
    const sample = {
      ts: Date.now(),
      windowSec: Number(body.windowSec) || 60,
      ua:        String(body.ua || "").slice(0, 120),
      url:       String(body.url || "").slice(0, 200),
      fetch:     Number(body.fetch) || 0,
      xhr:       Number(body.xhr) || 0,
      gmxhr:     Number(body.gmxhr) || 0,
      mutations: Number(body.mutations) || 0,
      qsa:       Number(body.qsa) || 0,
      navs:      Number(body.navs) || 0,
      timeouts:  Number(body.timeouts) || 0,
      intervalsActive: Number(body.intervalsActive) || 0,
      byHost:    typeof body.byHost === "object" && body.byHost ? body.byHost : {},
      bySource:  typeof body.bySource === "object" && body.bySource ? body.bySource : {},
    };
    load();
    _samples.push(sample);
    if (_samples.length > MAX_SAMPLES) _samples.splice(0, _samples.length - MAX_SAMPLES);
    persist();
    res.json({ ok: true, samplesStored: _samples.length });
  });

  // GET: raw JSON of all samples (for scripting / external view).
  app.get("/api/diag/battery", (_req, res) => {
    res.json({ samples: load() });
  });

  // GET HTML dashboard — simple timeline + aggregates.
  app.get("/diag/battery", (_req, res) => {
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(HTML);
  });
}

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Battery Diag</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font: 13px ui-monospace, "SF Mono", Menlo, monospace; background:#0a0d14; color:#dde; padding:16px; max-width:900px; margin:0 auto; }
  h1 { font-size:18px; margin:0 0 12px; color:#ff7e9c; }
  h2 { font-size:13px; color:#8ba; text-transform:uppercase; letter-spacing:.05em; margin:18px 0 6px; }
  .card { background:#131722; border:1px solid #232838; border-radius:8px; padding:10px 12px; margin-bottom:10px; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px,1fr)); gap:6px; }
  .stat { background:#0f1118; border-radius:6px; padding:6px 8px; }
  .stat .lbl { color:#667; font-size:10.5px; text-transform:uppercase; }
  .stat .val { font-weight:600; font-size:15px; color:#dde; }
  .stat .val.warn { color:#fbbf24; }
  .stat .val.bad { color:#fb7185; }
  table { width:100%; border-collapse:collapse; font-size:11.5px; }
  th, td { text-align:left; padding:4px 6px; border-bottom:1px solid #232838; }
  th { color:#667; text-transform:uppercase; font-size:10px; }
  td.r { text-align:right; }
  .row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
  button { background:#2a2d3a; color:#dde; border:0; border-radius:5px; padding:6px 12px; font:600 12px inherit; cursor:pointer; }
  .empty { color:#667; padding:18px; text-align:center; font-style:italic; }
</style>
</head><body>
<h1>Battery diag</h1>
<div class="row">
  <button onclick="load()">↻ Refresh</button>
  <span id="meta" style="color:#667;font-size:11px"></span>
</div>
<div id="content"><div class="empty">Loading…</div></div>
<script>
function fmt(n) { return Number.isFinite(n) ? n.toFixed(1) : '0'; }
function topN(o, n) { return Object.entries(o||{}).sort((a,b)=>b[1]-a[1]).slice(0,n); }
async function load() {
  const j = await fetch('/api/diag/battery').then(r=>r.json());
  const samples = j.samples || [];
  if (samples.length === 0) {
    document.getElementById('content').innerHTML = '<div class="empty">No samples yet. Open Torn in PDA with wb-battery-diag installed; it posts every 60s.</div>';
    return;
  }
  // Aggregate last hour
  const cutoff = Date.now() - 60*60*1000;
  const recent = samples.filter(s => s.ts >= cutoff);
  const agg = { fetch:0, xhr:0, gmxhr:0, mutations:0, qsa:0, navs:0, totalSec:0, byHost:{}, bySource:{} };
  for (const s of recent) {
    agg.fetch += s.fetch; agg.xhr += s.xhr; agg.gmxhr += s.gmxhr;
    agg.mutations += s.mutations; agg.qsa += s.qsa; agg.navs += s.navs;
    agg.totalSec += s.windowSec || 60;
    for (const [h,n] of Object.entries(s.byHost||{})) agg.byHost[h] = (agg.byHost[h]||0)+n;
    for (const [s2,n] of Object.entries(s.bySource||{})) agg.bySource[s2] = (agg.bySource[s2]||0)+n;
  }
  const m = (n)=>agg.totalSec>0 ? (n/agg.totalSec*60) : 0;
  const last = samples[samples.length-1];
  document.getElementById('meta').textContent = samples.length + ' samples · last ' + new Date(last.ts).toLocaleString();
  document.getElementById('content').innerHTML = \`
    <h2>Last hour aggregate (\${recent.length} samples)</h2>
    <div class="stats">
      <div class="stat"><div class="lbl">fetch/min</div><div class="val \${m(agg.fetch)>20?'warn':''} \${m(agg.fetch)>40?'bad':''}">\${fmt(m(agg.fetch))}</div></div>
      <div class="stat"><div class="lbl">xhr/min</div><div class="val">\${fmt(m(agg.xhr))}</div></div>
      <div class="stat"><div class="lbl">gmxhr/min</div><div class="val">\${fmt(m(agg.gmxhr))}</div></div>
      <div class="stat"><div class="lbl">mutations/min</div><div class="val \${m(agg.mutations)>1000?'warn':''} \${m(agg.mutations)>3000?'bad':''}">\${fmt(m(agg.mutations))}</div></div>
      <div class="stat"><div class="lbl">qSA/min</div><div class="val">\${fmt(m(agg.qsa))}</div></div>
      <div class="stat"><div class="lbl">navs/min</div><div class="val">\${fmt(m(agg.navs))}</div></div>
    </div>

    <h2>Hosts hit (last hour)</h2>
    <div class="card"><table><tr><th>Host</th><th class="r">Total</th><th class="r">/min</th></tr>
      \${topN(agg.byHost, 10).map(([h,n])=>\`<tr><td>\${h}</td><td class="r">\${n}</td><td class="r">\${fmt(m(n))}</td></tr>\`).join('')}
    </table></div>

    <h2>Top callers (last hour)</h2>
    <div class="card"><table><tr><th>Source</th><th class="r">Network calls</th><th class="r">/min</th></tr>
      \${topN(agg.bySource, 12).map(([s,n])=>\`<tr><td>\${s}</td><td class="r">\${n}</td><td class="r">\${fmt(m(n))}</td></tr>\`).join('')}
    </table></div>

    <h2>Last 10 samples</h2>
    <div class="card"><table>
      <tr><th>Time</th><th class="r">fetch</th><th class="r">xhr</th><th class="r">gmxhr</th><th class="r">mut</th><th class="r">qSA</th><th class="r">navs</th><th class="r">ints</th></tr>
      \${samples.slice(-10).reverse().map(s=>\`<tr>
        <td>\${new Date(s.ts).toLocaleTimeString()}</td>
        <td class="r">\${s.fetch}</td><td class="r">\${s.xhr}</td><td class="r">\${s.gmxhr}</td>
        <td class="r">\${s.mutations}</td><td class="r">\${s.qsa}</td><td class="r">\${s.navs}</td><td class="r">\${s.intervalsActive}</td>
      </tr>\`).join('')}
    </table></div>
  \`;
}
load();
setInterval(load, 30000);
</script>
</body></html>`;
