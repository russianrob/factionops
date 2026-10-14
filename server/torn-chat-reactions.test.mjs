import fs from 'node:fs';
import assert from 'node:assert/strict';
const src = fs.readFileSync('/opt/warboard/server/public/scripts/torn-chat-reactions.user.js','utf8');
function grab(sig){const i=src.indexOf(sig);assert.ok(i>0,sig);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
const REACTION = /^(\S+)\s+"([\s\S]+)"$/u;
const QUOTE_LEN = 24;
// collect() now writes into a DURABLE store so chips survive the virtual
// list recycling their reaction line, so the harness has to carry that state
// the same way the script does.
const PRELUDE = `
  const seen = new Map();
  const texts = new Map();
  const SEEN_CAP = 800;
  const winIds = new WeakMap();
  const winOther = new Map();
  let winSeq = 0;
`;
const mkFns = () => new Function('REACTION','QUOTE_LEN',
  `${PRELUDE}
   ${grab('function isSelf(')}
   ${grab('function bubbleText(')}
   ${grab('function keyFor(')}
   ${grab('function winIdOf(')}
   ${grab('function note(')}
   ${grab('function findRemembered(')}
   ${grab('function remember(')}
   ${grab('function quoteFor(')}
   ${grab('function collect(')}
   return {quoteFor, collect, keyFor, seen, texts, bubbleText, isSelf, winIdOf};`)(REACTION,QUOTE_LEN);
// Fresh state per test: the store persists by design, so sharing it across
// tests would let one test's reactions leak into the next.
let fns = mkFns();

const msg = (id, sender, text, win='faction') => ({ id, sender, text, win, bubble:null, row:{style:{}} });
let f=0; const t=(n,fn)=>{try{fns=mkFns();fn();console.log('  ok   '+n)}catch(e){f++;console.log('  FAIL '+n+'\n       '+e.message)}};

console.log('quoteFor — the fragment that aims a reaction:');
t('QUOTE_LEN is a FLOOR: words are added until it is passed, never cut mid-word', () => {
  const m = msg('a:1','P','ima need to get a 99k boost i think');
  const q = fns.quoteFor(m,[m]);
  assert.equal(q, 'ima need to get a 99k boost');
  assert.ok(q.length >= 24, 'at least the floor');
  assert.ok(m.text.startsWith(q), 'always a clean prefix of the message');
  assert.ok(!q.endsWith(' '), 'never a dangling space');
});
t('a short message is quoted whole', () => {
  const m = msg('a:1','P','gg');
  assert.equal(fns.quoteFor(m,[m]), 'gg');
});
t('EXTENDS when another visible message shares the fragment', () => {
  const a = msg('a:1','P','anyone know da best service for them');
  const b = msg('b:1','Q','anyone know da best service for vicodin');
  const q = fns.quoteFor(a,[a,b]);
  assert.ok(q.length > 'anyone know da best'.length, 'must disambiguate, got: '+q);
  assert.equal([a,b].filter(m=>m.text.includes(q)).length, 1, 'fragment must be unique');
});
t('an empty message yields nothing rather than an empty quote', () => {
  assert.equal(fns.quoteFor(msg('a:1','P','   '),[]), null);
});

console.log('\ncollect — resolving a reaction to its target:');
const Q = (e,frag)=>e+' "'+frag+'"';
t('a reaction lands on the quoted message, not the one above it', () => {
  const all=[msg('m1:1','POOPEATER','ima need to get a 99k boost'),
             msg('m2:2','Yukarii','Anyone working on amusement?'),
             msg('m3:3','Rob',Q('X','ima need to get a 99k'))];
  const {reg,hide}=fns.collect(all);
  assert.equal(reg.size,1);
  assert.ok(reg.has(all[0]), 'must attach to m1, not the adjacent m2');
});
t('several people reacting aggregate under one emoji', () => {
  const all=[msg('m1:1','A','ima need to get a 99k boost'),
             msg('r1:2','B',Q('X','ima need to get a 99k')),
             msg('r2:3','C',Q('X','ima need to get a 99k'))];
  const {reg,hide}=fns.collect(all);
  assert.equal(reg.get(all[0]).get('X').size,2);
});
t('FAIL OPEN: an unmatched quote stays a visible message', () => {
  const all=[msg('m1:1','A','something else entirely'),
             msg('r1:2','B',Q('X','a message that scrolled away'))];
  const {reg,hide}=fns.collect(all);
  assert.equal(reg.size,0);
  // The line stays visible either way now; what matters is that an
  // unmatched quote produces NO chip rather than a wrong one.
});
t('a reaction never targets another reaction', () => {
  const all=[msg('m1:1','A','ima need to get a 99k boost'),
             msg('r1:2','B',Q('X','ima need to get a 99k')),
             msg('r2:3','C',Q('Y','ima need to get a 99k'))];
  const {reg,hide}=fns.collect(all);
  assert.equal(reg.size,1);
  assert.equal(reg.get(all[0]).size,2,'both emoji land on the original');
});
t('an ordinary message with a quote in it is left alone', () => {
  const all=[msg('m1:1','A','he said "hello" to me')];
  const {reg,hide}=fns.collect(all);
  assert.equal(reg.size,0);
});
t('the most RECENT preceding match wins when text repeats', () => {
  const all=[msg('m1:1','A','same text here'),
             msg('m2:2','B','same text here'),
             msg('r1:3','C',Q('X','same text here'))];
  const {reg,hide}=fns.collect(all);
  assert.ok(reg.has(all[1]), 'should attach to the nearer one');
});

console.log('\nchannel scoping — faction and a PM open at once:');
t('a reaction NEVER attaches across channels', () => {
  // The same words in two windows. Without scoping, the PM reaction walks
  // back past its own channel and lands on the faction message.
  const all=[msg('f1:1','A','can i do med out partner','faction'),
             msg('p1:2','B','can i do med out partner','pm'),
             msg('r1:3','C','X "can i do med out partner"','pm')];
  const {reg,hide}=fns.collect(all);
  assert.equal(reg.size,1);
  assert.ok(reg.has(all[1]), 'must land on the PM message, not the faction one');
});
t('and the faction reaction stays in faction', () => {
  const all=[msg('p1:1','A','same words here','pm'),
             msg('f1:2','B','same words here','faction'),
             msg('r1:3','C','X "same words here"','faction')];
  const {reg,hide}=fns.collect(all);
  assert.ok(reg.has(all[1]));
});
t('a reaction with no match in its OWN channel fails open', () => {
  const all=[msg('f1:1','A','only in faction','faction'),
             msg('r1:2','B','X "only in faction"','pm')];
  const {reg,hide}=fns.collect(all);
  assert.equal(reg.size,0,'must not reach into the other channel');
});


console.log('\nprivate conversations — no message id exists at all:');
t('reactions work with id === null throughout', () => {
  // A PM bubble carries no uuid. The quote is what matches; the id was only
  // ever a map key, and the map is rebuilt from the DOM every pass.
  const all=[{id:null,sender:'Them',text:'hey there, how are you doing?',win:'pm',bubble:null,row:{style:{}}},
             {id:null,sender:'You', text:'X "hey there, how are you doing?"',win:'pm',bubble:null,row:{style:{}}}];
  const {reg,hide}=fns.collect(all);
  assert.equal(reg.size,1,'a null id must not collapse every message into one bucket');
  assert.ok(reg.has(all[0]));
});
t('two ID-LESS messages stay distinct', () => {
  // Keying by id would have merged these, since both ids are null.
  const all=[{id:null,sender:'Them',text:'first message here',win:'pm',bubble:null,row:{style:{}}},
             {id:null,sender:'Them',text:'second message here',win:'pm',bubble:null,row:{style:{}}},
             {id:null,sender:'You', text:'X "first message here"',win:'pm',bubble:null,row:{style:{}}},
             {id:null,sender:'You', text:'Y "second message here"',win:'pm',bubble:null,row:{style:{}}}];
  const {reg,hide}=fns.collect(all);
  assert.equal(reg.size,2,'two separate targets, not one');
  assert.equal(reg.get(all[0]).has('X'),true);
  assert.equal(reg.get(all[1]).has('Y'),true);
});


console.log('\nhiding — never the newest message:');
// display:none on the NEWEST virtualItem row fights the virtualiser's
// scroll-to-bottom AND stops Torn marking it read. Older rows drive neither.
const newestOf = (all, hide) => {
  const newest = new Map();
  for (const m of all) newest.set(m.win, m);
  return hide.filter((m) => newest.get(m.win) !== m);
};
t('a reaction that is the LAST message is left visible', () => {
  const all=[msg('m1:1','A','ima need to get a 99k boost'),
             msg('r1:2','B','X "ima need to get a 99k"')];
  const {hide}=fns.collect(all);
  assert.equal(hide.length,1,'it is still a reaction');
  assert.equal(newestOf(all,hide).length,0,'but must NOT be hidden');
});
t('once another message arrives, it is hidden', () => {
  const all=[msg('m1:1','A','ima need to get a 99k boost'),
             msg('r1:2','B','X "ima need to get a 99k"'),
             msg('m2:3','C','anything after it')];
  const {hide}=fns.collect(all);
  assert.equal(newestOf(all,hide).length,1,'no longer newest, so hide it');
});
t('newest is per CHANNEL, not global', () => {
  // A later message in ANOTHER channel must not make a faction reaction
  // hideable: it is still the newest thing in faction, so hiding it would
  // fight that channel's scroll and its unread badge.
  const all=[msg('f1:1','A','faction message','faction'),
             msg('fr:2','B','X "faction message"','faction'),
             msg('p1:3','C','a later PM','pm')];
  const {hide}=fns.collect(all);
  assert.equal(newestOf(all,hide).length,0,'still newest in faction -> stays visible');
});

t('and a later message in the SAME channel does make it hideable', () => {
  const all=[msg('f1:1','A','faction message','faction'),
             msg('fr:2','B','X "faction message"','faction'),
             msg('f2:3','C','a later faction message','faction'),
             msg('p1:4','D','a PM too','pm')];
  const {hide}=fns.collect(all);
  assert.equal(newestOf(all,hide).length,1);
});


console.log('\nchips must survive the virtual list recycling their reaction line:');

t('a chip persists after its reaction line scrolls out of the window', () => {
  const target = msg('m1:1','A','ima need to get a 99k boost');
  const react  = msg('r1:2','B','X "ima need to get a 99k"');
  fns.collect([target, react]);
  // Pass 2: the virtualiser recycled the reaction row away, the target is
  // still on screen. Before the durable store this dropped the chip, and
  // scrolling back brought it back -- chips popping in and out.
  fns.collect([target]);
  const still = fns.seen.get(fns.keyFor(target));
  assert.ok(still && still.get('X'), 'the chip must still be known');
  assert.equal(still.get('X').size, 1);
});

t('a message nobody reacted to still has nothing', () => {
  const plain = msg('m9:9','A','nobody reacted to this');
  fns.collect([plain]);
  assert.equal(fns.seen.get(fns.keyFor(plain)), undefined);
});

t('an id-less message with a NULL window does not throw', () => {
  // windowFor() returns null when it cannot find a composer, and
  // WeakMap.set(null) throws -- which used to take the whole pass down.
  const target = {id:null,sender:'Them',text:'hey there',win:null,bubble:null,row:{style:{}}};
  const react  = {id:null,sender:'You', text:'X "hey there"',win:null,bubble:null,row:{style:{}}};
  assert.doesNotThrow(() => fns.collect([target, react]));
  assert.ok(fns.seen.get(fns.keyFor(target)));
});


console.log('\na reaction whose target has scrolled out of the window:');

t('THE REPORTED CASE: it still resolves, so it is still hidden', () => {
  // Pass 1 renders the target. Pass 2 is after the virtualiser recycled it
  // away, leaving only the reaction on screen. Before the message index this
  // matched nothing, failed open, and sat in the chat as raw quoted text.
  const target = msg('m1:1','A','You can\'t do mine?');
  fns.collect([target]);
  const react = msg('r1:2','B','X "You can\'t do mine?"');
  const {hide} = fns.collect([react]);
  assert.equal(hide.length, 1, 'resolved from the index, so hideable');
  assert.ok(fns.seen.get(fns.keyFor(target)), 'and the chip is recorded');
});

t('a fragment never seen at all still stays visible', () => {
  // The fail-open rule survives: only messages we have actually rendered can
  // be matched, so a hand-typed quote is never swallowed.
  const {hide} = fns.collect([msg('r1:1','B','X "something nobody ever said"')]);
  assert.equal(hide.length, 0);
});

t('the index does not match across channels', () => {
  fns.collect([msg('f1:1','A','same words here','faction')]);
  const {hide} = fns.collect([msg('r1:2','B','X "same words here"','pm')]);
  assert.equal(hide.length, 0, 'a faction message must not resolve a PM reaction');
});

t('a reaction is never itself indexed as a target', () => {
  fns.collect([msg('r1:1','A','X "the original"')]);
  const {hide} = fns.collect([msg('r2:2','B','Y "the original"')]);
  assert.equal(hide.length, 0, 'the only candidate was a reaction, so no match');
});

console.log('\nbubbleText — the chip strip must not become part of the message:');
// Minimal stand-ins for the only DOM surface bubbleText touches.
const tnode = (s) => ({ nodeType: 3, textContent: s });
const enode = (cls, text) => ({ nodeType: 1, textContent: text,
  classList: { contains: (c) => String(cls).split(' ').includes(c) } });

t('a PM bubble reads its own text, not the chips hanging off it', () => {
  const chips = enode('tcr-chips', '\u{1F480} 2\u{1F525}');
  const bubble = { childNodes: [tnode('Clarifying, not an issue'), chips] };
  assert.equal(fns.bubbleText(bubble, null), 'Clarifying, not an issue');
});
t('THE SILENT ONE: a PM key is its text, so chips must not change it', () => {
  // The strip lives inside the bubble now. If its emoji leaked into the text,
  // every reaction would rewrite the key of the message it decorates and the
  // chip would detach from its own target on the very next pass.
  const plain  = { childNodes: [tnode('ima need to get a 99k')] };
  const reacted = { childNodes: [tnode('ima need to get a 99k'),
                                 enode('tcr-chips', '\u{1F44D} 3')] };
  const before = fns.keyFor({ id:null, win:'pm', text: fns.bubbleText(plain, null) });
  const after  = fns.keyFor({ id:null, win:'pm', text: fns.bubbleText(reacted, null) });
  assert.equal(after, before, 'the key moved when a reaction was added');
});
t('a public bubble takes the inner message element and ignores the rest', () => {
  const bubble = { childNodes: [tnode('SenderName'), enode('tcr-chips', '\u{1F525}')] };
  assert.equal(fns.bubbleText(bubble, { textContent: '  the actual message  ' }), 'the actual message');
});

console.log('\nisSelf — a hyphen is a word boundary, which /\\bself___/ got wrong:');
t('the real PM wrapper is yours', () => {
  assert.equal(fns.isSelf('root___EWrZN self___DidgR'), true);
});
t('THE BUG: a hyphenated class is NOT yours', () => {
  // /\bself___/ matched this, because `-` counts as a word boundary. Reading
  // someone else's message as your own is the dangerous direction.
  assert.equal(fns.isSelf('position-self___hash'), false);
  assert.equal(fns.isSelf('align-self___x justify-self___y'), false);
});
t('a public wrapper is not yours', () => {
  assert.equal(fns.isSelf('root___EP_Dq first___icNlg'), false);
  assert.equal(fns.isSelf(''), false);
  assert.equal(fns.isSelf(null), false);
});

console.log('\nchannel identity — two unnameable windows must not share a bucket:');
const pm = (text, chan) => ({ id:null, sender:'Them', text, win:null, chan, bubble:null, row:{style:{}} });

t('THE BUG: two PMs with the same words used to collide', () => {
  // windowFor() returns null for a window with no composer, and null === null,
  // so every unnameable window shared one id and one keyspace.
  const a = pm('see you at 8', 'c:2862329');
  const b = pm('see you at 8', 'c:3189116');
  assert.notEqual(fns.keyFor(a), fns.keyFor(b), 'different conversations, same key');
});
t('the same conversation still shares a key', () => {
  assert.equal(fns.keyFor(pm('see you at 8', 'c:2862329')),
               fns.keyFor(pm('see you at 8', 'c:2862329')));
});
t('a reaction cannot find its target in another PM', () => {
  const {hide} = fns.collect([
    pm('see you at 8', 'c:2862329'),
    { ...pm('X "see you at 8"', 'c:3189116'), sender:'Other' },
  ]);
  assert.equal(hide.length, 0, 'matched across two different conversations');
});
t('with no channel id at all it still falls back rather than throwing', () => {
  const a = { id:null, sender:'Them', text:'hi', win:null, chan:null, bubble:null, row:{style:{}} };
  assert.ok(String(fns.keyFor(a)).endsWith('|hi'));
});

console.log('\nquickRow — the six slots follow what you actually use:');
// Fake GM store and a monotonic clock, so ordering is deterministic rather than
// depending on two sends landing in different milliseconds.
const mkQuick = () => {
  const store = {};
  let clock = 1000;
  return new Function('GM_getValue','GM_setValue','Date','QUICK_DEFAULT','QUICK_SLOTS','USE_KEY','USE_CAP',
    `${grab('function gmGet(')}
     ${grab('function gmSet(')}
     ${grab('function loadUse(')}
     ${grab('function noteUse(')}
     ${grab('function quickRow(')}
     return {loadUse, noteUse, quickRow};`
  )((k, d) => (k in store ? store[k] : d), (k, v) => { store[k] = v; },
    { now: () => ++clock }, ['d1','d2','d3','d4','d5','d6'], 6, 'tcr-emoji-use', 40);
};

t('a fresh install shows the defaults', () => {
  const q = mkQuick();
  assert.deepEqual(q.quickRow(), ['d1','d2','d3','d4','d5','d6']);
});
t('something used once appears, and the row stays six long', () => {
  const q = mkQuick();
  q.noteUse('\u{1F680}');
  const row = q.quickRow();
  assert.ok(row.includes('\u{1F680}'), 'the emoji just used is not on the row');
  assert.equal(row.length, 6);
});
t('ranked by use count, most used first', () => {
  const q = mkQuick();
  for (let i = 0; i < 5; i++) q.noteUse('A');
  for (let i = 0; i < 3; i++) q.noteUse('B');
  q.noteUse('C');
  const row = q.quickRow();
  assert.equal(row[0], 'A');
  assert.equal(row[1], 'B');
});
t('THE POINT: a brand new emoji shows up WITHOUT out-ranking the regulars', () => {
  const q = mkQuick();
  // Six well-established favourites.
  const reg = ['A','B','C','D','E','F'];
  reg.forEach((e, i) => { for (let n = 0; n < 10 - i; n++) q.noteUse(e); });
  assert.deepEqual(q.quickRow(), reg, 'precondition: the row is full of regulars');
  // One use of something new has to be enough to reach the row.
  q.noteUse('\u{1F984}');
  const row = q.quickRow();
  assert.ok(row.includes('\u{1F984}'), 'a newly used emoji never reached the row');
  assert.equal(row.length, 6);
  assert.equal(row[0], 'A', 'it must not disturb the top of the row');
});
t('the stored map stays bounded', () => {
  const q = mkQuick();
  for (let i = 0; i < 60; i++) q.noteUse('e' + i);
  assert.ok(Object.keys(q.loadUse()).length <= 40, 'use map grew past its cap');
});
t('corrupt storage degrades to the defaults instead of throwing', () => {
  const q = mkQuick();
  q.noteUse('A');
  // Simulate a half-written value.
  const broken = new Function('GM_getValue','GM_setValue','Date','QUICK_DEFAULT','QUICK_SLOTS','USE_KEY','USE_CAP',
    `${grab('function gmGet(')}
     ${grab('function gmSet(')}
     ${grab('function loadUse(')}
     ${grab('function quickRow(')}
     return {quickRow};`)(() => '{not json', () => {}, Date, ['d1','d2','d3','d4','d5','d6'], 6, 'k', 40);
  assert.deepEqual(broken.quickRow(), ['d1','d2','d3','d4','d5','d6']);
});

console.log('\nwindowFor — a composer must belong to the message\'s own channel:');
// Minimal DOM shim: just enough for chatRoot(), channelOf() and windowFor().
// `flat` models channel boxes as direct children of #chatRoot; `wrapped` puts a
// wrapper in between, which is the layout that defeats a root-bail fix.
const mkDom = (wrapped) => {
  const mkEl = (id, kids) => {
    const el = {
      id: id || '', className: '', children: kids || [], parentElement: null,
      querySelectorAll(sel) {
        const out = [];
        (function walk(n) {
          for (const c of n.children) {
            if (c.isTextarea && /textarea/.test(sel)) out.push(c);
            walk(c);
          }
        })(el);
        return out;
      },
    };
    for (const k of (kids || [])) k.parentElement = el;
    return el;
  };
  const ta = { isTextarea: true, id: '', className: '', children: [], parentElement: null,
               querySelectorAll: () => [] };
  const facBubble = mkEl('', []);
  const facBox = mkEl('faction', [facBubble, ta]);
  const pmBubble = mkEl('', []);
  const pmBox = mkEl('2862329', [pmBubble]);          // collapsed: no composer
  const root = wrapped
    ? mkEl('chatRoot', [mkEl('', [facBox, pmBox])])
    : mkEl('chatRoot', [facBox, pmBox]);
  const document = { body: {}, getElementById: (x) => (x === 'chatRoot' ? root : null) };
  const fns = new Function('document',
    `${grab('function chatRoot(')}
     ${grab('function channelOf(')}
     ${grab('function windowFor(')}
     return {chatRoot, channelOf, windowFor};`)(document);
  return { fns, facBubble, pmBubble, ta };
};

for (const wrapped of [false, true]) {
  const label = wrapped ? 'boxes under a WRAPPER' : 'boxes DIRECT under #chatRoot';
  t(`the open channel still resolves its own composer (${label})`, () => {
    const d = mkDom(wrapped);
    const w = d.fns.windowFor(d.facBubble);
    assert.ok(w, 'the open channel lost its composer');
    assert.equal(w.ta, d.ta);
  });
  t(`THE LEAK: a collapsed channel must NOT borrow it (${label})`, () => {
    // Before this, windowFor walked past the composer-less PM box and handed
    // back the faction composer -- so reacting to a private message would have
    // typed a quote of it into faction chat.
    const d = mkDom(wrapped);
    assert.equal(d.fns.windowFor(d.pmBubble), null,
      'a collapsed channel was handed another channel\'s composer');
  });
}
t('channelOf names each box, and differs between them', () => {
  const d = mkDom(false);
  assert.equal(d.fns.channelOf(d.facBubble), 'c:faction');
  assert.equal(d.fns.channelOf(d.pmBubble), 'c:2862329');
});

console.log(f?`\n${f} FAILED`:'\nall passed');
