// Accepting a card image for the Showdown game.
//
// The app ships no artwork — the rendered cards carry licensed player
// photography — so a card you have no image for falls back to a drawn face.
// This lets somebody supply the missing image from the phone they are playing
// on, instead of needing shell access to drop a file in public/showdown/cards.
//
// The endpoint is deliberately OPEN, which the owner chose knowing the
// trade-off, so every constraint that would normally be carried by an auth
// check has to be carried here instead:
//
//   - the id becomes a FILENAME, so it is matched against one strict pattern
//     and rejected otherwise — never escaped, never cleaned up
//   - the id must name a card that actually exists in the shipped pool, so
//     the write surface is a fixed set of ~6,000 slots and not the disk
//   - a slot that already has an image is never overwritten, so the worst
//     case is filling an empty slot, not defacing a filled one
//   - Content-Type is a claim; the magic bytes decide what is written
//
// SVG is refused on purpose despite being an image: it is a document that
// executes script, and these are served from the same origin as the game.

/** 3 MB. A card render is ~200 KB; this is loose enough not to annoy. */
export const MAX_BYTES = 3 * 1024 * 1024;

/**
 * A baseball-reference id: letters, then a two-digit ordinal.
 *
 * MUST stay in step with playerKeyOf() in the Showdown client
 * (showdown/cardkey.mjs) — the client decides which filename it PROBES for,
 * this decides which filename gets WRITTEN, and a disagreement stores art at
 * a path the page never asks for. The test file pins both against the real
 * card-ids.json, so drift fails a test rather than going unnoticed.
 *
 * Period, apostrophe and underscore are real: `drewj.01`, `o'leatr01`,
 * `washiu_01`. None can escape the directory — the key must begin with a
 * letter and end in two digits, so `..` and `.` are unmatchable and no
 * segment containing a slash can match at all.
 */
const BREF = /^[a-z][a-z._']{1,12}[0-9]{2}$/;

/**
 * The file a card id may write, or null.
 *
 * Art is per PLAYER, not per season, so the key is the segment that names the
 * player. NOT simply the first segment: every printed card is `1999-martipe02
 * -1999-2000`, and reading segment zero collapsed all 3,742 of them onto one
 * key per year.
 */
export function playerKey(cardId) {
  if (typeof cardId !== 'string') return null;
  return cardId.split('-').find((seg) => BREF.test(seg)) || null;
}

/** PNG and JPEG, by signature. Anything else is not written. */
export function imageKind(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e
      && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a
      && buf[6] === 0x1a && buf[7] === 0x0a) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  return null;
}
