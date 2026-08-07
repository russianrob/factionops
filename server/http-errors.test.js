import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { apiNotFound, jsonErrorHandler } from "./http-errors.js";

// A throwaway app wired with the handlers, listening on an ephemeral port, so we
// exercise the REAL Express error path (body-parser throws, unmatched routes,
// thrown handlers) rather than a stub.
async function makeServer() {
  const app = express();
  app.use(express.json());
  app.get("/api/ok", (_req, res) => res.json({ ok: true }));
  app.get("/api/throws", () => { throw new Error("boom SECRET-DETAIL stack"); });
  app.get("/api/teapot", () => { const e = new Error("i am a teapot"); e.status = 418; throw e; });
  app.use(apiNotFound);
  app.use(jsonErrorHandler);
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test("unknown /api route → JSON 404, never HTML", async () => {
  const { server, base } = await makeServer();
  try {
    const r = await fetch(`${base}/api/does-not-exist`);
    assert.equal(r.status, 404);
    assert.match(r.headers.get("content-type") || "", /application\/json/);
    assert.deepEqual(await r.json(), { error: "Not found" });
  } finally { server.close(); }
});

test("unknown /data route → JSON 404 (clients JSON-parse /data too)", async () => {
  const { server, base } = await makeServer();
  try {
    const r = await fetch(`${base}/data/missing.json`);
    assert.equal(r.status, 404);
    assert.match(r.headers.get("content-type") || "", /application\/json/);
  } finally { server.close(); }
});

test("non-API unknown path is left to Express default (not our JSON 404)", async () => {
  const { server, base } = await makeServer();
  try {
    const r = await fetch(`${base}/a-browser-page`);
    assert.equal(r.status, 404);
    assert.doesNotMatch(r.headers.get("content-type") || "", /application\/json/);
  } finally { server.close(); }
});

test("thrown error → JSON 500, generic message, no stack/detail leak", async () => {
  const { server, base } = await makeServer();
  try {
    const r = await fetch(`${base}/api/throws`);
    assert.equal(r.status, 500);
    assert.match(r.headers.get("content-type") || "", /application\/json/);
    const body = await r.json();
    assert.equal(body.error, "Internal server error");
    assert.ok(!JSON.stringify(body).includes("SECRET-DETAIL"), "must not leak internal error text");
  } finally { server.close(); }
});

test("error carrying a status uses it; 4xx surfaces its message", async () => {
  const { server, base } = await makeServer();
  try {
    const r = await fetch(`${base}/api/teapot`);
    assert.equal(r.status, 418);
    assert.equal((await r.json()).error, "i am a teapot");
  } finally { server.close(); }
});

test("malformed JSON body → JSON 400, never the HTML SyntaxError page", async () => {
  const { server, base } = await makeServer();
  try {
    const r = await fetch(`${base}/api/ok`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad json",
    });
    assert.equal(r.status, 400);
    assert.match(r.headers.get("content-type") || "", /application\/json/);
    assert.ok((await r.json()).error, "has a JSON error field");
  } finally { server.close(); }
});
