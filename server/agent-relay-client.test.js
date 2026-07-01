// agent-relay-client.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { runJsOnDevice } from "./agent-relay-client.js";

test("runJsOnDevice enqueues a cmd then returns the matching result value", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
    if (url.endsWith("/api/inspect/cmd")) return { json: async () => ({ id: "cmd_1" }) };
    if (url.endsWith("/api/inspect/result")) return { json: async () => ({ results: [{ id: "cmd_1", result: "\"Home | TORN\"" }] }) };
    throw new Error("unexpected url " + url);
  };
  const out = await runJsOnDevice("return document.title", { base: "http://x", token: "t", fetchImpl, sleepImpl: async () => {} });
  assert.equal(out.value, "\"Home | TORN\"");
  assert.ok(calls.some(c => c.url.endsWith("/api/inspect/cmd") && c.body.js === "return document.title"));
});

test("runJsOnDevice returns a timeout error when no result arrives", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/inspect/cmd")) return { json: async () => ({ id: "cmd_2" }) };
    return { json: async () => ({ results: [] }) };
  };
  const out = await runJsOnDevice("x", { base: "http://x", token: "t", timeoutMs: 5, fetchImpl, sleepImpl: async () => {} });
  assert.match(out.error, /timeout/i);
});
