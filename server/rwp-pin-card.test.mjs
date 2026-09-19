// The pinned read card, run rather than read.
//
// Every previous assertion about placement was made against the SOURCE, and the
// placement was wrong four times running while those assertions passed. This
// lifts pinReadCard out of the shipping script and executes it against a DOM
// small enough to state exactly what happened.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");

function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in the shipping script: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}

/** Just enough DOM for one function. */
function makeDom() {
  const byId = new Map();
  function el(tag) {
    const e = {
      tagName: tag, id: "", children: [], parentNode: null,
      textContent: "", attrs: {}, handlers: {},
      style: { cssText: "" },
      get firstChild() { return this.children[0] || null; },
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k] ?? null; },
      addEventListener(ev, f) { (this.handlers[ev] = this.handlers[ev] || []).push(f); },
      click() { (this.handlers.click || []).forEach((f) => f()); },
      appendChild(c) { c.parentNode = this; this.children.push(c); if (c.id) byId.set(c.id, c); return c; },
      insertBefore(c, ref) {
        c.parentNode = this;
        const i = ref ? this.children.indexOf(ref) : -1;
        if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
        if (c.id) byId.set(c.id, c);
        return c;
      },
      removeChild(c) {
        const i = this.children.indexOf(c);
        if (i >= 0) this.children.splice(i, 1);
        c.parentNode = null;
        if (c.id && byId.get(c.id) === c) byId.delete(c.id);
        return c;
      },
    };
    return e;
  }
  const body = el("body");
  const document = {
    body,
    createElement: el,
    getElementById: (id) => byId.get(id) || null,
    _register: (e) => { if (e.id) byId.set(e.id, e); },
  };
  return { document, body, el };
}

function load() {
  const dom = makeDom();
  const ctx = { document: dom.document };
  vm.createContext(ctx);
  vm.runInContext(fn("pinReadCard") + "\nglobalThis.pin = pinReadCard;", ctx);
  return { pin: ctx.pin, ...dom };
}

test("the card ends up attached to the body", () => {
  // Not to a post, not to a node captured before the request — the body. That
  // is the whole point: there is no anchor left to lose.
  const { pin, document, body } = load();
  const box = document.createElement("div");
  pin(box, "rwp-read-card");
  assert.equal(box.parentNode, body);
  assert.equal(body.children.length, 1);
});

test("it is pinned and clear of the chat bar", () => {
  const { pin, document } = load();
  const box = document.createElement("div");
  pin(box, "rwp-read-card");
  assert.match(box.style.cssText, /position:fixed/);
  const m = box.style.cssText.match(/bottom:(\d+)px/);
  assert.ok(m && Number(m[1]) >= 48, "must clear Torn's chat: " + box.style.cssText);
});

test("a second card replaces the first instead of stacking", () => {
  // Two copies of the script are installed and running — the access log caught
  // two reads posted in the same second. Without this, two cards.
  const { pin, document, body } = load();
  const a = document.createElement("div");
  a.textContent = "first";
  pin(a, "rwp-read-card");
  const b = document.createElement("div");
  b.textContent = "second";
  pin(b, "rwp-read-card");
  assert.equal(body.children.length, 1, "two cards are stacked");
  assert.equal(body.children[0], b, "the newer read must win");
  assert.equal(a.parentNode, null, "the old card must be detached");
});

test("two DIFFERENT cards can coexist", () => {
  // The needs-a-key note and a read result are different things and must not
  // evict each other.
  const { pin, document, body } = load();
  pin(document.createElement("div"), "rwp-read-card");
  pin(document.createElement("div"), "rwp-needs-key");
  assert.equal(body.children.length, 2);
});

test("the close control removes the card", () => {
  const { pin, document, body } = load();
  const box = document.createElement("div");
  pin(box, "rwp-read-card");
  const x = box.children[0];
  assert.equal(x.textContent, "✕", "the close glyph comes first");
  x.click();
  assert.equal(body.children.length, 0, "clicking close must remove the card");
  assert.equal(box.parentNode, null);
});

test("the close control is named for anyone not seeing the glyph", () => {
  const { pin, document } = load();
  const box = document.createElement("div");
  pin(box, "rwp-read-card");
  assert.equal(box.children[0].getAttribute("aria-label"), "Close");
  assert.equal(box.children[0].getAttribute("role"), "button");
});

test("the card keeps the content it was given", () => {
  // The close control is INSERTED, not written over the top of the prices.
  const { pin, document } = load();
  const box = document.createElement("div");
  const row = document.createElement("div");
  row.textContent = "Jackhammer 18% Expose";
  box.appendChild(row);
  pin(box, "rwp-read-card");
  assert.equal(box.children.length, 2, "close control plus the row");
  assert.ok(box.children.includes(row), "the priced row must survive");
});
