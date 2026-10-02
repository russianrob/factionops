// Runs the SHIPPED war-chat dock code against a DOM built from Torn's real
// markup, captured live via the remote-inspect bridge. The OC chip shipped
// broken three times on "it parses, so it works"; this executes it instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const SRC = readFileSync('/opt/warboard/server/public/scripts/factionops-private.user.js', 'utf8');
function fn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'not found: ' + name);
  let d = 0;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}' && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}

// Torn's dock, exactly as the inspector reported it.
const DOCK = `
<div id="chatRoot" class="w3b-chat-root"><div class="root___cqpqn"><div class="root___Ef1Ql">
  <button type="button" class="root___zZRe1 root___mRtyn" id="chat_panel_button:faction">4</button>
  <button type="button" class="root___zZRe1 root___mRtyn" id="notes_panel_button"></button>
  <button type="button" class="root___zZRe1 root___mRtyn" id="people_panel_button" title="People"></button>
  <button type="button" class="root___zZRe1 root___mRtyn" id="w3b-dock-hub" title="TornW3B Companion"></button>
  <button type="button" class="root___zZRe1 root___mRtyn" id="notes_settings_button"></button>
</div></div></div>`;

function mount(html = DOCK, msgs = [], myId = '137558') {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const box = { document, state: { myPlayerId: myId }, wcMessages: msgs, console };
  const src = [
    'var WC_BTN_ID="fo-warchat-btn", WC_PANEL_ID="fo-warchat-panel", WC_MAX_RENDER=200;',
    'var wcUnread=0, wcOpen=false, wcLoaded=false, wcLoading=false, wcSeeded=true;',
    // Dependencies wcEnsureButton picked up in 5.4.4 (cache seeding). Stubbed
    // rather than exercised here; the cache has its own tests below.
    'var WC_CACHE_KEY="k", WC_CACHE_MAX=60;',
    'function deriveWarId(){ return "war_test"; }',
    'function GM_getValue(k,d){ return d; } function GM_setValue(){}',
    fn('wcCacheAll'), fn('wcCacheRead'), fn('wcCacheWrite'), fn('wcSeedFromCache'),
    fn('wcEscape'), fn('wcDockSlot'), fn('wcEnsureButton'), fn('wcSetBadge'), fn('wcRender'),
    'globalThis.API={wcEscape:wcEscape,wcDockSlot:wcDockSlot,wcEnsureButton:wcEnsureButton,' +
      'wcSetBadge:wcSetBadge,wcRender:wcRender};'
  ].join('\n');
  const f = new Function('document', 'state', 'wcMessages', 'console', src + '; return API;');
  return { document, api: f(document, box.state, msgs, console) };
}

test('the button lands in the dock, left of the settings gear', () => {
  const { document, api } = mount();
  api.wcEnsureButton();
  const b = document.getElementById('fo-warchat-btn');
  assert.ok(b, 'button was not injected');
  assert.equal(b.nextElementSibling.id, 'notes_settings_button');
});

test('it copies the dock class off a live sibling, never a literal', () => {
  // Torn rehashes these per build. A hardcoded root___zZRe1 works until the
  // next deploy and then the button silently loses all its styling.
  const { document, api } = mount(DOCK.replace(/root___zZRe1 root___mRtyn/g, 'root___NEWHASH x___OTHER'));
  api.wcEnsureButton();
  assert.equal(document.getElementById('fo-warchat-btn').className, 'root___NEWHASH x___OTHER');
});

test('calling it repeatedly does not stack buttons', () => {
  const { document, api } = mount();
  api.wcEnsureButton(); api.wcEnsureButton(); api.wcEnsureButton();
  assert.equal(document.querySelectorAll('#fo-warchat-btn').length, 1);
});

test('a page with no chat dock is left alone', () => {
  const { document, api } = mount('<div id="somethingelse"></div>');
  api.wcEnsureButton();
  assert.equal(document.getElementById('fo-warchat-btn'), null);
  assert.equal(api.wcDockSlot(), null);
});

test('a dock with no gear still gets the button', () => {
  const { document, api } = mount(DOCK.replace(/<button[^>]*notes_settings_button[^>]*><\/button>/, ''));
  api.wcEnsureButton();
  assert.ok(document.getElementById('fo-warchat-btn'));
});

