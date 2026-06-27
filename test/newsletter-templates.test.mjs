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
function selectGroupInDropdown(doc, roles, onDone, schedule) {
  if (!Array.isArray(roles) || !roles.length) { if (onDone) onDone(); return; }
  schedule = schedule || ((fn) => setTimeout(fn, 320));
  const want = {}; roles.forEach((r) => { want[normRole(r)] = 1; });
  let attempts = 0;
  function step() {
    attempts++;
    let changed = 0;
    roleCheckboxes(doc).forEach((cb) => {
      const desired = !!want[normRole(roleLabel(cb))];
      if (cb.checked !== desired) { clickOption(cb); changed++; }
    });
    if (changed === 0 || attempts >= 6) { if (onDone) onDone(); return; }
    schedule(step);
  }
  if (rolesMenuOpen(doc)) { step(); return; }
  const tg = doc.querySelector("button.toggler.multiselect");
  if (tg) { try { tg.click(); } catch (e) {} schedule(step); }
  else { step(); }
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
  const state = { open: !!opts.open };
  const names = opts.names || ["All", "Online", "Not in an Organized Crime (4)", "Reaper (56)", "Banker (3)"];
  const preChecked = opts.preChecked || ["All"];
  const options = [];
  function applyClick(o) {
    if (normName(o.name) === "All") { options.forEach((x) => { x._next = (x === o); }); }
    else { o._next = !o._checked; if (o._next) { const all = options.find((x) => normName(x.name) === "All"); if (all) all._next = false; } }
  }
  function mk(name, checked) {
    const o = { name, _checked: checked, _next: checked, broken: !!opts.broken };
    const control = { tagName: "SPAN", className: "checkbox checkbox-button__control",
      click() { if (!state.open) { state.open = true; return; } if (o.broken) return; applyClick(o); } };
    const li = { tagName: "LI", className: "item", parentElement: null };
    const label = { tagName: "LABEL", className: "checkbox checkbox-button", textContent: "", parentElement: li,
      querySelector(sel) { return /checkbox-button__control/.test(sel) ? control : null; } };
    const input = {
      type: "checkbox", className: "checkbox checkbox-button__input", textContent: "",
      parentElement: label,
      get checked() { return o._checked; },
      get offsetParent() { return state.open ? {} : null; },
      getAttribute() { return null; },
      closest(sel) { return /label/i.test(sel) ? label : (/li/i.test(sel) ? li : null); },
    };
    // roleLabel walks input -> label("") -> li(name)
    li.textContent = name;
    o.input = input;
    return o;
  }
  names.forEach((n) => options.push(mk(n, preChecked.indexOf(normName(n)) !== -1)));
  const toggler = { tagName: "BUTTON", className: "toggler multiselect down", click() { state.open = true; } };
  return {
    _state: state,
    _render() { options.forEach((o) => { o._checked = o._next; }); },
    querySelectorAll(sel) {
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

test("opens the closed recipients dropdown, then selects the group via the option control", () => {
  const doc = buildLiveDropdown();                 // closed, default "All"
  assert.equal(rolesMenuOpen(doc), false);
  let done = false;
  selectGroupInDropdown(doc, ["Reaper"], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.equal(doc._state.open, true);             // menu was opened
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]); // group selected, "All" auto-unticked
});

test("selection goes through the option CONTROL, not the bare input (1.0.6 blink fix)", () => {
  const doc = buildLiveDropdown({ open: true });
  // clickOption must target span.checkbox-button__control inside the label, never the input itself
  const input = roleCheckboxes(doc).find((cb) => normRole(roleLabel(cb)) === "Reaper");
  let clickedTag = null;
  const label = input.closest("label");
  const realCtrl = label.querySelector(".checkbox-button__control");
  const origClick = realCtrl.click.bind(realCtrl);
  realCtrl.click = function () { clickedTag = "SPAN.checkbox-button__control"; origClick(); };
  clickOption(input);
  doc._render();
  assert.equal(clickedTag, "SPAN.checkbox-button__control");  // proved it clicked the control
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
});

test("selecting an already-correct group is a no-op (no redundant clicks)", () => {
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
  assert.equal(done, true);                         // still terminates
  assert.deepEqual(getCheckedRoles(doc), ["All"]);  // couldn't apply, but bounded
});

test("empty roles is a no-op and still calls back", () => {
  const doc = buildLiveDropdown({ open: true });
  let done = false;
  selectGroupInDropdown(doc, [], () => { done = true; }, sched(doc));
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["All"]);  // untouched
});

test("applySelected-style report names the actual recipients and flags a vanished group", () => {
  const doc = buildLiveDropdown({ open: true, names: ["All", "Online", "Reaper (56)"], preChecked: ["Online"] });
  const saved = ["Reaper", "Dread Reaper"];          // Dread Reaper no longer exists
  let done = false;
  selectGroupInDropdown(doc, saved, () => { done = true; }, sched(doc));
  const present = {}; roleCheckboxes(doc).forEach((cb) => { const k = normRole(roleLabel(cb)); if (k) present[k] = 1; });
  const missing = saved.filter((r) => !present[normRole(r)]);
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
  assert.deepEqual(missing, ["Dread Reaper"]);
});
