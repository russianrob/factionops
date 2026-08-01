// ==UserScript==
// @name         TORN: Display Crime Chain
// @namespace    http://torn.city.com.dot.com.com
// @version      1.0.18
// @description  Calculates and displays your current crime chain (Crimes 2.0 DOM-compat patch)
// @author       Ironhydedragon[2428902]
// @match        https://www.torn.com/page.php?sid=crimes*
// @license      MIT
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @downloadURL https://update.greasyfork.org/scripts/585747/TORN%3A%20Display%20Crime%20Chain.user.js
// @updateURL https://update.greasyfork.org/scripts/585747/TORN%3A%20Display%20Crime%20Chain.meta.js
// ==/UserScript==

let crimeChain = 0;
let lastSeenTs = 0; // newest crime-log timestamp already counted (for live updates)
let ccBase = null;  // baseline {type, s, f, c} of the on-page success/fail/critical tallies
let chainNerve = 0;  // total nerve spent building the current chain (since last critical fail)
let chainCrimes = 0; // number of crime attempts in the current chain window
let avgNerveCost = 4; // running mean nerve/crime (seeded from the log) — used for instant optimistic ticks
let nerveDirty = false;   // optimistic nerve pending exact reconciliation from the (server-cached) log
let nerveError = false;   // last nerve walk hit an API error (bad / rate-limited key)
let reconcileInFlight = false;

const redFlame = '#e64d1a';
const _ccWin = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

