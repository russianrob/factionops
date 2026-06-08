/**
 * FactionOps Server – Torn.com faction war coordination tool.
 *
 * Express + Socket.IO backend providing:
 *  - JWT auth via Torn API key verification
 *  - Real-time target calling and status tracking
 *  - Enemy chain monitoring with bonus-hit alerts
 *  - File-based persistence for war state
 */

import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync, appendFileSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";

import routes, { setIO, gateMiddleware } from "./routes.js";
import "./war-scanner.js";
import { socketAuth } from "./auth.js";
import { registerSocketHandlers } from "./socket-handlers.js";
import { startChainMonitor, stopAll as stopAllChainMonitors } from "./chain-monitor.js";
import { startWarStatusMonitor, stopAll as stopAllWarStatusMonitors } from "./war-status-monitor.js";
import { loadHeatmaps, stopFlush as stopHeatmapFlush } from "./activity-heatmap.js";
import { startMembershipSchedule, stopMembershipSchedule } from "./membership-check.js";
import { startXanaxSubscriptions, stopXanaxSubscriptions, getActiveSubscribedFactionIds } from "./xanax-subscriptions.js";
import * as vaultRequests from "./vault-requests.js";
import { startSubscriptionManager, stopSubscriptionManager } from "./subscription-manager.js";
import * as store from "./store.js";
import * as warHistory from "./war-history.js";
import { computePayouts, backfillWarScores } from "./war-payouts.js";
import { maybeRefreshItemValues, onItemValuesRefreshed, getItemMarketValue } from "./item-values.js";
import * as priceWatcher from "./price-watcher.js";
import { startRwpRefresh } from "./rwp-refresh.js";
import * as itemMarket from "./item-market.js";
import { loadSubscriptions } from "./push-notifications.js";
import { fetchRankedWar } from "./torn-api.js";
import { isFactionAllowed } from "./subscription-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Configuration ───────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT, 10) || 3000;

// ── Express setup ───────────────────────────────────────────────────────

const app = express();

// Trust Nginx proxy for correct IP detection (needed for rate limiting)
app.set("trust proxy", 1);

// Enable CORS for all API routes. ONE invocation only — registering
// the cors middleware twice was emitting Access-Control-Allow-Origin
// twice on every response, which Chrome's WebView rejects as
// malformed (browsers require exactly one ACAO header). Surfaced as
// "Failed to fetch" / status=0 in the warboard-android WebView for
// every cross-origin call from a torn.com page.
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no Origin (PDA Flutter InAppWebView,
      // native HTTP clients, curl health checks).
      if (!origin) return callback(null, true);
      // Allow torn.com subdomains, tornwar.com (admin pages), and
      // localhost for dev.
      if (/\.torn\.com$/.test(origin) ||
          /^https?:\/\/(www\.)?tornwar\.com/.test(origin) ||
          /^https?:\/\/localhost/.test(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  })
);
// 1MB is comfortable for scout-report / post-war-report payloads that
// carry BSP + FFScouter estimates for every enemy + own faction member
// in a ranked war (can hit a few hundred kb). 50kb was tripping 413s
// for members with large BSP caches.
app.use(express.json({ limit: '1mb' }));

// ── Security headers ───────────────────────────────────────────────────────
// Helmet defaults Cross-Origin-Resource-Policy to "same-origin", which
// tells browsers to refuse to deliver the response body to any other-
// origin context — even when CORS would otherwise allow. That broke
// every Warboard-Android WebView fetch from a torn.com page to a
// tornwar.com endpoint: the server replied 204 OK with valid CORS
// headers, but Chrome's CORP enforcement stripped the response and
// surfaced it as a generic network error in the userscript. Setting
// crossOriginResourcePolicy: cross-origin allows the cross-context
// reads we explicitly want (warboard exists to be called from
// torn.com pages). Same applies to Mac/iOS WebKit clients.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── Rate limiting ────────────────────────────────────────────────────────

// Strict limit on auth endpoint — prevents API key brute-force and Torn API flooding
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // 2026-05-16: bumped 60 → 200. The APK + PDA + desktop browser
  // all on the same home IP combine to easily exceed 60/15min — every
  // SSE reconnect, every pm2 reload, every tab switch can trigger a
  // re-auth. User reported APK error 'Couldn't authenticate, too many
  // auth attempts'. 200/15min still caps brute-force at ~13/min
  // average — far below any practical attack rate, and the per-IP
  // bucket means one home network can't take down anyone else.
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again in a few minutes' },
});
app.use('/api/auth', authLimiter);

