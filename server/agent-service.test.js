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