const PDA_API_KEY = '###PDA-APIKEY###';
function isPDA() {
  const PDATestRegex = !/^(###).+(###)$/.test(PDA_API_KEY);
  console.log('REGEX', PDATestRegex); // TEST
  return PDATestRegex;
}

function setApiKey(apiKey) {
  localStorage.setItem('ihdScriptApiKey', apiKey);
}
function getApiKey() {
  return localStorage.getItem('ihdScriptApiKey');
}
function promptForApiKey() {
  const entered = _ccWin.prompt('Enter your full-access Torn API key:', getApiKey() || '');
  if (entered == null) return;
  const key = entered.trim();
  if (key && key.length !== 16) { _ccWin.alert('That is not a 16-character API key.'); return; }
  setApiKey(key);
  location.reload();
}
function renderKeyHint() {
  const titleContainerEl = document.querySelector('.crimes-app [class*="heading___"]');
  if (!titleContainerEl || document.querySelector('#crime-chain-setkey')) return;
  const hint = document.createElement('span');
  hint.id = 'crime-chain-setkey';
  hint.textContent = '⛓️ Set API key';
  hint.title = 'Click to enter your full-access Torn API key';
  hint.style.cssText = 'cursor:pointer;margin-left:14px;vertical-align:middle;font-weight:700;color:' + redFlame + ';';
  hint.addEventListener('click', promptForApiKey);
  titleContainerEl.insertAdjacentElement('afterend', hint);
}

const stylesheet = `
  <style>
  #crime-chain {
    cursor: pointer;
  }

  #api-form.header-wrapper-top {
    display: flex;
  }
  #api-form.header-wrapper-top .container {
    display: flex;
    justify-content: start;
    align-items: center;
    padding-left: 20px;
  }

  #api-form.header-wrapper-top h2 {
    display: block;
    text-align: center;
    margin: 0;
    width: 172px;
  }

  #api-form.header-wrapper-top input {
    background: linear-gradient(0deg, #111, #000);
    border-radius: 5px;
    box-shadow: 0 1px 0 hsla(0, 0%, 100%, 0.102);
    box-sizing: border-box;
    color: #9f9f9f;
    display: inline;
    font-weight: 400;
    height: 24px;
    width: clamp(170px, 50%, 250px);
    margin: 0 0 0 21px;
    outline: none;
    padding: 0 10px 0 10px;

    font-size: 12px;
    font-style: italic;
    vertical-align: middle;
    border: 0;
    text-shadow: none;
    z-index: 100;
  }
  #api-form.header-wrapper-top a {
    margin: 0 8px;
  }

  @media screen and (max-width: 1000px) {
    #api-form.header-wrapper-top h2 {
      width: 148px;
    }
    #api-form.header-wrapper-top input {
      margin-left: 10px;
    }
  }
  @media screen and (max-width: 784px) {
    #api-form.header-wrapper-top h2 {
      font-size: 16px;
      width: 80px;
    }

    #crime-chain .linkTitle____NPyM {
      display: block;
    }
    #body.r .linksContainer___LiOTN {
      margin-left: 8px;
    }
  }

  </style>`;
function renderStylesheet() {
  document.head.insertAdjacentHTML('beforeend', stylesheet);
}

function renderCrimeChainHTML() {
  console.log('🖼️ RENDERING CHAIN HTML'); // TEST
  // Torn regenerates the ___<hash> suffix on every crimes-app deploy, and the old
  // links/hub markup was removed in Crimes 2.0. Anchor on the stable class PREFIX
  // and render a self-styled badge that depends on none of Torn's hashed classes.
  const titleContainerEl = document.querySelector('.crimes-app [class*="heading___"]');
  if (!titleContainerEl) return;
  if (document.querySelector('#crime-chain')) return;
  const crimeChainHTML = `
    <span id="crime-chain" aria-labelledby="crime-chain" style="display:inline-flex;align-items:center;gap:6px;margin-left:14px;vertical-align:middle;font-weight:700;color:${redFlame};">
      <svg fill="${redFlame}" height="15" width="14" viewBox="0 0 31.891 31.891" xmlns="http://www.w3.org/2000/svg"><g><path d="M30.543,5.74l-4.078-4.035c-1.805-1.777-4.736-1.789-6.545-0.02l-4.525,4.414c-1.812,1.768-1.82,4.648-0.02,6.424 l2.586-2.484c-0.262-0.791,0.061-1.697,0.701-2.324l2.879-2.807c0.912-0.885,2.375-0.881,3.275,0.01l2.449,2.42 c0.9,0.891,0.896,2.326-0.01,3.213l-2.879,2.809c-0.609,0.594-1.609,0.92-2.385,0.711l-2.533,2.486 c1.803,1.781,4.732,1.789,6.545,0.02l4.52-4.41C32.34,10.396,32.346,7.519,30.543,5.74z"></path><path d="M13.975,21.894c0.215,0.773-0.129,1.773-0.752,2.381l-2.689,2.627c-0.922,0.9-2.414,0.895-3.332-0.012l-2.498-2.461 c-0.916-0.906-0.91-2.379,0.012-3.275l2.691-2.627c0.656-0.637,1.598-0.961,2.42-0.689l2.594-2.57 c-1.836-1.811-4.824-1.82-6.668-0.02l-4.363,4.26c-1.846,1.803-1.855,4.734-0.02,6.549l4.154,4.107 c1.834,1.809,4.82,1.818,6.668,0.018l4.363-4.26c1.844-1.805,1.852-4.734,0.02-6.547L13.975,21.894z"></path><path d="M11.139,20.722c0.611,0.617,1.611,0.623,2.234,0.008l7.455-7.416c0.621-0.617,0.625-1.615,0.008-2.234 c-0.613-0.615-1.611-0.619-2.23-0.006l-7.457,7.414C10.529,19.103,10.525,20.101,11.139,20.722z"></path></g></svg>
      <span aria-label="current crime chain" id="crime-chain__current" title="Current crime chain">###</span>
      <span id="crime-chain__nerve" style="display:none;font-weight:600;">🔥 …</span>
    </span>`;
  titleContainerEl.insertAdjacentHTML('afterend', crimeChainHTML);
  const badgeEl = document.querySelector('#crime-chain');
  if (badgeEl && !badgeEl.dataset.ccNerveClick) {
    badgeEl.dataset.ccNerveClick = '1';
    badgeEl.title = 'Click to show nerve spent building this chain';
    badgeEl.addEventListener('click', onBadgeNerveClick);
  }
}

function renderCrimeChainCurrent() {
  console.log('⛓️', crimeChain); // TEST
  const el = document.querySelector('#crime-chain__current');
  if (!el) return;
  el.textContent = Math.floor(crimeChain);
}

let nerveShown = false; // session-only — deliberately NOT persisted, so the readout hides on reload

function fmtNerve(n) {
  return '🔥 ' + Math.round(n).toLocaleString() + ' nerve';
}

function getNerveShown() {
  return nerveShown;
}
function setNerveShown(on) {
  nerveShown = !!on;
}

// Single source of truth for the readout's DOM. Always re-queries the live node
// (React tears the badge down and rebuilds it), so it can never write to a stale
// detached node, and it reads visibility straight from the persisted flag.
function renderNerveReadout() {
  const nEl = document.querySelector('#crime-chain__nerve');
  if (!nEl) return;
  if (!getNerveShown()) { nEl.style.display = 'none'; return; }
  nEl.style.display = 'inline';
  nEl.textContent = chainNerve > 0 ? fmtNerve(chainNerve) : (nerveError ? '🔥 ?' : '🔥 …');
  nEl.title = chainCrimes
    ? (chainCrimes + ' crimes since last reset · avg ' + (chainNerve / chainCrimes).toFixed(1) + ' nerve/crime')
    : '';
}

// Pull an exact figure from the log and snap the display to it (used on open/click).
// Uses the same forward-only guard as reconcileNerve so an open during live play can't
// yank the number back to a still-cached log; when it's behind, keep the optimistic
// value and leave it dirty for the reconcile loop.
async function refreshNerveExact() {
  try {
    const res = await walkChain();
    nerveError = false;
    if (res.crimes > 0) avgNerveCost = res.nerve / res.crimes;
    if (res.crimes >= chainCrimes) {
      chainNerve = res.nerve;
      chainCrimes = res.crimes;
      nerveDirty = false;
    } else {
      nerveDirty = true;
    }
  } catch (error) {
    console.error(error); // TEST
    nerveError = true;
  }
  renderNerveReadout();
}

// Badge click: toggle the readout AND remember the choice so it survives a refresh.
function onBadgeNerveClick() {
  const shown = !getNerveShown();
  setNerveShown(shown);
  renderNerveReadout();
  if (shown) refreshNerveExact();
}

// Re-apply the readout after a fresh badge render (React rebuild / page load).
function restoreNerveReadout() {
  renderNerveReadout();
}

// The on-page counters tick instantly but carry no nerve cost, and the crime log is
// server-cached ~1 min — so on each detected crime add an optimistic estimate (running
// mean nerve/crime) for an instant bump, mark it dirty, and let reconcileNerve() snap it
// to the exact log figure once the log catches up. Mirrors the chain counter math.
// The page shows each crime's ACTUAL nerve cost (class nerve___<hash>), so the
// optimistic tick doesn't have to guess. Previously it added avgNerveCost — the
// running mean across every crime type in the chain — so a nerve-2 crime bumped
// the readout by 4 or 5 until the (server-cached, ~1 min) log caught up, and
// stayed wrong entirely if the log walk failed.
//
// The header nerve BAR also carries a nerve___ class ("Nerve:39 / 130"), hence
// two guards: skip anything that is also a bar___, and require pure digits.
function readCrimeNerveCost() {
  const els = document.querySelectorAll('[class*="nerve___"]');
  for (const el of els) {
    if (/bar___/.test(String(el.className || ''))) continue;
    const t = String(el.textContent || '').trim();
    if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (n > 0 && n <= 100) return n;   // sane per-crime range
    }
  }
  return null;
}

