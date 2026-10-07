#!/usr/bin/env node
// Fire one real notification at a player, through the same path a war
// alert takes, and report what each transport did.
//
// Exists because "the server sent it" and "the phone showed it" are
// different claims, and only the second one matters. Apple and FCM both
// return success for a token they will never deliver to, so the only
// proof is a human seeing a banner.
//
//   node tools/push-test.mjs 137558 bonus_imminent
//   node tools/push-test.mjs 137558 chain_alert
//
// The type is passed through to the preference gate, so this also tells
// you whether that type is switched off for the player.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

// Load .env the way server.js does — AFTER the chdir above, since dotenv
// resolves .env against the cwd at import time. A static import would be
// hoisted above the chdir and find nothing, which silently disables VAPID
// and APNs and makes a healthy server look broken.
await import('dotenv/config');

const playerId = String(process.argv[2] || '').trim();
const type = String(process.argv[3] || 'bonus_imminent').trim();

if (!playerId) {
  console.error('usage: node tools/push-test.mjs <playerId> [notifType]');
  process.exit(1);
}

const push = await import('../push-notifications.js');

// The web-push store is populated by server.js at boot, not at import, so a
// standalone process sees an empty map until this is called. Without it the
// web channel silently reports "no devices" for everyone.
push.loadSubscriptions();

const fcm = await import('../fcm-subscriptions.js').catch(() => null);
const devices = fcm ? fcm.listForPlayer(playerId) : [];

console.log(`player ${playerId} — type ${type}`);
console.log(`  web push  : ${push.isSubscribed(playerId) ? 'subscribed' : 'no devices'}`);
console.log(`  app tokens: ${devices.length}`
  + (devices.length ? ` (${devices.map((d) => d.platform).join(', ')})` : ''));
console.log(`  in audience: ${push.hasAnyPushChannel(playerId)}`);

if (!push.hasAnyPushChannel(playerId)) {
  console.log('\nNot reachable on any transport — nothing to send.');
  process.exit(0);
}

await push.sendToPlayer(playerId, {
  title: '💥 Bonus Hit Imminent',
  body: `TEST — this is what a ${type} alert looks like.`,
  tag: 'push-test',
  icon: '/icon-192.png',
  data: { type: 'bonus', test: '1' },
}, type);

// sendToPlayer deliberately does not await the native fan-out (a slow APNs
// round-trip must not hold up a chain alert), so give it time to land
// before the process exits and kills the in-flight request.
await new Promise((r) => setTimeout(r, 4000));

console.log('\nSent. If no banner arrives, the gap is on the device:');
console.log('  - notification permission for the warboard app');
console.log('  - a Focus mode or per-app notification setting');
console.log('  - a stale token from an app build no longer installed');
process.exit(0);
