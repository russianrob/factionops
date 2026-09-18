// How long a call on a target lasts.
//
// These were declared in two files — routes.js for the HTTP path and
// socket-handlers.js for the websocket one — with the same expression copied
// into both. That duplication is how the last bug happened: the userscript
// said calls lasted fifteen minutes, the server enforced five, and nobody
// noticed because the number a reader was looking at was never the number in
// effect. Two copies of a rule is two chances to update one of them.
//
// The environment wins over these defaults, because that is what the running
// server actually reads (server.js does `import "dotenv/config"`). The defaults
// exist so a fresh deploy without a .env behaves the same way.

/** Read a positive integer from the environment, or fall back. */
function envMs(name, fallback) {
  const raw = parseInt(process.env[name], 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * A regular call. Twenty minutes: long enough to line up a hit without the
 * target reading as free while somebody is still on their way to it.
 */
export const CALL_EXPIRE_MS = envMs("CALL_EXPIRE_MS", 20 * 60 * 1000);

/**
 * A multi-hit deal call. Two hours, so a cross-faction agreement does not
 * lapse mid-negotiation.
 */
export const DEAL_EXPIRE_MS = envMs("DEAL_EXPIRE_MS", 2 * 60 * 60 * 1000);

/** What a given call is worth in milliseconds, deal or not. */
export function expiryFor(call) {
  return call && call.isDeal ? DEAL_EXPIRE_MS : CALL_EXPIRE_MS;
}
