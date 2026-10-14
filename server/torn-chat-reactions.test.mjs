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
  const SEEN_CAP = 800;
  const winIds = new WeakMap();
  const winOther = new Map();
  let winSeq = 0;
`;
const mkFns = () => new Function('REACTION','QUOTE_LEN',
  `${PRELUDE}
   ${grab('function keyFor(')}
   ${grab('function remember(')}
   ${grab('function quoteFor(')}
   ${grab('function collect(')}
   return {quoteFor, collect, keyFor, seen};`)(REACTION,QUOTE_LEN);
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

console.log(f?`\n${f} FAILED`:'\nall passed');
