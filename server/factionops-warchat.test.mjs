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
    'var wcUnread=0, wcOpen=false, wcLoaded=false;',
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