function bumpNerveOptimistic(dS, dF, dC) {
  if (dC > 0) { chainNerve = 0; chainCrimes = 0; nerveDirty = false; }
  else {
    const n = (dS > 0 ? dS : 0) + (dF > 0 ? dF : 0);
    // Real cost of the crime actually on screen; fall back to the running mean
    // only on the hub, where no single crime is selected.
    const cost = readCrimeNerveCost() ?? avgNerveCost;
    if (n > 0) { chainNerve += n * cost; chainCrimes += n; nerveDirty = true; }
  }
  renderNerveReadout();
}

// While an optimistic estimate is outstanding, re-walk the log and snap to the exact
// figure — but only once the (cached) log has caught up to our count, so the number
// never jumps backwards mid-session.
async function reconcileNerve() {
  if (!nerveDirty || reconcileInFlight || !getApiKey()) return;
  reconcileInFlight = true;
  try {
    const res = await walkChain();
    nerveError = false;
    if (res.crimes > 0) avgNerveCost = res.nerve / res.crimes;
    if (res.crimes >= chainCrimes) {
      chainNerve = res.nerve;
      chainCrimes = res.crimes;
      nerveDirty = false;
      renderNerveReadout();
    }
  } catch (error) {
    console.error(error); // TEST
  } finally {
    reconcileInFlight = false;
  }
}

