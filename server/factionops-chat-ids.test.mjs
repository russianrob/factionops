// Posting a call into Torn faction chat, after the chat 3.1 rename.
//
// The script's own diagnostics caught this: every fo-call-chat entry on
// 2026-10-02 was reason "no-channel-button" and there were ZERO "click-sent",
// against 368 click-sent on 2026-09-24. The channel button id had changed and
// nothing had reached chat since.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const BUILDS = ['factionops.user.js', 'factionops-private.user.js', 'factionops-beta.user.js'];

function fnFrom(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'not found: ' + name);
  let d = 0;
  for (let j = src.indexOf('{', i); j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}

// Markup read off the live page 2026-10-02. The faction channel button lost
// its "-<factionId>" suffix and "channel_" became "chat_"; the content box
// "faction-<id>" became plain "faction".
const CHAT_31 = `
<div id="chatRoot">
  <button id="chat_panel_button:4513226" class="root___zZRe1 root___rnQAo"></button>
  <button id="chat_panel_button:faction" class="root___zZRe1 opened___dihOy" title="Dead Fragment">1</button>
  <button id="chat_panel_button:company" class="root___zZRe1 root___y4L37"></button>
  <div id="faction" class="root___Ex8tg visible___IVBmB">
    <div class="root___aBCjE">
      <textarea class="textarea___JRbO5" placeholder="Type your message here..."></textarea>
      <button class="iconWrapper___DRSkm" disabled></button>
    </div>
  </div>
</div>`;

const CHAT_30 = `
<div id="chatRoot">
  <button id="channel_panel_button:faction-42055" class="root___zZRe1 opened___old"></button>
  <div id="faction-42055" class="root___Ex8tg">
    <textarea class="textarea___JRbO5"></textarea>
    <button class="iconWrapper___DRSkm" disabled></button>
  </div>
</div>`;

// A decoy outside the chat: a bare id of "faction" is generic enough that
// other page markup could legitimately use it.
const DECOY = `<div id="faction">someone else's markup</div>`;

function api(build, html, factionId = '42055') {
  const src = readFileSync('/opt/warboard/server/public/scripts/' + build, 'utf8');
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const code = [
    fnFrom(src, 'factionChatToggleButton'),
    fnFrom(src, 'factionChatBox'),
    'globalThis.API={factionChatToggleButton,factionChatBox};'
  ].join('\n');
  return new Function('document', 'state', code + '; return API;')(
    document, { myFactionId: factionId });
}

for (const build of BUILDS) {
  test(`${build}: finds the chat 3.1 channel button`, () => {
    const a = api(build, CHAT_31);
    const btn = a.factionChatToggleButton();
    assert.ok(btn, 'the 3.1 button was not found — this is the live breakage');
    assert.equal(btn.id, 'chat_panel_button:faction');
  });

  test(`${build}: finds the chat 3.1 message box`, () => {
    const a = api(build, CHAT_31);
    const box = a.factionChatBox();
    assert.ok(box, 'the 3.1 box was not found');
    assert.equal(box.id, 'faction');
    assert.ok(box.querySelector('textarea[class*="textarea___"]'), 'no textarea inside it');
    assert.ok(box.querySelector('button[class*="iconWrapper___"]'), 'no send button inside it');
  });

  test(`${build}: still works on a pre-3.1 build`, () => {
    // Anyone served a cached bundle, or on an older Torn.
    const a = api(build, CHAT_30);
    assert.equal(a.factionChatToggleButton().id, 'channel_panel_button:faction-42055');
    assert.equal(a.factionChatBox().id, 'faction-42055');
  });

  test(`${build}: a bare #faction OUTSIDE the chat is ignored`, () => {
    // Posting a war call into whatever that element is would be the worst
    // outcome here, so provenance is checked rather than document order.
    const a = api(build, DECOY);
    assert.equal(a.factionChatBox(), null);
    assert.equal(a.factionChatToggleButton(), null);
  });

  test(`${build}: the decoy does not win over the real box`, () => {
    const a = api(build, DECOY + CHAT_31);
    const box = a.factionChatBox();
    assert.ok(box, 'no box found');
    assert.ok(box.closest('#chatRoot'), 'picked the decoy outside the chat');
  });

  test(`${build}: factionless users get nothing, not a wrong channel`, () => {
    // auth stores '0' for factionless. On 3.1 the button carries no faction
    // id, so this only governs the legacy path.
    const a = api(build, CHAT_30, '0');
    assert.equal(a.factionChatToggleButton(), null);
    assert.equal(a.factionChatBox(), null);
  });

  test(`${build}: the open marker Torn still uses is detectable`, () => {
    // sendCallToChat decides whether to click the toggle with /opened___/.
    // 3.1 kept that convention: opened___dihOy / opened___PTx4p.
    const a = api(build, CHAT_31);
    assert.match(String(a.factionChatToggleButton().className), /opened___/);
  });
}
