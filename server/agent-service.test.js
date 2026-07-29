// agent-service.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStreamLine } from "./agent-service.js";

test("captures session id from system/init", () => {
  const e = normalizeStreamLine({ type: "system", subtype: "init", session_id: "abc" });
  assert.deepEqual(e, { t: "session", id: "abc" });
});

test("maps a text_delta stream_event to a delta", () => {
  const e = normalizeStreamLine({ type: "stream_event", event: { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "hi" } } });
  assert.deepEqual(e, { t: "delta", text: "hi" });
});

test("ignores thinking_delta as a thinking indicator, not text", () => {
  const e = normalizeStreamLine({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "" } } });
  assert.deepEqual(e, { t: "thinking" });
});

test("maps rate_limit_event", () => {
  const e = normalizeStreamLine({ type: "rate_limit_event", rate_limit_info: { status: "allowed", resetsAt: 123 } });
  assert.deepEqual(e, { t: "rate", status: "allowed", resetsAt: 123 });
});

test("maps a successful result to done", () => {
  const e = normalizeStreamLine({ type: "result", subtype: "success", is_error: false, result: "PONG", session_id: "abc" });
  assert.deepEqual(e, { t: "done", ok: true, result: "PONG" });
});

test("ignores hook noise", () => {
  assert.equal(normalizeStreamLine({ type: "system", subtype: "hook_started" }), null);
  assert.equal(normalizeStreamLine({ type: "system", subtype: "hook_response" }), null);
});

import { resolveScriptSource } from "./agent-service.js";

test("resolveScriptSource: returns the manifest entry's source by basename", () => {
  const manifest = [{ filename: "x.user.js", name: "X", version: "1", enabled: true, source: "// FROM-MANIFEST" }];
  assert.equal(resolveScriptSource("x.user.js", manifest), "// FROM-MANIFEST");
});

test("resolveScriptSource: falls back to the served dir when not in the manifest", () => {
  // "nope.user.js" is not in the manifest and not on disk -> null (dir read fails)
  assert.equal(resolveScriptSource("nope.user.js", [{ filename: "x.user.js", source: "// X" }]), null);
});

test("resolveScriptSource: null manifest defers entirely to the served dir", () => {
  assert.equal(resolveScriptSource("nope.user.js", null), null);
});

import { buildTurnPrompt } from "./agent-service.js";

test("buildTurnPrompt: injects the manifest's USERSCRIPTS block", () => {
  const p = buildTurnPrompt({
    snap: "SNAP", text: "hi",
    installed: [{ filename: "z.user.js", name: "Zed", version: "3", enabled: true, source: "//Z" }],
    skipUserscripts: false,
  });
  assert.match(p, /=== USERSCRIPTS ===/);
  assert.match(p, /z\.user\.js — Zed \(v3\)/);
  assert.match(p, /=== USER MESSAGE ===\nhi/);
});

test("buildTurnPrompt: skipUserscripts omits the USERSCRIPTS block", () => {
  const p = buildTurnPrompt({ snap: "SNAP", text: "hi", installed: [{ filename: "z.user.js", source: "//Z" }], skipUserscripts: true });
  assert.ok(!p.includes("=== USERSCRIPTS ==="));
});

import express from "express";
import http from "node:http";

test("agent route parser accepts a >1MB installedScripts body", async () => {
  const app = express();
  app.post("/t", express.json({ limit: "8mb" }), (req, res) => {
    res.json({ n: Array.isArray(req.body.installedScripts) ? req.body.installedScripts.length : -1 });
  });
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const port = server.address().port;
  const big = { installedScripts: Array.from({ length: 400 }, (_, i) => ({ filename: `s${i}.user.js`, source: "x".repeat(5000) })) };
  const body = JSON.stringify(big);
  assert.ok(body.length > 1_000_000, "payload must exceed the old 1MB cap");
  const res = await new Promise((resolve) => {
    const req = http.request({ port, path: "/t", method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } }, (r) => {
      let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => resolve({ status: r.statusCode, body: d }));
    });
    req.end(body);
  });
  server.close();
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.body).n, 400);
});

