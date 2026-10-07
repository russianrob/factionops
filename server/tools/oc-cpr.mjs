#!/usr/bin/env node
// What CPR actually clears an OC, measured from the faction's own history.
//
//   node tools/oc-cpr.mjs                    last 90 days, every difficulty
//   node tools/oc-cpr.mjs --days 30
//   node tools/oc-cpr.mjs --difficulty 8
//   node tools/oc-cpr.mjs --role Muscle
//   node tools/oc-cpr.mjs --json            machine-readable, for scripts
//
// Why this exists: Torn publishes NO minimum stat, job stat, or CPR for any
// OC role. /v2/torn?selections=organizedcrimes returns only name,
// position_info and required_item per slot, and the payload is byte-identical
// under a higher-access key, so the absence is real rather than a permissions
// artifact. The community's "70+ CPR, 60+ above level 8" is a risk
// convention, not a rule. The only honest answer to "what CPR do we need?" is
// measured, and compared against the break-even rate each crime publishes.
//
// TWO LEVELS, deliberately kept apart, because mixing them is the easy
// mistake here:
//
//   crime.status        Successful | Failure  — the thing that wins or loses
//                       scope, and therefore the ONLY rate comparable to
//                       scope.cost/scope.return.
//   slot.user.outcome   per seat, five-valued (see SEAT_FAIL). CPR is a
//                       per-seat number, so the CPR views use this.
//
// Comparing a seat pass rate to the scope break-even is apples to oranges and
// will tell you a tier is short when it is fine.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

// dotenv resolves .env against the cwd at import time, so this must come
// AFTER the chdir — a static import gets hoisted above it and finds nothing,
// which looks exactly like a server with no API key configured.
await import('dotenv/config');

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const has = (name) => argv.includes(`--${name}`);

const DAYS      = Number(flag('days', 90));
const ONLY_DIFF = flag('difficulty', null);
const ONLY_ROLE = flag('role', null);
const AS_JSON   = has('json');
const MIN_N     = 8;   // below this a rate is noise, and is marked so

// Measured over 400 completed crimes, 2026-10-07. The seat enum is NOT the
// crime enum: seats say "Failed", crimes say "Failure", and three of the five
// seat values describe a consequence rather than a plain miss. They are
// grouped as "did not cleanly pass" and also broken out in the report, since
// Jailed and Hospitalized cost the member real time and are worth seeing.
const SEAT_PASS = 'Successful';
const SEAT_FAIL = ['Failed', 'Jailed', 'Hospitalized', 'Injured'];

const KEY = process.env.OWNER_API_KEY || '';
if (!KEY) {
  console.error('No OWNER_API_KEY in server/.env — nothing to query with.');
  process.exit(1);
}

async function api(path) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`https://api.torn.com/v2/${path}${sep}key=${KEY}`);
  const j = await r.json();
  // Torn answers a rejected key with HTTP 200 and an error body, so the
  // status code alone never tells you the call failed.
  if (j && j.error) {
    const e = j.error;
    throw new Error(`Torn API: ${e.error || JSON.stringify(e)} (code ${e.code})`);
  }
  return j;
}

// ── The break-even rate each crime publishes ────────────────────────────
// scope.cost / scope.return IS the crime success rate needed to hold scope:
// the ratios are 1/2, 2/3, 3/4, 4/5, 5/6 → 50 / 66.7 / 75 / 80 / 83.3%.
// Reading it per crime matters, because difficulty 8 straddles two of those
// bands and any per-tier table is wrong for half of it.
const catalogue = (await api('torn?selections=organizedcrimes')).organizedcrimes || [];
const breakEven = new Map();
for (const c of catalogue) {
  const { cost, return: ret } = c.scope || {};
  if (cost && ret) breakEven.set(c.name, (cost / ret) * 100);
}

// ── Pull completed crimes, oldest bound by --days ───────────────────────
// Offset paging genuinely works on this endpoint, unlike faction/attacks
// where the next link dies after one page and you must cursor by timestamp.
const cutoff = Math.floor(Date.now() / 1000) - DAYS * 86400;
const crimes = [];
for (let offset = 0; offset < 5000; offset += 100) {
  const page = (await api(`faction/crimes?cat=completed&limit=100&offset=${offset}`)).crimes || [];
  if (!page.length) break;
  crimes.push(...page.filter((c) => (c.executed_at || 0) >= cutoff));
  // Pages come back newest-first, so once a page reaches past the cutoff
  // every later page is older still.
  if (Math.min(...page.map((c) => c.executed_at || 0)) < cutoff) break;
}