// v4.9.96: public API tier — per-IP rate limit since callers may be
// unauthenticated tools. Complements per-caller-key limits enforced
// inside each public route handler.
const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 2/sec sustained per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Public API rate limit — slow down' },
});
app.use('/api/public', publicApiLimiter);

// General limiter on all routes as a backstop.
// Bumped 2026-05-06 from 5000/15min → 30000/15min after iOS Chat tab
// opens were generating bursts of 1500+ req/sec (chat fetch + retry
// loop + poll + heatmap + travel-info × multiple devices on one NAT
// IP). 5000/15min ≈ 5.5 req/s sustained which is fine for ONE active
// device but blew up under multi-device + tab-transition fanouts. New
// cap of 30000/15min ≈ 33 req/s sustained still rejects scrapers,
// gives legitimate multi-device users headroom for tab transitions
// without 429 storms. Static scripts & socket.io are excluded since
// they shouldn't consume the API budget.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
  skip: (req) =>
    req.path.startsWith('/scripts/') ||
    req.path.startsWith('/socket.io/') ||
    req.path === '/' ||
    req.path.startsWith('/assets/') ||
    req.path === '/api/stream',
});
app.use(globalLimiter);

// v5.0.2: per-key limit on /api/oc/spawn-key. The IP-based globalLimiter
// can't catch a single leaked/scraped key being replayed from many IPs
// (botnet, residential proxy pool). Cap each key at 240 req/min ≈ 4/s,
// which is ~6-8× heavier than a single active user with multiple tabs.
// Falls back to per-IP keying if the key param is missing/short.
const spawnKeyPerKeyLimiter = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyGenerator: (req) => {
    const k = req.query?.key || (req.body && req.body.key) || '';
    if (typeof k === 'string' && k.length >= 8) return `key:${k.slice(-8)}`;
    // Fallback to IP — use ipKeyGenerator helper so IPv6 /56 subnets are
    // grouped (raw req.ip would let one /128 evade by rotating).
    return `ip:${ipKeyGenerator(req.ip)}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Per-key rate limit hit — slow down' },
});
app.use('/api/oc/spawn-key', spawnKeyPerKeyLimiter);

// v5.0.3: per-JWT limit on the iOS / FactionOps "war room" endpoints.
// Bounds the blast radius of a single client's runaway loop (e.g. the
// known iOS WarRoomViewModel SwiftUI re-render storm where .onAppear
// fires start() many times per second). Without this hedge, one user's
// bug consumes the whole globalLimiter budget (30k/15min = ~33 r/s) and
// forces 429s on EVERY user behind that IP. Per-JWT keying isolates
// the cost to that one user's session — they get 429s instantly while
// everyone else is unaffected.
//
// Cap: 240 req/min per JWT ≈ 4 req/s. A normal iOS tick fires 5-7
// requests every 15 s = ~28/min, so this is ~9× normal headroom but
// still bounds a 100+ req/sec storm to the offending session.
const warRoomPerJwtLimiter = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyGenerator: (req) => {
    const auth = req.headers?.authorization || '';
    const tokenFromHeader = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    const tokenFromQuery  = (req.query?.token && typeof req.query.token === 'string') ? req.query.token : '';
    const t = tokenFromHeader || tokenFromQuery;
    if (t && t.length >= 20) return 'jwt:' + t.slice(-20);
    return 'ip:' + ipKeyGenerator(req.ip);
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Per-session rate limit hit — runaway loop detected. Restart the app.' },
});
// Applied to the endpoints where the SwiftUI storm hits hardest. The
// underlying bug fires fetchPoll + 2× fetchHeatmap + fetchTravelInfo +
// fetchWars together, so capping any one of them breaks the wave.
app.use('/api/poll',                   warRoomPerJwtLimiter);
app.use('/api/heatmap',                warRoomPerJwtLimiter);
app.use(/^\/api\/faction\/[^/]+\/war/, warRoomPerJwtLimiter);
app.use(/^\/api\/war\/[^/]+\/travel-info/, warRoomPerJwtLimiter);

// ── Landing page is public — gate is applied only to /scripts/*.user.js below ──

// (Removed: temp [req-log] middleware that diagnosed the Android
// WebView CORS issue. Root cause was Chromium's CORS layer rejecting
// cross-origin tornwar.com calls from torn.com pages despite correct
// server headers; resolved by routing userscript HTTP through a
// native Kotlin bridge in the Warboard Android app — see
// WarboardNativeBridge.kt + gm-shim.js's nativeRequest() path.)

// ── Landing page gate ───────────────────────────────────────────────────
app.use(gateMiddleware);

// ── Battery diag ────────────────────────────────────────────────────────
// Receives periodic samples from the wb-battery-diag userscript and
// serves a read-only timeline at /diag/battery. Gate-exempt the POST
// endpoint via the path prefix already covered by /api/* in gate.
import("./battery-diag.js").then(m => m.registerRoutes(app, express));

// ── Static files (landing page) ─────────────────────────────────────────
app.use(express.static(join(__dirname, "public")));

// ── Userscript download route (legacy) ──────────────────────────────────
const USERSCRIPT_PATH = join(__dirname, "..", "client", "factionops.user.js");

app.get("/download/factionops.user.js", (_req, res) => {
  try {
    const script = readFileSync(USERSCRIPT_PATH, "utf-8");
    res.setHeader("Content-Type", "text/javascript; charset=UTF-8");
    res.setHeader("Content-Disposition", 'inline; filename="factionops.user.js"');
    res.setHeader("Cache-Control", "no-cache");
    res.send(script);
  } catch (err) {
    console.error("[server] Failed to read userscript:", err.message);
    res.status(500).json({ error: "Script file not found" });
  }
});

// ── Scripts hosting ─────────────────────────────────────────────────────
// Serves userscripts by exact filename only. No directory listing.
// Scripts are stored in /opt/warboard/scripts/ on the VPS.
const SCRIPTS_DIR = join(__dirname, "scripts");

// Block directory listing and any path traversal
app.get("/scripts/", (_req, res) => res.status(403).json({ error: "Forbidden" }));
app.get("/scripts", (_req, res) => res.status(403).json({ error: "Forbidden" }));

// Serve individual .user.js and .meta.js files
app.get("/scripts/:filename", (req, res) => {
  const filename = req.params.filename;

  // Only allow .user.js and .meta.js files, no path traversal
  if (!/^[\w.-]+\.(?:user|meta)\.js$/.test(filename) || filename.includes("..")) {
    return res.status(404).json({ error: "Not found" });
  }

  const filePath = join(SCRIPTS_DIR, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const script = readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "text/javascript; charset=UTF-8");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    res.send(script);
  } catch (err) {
    console.error(`[server] Failed to read script ${filename}:`, err.message);
    res.status(500).json({ error: "Failed to read script" });
  }
});

// ── Data files hosting ──────────────────────────────────────────────────
const DATA_DIR = join(__dirname, "data");

app.get("/data/", (_req, res) => res.status(403).json({ error: "Forbidden" }));
app.get("/data", (_req, res) => res.status(403).json({ error: "Forbidden" }));

app.get("/data/:filename", (req, res) => {
  const filename = req.params.filename;
  if (!/^[\w.-]+\.json$/.test(filename) || filename.includes("..")) {
    return res.status(404).json({ error: "Not found" });
  }
  const filePath = join(DATA_DIR, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    const data = readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "application/json; charset=UTF-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(data);
  } catch (err) {
    console.error(`[server] Failed to read data file ${filename}:`, err.message);
    res.status(500).json({ error: "Failed to read file" });
  }
});

// ── Serve Socket.IO client (for PDA and CSP-restricted environments) ───
app.get("/socket.io.min.js", (_req, res) => {
  const sioPath = join(__dirname, "node_modules", "socket.io", "client-dist", "socket.io.min.js");
  try {
    const script = readFileSync(sioPath, "utf-8");
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(script);
  } catch (err) {
    console.error("[server] Failed to serve Socket.IO client:", err.message);
    res.status(404).json({ error: "Socket.IO client not found" });
  }
});

// ── One-shot file upload (warboard-mac/ios Apple cert + profile drop) ──
// Open while /tmp/cert-upload-token exists; the file's mere presence
// gates the route. Each successful upload closes the window — drop one
// file at a time, recreate the token between drops.
//
// Uploaded files land in /tmp under their original filename (capped to
// alphanumerics + dot/dash to keep the writes contained). The route
// accepts a `?name=` query param to set the destination filename, since
// we now juggle multiple file types (.cer, .mobileprovision, .p8).
const CERT_UPLOAD_TOKEN_PATH = "/tmp/cert-upload-token";

function uploadOpen() {
  return existsSync(CERT_UPLOAD_TOKEN_PATH);
}

function safeFilename(raw) {
  if (!raw || typeof raw !== "string") return null;
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(raw)) return null;
  if (raw.startsWith(".") || raw.includes("..")) return null;
  return raw;
}

// Tiny companion form for posting App Store Connect's Key ID + Issuer
// ID at the same time — two short strings, not worth a base64 round.
app.get("/upload-ids", (_req, res) => {
  if (!uploadOpen()) {
    return res.status(410).type("text/plain").send("Upload window closed.");
  }
  res.setHeader("Content-Type", "text/html; charset=UTF-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>App Store Connect IDs</title>
<style>
  body { font: 16px system-ui; padding: 24px; max-width: 480px; margin: 0 auto; }
  label { display: block; margin: 16px 0 4px; font-weight: 600; }
  input { display: block; width: 100%; padding: 10px; font: 15px monospace; box-sizing: border-box; }
  button { margin-top: 20px; font-size: 17px; padding: 12px 20px; width: 100%; border: 0; border-radius: 8px; background: #0a84ff; color: #fff; }
  #status { margin-top: 16px; padding: 12px; border-radius: 6px; }
  .ok { background: #d4edda; color: #155724; }
  .err { background: #f8d7da; color: #721c24; }
</style></head><body>
<h2>App Store Connect IDs</h2>

<label>Key ID (10 characters)</label>
<input type="text" id="kid" placeholder="ABCD1234EF" maxlength="20">

<label>Issuer ID (UUID)</label>
<input type="text" id="iss" placeholder="01234567-89ab-cdef-0123-456789abcdef" maxlength="50">

<button id="b">Upload both</button>
<div id="status"></div>
<script>
  const kid = document.getElementById('kid');
  const iss = document.getElementById('iss');
  const b = document.getElementById('b');
  const s = document.getElementById('status');
  b.addEventListener('click', async () => {
    const k = kid.value.trim(), i = iss.value.trim();
    if (!k || !i) { s.className = 'err'; s.textContent = 'Both fields required.'; return; }
    b.disabled = true;
    s.className = ''; s.textContent = 'Uploading…';
    try {
      const r = await fetch(location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_id: k, issuer_id: i }),
      });
      const text = await r.text();
      if (r.ok) { s.className = 'ok'; s.textContent = text; }
      else { s.className = 'err'; s.textContent = 'Failed: ' + text; b.disabled = false; }
    } catch (e) { s.className = 'err'; s.textContent = 'Error: ' + e.message; b.disabled = false; }
  });
</script>
</body></html>`);
});

