// What does /api/auth actually return for a given player's key?
//
// A refusal test: it sends the key to our OWN auth endpoint and prints the
// status and message. It reads nothing from Torn beyond what auth already
// verifies, and the expected outcome is 403.
//
//   node tools/auth-probe.mjs <playerId>
import * as store from '../store.js';

const id = String(process.argv[2] || '').trim();
if (!/^\d+$/.test(id)) { console.log('usage: node tools/auth-probe.mjs <playerId>'); process.exit(1); }

store.loadPlayerKeys();
const key = store.getApiKeyForPlayer(id);
if (!key) { console.log('no key stored for ' + id); process.exit(0); }
console.log('using stored key for ' + id + ' (len ' + key.length + ', last4 ' + key.slice(-4) + ')');

const r = await fetch('https://tornwar.com/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiKey: key, scriptVersion: '5.5.3' }),
});
const body = await r.text();
console.log('HTTP   :', r.status);
console.log('body   :', body.slice(0, 400));
console.log('verdict:', r.status === 403 ? 'REFUSED — gate holds'
          : r.status === 200 ? '*** ACCEPTED — gate failed ***'
          : 'unexpected (' + r.status + ')');