const unknown = new Map();
const noteUnknown = (v) => unknown.set(v, (unknown.get(v) || 0) + 1);

// ── Crime level: the scope question ─────────────────────────────────────
const pickedCrimes = crimes.filter((c) =>
  ONLY_DIFF == null || String(c.difficulty) === String(ONLY_DIFF));
const crimeStat = new Map();   // difficulty -> {n, ok, need}
for (const c of pickedCrimes) {
  if (c.status !== 'Successful' && c.status !== 'Failure') noteUnknown(`crime:${c.status}`);
  if (!crimeStat.has(c.difficulty)) crimeStat.set(c.difficulty, { n: 0, ok: 0, needs: [] });
  const g = crimeStat.get(c.difficulty);
  g.n++;
  if (c.status === 'Successful') g.ok++;
  const be = breakEven.get(c.name);
  if (be != null) g.needs.push(be);
}

// ── Seat level: the CPR question ────────────────────────────────────────
const seats = [];
for (const c of crimes) {
  for (const s of c.slots || []) {
    const u = s.user;
    if (!u || !u.outcome) continue;                   // empty seat
    if (typeof s.checkpoint_pass_rate !== 'number') continue;
    const ok = u.outcome === SEAT_PASS;
    if (!ok && !SEAT_FAIL.includes(u.outcome)) noteUnknown(`seat:${u.outcome}`);
    seats.push({ crime: c.name, difficulty: c.difficulty, role: s.position,
                 cpr: s.checkpoint_pass_rate, ok, outcome: u.outcome });
  }
}
const picked = seats.filter((r) =>
  (ONLY_DIFF == null || String(r.difficulty) === String(ONLY_DIFF)) &&
  (ONLY_ROLE == null || r.role.toLowerCase() === ONLY_ROLE.toLowerCase()));

const pct = (ok, n) => (n ? (ok / n) * 100 : null);
function group(keyOf) {
  const m = new Map();
  for (const r of picked) {
    const k = keyOf(r);
    if (!m.has(k)) m.set(k, { n: 0, ok: 0, cprOk: [], cprFail: [], modes: new Map() });
    const g = m.get(k);
    g.n++;
    if (r.ok) { g.ok++; g.cprOk.push(r.cpr); }
    else {
      g.cprFail.push(r.cpr);
      g.modes.set(r.outcome, (g.modes.get(r.outcome) || 0) + 1);
    }
  }
  return m;
}

// CPR bands of 5. This is the view that answers the real question: not "what
// is the floor" (there is none) but "at this CPR, how often does the seat
// actually come through clean?"
const BAND = 5;
const byRole = group((r) => r.role);
const byBand = group((r) => Math.floor(r.cpr / BAND) * BAND);

const med = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

if (AS_JSON) {
  const dump = (m) => [...m.entries()].sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([k, g]) => ({ key: k, seats: g.n, passed: g.ok, pass_pct: pct(g.ok, g.n),
                        cpr_passed_min: g.cprOk.length ? Math.min(...g.cprOk) : null,
                        cpr_failed_max: g.cprFail.length ? Math.max(...g.cprFail) : null,
                        failure_modes: Object.fromEntries(g.modes) }));
  console.log(JSON.stringify({
    window_days: DAYS, crimes: pickedCrimes.length, seats: picked.length,
    filters: { difficulty: ONLY_DIFF, role: ONLY_ROLE },
    by_difficulty_crime_level: [...crimeStat.entries()].sort((a, b) => a[0] - b[0])
      .map(([d, g]) => ({ difficulty: d, crimes: g.n, succeeded: g.ok,
                          success_pct: pct(g.ok, g.n),
                          break_even_pct: g.needs.length ? Math.max(...g.needs) : null })),
    by_cpr_band_seat_level: dump(byBand),
    by_role_seat_level: dump(byRole),
    unknown_outcomes: Object.fromEntries(unknown),
  }, null, 2));
  process.exit(0);
}

console.log(`\nOC results — last ${DAYS} days`
  + (ONLY_DIFF ? `, difficulty ${ONLY_DIFF}` : '')
  + (ONLY_ROLE ? `, role ${ONLY_ROLE}` : ''));
console.log(`${pickedCrimes.length} completed crimes, ${picked.length} filled seats\n`);

if (!picked.length) {
  console.log('Nothing matched. Widen --days, or check the --role spelling.');
  process.exit(0);
}

