import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { playerKey, imageKind, MAX_BYTES } from './showdown-card-upload.js';

// ── which file a card id is allowed to write ────────────────────────────────
//
// The id arrives from the browser and becomes a FILENAME, so this is the only
// thing standing between an open endpoint and an arbitrary write. It answers
// with a bare key or null; the caller has nothing to sanitise afterwards.

test('takes the player key from a card id', () => {
  assert.equal(playerKey('freehbi01-1974-EXPANDED'), 'freehbi01');
});

test('accepts an id with no season suffix', () => {
  assert.equal(playerKey('bondsba01'), 'bondsba01');
});

test('refuses a traversal attempt', () => {
  assert.equal(playerKey('../../etc/passwd'), null);
  assert.equal(playerKey('..'), null);
  assert.equal(playerKey('a/b'), null);
});

test('refuses a key carrying its own extension', () => {
  // ".png" is appended by the caller; a dot here would make foo.php.png or,
  // worse on a mis-set server, foo.php.
  assert.equal(playerKey('evil.php-2001'), null);
});

test('refuses upper case, so one card can never claim two files', () => {
  assert.equal(playerKey('Freehbi01-1974'), null);
});

test('refuses an empty or absurd key', () => {
  assert.equal(playerKey(''), null);
  assert.equal(playerKey('-1974'), null);
  assert.equal(playerKey('a'), null);
  assert.equal(playerKey('a'.repeat(40)), null);
  assert.equal(playerKey(null), null);
  assert.equal(playerKey({ toString: () => '../x' }), null);
});

test('refuses a key that is all digits', () => {
  // bref ids are always letters-then-digits; a bare number is somebody
  // probing, not a card.
  assert.equal(playerKey('12345'), null);
});

// ── what the bytes actually are ─────────────────────────────────────────────
//
// Content-Type is whatever the client claims. The magic bytes are not.

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

test('recognises a real PNG', () => {
  assert.equal(imageKind(PNG), 'png');
});

test('recognises a real JPEG', () => {
  assert.equal(imageKind(JPG), 'jpeg');
});

test('refuses HTML wearing an image content-type', () => {
  assert.equal(imageKind(Buffer.from('<script>alert(1)</script>')), null);
});

test('refuses an SVG, which is a document that executes', () => {
  assert.equal(imageKind(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')), null);
});

test('refuses a truncated header', () => {
  assert.equal(imageKind(Buffer.from([0x89, 0x50])), null);
  assert.equal(imageKind(Buffer.alloc(0)), null);
  assert.equal(imageKind(null), null);
});

test('the size cap is a real number and not generous', () => {
  assert.ok(MAX_BYTES > 0 && MAX_BYTES <= 4 * 1024 * 1024);
});

// ── the year-first ids, which is what this module got wrong ────────────────

test('skips a leading year to find the player', () => {
  assert.equal(playerKey('1999-martipe02-1999-2000'), 'martipe02');
});

test('skips several years and an upper-case tag', () => {
  assert.equal(playerKey('1999-2000-evereca01-DATES-1999-2000-2000'), 'evereca01');
});

test('two players from the same season never share a file', () => {
  assert.notEqual(playerKey('1999-walkela01-1999-2000'), playerKey('1999-gilesbr02-1999-2000'));
});

test('accepts the period, apostrophe and underscore that real ids use', () => {
  assert.equal(playerKey('1999-drewj.01-1999-2000'), 'drewj.01');
  assert.equal(playerKey("1999-o'leatr01-1999-2000"), "o'leatr01");
  assert.equal(playerKey('washiu_01-1982-EXPANDED'), 'washiu_01');
});

// ── the two implementations must agree ─────────────────────────────────────

test('every slot the client publishes is one this module accepts', () => {
  // The client generates card-ids.json with ITS rule and probes with ITS
  // rule; this module decides what gets written. If they disagree, uploads
  // land at a path the page never asks for and the feature silently does
  // nothing. Checked against the deployed file, not a fixture.
  const path = '/opt/warboard/server/public/showdown/card-ids.json';
  if (!existsSync(path)) return;                     // not deployed here; nothing to pin
  const keys = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(keys.length > 3000, `expected the full slot list, got ${keys.length}`);
  const rejected = keys.filter((k) => playerKey(k) !== k);
  assert.deepEqual(rejected.slice(0, 5), [], `${rejected.length} published slots are unwritable`);
});
