import { test } from "node:test";
import assert from "node:assert/strict";

// --- helpers mirrored verbatim from torn-faction-newsletter-templates.user.js ---
const ROLE_SELECTOR = 'input[class*="checkbox-button__"]';
function roleCheckboxes(doc) { return [].slice.call(doc.querySelectorAll(ROLE_SELECTOR)); }
function roleLabel(cb) { let c = cb; for (let h = 0; h < 6 && c; h++) { const t = String(c.textContent || "").trim(); if (t && t.length < 50) return t; c = c.parentElement; } return ""; }
function normRole(s) { return String(s || "").replace(/\s*\(\d+\)\s*$/, "").trim(); }
function getCheckedRoles(doc) { return roleCheckboxes(doc).filter((cb) => cb.checked).map((cb) => normRole(roleLabel(cb))).filter(Boolean); }
function clickOption(cb) {
  const label = (cb.closest && cb.closest("label")) || cb.parentElement;
  const ctrl = (label && label.querySelector && label.querySelector(".checkbox-button__control")) || label || cb;
  try { ctrl.click(); } catch (e) {}
}
function rolesMenuOpen(doc) { return roleCheckboxes(doc).some((cb) => cb.offsetParent !== null); }
let menuHideGen = 0;
function closeRolesMenu(doc) { if (rolesMenuOpen(doc)) { const tg = doc.querySelector("button.toggler.multiselect"); if (tg) { try { tg.click(); } catch (e) {} } } }
function rolesRoot(doc) { const b = roleCheckboxes(doc)[0]; return (b && b.closest) ? b.closest(".small-select-menu-wrap, .react-dropdown-default, .select-wrap") : null; }
function setMenuHidden(doc, on) {
  if (on) { const root = rolesRoot(doc); if (root && root.setAttribute) root.setAttribute("data-fnt-hide-menu", "1"); }
  else { const marked = doc.querySelectorAll("[data-fnt-hide-menu]"); for (let i = 0; i < marked.length; i++) { if (marked[i].removeAttribute) marked[i].removeAttribute("data-fnt-hide-menu"); } }
}
function selectGroupInDropdown(doc, roles, onDone, schedule) {
  if (!Array.isArray(roles) || !roles.length) { if (onDone) onDone(); return; }
  schedule = schedule || ((fn) => setTimeout(fn, 320));
  const want = {}; roles.forEach((r) => { want[normRole(r)] = 1; });
  const startedClosed = !rolesMenuOpen(doc);
  const gen = ++menuHideGen;
  const unhide = () => { if (gen === menuHideGen) setMenuHidden(doc, false); };
  const diffBoxes = () => roleCheckboxes(doc).filter((cb) => cb.checked !== !!want[normRole(roleLabel(cb))]);
  function finish() {
    if (startedClosed) {
      closeRolesMenu(doc);
      let tries = 0;
      const waitClosed = () => { if (gen !== menuHideGen) return; if (!rolesMenuOpen(doc) || ++tries >= 16) { unhide(); return; } schedule(waitClosed); };
      waitClosed();
    }
    try { if (onDone) onDone(); } catch (e) {}
  }
  let attempts = 0;
  function settle() {
    attempts++;
    let d;
    try { d = diffBoxes(); } catch (e) { finish(); return; }
    if (d.length === 0 || attempts >= 6) { finish(); return; }
    if (!rolesMenuOpen(doc)) { const tg = doc.querySelector("button.toggler.multiselect"); if (tg) { try { tg.click(); } catch (e) {} } }
    d.forEach(clickOption);
    schedule(settle);
  }
  if (startedClosed) setMenuHidden(doc, true);
  diffBoxes().forEach(clickOption);
  schedule(settle);
}

function normName(n) { return String(n).replace(/\s*\(\d+\)\s*$/, "").trim(); }