app.post("/upload-ids", express.json({ limit: "1kb" }), (req, res) => {
  if (!uploadOpen()) {
    return res.status(410).type("text/plain").send("Upload window closed.");
  }
  const { key_id, issuer_id } = req.body || {};
  if (typeof key_id !== "string" || !/^[A-Z0-9]{8,15}$/i.test(key_id)) {
    return res.status(400).type("text/plain").send("Bad key_id (need 8-15 alphanum).");
  }
  if (typeof issuer_id !== "string" || !/^[a-f0-9-]{30,40}$/i.test(issuer_id)) {
    return res.status(400).type("text/plain").send("Bad issuer_id (need a UUID).");
  }
  try {
    writeFileSync("/tmp/key_id.txt", key_id);
    writeFileSync("/tmp/issuer_id.txt", issuer_id);
    try { unlinkSync(CERT_UPLOAD_TOKEN_PATH); } catch {}
    console.log(`[server] ASC IDs written: key_id=${key_id}, issuer_id=${issuer_id}`);
    res.type("text/plain").send("Saved both IDs. Window closed.");
  } catch (err) {
    console.error("[server] ASC IDs write failed:", err.message);
    res.status(500).type("text/plain").send("Server error.");
  }
});

// Anonymous diagnostic channel for in-browser userscripts. Accepts a small
// JSON body and logs it with a tag we can grep from pm2. Used temporarily
// to debug why a feature fires or doesn't on a user's browser without
// needing them to paste console output.
const _diagHits = new Map(); // ip → { count, firstAt }
app.post("/api/debug/client-log", express.json({ limit: "4kb" }), (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const bucket = _diagHits.get(ip) || { count: 0, firstAt: now };
  if (now - bucket.firstAt > 60_000) { bucket.count = 0; bucket.firstAt = now; }
  bucket.count++;
  _diagHits.set(ip, bucket);
  if (bucket.count > 60) return res.status(429).end(); // 60/min per IP cap
  const tag = String(req.body?.tag || 'client-diag').slice(0, 40);
  let payload;
  try { payload = JSON.stringify(req.body?.data || {}).slice(0, 1500); }
  catch (_) { payload = '<unserializable>'; }
  console.log(`[${tag}] ${payload}`);
  res.status(204).end();
});