async function fetchCrimes(toTimestamp) {
  const response = await fetch(`https://api.torn.com/user/?selections=log&cat=136${toTimestamp ? '&to=' + toTimestamp : ''}&key=${getApiKey()}`);
  const data = await response.json();
  if (data && data.error) throw new Error('Torn API error ' + data.error.code + ': ' + data.error.error);
  return data;
}

// Walk the crime log back to the last critical fail (the point the chain last hit 0)
// and replay it, tallying the chain AND the exact nerve each crime cost (log entries
// carry data.nerve). Critical fails reset both — that nerve belonged to the old chain.
// Returns a snapshot without mutating globals, so it's safe to call on demand.
async function walkChain() {
  let dataCollector = [];
  function dataCollectorUnshifter(fetchData) {
    for (const log in fetchData.log) {
      if (fetchData.log[log].title && fetchData.log[log].title.match(/Crime (success|fail|critical fail|item add)/gi)) {
        dataCollector.unshift(fetchData.log[log]);
      }
    }
  }
  dataCollectorUnshifter(await fetchCrimes());
  while (dataCollector.filter((log) => log.title.match(/Crime critical fail/i)).length < 1) {
    if (!dataCollector.length) break; // no crime logs at all — don't deref [0]
    const before = dataCollector.length;
    dataCollectorUnshifter(await fetchCrimes(dataCollector[0].timestamp - 1));
    if (dataCollector.length === before) break; // no older entries returned — stop (avoid infinite API loop)
  }

  let chain = 0, nerve = 0, crimes = 0, maxTs = 0;
  for (const d of dataCollector) {
    const nv = (d.data && typeof d.data.nerve === 'number') ? d.data.nerve : 0;
    if (d.timestamp > maxTs) maxTs = d.timestamp;
    if (d.title.match(/Crime success/i)) { chain++; nerve += nv; crimes++; }
    if (d.title.match(/Crime fail/i)) { chain = chain ? chain / 2 : 0; nerve += nv; crimes++; }
    if (d.title.match(/Crime critical fail/i)) { chain = 0; nerve = 0; crimes = 0; }
  }
  return { chain, nerve, crimes, maxTs };
}

async function calcCrimeChain() {
  try {
    const res = await walkChain();
    crimeChain = res.chain;
    chainNerve = res.nerve;
    chainCrimes = res.crimes;
    if (res.crimes > 0) avgNerveCost = res.nerve / res.crimes;
    nerveError = false;
    nerveDirty = false;
    lastSeenTs = Math.max(lastSeenTs, res.maxTs || 0);
  } catch (error) {
    console.error(error); // TEST
    nerveError = true;
  }
}

