// The one Torn request helper behind /hof.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-torn-test-"));
const { tornGet } = await import("./hof-torn.js");
const { getRecent } = await import("./key-usage-log.js");

const KEY = "test-key-hof";
const reply = (body, status = 200) => ({ status, ok: status >= 200 && status < 300, text: async () => body });
function fake(respond) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return respond(url, init); };
  return { fetchImpl, calls };
}

test("the key goes in the Authorization header, never the URL, and the call is labelled", async () => {
  const f = fake(() => reply('{"factionhof":[]}'));
  const r = await tornGet("/torn/factionhof", { cat: "respect", limit: 100, offset: 200 }, { key: KEY, fetchImpl: f.fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.text, '{"factionhof":[]}');
  const { url, init } = f.calls[0];
  assert.equal(init.headers.Authorization, "ApiKey " + KEY);
  assert.ok(!url.includes(KEY), "key leaked into the URL");
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://api.torn.com/v2/torn/factionhof");
  assert.equal(u.searchParams.get("comment"), "wb-hof");
  assert.equal(u.searchParams.get("offset"), "200");
});

test("every call lands in the key-usage log under its source", async () => {
  const f = fake(() => reply("id,name,respect\n"));
  await tornGet("/faction/snapshot", { timestamp: 1792368000 }, { key: KEY, fetchImpl: f.fetchImpl, source: "hof-usage-test" });
  const mine = getRecent(10, KEY.slice(-4)).entries.filter((e) => e.source === "hof-usage-test");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].endpoint, "/v2/faction/snapshot");
  assert.equal(mine[0].status, 200);
});

test("a Torn error object comes back as its code, even with HTTP 200", async () => {
  const f = fake(() => reply('{"error":{"code":30,"error":"File does not exist"}}'));
  assert.deepEqual(await tornGet("/faction/snapshot", {}, { key: KEY, fetchImpl: f.fetchImpl }),
    { ok: false, code: 30, message: "File does not exist" });
});

test("other failures come back as http_<status>, timeout or network", async () => {
  const bad = fake(() => reply("<html>Bad gateway</html>", 502));
  assert.equal((await tornGet("/torn/factionhof", {}, { key: KEY, fetchImpl: bad.fetchImpl })).code, "http_502");

  // A request that never answers. The pending timer stands in for the open
  // socket that keeps a real fetch's event loop alive.
  const slow = fake((_url, init) => new Promise((_resolve, reject) => {
    const socket = setTimeout(() => {}, 5000);
    init.signal.addEventListener("abort", () => { clearTimeout(socket); reject(init.signal.reason); });
  }));
  assert.equal((await tornGet("/torn/factionhof", {}, { key: KEY, fetchImpl: slow.fetchImpl, timeoutMs: 20 })).code, "timeout");

  const down = fake(() => { throw new TypeError("fetch failed"); });
  assert.equal((await tornGet("/torn/factionhof", {}, { key: KEY, fetchImpl: down.fetchImpl })).code, "network");
});

test("it never throws, even when reading the body does", async () => {
  const f = fake(() => ({ status: 200, ok: true, text: async () => { throw new Error("socket hang up"); } }));
  const r = await tornGet("/torn/factionhof", {}, { key: KEY, fetchImpl: f.fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.code, "network");
});
