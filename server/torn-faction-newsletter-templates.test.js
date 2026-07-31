import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(
  new URL("./public/scripts/torn-faction-newsletter-templates.user.js", import.meta.url), "utf8");
// The script is a browser userscript, so it touches window/document at load.
// Stub just enough for the module body to run — we only exercise its pure
// export/import helpers here, not any DOM behaviour.
const mod = (function () {
  const module = { exports: {} };
  const store = {};
  const noop = () => {};
  const el = () => ({
    style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, insertAdjacentElement: noop, addEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [], setAttribute: noop, remove: noop,
    textContent: "", innerHTML: "", value: "",
  });
  const documentStub = {
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: el, addEventListener: noop,
    head: el(), body: el(), documentElement: el(),
  };
  const windowStub = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    addEventListener: noop, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
    location: { pathname: "/factions.php", hash: "", href: "https://www.torn.com/factions.php" },
    document: documentStub,
  };
  new Function("module", "exports", "window", "document", "localStorage", "location", "MutationObserver", src)(
    module, module.exports, windowStub, documentStub, windowStub.localStorage,
    windowStub.location, function () { return { observe: noop, disconnect: noop }; },
  );
  return module.exports;
})();

const TPL = {
  "War prep":   { html: "<p>Get your xanax</p>", roles: ["Leader", "Member"] },
  "Payday":     { html: "<p>Paid</p>",           roles: ["Member"] },
};

// ── export ─────────────────────────────────────────────────────────────────
test("export wraps templates in a versioned envelope", () => {
  const p = mod.exportPayload(TPL, null, "2026-08-01T00:00:00Z");
  assert.equal(p.fnt, 1);
  assert.equal(p.exported, "2026-08-01T00:00:00Z");
  assert.deepEqual(Object.keys(p.templates).sort(), ["Payday", "War prep"]);
});

test("export of a single named template carries only that one", () => {
  const p = mod.exportPayload(TPL, "Payday", "t");
  assert.deepEqual(Object.keys(p.templates), ["Payday"]);
  assert.deepEqual(p.templates.Payday, TPL.Payday);
});

test("export of an unknown name falls back to everything rather than an empty file", () => {
  const p = mod.exportPayload(TPL, "Nope", "t");
  assert.equal(Object.keys(p.templates).length, 2);
});

test("export of nothing is still valid JSON, not a crash", () => {
  const p = mod.exportPayload({}, null, "t");
  assert.deepEqual(p.templates, {});
});

// ── parse ──────────────────────────────────────────────────────────────────
test("parse accepts our own envelope", () => {
  const text = JSON.stringify(mod.exportPayload(TPL, null, "t"));
  const r = mod.parseImport(text);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.templates).sort(), ["Payday", "War prep"]);
});

test("parse also accepts a bare name->template map (hand-edited or older export)", () => {
  const r = mod.parseImport(JSON.stringify(TPL));
  assert.equal(r.ok, true);
  assert.equal(Object.keys(r.templates).length, 2);
});

test("parse rejects junk with a readable reason instead of throwing", () => {
  for (const bad of ["", "   ", "not json", "[1,2,3]", "null", '"a string"', "42"]) {
    const r = mod.parseImport(bad);
    assert.equal(r.ok, false, `expected reject for ${JSON.stringify(bad)}`);
    assert.equal(typeof r.error, "string");
    assert.ok(r.error.length > 0);
  }
});

test("parse drops entries that aren't shaped like templates", () => {
  const r = mod.parseImport(JSON.stringify({ good: { html: "<p>x</p>" }, bad: 5, alsoBad: null }));
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.templates), ["good"]);
});

test("parse rejects a payload whose entries are ALL invalid", () => {
  const r = mod.parseImport(JSON.stringify({ a: 1, b: 2 }));
  assert.equal(r.ok, false);
});

// ── merge ──────────────────────────────────────────────────────────────────
test("merge adds new templates and reports the count", () => {
  const r = mod.mergeImport({ Payday: TPL.Payday }, { "War prep": TPL["War prep"] });
  assert.equal(r.added, 1);
  assert.equal(r.replaced, 0);
  assert.deepEqual(Object.keys(r.merged).sort(), ["Payday", "War prep"]);
});

test("merge overwrites a same-named template and counts it as replaced", () => {
  const incoming = { Payday: { html: "<p>NEW</p>", roles: [] } };
  const r = mod.mergeImport({ Payday: TPL.Payday }, incoming);
  assert.equal(r.added, 0);
  assert.equal(r.replaced, 1);
  assert.equal(r.merged.Payday.html, "<p>NEW</p>", "incoming wins");
});

test("merge never mutates the caller's existing map", () => {
  const existing = { Payday: TPL.Payday };
  const before = JSON.stringify(existing);
  mod.mergeImport(existing, { Payday: { html: "<p>NEW</p>" } });
  assert.equal(JSON.stringify(existing), before);
});

test("merge of an empty import leaves everything untouched", () => {
  const r = mod.mergeImport(TPL, {});
  assert.equal(r.added, 0);
  assert.equal(r.replaced, 0);
  assert.deepEqual(r.merged, TPL);
});

test("round trip: export then import reproduces the originals exactly", () => {
  const text = JSON.stringify(mod.exportPayload(TPL, null, "t"));
  const parsed = mod.parseImport(text);
  const r = mod.mergeImport({}, parsed.templates);
  assert.deepEqual(r.merged, TPL);
  assert.equal(r.added, 2);
});