app.use(routes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ── HTTP + Socket.IO server ─────────────────────────────────────────────

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or some curl requests)
      // or "null" origin (common in some sandbox/userscript environments)
      if (!origin || origin === "null") {
        return callback(null, true);
      }
      if (/\.torn\.com$/.test(origin) || /tornwar\.com/.test(origin) || /^https?:\/\/localhost/.test(origin)) {
        return callback(null, true);
      }
      // Log unexpected origins for debugging
      console.log('[ws] CORS rejected origin:', origin);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  allowEIO3: true,
});

// Share io instance with route handlers for real-time broadcasts
setIO(io);

// Authenticate every socket connection via JWT
io.use(socketAuth);

io.on("connection", (socket) => {
  console.log(`[ws] Socket connected: ${socket.id} (player: ${socket.user.playerName})`);
  
  // Admin/Leader Broadcast Listener
  socket.on('admin_broadcast', (data) => {
      const adminId = '137558'; 
      const pos = socket.user?.factionPosition || '';
      const isLeader = pos === 'leader' || pos === 'co-leader' || pos === 'war leader' || pos === 'banker';
      
      if (socket.user && String(socket.user.playerId) === adminId) {
          // Global broadcast
          io.emit('global_toast', { 
              message: data.message, 
              type: data.type || 'info' 
          });
          console.log(`[📣] Global Admin Broadcast sent: ${data.message}`);
      } else if (socket.user && isLeader) {
          // Faction-only broadcast
          const warId = `war_${socket.user.factionId}`;
          const room = `war_${warId}`;
          
          io.to(room).emit('global_toast', { 
              message: data.message, 
              type: data.type || 'info' 
          });
          console.log(`[📣] Faction Broadcast sent by ${socket.user.playerName} to room ${room}: ${data.message}`);
      } else {
          console.log(`[⚠️] Blocked unauthorized broadcast attempt.`);
      }
  });

  registerSocketHandlers(io, socket);

  // When a player joins a war, ensure status monitoring is running
  // Chain data comes from clients via DOM reading — no server-side chain polling needed
  socket.on("join_war", ({ warId }) => {
    // Small delay to let the war get created/loaded first
    setTimeout(() => {
      const war = store.getWar(warId);
      if (war?.enemyFactionId) {
        startWarStatusMonitor(io, warId);
      }
    }, 100);
  });
});

