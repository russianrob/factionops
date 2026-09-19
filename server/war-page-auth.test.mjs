// Getting back to the sign-in form when a token expires.
//
// Two faction members opened tornwar.com/war and were told "Invalid or expired
// token" with no way to sign in again. Both pages have a sign-in form and both
// have a recovery path that clears the stale token and shows it — the recovery
// just never ran.
//
// The fetch helper throws `new Error(j.error || 'HTTP ' + r.status)`, and the
// server's 401 body is {"error":"Invalid or expired token"}. So the message is
// that sentence, containing neither "401" nor "403", while the recovery asked:
//
//     if (/401|403/.test(e.message)) { setTok(''); boot(); return; }
//
// An HTTP status is a number on the response, not a substring of prose. The
// helper carries it on the error now and the recovery reads it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./routes.js", import.meta.url), "utf8");

/** Pull one inline page template out of routes.js. */
function page(name) {
  const i = SRC.indexOf("const " + name + " = `");
  assert.ok(i >= 0, "no such page template: " + name);
  const start = SRC.indexOf("`", i) + 1;
  let j = start;
  while (j < SRC.length) {
    if (SRC[j] === "\\") { j += 2; continue; }
    if (SRC[j] === "`") break;
    j++;
  }
  return SRC.slice(start, j);
}
/** A named function out of a page's inline script. */
function pageFn(html, name) {
  const i = html.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in that page: " + name);
  // The body's brace, NOT the first one — `function api(path,{method}={})`
  // opens a brace inside its own parameter list, and matching from there
  // returns the signature and nothing else.
  let p = html.indexOf("(", i), depth = 0, k = p;
  for (; k < html.length; k++) {
    if (html[k] === "(") depth++;
    else if (html[k] === ")" && --depth === 0) break;
  }
  const o = html.indexOf("{", k);
  let d = 0;
  for (let k = o; k < html.length; k++) {
    if (html[k] === "{") d++;
    else if (html[k] === "}" && --d === 0) return html.slice(i, k + 1);
  }
  throw new Error("unbalanced braces in " + name);
}

const PAGES = ["WAR_REPORT_HTML", "PAYOUTS_HTML"];

for (const name of PAGES) {
  const html = page(name);

  test(`${name}: an expired-token reply is recognised as an auth failure`, () => {
    const box = {};
    vm.createContext(box);
    vm.runInContext(pageFn(html, "isAuthError") + "\nglobalThis.isAuth = isAuthError;", box);
    // Exactly what the server sends: 401, and prose that names no number.
    const e = new Error("Invalid or expired token");
    e.status = 401;
    assert.equal(box.isAuth(e), true);
  });

  test(`${name}: a forbidden reply is too`, () => {
    const box = {};
    vm.createContext(box);
    vm.runInContext(pageFn(html, "isAuthError") + "\nglobalThis.isAuth = isAuthError;", box);
    const e = new Error("Admin role required");
    e.status = 403;
    assert.equal(box.isAuth(e), true);
  });

  test(`${name}: an ordinary failure does not wipe the token`, () => {
    // Signing the reader out on any error would be its own bug.
    const box = {};
    vm.createContext(box);
    vm.runInContext(pageFn(html, "isAuthError") + "\nglobalThis.isAuth = isAuthError;", box);
    const e = new Error("War not found");
    e.status = 404;
    assert.equal(box.isAuth(e), false);
    assert.equal(box.isAuth(new Error("Network request failed")), false);
    assert.equal(box.isAuth(null), false);
  });

  test(`${name}: the helper puts the status on the error`, () => {
    // Without this the predicate above has nothing to read.
    const api = pageFn(html, "api");
    assert.match(api, /status\s*=\s*r\.status/,
      "the response status must survive onto the error: " + api);
  });

  test(`${name}: recovery asks the predicate, not the prose`, () => {
    assert.ok(!/\/401\|403\/\.test\(e\.message\)/.test(html),
      "still matching an HTTP status against a sentence");
    assert.match(html, /isAuthError\(e\)/, "recovery must go through the predicate");
  });
}