//// Callbacks
function updateCrimeCallback(mutationList) {
  for (const mutation of mutationList) {
    if (mutation.addedNodes.length > 0 && mutation.addedNodes[0].classList && [...mutation.addedNodes[0].classList].join(' ').match(/crimes-outcome-/)) {
      const outcome = [...mutation.addedNodes[0].classList].join(' ').match(/(?<=crimes-outcome-)\w+/gi)[0];
      console.log('👀', outcome); // TEST

      if (outcome === 'success') {
        crimeChain++;
      }
      if (outcome === 'failure') {
        crimeChain = crimeChain / 2;
      }
      if (outcome === 'criticalFailure') {
        crimeChain = crimeChain / 2;
      }

      renderCrimeChainCurrent();
    }
  }
}

//////// CONTROLLERS ////////
function initController() {
  renderStylesheet();

  if (typeof GM_registerMenuCommand !== 'undefined') {
    GM_registerMenuCommand('⛓️ Set / update API key', promptForApiKey);
  }

  if (isPDA()) {
    console.log('🌟 IS PDA!!!!!', PDA_API_KEY); // TEST
    setApiKey(PDA_API_KEY);
  }

  if (!getApiKey()) {
    console.log('noAPIKey found'); // TEST
    renderKeyHint();
    return;
  }

  renderCrimeChainHTML();
}

async function loadController() {
  await calcCrimeChain();
  renderCrimeChainCurrent();
  renderNerveReadout();
}

async function pollLatestCrime() {
  try {
    const data = await fetchCrimes();
    const fresh = Object.values((data && data.log) || {})
      .filter((l) => l && typeof l.title === 'string' && /Crime (success|fail|critical fail)/i.test(l.title) && l.timestamp > lastSeenTs)
      .sort((a, b) => a.timestamp - b.timestamp);
    for (const e of fresh) {
      if (e.title.match(/Crime critical fail/i)) crimeChain = 0;
      else if (e.title.match(/Crime fail/i)) crimeChain = crimeChain ? crimeChain / 2 : 0;
      else if (e.title.match(/Crime success/i)) crimeChain++;
      lastSeenTs = e.timestamp;
    }
    if (fresh.length) { renderCrimeChainCurrent(); nerveDirty = true; } // let reconcileNerve re-walk for exact nerve
  } catch (error) {
    console.error(error); // TEST
  }
}

function updateCrimeChainController() {
  // Crimes 2.0 dropped the old crimes-outcome-* class this used to watch, so instead
  // re-read the API crimes log after each crime (DOM-structure-independent). Fast path
  // = hook the page's own crime request; safety net = a slow poll.
  let refreshTimer = null;
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(pollLatestCrime, 1200); // let the log settle after the crime
  };

  const origFetch = _ccWin.fetch;
  if (typeof origFetch === 'function') {
    _ccWin.fetch = function (input) {
      const url = input && input.url ? input.url : String(input || '');
      const out = origFetch.apply(this, arguments);
      if (/crimes/i.test(url) && !/api\.torn\.com/i.test(url)) {
        try { out.then(() => scheduleRefresh(), () => {}); } catch (e) {}
      }
      return out;
    };
  }

  const X = _ccWin.XMLHttpRequest;
  if (X && X.prototype) {
    const oOpen = X.prototype.open;
    const oSend = X.prototype.send;
    X.prototype.open = function (m, url) { this.__cc = String(url || ''); return oOpen.apply(this, arguments); };
    X.prototype.send = function () {
      if (this.__cc && /crimes/i.test(this.__cc) && !/api\.torn\.com/i.test(this.__cc)) {
        this.addEventListener('load', scheduleRefresh);
      }
      return oSend.apply(this, arguments);
    };
  }

  setInterval(pollLatestCrime, 10000); // safety net while on the crimes page
}