// ── Load persisted state & start ────────────────────────────────────────

store.loadState();
store.loadFactionKeys();
store.loadPlayerKeys();
store.loadFactionSettings();
store.loadKeyPoolingOpt();
store.loadPlayerFactions();
store.loadMemberBars();
store.loadPayoutSettings();
// War history: seed from the persisted payout cache (one-time catch-up for
// wars that ended before this store existed), then keep it current via the
// computePayouts ingest hook + the periodic sweep below.
try {
  const seeded = warHistory.backfill(store.getWar);
  if (seeded) console.log(`[war-history] backfilled ${seeded} war(s) from payout cache`);
} catch (e) { console.warn(`[war-history] backfill failed: ${e.message}`); }
// Capture any ended war not yet snapshotted (e.g. nobody opened its payouts).
// computePayouts ingests via its hook; this just skips wars already in history.
async function _sweepWarHistory() {
  for (const [warId, war] of Array.from(store.getAllWars())) {
    if (!war || !war.warEnded) continue;
    if (warHistory.hasWar(war.factionId, war)) continue;
    try { await computePayouts(warId); }
    catch (e) { console.warn(`[war-history] sweep compute failed for ${warId}: ${e.message}`); }
  }
}
setTimeout(() => { _sweepWarHistory().catch(() => {}); }, 60_000);
setInterval(() => { _sweepWarHistory().catch(() => {}); }, 3_600_000);
// Fill ranked-war scores for stored wars that ended before this feature
// existed (their record is gone but Torn still serves the report by ID).
setTimeout(() => { backfillWarScores().then(n => { if (n) console.log(`[war-history] filled ${n} missing war score(s)`); }).catch(() => {}); }, 10_000);
setInterval(() => { backfillWarScores().catch(() => {}); }, 86_400_000);
// Keep the public item market-price cache fresh (~5 min) so the arson price feed
// (/api/arson/prices, /api/items/prices) stays current even with no OC traffic.
// ~1 Torn call per cycle on a pooled key — negligible vs the 100/min rate limit.
function _refreshItemPrices() {
  // Prefer the faction's own configured key; fall back to the pool if unset.
  try { maybeRefreshItemValues(store.getFactionApiKey('42055') || store.getPollingKey('42055', 'items')); } catch (_) {}
}
setTimeout(_refreshItemPrices, 15_000);
setInterval(_refreshItemPrices, 300_000);
// Price-spike watcher: evaluate tracked items (e.g. Passport > $900k) after
// every price refresh, push-alerting the configured player on cross-up.
priceWatcher.load();
onItemValuesRefreshed(() => priceWatcher.checkWatchers());
// Torn RW Pricer: regenerate data/rwp-prices.json daily from the marches.cafe
// auction CSVs so the PDA path (which can't gunzip the CDN) gets fresh prices.
startRwpRefresh();
// Item-market lowest-listing cache: value OC reward artifacts (e.g. Priceless
// Painting) the bulk catalog prices at $0. Seed from OC history, then refresh
// the live lowest listings every ~12 min on the owner's key.
itemMarket.seedFromOcHistory(getItemMarketValue);
const _imKey = () => store.getFactionApiKey('42055') || store.getPollingKey('42055', 'items');
setTimeout(() => { itemMarket.refreshTracked(_imKey()).catch(() => {}); }, 20_000);
setInterval(() => { itemMarket.refreshTracked(_imKey()).catch(() => {}); }, 12 * 60_000);
loadHeatmaps();
loadSubscriptions();

