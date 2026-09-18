// How long a call lasts, and the fact that only one file decides.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CALL_EXPIRE_MS, DEAL_EXPIRE_MS, expiryFor } from "./call-timings.js";

test("the defaults are twenty minutes and two hours", () => {
  // No .env is loaded in a test process, so these are the fallbacks — what a
  // fresh deploy without an environment file would use.
  assert.equal(CALL_EXPIRE_MS, 20 * 60 * 1000);
  assert.equal(DEAL_EXPIRE_MS, 2 * 60 * 60 * 1000);
});

test("a deal gets the long window and a plain call does not", () => {
  assert.equal(expiryFor({ isDeal: true }), DEAL_EXPIRE_MS);
  assert.equal(expiryFor({ isDeal: false }), CALL_EXPIRE_MS);
  assert.equal(expiryFor({}), CALL_EXPIRE_MS);
  // A missing call is a plain one rather than a crash.
  assert.equal(expiryFor(null), CALL_EXPIRE_MS);
  assert.equal(expiryFor(undefined), CALL_EXPIRE_MS);
});

// ── One place, and it stays one place ──────────────────────────
// These lived in routes.js AND socket-handlers.js as the same expression typed
// twice. That is how the last bug survived: the userscript said fifteen
// minutes, the server enforced five, and the number a reader looked at was
// never the number in effect. A second copy is a second chance to update one
// of them.

const files = ["routes.js", "socket-handlers.js"].map((f) => ({
  name: f, src: fs.readFileSync(new URL("./" + f, import.meta.url), "utf8"),
}));

test("no other file declares a call window of its own", () => {
  for (const f of files) {
    assert.ok(!/^\s*(const|let|var)\s+CALL_EXPIRE_MS\s*=/m.test(f.src),
      f.name + " declares CALL_EXPIRE_MS again");
    assert.ok(!/^\s*(const|let|var)\s+DEAL_EXPIRE_MS\s*=/m.test(f.src),
      f.name + " declares DEAL_EXPIRE_MS again");
  }
});

test("both paths take it from the shared module", () => {
  // The HTTP path and the websocket path both place calls, and they have to
  // agree — a call placed over one and expired by the other must last the same
  // time.
  for (const f of files) {
    assert.match(f.src, /import \{[^}]*CALL_EXPIRE_MS[^}]*\} from "\.\/call-timings\.js"/,
      f.name + " does not import the shared window");
  }
});

test("the environment still wins over the default", () => {
  // The running server reads .env through dotenv; these defaults are only the
  // fallback. Losing that would silently pin production to whatever is checked
  // in.
  const src = fs.readFileSync(new URL("./call-timings.js", import.meta.url), "utf8");
  assert.match(src, /process\.env\[name\]/);
  assert.match(src, /CALL_EXPIRE_MS"/);
  assert.match(src, /DEAL_EXPIRE_MS"/);
});
