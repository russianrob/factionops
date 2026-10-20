// The paid forum readers are switched off.
//
// RW Pricer 3.14.0 no longer asks, but 3.13.4 and older, and the standalone
// "RW Pricer - Forum Screenshots" script, still POST every forum post and
// screenshot they could not price locally. Each one used to be an AI read
// billed to the owner (about 570 a day), and installs that never update keep
// asking indefinitely. So both routes answer at once with the reply every old
// version treats as "nothing to show", and the readers behind them can no
// longer reach the model at all.
//
// Nothing here may reach the network: fetch is replaced by a recorder that
// answers instantly, so a reader that still called out is caught on an
// assertion and billed for nothing, even while these tests are red.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { readPostText, textKey } from "./rwp-text-read.js";
import { readItemImage } from "./rwp-image-read.js";

// The model answers "nothing found" so a reader that still calls it returns
// promptly instead of sitting in its retry backoff; anything else is a 404.
const sent = [];
globalThis.fetch = async (url) => {
  sent.push(String(url));
  const model = String(url).startsWith("https://api.anthropic.com/");
  return {
    ok: model, status: model ? 200 : 404, headers: { get: () => null },
    json: async () => ({ content: [{ text: '{"items": []}' }] }),
    text: async () => "", arrayBuffer: async () => new ArrayBuffer(0),
  };
};

// ── The routes ─────────────────────────────────────────────────
const ROUTES = fs.readFileSync(new URL("./routes.js", import.meta.url), "utf8");

/**
 * Answer one fake request with the route registration lifted out of
 * routes.js, so it is the shipping handler that replies. Everything the old
 * handlers reached for is a recorder, so any use of it shows up in `touched`.
 */
async function call(path, body) {
  const at = ROUTES.indexOf('router.post("' + path + '"');
  assert.ok(at >= 0, "not in routes.js: " + path);
  let depth = 0, end = -1;
  for (let k = ROUTES.indexOf("(", at); k < ROUTES.length; k++) {
    if (ROUTES[k] === "(") depth++;
    else if (ROUTES[k] === ")" && --depth === 0) { end = k; break; }
  }
  const touched = [];
  const recorder = (name) => new Proxy(function () {}, {
    get: (_t, prop) => recorder(name + "." + String(prop)),
    apply: () => { touched.push(name); return undefined; },
  });
  let handler = null;
  const box = {
    router: { post: (_p, ...fns) => { handler = fns[fns.length - 1]; } },
    express: { json: () => (_q, _s, next) => next() },
    rwpText: recorder("rwpText"), rwpImage: recorder("rwpImage"), readBudget: recorder("readBudget"),
    rwpFeed: recorder("rwpFeed"), priceOf: recorder("priceOf"), unknownItem: recorder("unknownItem"),
    readerKey: recorder("readerKey"), console: recorder("console"),
  };
  vm.createContext(box);
  vm.runInContext(ROUTES.slice(at, end + 1), box);
  const res = {
    statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  try { await handler({ body, headers: {}, ip: "203.0.113.7" }, res); }
  catch (e) { touched.push("threw: " + e.message); }
  // Compared as the JSON a client receives; objects made inside the sandbox
  // carry its own prototypes, which strict equality would trip over.
  const reply = res.body === undefined ? undefined : JSON.parse(JSON.stringify(res.body));
  return { status: res.statusCode, body: reply, touched };
}

const POST = "Selling: Kodachi 53% Parry 600m, Jackhammer 18% Expose 3.00b, pm me";

test("a forum post gets an empty answer and nothing behind it runs", async () => {
  // Empty items is silent in every text client from 3.7.0 to 3.13.4. A 401 or
  // a needsMember field would not be: 3.9.3-3.13.4 take either as "sign in",
  // post the player's Torn API key to /api/auth and ask again.
  assert.deepEqual(await call("/api/rwp/read-text", { text: POST, v: "3.13.3" }),
    { status: 200, body: { items: [] }, touched: [] });
});

test("a screenshot gets an error answer and nothing behind it runs", async () => {
  // Every screenshot client checks for an `error` first, before its caption
  // retry and its "could not read an item card" note, so this is the one
  // reply that draws nothing and asks only once.
  const off = { status: 200, body: { error: "Screenshot reading has been switched off." }, touched: [] };
  assert.deepEqual(await call("/api/rwp/read-image", { url: "https://i.imgur.com/AbC123.png" }), off);
  assert.deepEqual(await call("/api/rwp/read-image", { url: "https://i.imgur.com/AbC123.png", hint: "Kodachi 53% parry" }), off,
    "the caption retry gets the same answer");
});

// ── The readers behind them ────────────────────────────────────
// The routes no longer call these, but they are what a test, a script or a
// future route would reach, so they must not be able to pay either.

test("a post the reader has never seen is not sent to the model", async () => {
  const text = "Kodachi " + Math.random() + " 53% Parry 600m Jackhammer 18% Expose 3b";
  const cacheFile = new URL("./data/rwp-text-cache/txt-" + textKey(text) + ".json", import.meta.url);
  sent.length = 0;
  try {
    const out = await readPostText({}, text, { mayRead: () => true });
    assert.deepEqual(out, { ok: true, items: [] });
    assert.deepEqual(sent, [], "the reader called out");
    assert.equal(fs.existsSync(cacheFile), false, "a reading was saved for a post nobody read");
  } finally {
    // Only a reader that still calls the model writes one; keep the live cache clean.
    fs.rmSync(cacheFile, { force: true });
  }
});

test("a screenshot the reader has never seen is neither downloaded nor read", async () => {
  sent.length = 0;
  const out = await readItemImage("https://i.imgur.com/" + String(Math.random()).slice(2) + ".png", {});
  assert.deepEqual(out, { ok: false, reason: "screenshot reading is switched off" });
  assert.deepEqual(sent, [], "the reader called out");
});
