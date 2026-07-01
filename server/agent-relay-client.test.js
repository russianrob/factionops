// agent-relay-client.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { runJsOnDevice, screenshotDevice } from "./agent-relay-client.js";

// Ground truth (routes.js:400-428): operator ENQUEUEs via POST /api/inspect/cmd
// ({js} or {action:"screenshot"}) and READS via GET /api/inspect/result (drains
// {results:[{id,kind,result,error}]}). These tests assert that exact contract.

test("runJsOnDevice: POST /api/inspect/cmd {js} then GET /api/inspect/result", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
    if (url.endsWith("/api/inspect/cmd")) return { json: async () => ({ ok: true, id: "cmd_1" }) };
    if (url.endsWith("/api/inspect/result")) return { json: async () => ({ results: [{ id: "cmd_1", kind: "js", result: "\"Home | TORN\"" }] }) };
    throw new Error("unexpected url " + url);
  };
  const out = await runJsOnDevice("return document.title", { base: "http://x", token: "t", fetchImpl, sleepImpl: async () => {} });
  assert.equal(out.value, "\"Home | TORN\"");
  const cmd = calls.find(c => c.url.endsWith("/api/inspect/cmd"));
  assert.equal(cmd.method, "POST");
  assert.deepEqual(cmd.body, { js: "return document.title" });
  const read = calls.find(c => c.url.endsWith("/api/inspect/result"));
  assert.equal(read.method, "GET");
});

test("runJsOnDevice returns a timeout error when no result arrives", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/inspect/cmd")) return { json: async () => ({ ok: true, id: "cmd_2" }) };
    return { json: async () => ({ results: [] }) };
  };
  const out = await runJsOnDevice("x", { base: "http://x", token: "t", timeoutMs: 5, fetchImpl, sleepImpl: async () => {} });
  assert.match(out.error, /timeout/i);
});

test("runJsOnDevice surfaces a device error result", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/inspect/cmd")) return { json: async () => ({ ok: true, id: "cmd_3" }) };
    return { json: async () => ({ results: [{ id: "cmd_3", kind: "js", error: "ReferenceError: x is not defined" }] }) };
  };
  const out = await runJsOnDevice("x", { base: "http://x", token: "t", fetchImpl, sleepImpl: async () => {} });
  assert.match(out.error, /ReferenceError/);
});

test("screenshotDevice enqueues {action:'screenshot'} via POST and returns the ref id", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
    return { json: async () => ({ ok: true, id: "shot_1" }) };
  };
  const out = await screenshotDevice({ base: "http://x", token: "t", fetchImpl });
  assert.equal(out.ref, "shot_1");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { action: "screenshot" });
});
