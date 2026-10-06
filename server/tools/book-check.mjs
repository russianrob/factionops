// Is a given player reading a book?
//
// Torn only reveals the "Reading Book" icon to the player themselves, so this
// has to go out under THAT player's own key. It prints the book line and
// nothing else -- never the key.
//
//   node tools/book-check.mjs <playerId>
import * as store from '../store.js';

const id = String(process.argv[2] || '').trim();
if (!/^\d+$/.test(id)) { console.log('usage: node tools/book-check.mjs <playerId>'); process.exit(1); }

// The key Map is populated at server startup, not on import. A standalone
// process sees an empty Map and reports "no key stored" for everybody, which
// reads exactly like a member who never shared one.
store.loadPlayerKeys();

const key = store.getApiKeyForPlayer(id);
if (!key) { console.log('no key stored for ' + id); process.exit(0); }

const url = 'https://api.torn.com/user/?selections=icons&key='
  + encodeURIComponent(key) + '&comment=wb-book';
const d = await (await fetch(url)).json();

if (d.error) { console.log('API error:', JSON.stringify(d.error)); process.exit(0); }

const icons = Object.values(d.icons || {});
const books = icons.filter((v) => String(v).toLowerCase().includes('reading book'));

// The icon COUNT is the tell. The private set runs to a dozen or so; a public
// or minimal key returns only 5-6, and then "no book" means "not allowed to
// see" rather than "not reading" -- which is the whole trap here.
console.log('name   :', d.name || '(unknown)');
console.log('icons  :', icons.length, icons.length <= 7
  ? '  <-- LOW-ACCESS KEY: this cannot answer the question'
  : '  (private set -- the answer below is real)');
console.log('book   :', books.length ? books.join(' | ') : 'not reading a book');