// ---------------------------------------------------------------------------
// Static stub for selector/label/read tests: 4 site-settings boxes (checkbox-css)
// + 10 role boxes (checkbox-button__input), reconstructed from the NLG5 capture.
function makeStatic(cls, label, checked) {
  const parent = { textContent: label, parentElement: null };
  return { type: "checkbox", className: cls, checked, textContent: "", parentElement: parent, getAttribute() { return null; } };
}
function buildDoc(opts) {
  opts = opts || {};
  const omit = opts.omit || [];
  const preChecked = opts.preChecked || ["Not in an Organized Crime"];
  const extra = opts.extra || [];
  const settings = [
    makeStatic("checkbox-css dark-bg", "Not", true),
    makeStatic("checkbox-css dark-bg", "Dark Mode", true),
    makeStatic("checkbox-css dark-bg", "Desktop View", false),
    makeStatic("checkbox-css dark-bg", "News Ticker", true),
  ];
  const roleNames = [
    "All", "Online", "Not in an Organized Crime (4)", "Leader/Co-leader (2)",
    "Dread Reaper (5)", "Banker (3)", "Reaper (56)", "30 Day Trial (8)",
    "War Leader (2)", "Admin Leader (3)",
  ].filter((n) => omit.indexOf(normName(n)) === -1);
  const roles = roleNames.map((n) =>
    makeStatic("checkbox checkbox-button__input", n, preChecked.indexOf(normName(n)) !== -1));
  const all = settings.concat(roles).concat(extra.map((e) => makeStatic(e.cls, e.label, !!e.checked)));
  return {
    querySelectorAll(sel) {
      const m = sel.match(/class\*=["']?([^"'\]]+)/);
      if (m) return all.filter((c) => c.className.includes(m[1]));
      if (sel === "input[type=checkbox]") return all.slice();
      return [];
    },
  };
}

// ---------------------------------------------------------------------------
// LIVE dropdown stub, reconstructed from the FNT-DIAG click trace:
//  - menu is CLOSED until BUTTON.toggler.multiselect is clicked (options not laid out)
//  - an option is selected by clicking SPAN.checkbox-button__control inside LABEL.checkbox-button
//  - clicking a specific group auto-unchecks "All"; clicking "All" clears the specifics
//  - the checked change is applied on the next render tick (async), like React
function buildLiveDropdown(opts) {
  opts = opts || {};
  const state = { open: !!opts.open, everOpened: !!opts.open };
  function openMenu() { state.open = true; state.everOpened = true; }
  const names = opts.names || ["All", "Online", "Not in an Organized Crime (4)", "Reaper (56)", "Banker (3)"];
  const preChecked = opts.preChecked || ["All"];
  const options = [];
  // the recipients dropdown's outer container (what rolesRoot() resolves + we mark to hide)
  const root = { tagName: "DIV", className: "small-select-menu-wrap t-big-select-menu", _marked: false,
    setAttribute(k) { if (k === "data-fnt-hide-menu") this._marked = true; },
    removeAttribute(k) { if (k === "data-fnt-hide-menu") this._marked = false; },
    getAttribute() { return null; } };
  function applyClick(o) {
    if (normName(o.name) === "All") { options.forEach((x) => { x._next = (x === o); }); }
    else { o._next = !o._checked; if (o._next) { const all = options.find((x) => normName(x.name) === "All"); if (all) all._next = false; } }
  }
  function mk(name, checked) {
    const o = { name, _checked: checked, _next: checked, broken: !!opts.broken };
    const control = { tagName: "SPAN", className: "checkbox checkbox-button__control",
      click() { if (o.broken) return; if (!state.open && !opts.silentControl) { openMenu(); return; } applyClick(o); } };
    const li = { tagName: "LI", className: "item", parentElement: null };
    const label = { tagName: "LABEL", className: "checkbox checkbox-button", textContent: "", parentElement: li,
      querySelector(sel) { return /checkbox-button__control/.test(sel) ? control : null; } };
    const input = {
      type: "checkbox", className: "checkbox checkbox-button__input", textContent: "",
      parentElement: label,
      get checked() { return o._checked; },
      get offsetParent() { return state.open ? {} : null; },
      getAttribute() { return null; },
      closest(sel) {
        if (/small-select-menu-wrap|react-dropdown-default|select-wrap/.test(sel)) return root;
        if (/label/i.test(sel)) return label;
        if (/\bli\b/i.test(sel)) return li;
        return null;
      },
    };
    li.textContent = name;   // roleLabel walks input -> label("") -> li(name)
    o.input = input;
    return o;
  }
  names.forEach((n) => options.push(mk(n, preChecked.indexOf(normName(n)) !== -1)));
  const toggler = { tagName: "BUTTON", className: "toggler multiselect down", click() { if (state.open) { state.open = false; } else { openMenu(); } } };
  return {
    _state: state,
    _render() { options.forEach((o) => { o._checked = o._next; }); },
    _marked() { return root._marked; },
    querySelectorAll(sel) {
      if (sel === "[data-fnt-hide-menu]") return root._marked ? [root] : [];
      const m = sel.match(/class\*=["']?([^"'\]]+)/);
      if (m) return options.map((o) => o.input).filter((i) => i.className.includes(m[1]));
      return [];
    },
    querySelector(sel) { return sel === "button.toggler.multiselect" ? toggler : null; },
  };
}

// === selector / read tests (static) ===
test("selects exactly the 10 role checkboxes, not the 4 site-settings ones", () => {
  assert.equal(roleCheckboxes(buildDoc()).length, 10);
});
test("reads the ticked group via native .checked", () => {
  assert.deepEqual(getCheckedRoles(buildDoc()), ["Not in an Organized Crime"]);
});
test("labels strip the (N) member count", () => {
  const labels = roleCheckboxes(buildDoc()).map((cb) => normRole(roleLabel(cb)));
  assert.deepEqual(labels, ["All", "Online", "Not in an Organized Crime", "Leader/Co-leader", "Dread Reaper", "Banker", "Reaper", "30 Day Trial", "War Leader", "Admin Leader"]);
});
test("hardened selector excludes lookalike inputs (checkbox-button-group / checkbox-buttoned)", () => {
  const doc = buildDoc({ extra: [
    { cls: "checkbox checkbox-button-group", label: "Bogus", checked: true },
    { cls: "checkbox-buttoned", label: "Bogus2", checked: true },
  ] });
  assert.equal(roleCheckboxes(doc).length, 10);
});
test("regression: the old exact-token selector matches nothing", () => {
  assert.equal(buildDoc().querySelectorAll("input.checkbox-button__in").length, 0);
});

// === dropdown selection tests (live stub) ===
const sched = (doc) => (fn) => { doc._render(); fn(); };  // render the opened menu between steps

test("SILENT path: when the control selects without needing the menu, the menu never opens", () => {
  const doc = buildLiveDropdown({ silentControl: true });   // closed; control works while closed
  let done = false;
  selectGroupInDropdown(doc, ["Reaper"], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
  assert.equal(doc._state.everOpened, false);               // never opened the dropdown — invisible
});

test("FALLBACK path: if the menu must open, it selects then CLOSES it (doesn't leave it open)", () => {
  const doc = buildLiveDropdown();                           // closed; control needs the menu open
  let done = false;
  selectGroupInDropdown(doc, ["Reaper"], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);        // group selected
  assert.equal(doc._state.everOpened, true);                 // it did have to open...
  assert.equal(doc._state.open, false);                      // ...but it's closed again at the end
});

test("setMenuHidden marks ONLY the recipients container, and unmarks it (scoped, not global)", () => {
  const doc = buildLiveDropdown();
  setMenuHidden(doc, true);
  assert.equal(doc._marked(), true);
  assert.equal(doc.querySelectorAll("[data-fnt-hide-menu]").length, 1);  // exactly one element marked
  setMenuHidden(doc, false);
  assert.equal(doc._marked(), false);
  assert.equal(doc.querySelectorAll("[data-fnt-hide-menu]").length, 0);
});

test("FALLBACK path hides during open/close, unhides only after the menu is CLOSED, leaves nothing marked", () => {
  const doc = buildLiveDropdown();                           // closed -> will open
  let done = false;
  selectGroupInDropdown(doc, ["Reaper"], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
  assert.equal(doc._state.open, false);                      // closed at end
  assert.equal(doc._marked(), false);                        // hide attribute cleaned up
});

test("user-opened menu: never marks/hides (we don't touch their open menu)", () => {
  const doc = buildLiveDropdown({ open: true });
  selectGroupInDropdown(doc, ["Reaper"], () => {}, sched(doc));
  assert.equal(doc._marked(), false);
  assert.equal(doc._state.open, true);
});

test("broken control + started closed: still ends closed and unmarked (no stuck hide)", () => {
  const doc = buildLiveDropdown({ broken: true });           // closed, control never registers
  let done = false;
  selectGroupInDropdown(doc, ["Reaper"], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.equal(doc._state.open, false);                      // gave up and closed
  assert.equal(doc._marked(), false);                        // and cleaned up the hide
});

test("an onDone that throws still leaves the menu unmarked (cleanup not coupled to callback)", () => {
  const doc = buildLiveDropdown();
  selectGroupInDropdown(doc, ["Reaper"], () => { throw new Error("boom"); }, sched(doc));
  assert.equal(doc._marked(), false);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
});

test("if the user already had the menu open, leave it open", () => {
  const doc = buildLiveDropdown({ open: true });
  let done = false;
  selectGroupInDropdown(doc, ["Reaper"], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
  assert.equal(doc._state.open, true);                       // respected the user's open menu
});

test("selection goes through the option CONTROL, not the bare input (1.0.6 blink fix)", () => {
  const doc = buildLiveDropdown({ open: true });
  const input = roleCheckboxes(doc).find((cb) => normRole(roleLabel(cb)) === "Reaper");
  let clickedTag = null;
  const realCtrl = input.closest("label").querySelector(".checkbox-button__control");
  const origClick = realCtrl.click.bind(realCtrl);
  realCtrl.click = function () { clickedTag = "SPAN.checkbox-button__control"; origClick(); };
  clickOption(input);
  doc._render();
  assert.equal(clickedTag, "SPAN.checkbox-button__control");
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
});

test("selecting an already-correct group is a no-op", () => {
  const doc = buildLiveDropdown({ open: true, preChecked: ["Reaper"] });
  let done = false;
  selectGroupInDropdown(doc, ["Reaper"], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
});

test("bounded: gives up after the attempt cap if the control never registers (no infinite loop)", () => {
  const doc = buildLiveDropdown({ open: true, broken: true });
  let done = false;
  selectGroupInDropdown(doc, ["Reaper"], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["All"]);
});

test("empty roles is a no-op and still calls back", () => {
  const doc = buildLiveDropdown({ open: true });
  let done = false;
  selectGroupInDropdown(doc, [], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["All"]);
});

test("applySelected-style report names the actual recipients and flags a vanished group", () => {
  const doc = buildLiveDropdown({ open: true, names: ["All", "Online", "Reaper (56)"], preChecked: ["Online"] });
  const saved = ["Reaper", "Dread Reaper"];
  let done = false;
  selectGroupInDropdown(doc, saved, () => { done = true; }, sched(doc));
  const present = {}; roleCheckboxes(doc).forEach((cb) => { const k = normRole(roleLabel(cb)); if (k) present[k] = 1; });
  const missing = saved.filter((r) => !present[normRole(r)]);
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
  assert.deepEqual(missing, ["Dread Reaper"]);
});

// === newsletter title field (input.text-input.titleField___HASH) ===
function titleInput(doc) { return doc.querySelector('input[class*="titleField"]'); }
function getTitle(doc) { const el = titleInput(doc); return el ? String(el.value || "") : ""; }
function setTitle(doc, v) {
  const el = titleInput(doc); if (!el) return false;
  const val = v == null ? "" : String(v);
  el.value = val;
  el.dispatchEvent({ type: "input" }); el.dispatchEvent({ type: "change" });
  return true;
}
function buildTitleDoc(initial, cls) {
  const events = [];
  const input = { tagName: "INPUT", className: cls || "text-input titleField___JEzzv", value: initial || "", dispatchEvent(e) { events.push(e.type); return true; } };
  return { _events: events, querySelector(sel) { const m = sel.match(/class\*=["']?([^"'\]]+)/); return (m && input.className.includes(m[1])) ? input : null; } };
}

test("titleInput finds the React title field by the stable 'titleField' token (hash-proof)", () => {
  assert.ok(titleInput(buildTitleDoc("", "text-input titleField___JEzzv")));
  assert.ok(titleInput(buildTitleDoc("", "text-input titleField___aB9xQ")));   // different CSS-module hash still matches
});
test("getTitle reads the field value; setTitle writes it and fires input+change", () => {
  const doc = buildTitleDoc("old");
  assert.equal(getTitle(doc), "old");
  assert.equal(setTitle(doc, "War Briefing"), true);
  assert.equal(getTitle(doc), "War Briefing");
  assert.deepEqual(doc._events, ["input", "change"]);     // React-controlled input needs these to register
});
test("setTitle null/empty clears the field", () => {
  const doc = buildTitleDoc("something");
  setTitle(doc, null);
  assert.equal(getTitle(doc), "");
});
test("a template carries title alongside body+roles and Apply restores it", () => {
  const doc = buildTitleDoc("");
  const tpl = { body: "<p>hi</p>", roles: ["Reaper"], title: "Weekly Update" };
  setTitle(doc, tpl.title || "");
  assert.equal(getTitle(doc), "Weekly Update");
});

// === Quick Send confirmation target (reflect the actual selected recipients) ===
function sendTargetLabel(recips) {
  const specific = (recips || []).filter((r) => normRole(r).toLowerCase() !== "all");
  return specific.length ? specific.join(", ") : "the whole faction";
}
test("Quick Send target label reflects the selected group, not always 'whole faction'", () => {
  assert.equal(sendTargetLabel(["Reaper"]), "Reaper");
  assert.equal(sendTargetLabel(["Reaper", "Banker"]), "Reaper, Banker");
  assert.equal(sendTargetLabel(["All"]), "the whole faction");   // "All" selected => whole faction
  assert.equal(sendTargetLabel([]), "the whole faction");        // nothing specific => whole faction
  assert.equal(sendTargetLabel(["All", "Reaper"]), "Reaper");    // specifics win over a stray All
});