test('message text is escaped, not injected', () => {
  const { api } = mount();
  assert.equal(api.wcEscape('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(api.wcEscape('a & b'), 'a &amp; b');
});

test('a hostile message renders as text in the list', () => {
  const msgs = [{ id: '1', ts: Date.now(), playerId: '1', playerName: '<b>evil</b>', text: '<script>x</script>' }];
  const { document, api } = mount(DOCK + '<div id="fo-wc-list"></div>', msgs);
  api.wcRender();
  const html = document.getElementById('fo-wc-list').innerHTML;
  assert.ok(!/<script>/.test(html), 'script tag survived escaping');
  assert.ok(/&lt;script&gt;/.test(html));
  assert.ok(!/<b>evil<\/b>/.test(html), 'player name was not escaped');
});

test('an empty history says so rather than rendering blank', () => {
  const { document, api } = mount(DOCK + '<div id="fo-wc-list"></div>', []);
  api.wcRender();
  assert.match(document.getElementById('fo-wc-list').textContent, /No messages yet/i);
});

test('the unread badge shows a count and hides at zero', () => {
  const { document, api } = mount();
  api.wcEnsureButton();
  api.wcSetBadge(3);
  const badge = document.getElementById('fo-warchat-badge');
  assert.equal(badge.textContent, '3');
  assert.equal(badge.style.display, 'block');
  api.wcSetBadge(0);
  assert.equal(badge.style.display, 'none');
  api.wcSetBadge(250);
  assert.equal(badge.textContent, '99+');
});

// ── where the overlay's furniture is allowed to appear ─────────────────
//
// 5.4.2 widened @match to all of Torn for the chat dock. The settings gear
// and heatmap toggle are created in TWO places — detectPageAndInit and
// main() — and 5.4.2 gated only the first, so both round buttons kept
// turning up over the crimes page. One rule now, used by both.

const pageRule = (() => {
  const src = fn('isOriginallyMatchedPage');
  return new Function(src + '; return isOriginallyMatchedPage;')();
})();

test('the pages this script was built for are recognised', () => {
  for (const u of [
    'https://www.torn.com/factions.php?step=your#/tab=crimes',
    'https://www.torn.com/war.php',
    'https://www.torn.com/loader.php?sid=attack&user2ID=1',
    'https://www.torn.com/profiles.php?XID=137558',
  ]) assert.equal(pageRule(u), true, u);
});

test('the rest of Torn is not', () => {
  for (const u of [
    'https://www.torn.com/crimes.php',
    'https://www.torn.com/gym.php',
    'https://www.torn.com/item.php',
    'https://www.torn.com/page.php?sid=ItemMarket',
    'https://www.torn.com/index.php',
  ]) assert.equal(pageRule(u), false, u);
});

test('rubbish input is not a matched page', () => {
  assert.equal(pageRule(''), false);
  assert.equal(pageRule(null), false);
  assert.equal(pageRule(undefined), false);
});

test('both creators are gated on the SAME rule, not two copies', () => {
  // The whole bug: two gates, one updated. If either stops calling the
  // shared helper, this fails.
  const uses = (SRC.match(/isOriginallyMatchedPage\(/g) || []).length;
  assert.ok(uses >= 3, 'expected the definition plus both gates, found ' + uses);
  assert.ok(!/const onOriginalPage = \/factions/.test(SRC),
    'a second inline copy of the page rule has reappeared');
});

test('main() will not build the furniture off the original pages', () => {
  const i = SRC.indexOf('const wantsFurniture');
  assert.ok(i > 0, 'main() gate missing — update this anchor');
  const body = SRC.slice(i, i + 320);
  assert.match(body, /isOriginallyMatchedPage/);
  assert.match(body, /createSettingsGear/);
  assert.match(body, /createHeatmapButton/);
});

// ── loading vs empty ───────────────────────────────────────────────────
//
// The panel rendered "No messages yet." the instant it opened, then filled
// in when the GET returned — so a room with a hundred messages still
// flashed an empty state at you. "Empty" is a claim; it can only be made
// once the history has actually come back.

function mountRender({ loading, msgs }) {
  const { document } = parseHTML('<html><body><div id="fo-wc-list"></div></body></html>');
  const src = [
    'var WC_MAX_RENDER=200;',
    'var wcLoading=' + JSON.stringify(loading) + ';',
    fn('wcEscape'), fn('wcRender'),
    'globalThis.R=wcRender;'
  ].join('\n');
  const f = new Function('document', 'state', 'wcMessages', 'console', src + '; return R;');
  f(document, { myPlayerId: '1' }, msgs, console)();
  return document.getElementById('fo-wc-list').textContent;
}

test('an empty room while still fetching says Loading, not No messages', () => {
  assert.match(mountRender({ loading: true, msgs: [] }), /Loading/);
});

test('an empty room that has finished fetching says No messages', () => {
  assert.match(mountRender({ loading: false, msgs: [] }), /No messages yet/i);
});

test('messages win over both states', () => {
  const out = mountRender({ loading: true, msgs: [{ id: '1', ts: Date.now(), playerId: '2', playerName: 'A', text: 'hello' }] });
  assert.match(out, /hello/);
  assert.ok(!/Loading/.test(out));
});

// ── the local cache ────────────────────────────────────────────────────

function cacheHarness(initial) {
  let store = initial === undefined ? '' : JSON.stringify(initial);
  const src = [
    "var WC_CACHE_KEY='k', WC_CACHE_MAX=60;",
    'function GM_getValue(k, d){ return store === "" ? d : store; }',
    'function GM_setValue(k, v){ store = v; }',
    fn('wcCacheAll'), fn('wcCacheRead'), fn('wcCacheWrite'),
    'globalThis.C={read:wcCacheRead, write:wcCacheWrite, peek:function(){return store;}};'
  ].join('\n');
  return new Function('store', src + '; return C;')(store);
}

test('a cold cache reads as empty rather than throwing', () => {
  assert.deepEqual(cacheHarness().read('war_1'), []);
});

test('corrupt cache contents do not take the panel down', () => {
  const c = new Function('', [
    "var WC_CACHE_KEY='k', WC_CACHE_MAX=60;",
    'var store = "{not json";',
    'function GM_getValue(k,d){ return store; }',
    'function GM_setValue(k,v){ store = v; }',
    fn('wcCacheAll'), fn('wcCacheRead'),
    'return { read: wcCacheRead };'
  ].join('\n'))();
  assert.deepEqual(c.read('war_1'), []);
});

test('the cache is bounded, so it cannot grow without limit', () => {
  const big = Array.from({ length: 500 }, (_, i) => ({ id: String(i), text: 'm' + i }));
  const c = cacheHarness({});
  c.write('war_1', big);
  const kept = JSON.parse(c.peek())['war_1'];
  assert.equal(kept.length, 60);
  assert.equal(kept[kept.length - 1].id, '499', 'kept the oldest instead of the newest');
});

test('two wars keep separate histories', () => {
  const c = cacheHarness({});
  c.write('war_1', [{ id: 'a', text: 'one' }]);
  c.write('war_2', [{ id: 'b', text: 'two' }]);
  assert.equal(c.read('war_1')[0].text, 'one');
  assert.equal(c.read('war_2')[0].text, 'two');
});