// Resume war status monitors for any persisted wars (skip ended wars)
for (const [warId, war] of store.getAllWars()) {
  if (war.enemyFactionId && !war.warEnded) {
    startWarStatusMonitor(io, warId);
  }
}

// Schedule weekly membership verification (every Tuesday)
startMembershipSchedule();
  // 2026-05-21: disabled — no factions use the scripts, so the 5-min
  // poll against /user/?selections=events&comment=wb-xanax is wasted
  // OWNER_API_KEY budget. Re-enable by uncommenting if subscription
  // payments resume. Module remains imported so routes.js helpers
  // (hasXanaxSubscription, grantFactionAccess, etc.) still resolve —
  // they just read the static state file instead of live polling.
  // startXanaxSubscriptions();
  // Resume chain-monitor polling for any war that has an iOS Live
  // Activity push token registered. The /api/poll handler also starts
  // these on demand, but if the iOS app has been backgrounded since
  // last server reload, /api/poll never gets hit and the monitor stays
  // dead — meaning chain hits land server-side but no APNs push fires.
  // Iterating the persisted token store on boot covers that gap.
  (async () => {
    // Shared across both resume blocks below so the recently-ended
    // revive doesn't double-start chain-monitor for wars the LA hook
    // already covered.
    const seen = new Set();
    try {
      const lat = await import("./live-activity-tokens.js");
      // listForWar takes a single warId, but we want all distinct warIds.
      // Cheapest path: load the JSON ourselves.
      const fs = await import("node:fs");
      const path = await import("node:path");
      const file = path.join(path.dirname(new URL(import.meta.url).pathname), "data", "live-activity-tokens.json");
      if (fs.existsSync(file)) {
        const rows = JSON.parse(fs.readFileSync(file, "utf-8"));
        for (const row of rows) {
          if (row && row.warId && !seen.has(row.warId)) {
            seen.add(row.warId);
            const w = store.getWar(row.warId);
            if (w && !w.warEnded) {
              startChainMonitor(null, row.warId);
              console.log(`[live-activity] resumed chain monitor for ${row.warId}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[live-activity] resume hook failed: ${err.message}`);
    }

    // 2026-05-19: Also resume chain-monitor for every recently-ended
    // war so the next ranked-war match for that faction gets picked up
    // automatically without waiting on client traffic. Previously
    // chain-monitor stopped permanently on warEnded → new-war detection
    // was blocked until someone loaded the war page (which then ran the
    // route-level lazy detection). Recency gate: 14 days, well past any
    // realistic between-war gap so we don't keep polling abandoned wars
    // forever.
    try {
      const REVIVE_WINDOW_MS = 14 * 24 * 3600 * 1000;
      const now = Date.now();
      const all = store.getAllWars();
      const entries = (all instanceof Map) ? Array.from(all.entries()) : Object.entries(all || {});
      let revived = 0;
      for (const [warId, w] of entries) {
        if (!w || !w.factionId) continue;
        if (!w.warEnded) continue; // active wars handled by the block above
        if (seen.has(warId)) continue;
        const endedAt = Number(w.warEndedAt) || 0;
        if (endedAt && (now - endedAt) > REVIVE_WINDOW_MS) continue;
        // 2026-05-19: ONLY revive synthetic per-faction war records
        // (war_<factionId>). Reviving arbitrary historical-warId
        // records lets chain-monitor re-poll Torn for them, see the
        // CURRENT active war as a "new enemy", and overwrite the
        // historical record's enemyFactionId/Name with the new one —
        // creating a duplicate active war record with a null name
        // that pollutes the /api/faction/<id>/war list. Synthetic
        // records are designed to track whichever war is current;
        // historical warId-keyed records should stay frozen.
        if (warId !== `war_${w.factionId}`) continue;
        seen.add(warId);
        startChainMonitor(null, warId);
        revived++;
      }
      if (revived > 0) console.log(`[boot-resume] revived chain-monitor for ${revived} recently-ended synthetic war(s) so new-war detection stays live`);
    } catch (err) {
      console.warn(`[boot-resume] revive-recent failed: ${err.message}`);
    }
  })();
  // Background poller handles OWNER faction only (uses OWNER_API_KEY).
  // Other factions get "piggy-back" cleanup — /api/oc/vault-requests
  // opportunistically triggers a fundsnews poll using the caller's OWN
  // key whenever someone opens the panel. No stored keys needed, each
  // user's key only polls their own faction. See vault-requests.js.
  const OWNER_FID = String(process.env.OWNER_FACTION_ID || '42055');
  vaultRequests.startPoller({
    getApiKeyForFaction: async (factionId) =>
      String(factionId) === OWNER_FID ? (process.env.OWNER_API_KEY || '') : '',
    listActiveFactions: () => [OWNER_FID],
  });

// Start faction subscription manager (polls for 50M payments)
startSubscriptionManager();

// ── Auto-detect new ranked wars every 5 minutes ─────────────────────────
let warDetectTimer = null;
const WAR_DETECT_INTERVAL_NORMAL = 5 * 60 * 1000; // 5 minutes
const WAR_DETECT_INTERVAL_ACTIVE = 60 * 1000;      // 1 minute during war start window

async function detectNewWars() {
  try {
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun, 2=Tue
    const utcHour = now.getUTCHours();
    const hasActiveWar = [...store.getAllWars()].some(([, w]) => w.enemyFactionId && !w.warEnded);

    // Always check if there's an active war (war spans multiple days)
    // On non-Tuesday days with no active war, skip to save API calls
    if (!hasActiveWar && day !== 2) return;
    // if (day === 2 && utcHour >= 14 && !hasActiveWar) return; // no match this week, stop polling

    // On Tuesdays, poll every 1 min between 11:45-12:30 UTC (war start window)
    // Outside that window, poll every 5 min
    const inStartWindow = day === 2 && ((utcHour === 11 && now.getUTCMinutes() >= 45) || utcHour === 12 && now.getUTCMinutes() <= 30);
    if (inStartWindow && warDetectTimer) {
      clearInterval(warDetectTimer);
      warDetectTimer = setInterval(detectNewWars, WAR_DETECT_INTERVAL_ACTIVE);
    } else if (!inStartWindow && warDetectTimer) {
      clearInterval(warDetectTimer);
      warDetectTimer = setInterval(detectNewWars, WAR_DETECT_INTERVAL_NORMAL);
    }

    // Check all factions that have stored API keys
    const allWars = store.getAllWars();
    const activeWarFactions = new Set();
    for (const [, war] of allWars) {
      if (war.factionId) activeWarFactions.add(war.factionId);
    }

    // Check each faction with a stored key
    const factionKeys = store.getAllFactionKeys ? store.getAllFactionKeys() : [];
    for (const [factionId, apiKey] of factionKeys) {
      if (!isFactionAllowed(factionId)) continue;
      try {
        const rw = await fetchRankedWar(factionId, apiKey);
        if (!rw || !rw.warId || !rw.enemyFactionId) continue;

        const warId = `war_${factionId}`;
        const existing = store.getWar(warId);
        if (existing && !existing.enemyFactionName && rw.enemyFactionName) {
          existing.enemyFactionName = rw.enemyFactionName;
          store.saveState();
        }

        const enemyChanged = existing && String(existing.enemyFactionId) !== String(rw.enemyFactionId);
        console.log(`[war-detect] Check: existing=${existing?.enemyFactionId || 'none'}, api=${rw.enemyFactionId}, changed=${enemyChanged}, ended=${existing?.warEnded}`);

        // If no existing war, enemy changed, or war ended — reset and create fresh entry
        if (!existing || !existing.enemyFactionId || existing.warEnded || enemyChanged) {
          if (enemyChanged) {
            console.log(`[war-detect] Enemy changed: ${existing.enemyFactionId} → ${rw.enemyFactionId} — resetting war state`);
            // Clear stale data from old war
            const war = store.getWar(warId);
            if (war) {
              war.warEnded = false; war.warResult = null; war.warEndedAt = null;
              war.warScores = null; war.warStart = null; war.warOrigTarget = null;
              war.warEta = null; war.clientTimerReport = null; war.chainData = null;
              war.enemyActivityLog = []; war.enemyActivityByHour = {};
            }
          }
          const war = store.getOrCreateWar(warId, factionId, rw.enemyFactionId);
          war.enemyFactionName = rw.enemyFactionName;
          war.enemyFactionId = rw.enemyFactionId;
          // Store war start time from API
          if (rw.warStart) war.warStart = rw.warStart;
          if (rw.warTarget) war.warOrigTarget = rw.warTarget;
          // Stamp the real Torn ranked-war ID so when this war ends and
          // the placeholder gets reused for the next opponent, the archival
          // helper has a stable key to preserve history under.
          if (rw.warId) store.recordRealWarId(warId, rw.warId);
          store.saveState();
          startWarStatusMonitor(io, warId);
          console.log(`[war-detect] Detected war: ${factionId} vs ${rw.enemyFactionName} (${rw.enemyFactionId}), starts: ${new Date(rw.warStart * 1000).toISOString()}`);
        }
      } catch (_) {
        // API error for this faction, skip
      }
    }
  } catch (err) {
    console.error('[war-detect] Detection failed:', err.message);
  }
}

// Run detection on startup (after a short delay) and every 5 minutes
setTimeout(detectNewWars, 10000);
warDetectTimer = setInterval(detectNewWars, WAR_DETECT_INTERVAL_NORMAL);
console.log('[war-detect] Auto-detection scheduled (5 min normal, 1 min during Tuesday 11:45-12:30 UTC)');

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] FactionOps server listening on port ${PORT}`);
  console.log(`[server] Landing page: http://localhost:${PORT}`);
  console.log(`[server] Script download: http://localhost:${PORT}/download/factionops.user.js`);
  console.log(`[server] REST API: http://localhost:${PORT}/api`);
  console.log(`[server] WebSocket: ws://localhost:${PORT}`);
});

// ── Status Live Activity poller ────────────────────────────────────────
// Fetches bars+cooldowns every 5 min for each Status-LA subscriber
// and pushes the result via APNs so the iOS Live Activity stays fresh
// while the app is closed. Idempotent — does nothing when no users
// are subscribed.
import('./status-la-poller.js').then(m => m.start()).catch(e => {
  console.error('[status-la] failed to start poller:', e.message);
});

// Faction API key health monitor — detects keys that Torn has revoked
// (regenerated by their owner) and pushes a notification to the admin
// playerId (gated; defaults to 137558). Prevents stale-key silent
// failures like the 2026-05-19 scout-report breakage.
import('./faction-key-health.js').then(m => m.start()).catch(e => {
  console.error('[key-health] failed to start monitor:', e.message);
});

// ── Graceful shutdown ───────────────────────────────────────────────────

function shutdown(signal) {
  console.log(`\n[server] Received ${signal}, shutting down...`);
  stopAllChainMonitors();
  stopAllWarStatusMonitors();
  if (warDetectTimer) { clearInterval(warDetectTimer); warDetectTimer = null; }
  try { stopPersonalMonitor(); } catch (_) {}
  stopHeatmapFlush();
  stopMembershipSchedule();
  stopSubscriptionManager();

  store.saveState();
  store.saveMemberBars();
  try { warHistory.flushAll(); } catch (_) {}
  httpServer.close(() => {
    console.log("[server] Server closed");
    process.exit(0);
  });
  // Force exit after 5 seconds if connections don't close
  setTimeout(() => process.exit(0), 5000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
