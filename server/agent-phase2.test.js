// agent-phase2.test.js — Phase 2 (propose → confirm → deploy) unit coverage.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseProposal, userscriptContext, isValidUserscriptName } from "./agent-service.js";

// ── parseProposal ────────────────────────────────────────────────────────
test("parseProposal extracts filename + fenced content", () => {
  const body = "// ==UserScript==\n// @version 1.0.1\nconsole.log('hi');\n";
  const txt = "Sure, here's the fix.\n\n===FILE: torn-green-nav.user.js===\n```js\n" + body + "```\n";
  const p = parseProposal(txt);
  assert.equal(p.filename, "torn-green-nav.user.js");
  assert.equal(p.content, body.replace(/\n$/, "")); // trailing newline before fence is dropped
  assert.ok(p.content.includes("console.log('hi');"));
});

test("parseProposal returns null when there is no proposal", () => {
  assert.equal(parseProposal("just a normal answer, no file block"), null);
  assert.equal(parseProposal("```js\nvar x=1;\n```"), null); // fence but no ===FILE:=== marker
  assert.equal(parseProposal(""), null);
  assert.equal(parseProposal(null), null);
});

test("parseProposal picks the LAST proposal when several are present", () => {
  const txt =
    "===FILE: first.user.js===\n```\nAAA\n```\n" +
    "some chatter\n" +
    "===FILE: second.user.js===\n```js\nBBB\n```\n";
  const p = parseProposal(txt);
  assert.equal(p.filename, "second.user.js");
  assert.equal(p.content, "BBB");
});

test("parseProposal reduces the filename to a bare basename", () => {
  const p = parseProposal("===FILE: ../../etc/torn-x.user.js===\n```\nZZZ\n```");
  assert.equal(p.filename, "torn-x.user.js");
});

// ── userscriptContext ────────────────────────────────────────────────────
function mockScriptsDir() {
  const dir = mkdtempSync(join(tmpdir(), "wb-scripts-"));
  writeFileSync(join(dir, "torn-foo.user.js"),
    "// ==UserScript==\n// @name Torn Foo\n// @version 2.3.4\n// ==/UserScript==\nUNIQUE_FOO_MARKER();\n");
  writeFileSync(join(dir, "torn-bar.user.js"),
    "// ==UserScript==\n// @name Torn Bar\n// @version 0.9.1\n// ==/UserScript==\nUNIQUE_BAR_MARKER();\n");
  writeFileSync(join(dir, "notes.txt"), "ignore me"); // non-userscript is skipped
  return dir;
}

test("userscriptContext lists every *.user.js with @name + @version", () => {
  const dir = mockScriptsDir();
  try {
    const out = userscriptContext("hello", dir);
    assert.match(out, /userscripts on the Warboard server \(2\)/);
    assert.match(out, /torn-foo\.user\.js — Torn Foo \(v2\.3\.4\)/);
    assert.match(out, /torn-bar\.user\.js — Torn Bar \(v0\.9\.1\)/);
    assert.doesNotMatch(out, /notes\.txt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("userscriptContext injects FULL source only for a NAMED script", () => {
  const dir = mockScriptsDir();
  try {
    // Name torn-foo by its basename (no .user.js) — should inline its body only.
    const out = userscriptContext("please fix torn-foo for me", dir);
    assert.match(out, /=== FULL SOURCE: torn-foo\.user\.js ===/);
    assert.match(out, /UNIQUE_FOO_MARKER/);
    assert.doesNotMatch(out, /UNIQUE_BAR_MARKER/); // un-named script body stays out
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("userscriptContext injects nothing full when no script is named", () => {
  const dir = mockScriptsDir();
  try {
    const out = userscriptContext("general question about Torn", dir);
    assert.doesNotMatch(out, /FULL SOURCE/);
    assert.doesNotMatch(out, /UNIQUE_FOO_MARKER/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("userscriptContext matches the full filename too", () => {
  const dir = mockScriptsDir();
  try {
    const out = userscriptContext("torn-bar.user.js is broken", dir);
    assert.match(out, /=== FULL SOURCE: torn-bar\.user\.js ===/);
    assert.match(out, /UNIQUE_BAR_MARKER/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── isValidUserscriptName (deploy filename jail) ─────────────────────────
test("isValidUserscriptName rejects traversal / non-userscript names", () => {
  for (const bad of ["../x", "../x.user.js", "/etc/passwd", "foo.js", "a/b.user.js",
                     "torn.user.js/../x.user.js", "", "torn.user.js\n", "torn user.js"]) {
    assert.equal(isValidUserscriptName(bad), false, "should reject: " + JSON.stringify(bad));
  }
});

test("isValidUserscriptName accepts a bare *.user.js basename", () => {
  for (const ok of ["torn-dual-flyout.user.js", "oc_reward-values.user.js", "a.user.js", "torn.green.nav.user.js"]) {
    assert.equal(isValidUserscriptName(ok), true, "should accept: " + JSON.stringify(ok));
  }
});

// ── userscriptContext: installed-manifest branch ─────────────────────────
test("userscriptContext: manifest lists the real installed set with accurate count", () => {
  const manifest = [
    { filename: "a.user.js", name: "Alpha", version: "1.2", enabled: true, source: "// SRC-A" },
    { filename: "b.user.js", name: "Beta", version: "0.9", enabled: false, source: "// SRC-B" },
  ];
  const out = userscriptContext("hello", manifest);
  assert.match(out, /installed userscripts \(2\)/i);
  assert.match(out, /- a\.user\.js — Alpha \(v1\.2\)/);
  assert.match(out, /- b\.user\.js — Beta \(v0\.9\) \[disabled\]/);
  assert.ok(!out.includes("SRC-A"), "source not injected unless named");
});

test("userscriptContext: injects full source only for a named script", () => {
  const manifest = [{ filename: "a.user.js", name: "Alpha", version: "1", enabled: true, source: "// SRC-A" }];
  const out = userscriptContext("please edit a.user.js", manifest);
  assert.match(out, /=== FULL SOURCE: a\.user\.js ===/);
  assert.ok(out.includes("// SRC-A"));
});

test("userscriptContext: empty/absent manifest falls back to the served directory header", () => {
  const out = userscriptContext("hi", []);          // empty array => fallback
  assert.match(out, /on the Warboard server|no userscripts found|unavailable/i);
});