// ── snapshot ok flag ────────────────────────────────────────────────────────
// The footer said "no snapshot" on every turn even though the agent saw the
// page fine: the ok flag grepped the WHOLE payload for /error/, and the
// console-capture section virtually always contains {"kind":"error"} entries.
import { snapshotOk, isWedgedReply, withTurnLock } from "./agent-service.js";

test("snapshotOk: healthy snapshot with console error entries is ok", () => {
  const snap = JSON.stringify({ url: "https://www.torn.com/factions.php", title: "Factions | TORN",
    text: "member list", console: [{ kind: "error", msg: "[FF Scouter V2] boom" }] });
  assert.equal(snapshotOk(snap), true);
});

test("snapshotOk: page text containing the word error is still ok", () => {
  assert.equal(snapshotOk('{"url":"x","text":"an error occurred in chat"}'), true);
});

test("snapshotOk: relay failure strings are not ok", () => {
  assert.equal(snapshotOk("(page snapshot unavailable: relay not connected)"), false);
  assert.equal(snapshotOk("(page snapshot error: Error: timeout)"), false);
});

// ── wedged-session marker ───────────────────────────────────────────────────
// A child SIGKILLed mid-session-write leaves a trailing unanswered user entry;
// every later --resume then emits the CLI's synthetic no-op instead of calling
// the model. The marker must be detected so the turn retries on a fresh session.
test("isWedgedReply: synthetic no-op marker detected", () => {
  assert.equal(isWedgedReply("No response requested."), true);
  assert.equal(isWedgedReply("  No response requested.\n"), true);
  assert.equal(isWedgedReply("No response requested"), true);
});

test("isWedgedReply: real replies and empties pass through", () => {
  assert.equal(isWedgedReply("Here is the fix — bump @version and…"), false);
  assert.equal(isWedgedReply("No response requested. Just kidding, here's more."), false);
  assert.equal(isWedgedReply(""), false);
  assert.equal(isWedgedReply(null), false);
});

// ── turn serialization ──────────────────────────────────────────────────────
// With disconnect no longer killing the child, a reconnect must not spawn a
// second claude writing the SAME session file while the orphan still runs.
test("withTurnLock: overlapping turns run sequentially, results intact", async () => {
  const order = [];
  const slow = withTurnLock(async () => { order.push("a-start"); await new Promise(r => setTimeout(r, 40)); order.push("a-end"); return "A"; });
  const fast = withTurnLock(async () => { order.push("b-start"); return "B"; });
  const [ra, rb] = await Promise.all([slow, fast]);
  assert.deepEqual(order, ["a-start", "a-end", "b-start"]);
  assert.equal(ra, "A"); assert.equal(rb, "B");
});

test("withTurnLock: a rejected turn does not block the next", async () => {
  const boom = withTurnLock(async () => { throw new Error("boom"); });
  await assert.rejects(boom, /boom/);
  const next = await withTurnLock(async () => "ok");
  assert.equal(next, "ok");
});

// ── deploy stub gate ────────────────────────────────────────────────────────
// The agent aborting a ===FILE: block mid-reply leaves a header-only fence
// that parses as a valid proposal and passes node --check — the deploy gate
// must catch it (and truncated near-empty rewrites of big scripts).
import { stubProposalError } from "./agent-service.js";

test("stubProposalError: header-only userscript is rejected", () => {
  const header = "// ==UserScript==\n// @name X\n// @version 1.0\n// ==/UserScript==\n";
  assert.match(stubProposalError(header, 0), /no executable code/);
});

test("stubProposalError: >50% shrink of a big script is rejected", () => {
  const small = "// ==UserScript==\n// @name X\n// ==/UserScript==\nconsole.log(1);\n";
  assert.match(stubProposalError(small, 230000), /shrink/);
});

test("stubProposalError: real script passes, small files may shrink freely", () => {
  const real = "// ==UserScript==\n// @name X\n// ==/UserScript==\n(function(){ console.log('hi'); })();\n";
  assert.equal(stubProposalError(real, 0), null);
  assert.equal(stubProposalError(real, 3000), null);   // existing file small — no ratio gate
  assert.equal(stubProposalError("x".repeat(120000), 230000), null); // 52% — over the line
});
