// tools/gen-xanax-page.mjs (tornwar.com/xanax): the Repeat offenders list shows
// current members only. The generator runs as-is on a copy of the server folder
// with a made-up war-history; Torn's member list is answered by a stand-in fetch
// that also records every request. Ids and names are made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const SERVER = dirname(fileURLToPath(import.meta.url));
const DAY = 86400000;

// Three wars. Alpha (still in) and Charlie (left) are flagged in two of them,
// Bravo in one; Delta took a vial and made his attacks.
const war = (n, members) => ({
  warEndedAt: Date.UTC(2026, 8, 1) + n * 7 * DAY,
  enemyFactionId: 900 + n, enemyFactionName: `Enemy ${n}`, warResult: 'victory',
  members: members.map(([playerId, name, xanaxTaken, totalAttacks]) => ({ playerId, name, xanaxTaken, warHits: totalAttacks, totalAttacks })),
  xanaxStats: { taken: Object.fromEntries(members.map(([id, , x]) => [String(id), x])), names: {} },
});
const HISTORY = { wars: {
  w1: war(1, [[1000001, 'Alpha', 3, 0], [1000003, 'Charlie', 4, 0], [1000004, 'Delta', 1, 20]]),
  w2: war(2, [[1000001, 'Alpha', 2, 0], [1000003, 'Charlie', 3, 0], [1000002, 'Bravo', 2, 0]]),
  w3: war(3, [[1000004, 'Delta', 1, 20]]),
} };
const STUB = `import { appendFileSync } from 'node:fs';
globalThis.fetch = async (url, opts = {}) => {
  appendFileSync(process.env.STUB_LOG, JSON.stringify({ url: String(url), headers: opts.headers || {} }) + '\\n');
  const mode = process.env.STUB_MODE;
  const body = mode === 'error' ? { error: { code: 2, error: 'Incorrect key' } }
    : mode === 'empty' ? { members: [] }
    : { members: JSON.parse(process.env.STUB_ROSTER).map((id) => ({ id, name: 'x' })) };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
`;

// Runs the generator on a fresh copy; returns the page, its log and the requests it made.
function run({ key = 'testkey1234', mode = 'ok', roster = [1000001, 1000002, 1000004] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'xanax-page-'));
  try {
    const srv = join(root, 'server');
    mkdirSync(join(srv, 'tools'), { recursive: true });
    mkdirSync(join(srv, 'data', 'war-history'), { recursive: true });
    copyFileSync(process.env.XANAX_GEN_SRC || join(SERVER, 'tools', 'gen-xanax-page.mjs'), join(srv, 'tools', 'gen-xanax-page.mjs'));
    copyFileSync(join(SERVER, 'xanax-model.js'), join(srv, 'xanax-model.js'));
    symlinkSync(join(SERVER, 'node_modules'), join(srv, 'node_modules'));
    writeFileSync(join(srv, 'data', 'war-history', '42055.json'), JSON.stringify(HISTORY));
    writeFileSync(join(root, 'stub.mjs'), STUB);
    const log = join(root, 'requests.log');
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, STUB_LOG: log, STUB_MODE: mode, STUB_ROSTER: JSON.stringify(roster) };
    if (key) env.OWNER_API_KEY = key;
    const r = spawnSync(process.execPath, ['--import', pathToFileURL(join(root, 'stub.mjs')).href, 'tools/gen-xanax-page.mjs'], { cwd: srv, env, encoding: 'utf8', timeout: 30000 });
    const page = join(srv, 'public', 'xanax', 'index.html');
    assert.equal(r.status, 0, r.stderr);
    return {
      html: existsSync(page) ? readFileSync(page, 'utf8') : '',
      out: r.stdout + r.stderr,
      requests: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [],
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
// The rows between the Repeat offenders band and the Flagged once band.
const repeatBand = (html) => {
  const a = html.indexOf('Repeat offenders<small>');
  return a < 0 ? '' : html.slice(a, html.indexOf('Flagged once<small>', a));
};
const named = (html, name) => html.includes(`title="${name}"`);

test('a repeat offender who has left the faction is not listed; one still in is', () => {
  const { html } = run();
  const band = repeatBand(html);
  assert.ok(named(band, 'Alpha'), band);
  assert.ok(!named(band, 'Charlie'), band);
  assert.match(html, /<b>1<\/b><span>repeat offenders \(2\+\)<\/span>/);
  assert.match(html, /Worst: <span class="nm">Alpha<\/span>/);
  assert.match(band, /1 who left not shown/);
});

test('someone hidden from the repeat list is not named as the biggest waste either', () => {
  const { html } = run();
  const waste = html.slice(html.indexOf('Biggest cumulative waste'), html.indexOf('</li>', html.indexOf('Biggest cumulative waste')));
  assert.ok(waste.includes('Alpha') && !waste.includes('Charlie'), waste);
});

test('flagged-once members stay as they were', () => {
  const { html } = run();
  const once = html.slice(html.indexOf('Flagged once<small>'));
  assert.ok(named(once, 'Bravo'), once);
});

test('one request for the member list, with the key in a header and not the address', () => {
  const { requests, out } = run();
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/v2\/faction\/42055\/members/);
  assert.ok(!requests[0].url.includes('testkey1234'), requests[0].url);
  assert.equal(requests[0].headers.Authorization, 'ApiKey testkey1234');
  assert.match(out, /roster 3 members, 1 repeat offender hidden/);
});

test('if Torn refuses, nobody is hidden and the page says nothing about it', () => {
  const { html, out } = run({ mode: 'error' });
  assert.ok(named(repeatBand(html), 'Charlie'));
  assert.ok(!html.includes('who left'), 'no hidden-count claim');
  assert.match(out, /roster unavailable/);
});

test('an empty member list is treated as unavailable, not as everyone gone', () => {
  const { html, out } = run({ mode: 'empty' });
  const band = repeatBand(html);
  assert.ok(named(band, 'Alpha') && named(band, 'Charlie'), band);
  assert.match(out, /roster unavailable/);
});

test('without a key it makes no request and lists everyone', () => {
  const { html, requests } = run({ key: '' });
  assert.equal(requests.length, 0);
  assert.ok(named(repeatBand(html), 'Charlie'));
});