// INSTANT path: Crimes 2.0 shows live per-crime tallies (successes/fails/criticalFails)
// that tick the moment you play — no reload, no cached log. Watch them and apply the
// same chain math the instant a counter moves; advance lastSeenTs so the log poll
// doesn't re-count the same crime.
function readCrimeCounters() {
  const sEl = document.querySelector('[class*="successes___"]');
  const cEl = document.querySelector('[class*="criticalFails___"]');
  let fEl = null;
  const rc = document.querySelectorAll('[class*="resultCount___"]');
  for (const el of rc) { const cls = String(el.className || ''); if (/fails_/.test(cls) && !/criticalFails/.test(cls)) fEl = el; }
  if (!sEl || !fEl || !cEl) return null;
  const num = (el) => { const t = String(el.textContent || '').replace(/[^\d]/g, ''); return t ? parseInt(t, 10) : 0; };
  return { type: location.hash, s: num(sEl), f: num(fEl), c: num(cEl) };
}

function crimeCounterTick() {
  const cur = readCrimeCounters();
  if (!cur) { ccBase = null; return; }                              // hub / counters not present
  if (!ccBase || ccBase.type !== cur.type) { ccBase = cur; return; } // first sight or crime-type switch — baseline only
  const dS = cur.s - ccBase.s, dF = cur.f - ccBase.f, dC = cur.c - ccBase.c;
  if (dS <= 0 && dF <= 0 && dC <= 0) { ccBase = cur; return; }       // reset/rollback — re-baseline, no chain change
  if (dC > 0) crimeChain = 0;
  else if (dF > 0) { for (let k = 0; k < dF; k++) crimeChain = crimeChain ? crimeChain / 2 : 0; }
  else crimeChain += dS;
  bumpNerveOptimistic(dS, dF, dC);
  ccBase = cur;
  lastSeenTs = Math.floor(Date.now() / 1000);
  renderCrimeChainCurrent();
}

function crimeCounterController() {
  ccBase = readCrimeCounters();
  setInterval(crimeCounterTick, 300);
  setInterval(reconcileNerve, 10000); // snap optimistic nerve to the exact log figure once it catches up
}

function ensureBadge() {
  if (!getApiKey()) { renderKeyHint(); return; }
  renderCrimeChainHTML();    // idempotent: bails if the heading anchor is absent or badge exists
  renderCrimeChainCurrent(); // idempotent: bails if the value node is absent
  restoreNerveReadout();     // re-open the nerve readout if the user left it shown
}

function badgeController() {
  // The crimes app is a React SPA that mounts AFTER document-end and re-renders on
  // hub<->crime navigation, so render the badge once its anchor exists and re-add it
  // whenever React wipes it. Both render helpers are idempotent, so this is cheap.
  let t = null;
  const obs = new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(ensureBadge, 250);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  ensureBadge();
}

//// Startup gate. The old Promise.race([readyState==='complete', window 'load'])
// could deadlock in a sandboxed webext runtime that injected the script AFTER
// 'load' had already fired while readyState wasn't yet 'complete' — both promises
// stayed pending forever, so initController() never ran (no badge, no hint, not
// even the stylesheet). Instead, run once on whichever of DOMContentLoaded / load
// / a short fallback timeout fires first — this can't wedge. badgeController's
// MutationObserver still handles the SPA mounting its anchor later.
let __ccStarted = false;
async function ccStart() {
  if (__ccStarted) return;
  __ccStarted = true;
  try {
    console.log('⛓️ Crime chain script ON!'); // TEST
    initController();
    badgeController();
    if (getApiKey()) {
      await loadController();
      updateCrimeChainController();
      crimeCounterController();
    }
  } catch (error) {
    console.error(error); // TEST
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ccStart, { once: true });
  window.addEventListener('load', ccStart, { once: true });
  setTimeout(ccStart, 1500); // final backstop: never deadlock if neither event fires in this runtime
} else {
  ccStart(); // interactive/complete — the DOM body already exists, run now
}