// ── Scope: crime success vs what the crime needs ────────────────────────
console.log('SCOPE — crime success rate vs the break-even the crime publishes');
console.log('  diff  crimes   success    need   verdict');
for (const [d, g] of [...crimeStat.entries()].sort((a, b) => a[0] - b[0])) {
  // The strictest break-even in the tier: difficulty 8 mixes 4/5 and 5/6
  // crimes, and clearing the easier one is not clearing the tier.
  const need = g.needs.length ? Math.max(...g.needs) : null;
  const p = pct(g.ok, g.n);
  const verdict = need == null ? ''
    : p >= need ? `holds, +${(p - need).toFixed(1)}pt`
                : `LOSING SCOPE, -${(need - p).toFixed(1)}pt`;
  console.log(`  ${String(d).padEnd(4)} ${String(g.n).padStart(6)} ${p.toFixed(1).padStart(8)}%`
    + ` ${need == null ? '     —' : (need.toFixed(1) + '%').padStart(7)}`
    + `   ${verdict}${g.n < MIN_N ? '  (n low)' : ''}`);
}

// ── CPR: the decision-useful view ───────────────────────────────────────
console.log('\nCPR BAND — how often a seat at this CPR came through clean');
console.log('  CPR      seats    clean');
for (const [b, g] of [...byBand.entries()].sort((a, b) => a[0] - b[0])) {
  const p = pct(g.ok, g.n);
  console.log(`  ${String(b).padStart(3)}-${String(b + BAND - 1).padEnd(4)}`
    + ` ${String(g.n).padStart(5)} ${p.toFixed(1).padStart(8)}%  ${'#'.repeat(Math.round(p / 5))}`
    + `${g.n < MIN_N ? '  (n low)' : ''}`);
}

// ── Per role ────────────────────────────────────────────────────────────
console.log('\nROLE          seats    clean   lowest clean   highest fail   how they failed');
for (const [role, g] of [...byRole.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const lo = g.cprOk.length ? Math.min(...g.cprOk) : null;
  const hi = g.cprFail.length ? Math.max(...g.cprFail) : null;
  const modes = [...g.modes.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`).join(', ') || '—';
  console.log(`  ${role.padEnd(13)} ${String(g.n).padStart(4)} ${pct(g.ok, g.n).toFixed(1).padStart(8)}%`
    + ` ${(lo == null ? '—' : String(lo)).padStart(14)} ${(hi == null ? '—' : String(hi)).padStart(14)}`
    + `   ${modes}${g.n < MIN_N ? '  (n low)' : ''}`);
}

// Overlap is the whole point: where the lowest clean CPR sits BELOW the
// highest failing one, there is demonstrably no threshold. Reporting that
// beats quoting a floor that does not exist.
const allOk = picked.filter((r) => r.ok).map((r) => r.cpr);
const allFail = picked.filter((r) => !r.ok).map((r) => r.cpr);
if (allOk.length && allFail.length) {
  const lo = Math.min(...allOk), hi = Math.max(...allFail);
  console.log(`\nCame through clean as low as ${lo} CPR; failed as high as ${hi} CPR`
    + ` (medians ${med(allOk)} clean vs ${med(allFail)} failed).`);
  if (lo < hi) {
    console.log('Those ranges overlap, which is the measurement saying there is no');
    console.log('cutoff — CPR moves the odds, it does not gate the seat.');
  }
  // If the band curve is nearly flat, CPR is plainly not the seat's own pass
  // probability — it is one input among several. Worth saying, because the
  // name "checkpoint pass rate" invites reading it as the answer.
  // Sort by CPR before splitting low/high: a Map iterates in insertion
  // order, which here is the order seats happened to be encountered, so an
  // unsorted split compares two arbitrary halves and mislabels the range.
  const solid = [...byBand.entries()].filter(([, g]) => g.n >= MIN_N)
    .map(([b, g]) => [b, pct(g.ok, g.n)])
    .sort((a, b) => a[0] - b[0]);
  if (solid.length >= 3) {
    const lows = solid.slice(0, Math.ceil(solid.length / 2));
    const highs = solid.slice(-Math.ceil(solid.length / 2));
    const avg = (a) => a.reduce((s, [, p]) => s + p, 0) / a.length;
    const gap = avg(highs) - avg(lows);
    console.log(`Low CPR bands clean ${avg(lows).toFixed(1)}% vs high bands`
      + ` ${avg(highs).toFixed(1)}% — a ${gap.toFixed(1)}pt spread across`
      + ` ${solid[0][0]}-${solid[solid.length - 1][0] + BAND - 1} CPR.`);
  }
}

if (unknown.size) {
  console.log(`\nUnrecognised outcomes (counted as failures): `
    + [...unknown.entries()].map(([k, v]) => `${k} x${v}`).join(', '));
  console.log('If Torn changed an enum, fix this tool before trusting the numbers.');
}
console.log();
