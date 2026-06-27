import { test } from "node:test";
import assert from "node:assert/strict";

// Faithful stub of the factions.php newsletter DOM, reconstructed verbatim from the
// on-device NLG5-DIAG capture (2026-06-27): 14 input[type=checkbox] = 4 site-settings
// boxes (class "checkbox-css dark-bg") + 10 newsletter role boxes (class
// "checkbox checkbox-button__input"). Native .checked reflects selection (no aria-checked).
function makeCheckbox(cls, label, checked) {
  const parent = { textContent: label, parentElement: null };
  const cb = {
    type: "checkbox",
    className: cls,
    checked: checked,
    textContent: "",          // an <input> has no text content
    parentElement: parent,
    getAttribute() { return null; },   // no aria-checked in the real DOM
    click() { this.checked = !this.checked; }, // Torn's box toggles on a real click
  };
  return cb;
}

function normName(n) { return String(n).replace(/\s*\(\d+\)\s*$/, "").trim(); }
function buildDoc(opts) {
  opts = opts || {};
  const omit = opts.omit || [];
  const preChecked = opts.preChecked || ["Not in an Organized Crime"]; // i=6 in the capture
  const extra = opts.extra || [];
  const settings = [
    makeCheckbox("checkbox-css dark-bg", "Not", true),
    makeCheckbox("checkbox-css dark-bg", "Dark Mode", true),
    makeCheckbox("checkbox-css dark-bg", "Desktop View", false),
    makeCheckbox("checkbox-css dark-bg", "News Ticker", true),
  ];
  const roleNames = [
    "All", "Online", "Not in an Organized Crime (4)", "Leader/Co-leader (2)",
    "Dread Reaper (5)", "Banker (3)", "Reaper (56)", "30 Day Trial (8)",
    "War Leader (2)", "Admin Leader (3)",
  ].filter((n) => omit.indexOf(normName(n)) === -1);
  const roles = roleNames.map((n) =>
    makeCheckbox("checkbox checkbox-button__input", n, preChecked.indexOf(normName(n)) !== -1));
  const all = settings.concat(roles).concat(extra.map((e) => makeCheckbox(e.cls, e.label, !!e.checked)));
  return {
    _all: all,
    querySelectorAll(sel) {
      if (sel === "input.checkbox-button__in") {
        return all.filter((c) => (" " + c.className + " ").includes(" checkbox-button__in "));
      }
      const m = sel.match(/class\*=["']?([^"'\]]+)/);
      if (m) return all.filter((c) => c.className.includes(m[1]));
      if (sel === "input[type=checkbox]") return all.slice();
      return [];
    },
  };
}

// --- helpers mirrored verbatim from torn-faction-newsletter-templates.user.js ---
const ROLE_SELECTOR = 'input[class*="checkbox-button__"]';   // FIX: was "input.checkbox-button__in"; requires the BEM "__" so checkbox-button-group / checkbox-buttoned do NOT match
function roleCheckboxes(doc) { return [].slice.call(doc.querySelectorAll(ROLE_SELECTOR)); }
function roleLabel(cb) { let c = cb; for (let h = 0; h < 6 && c; h++) { const t = String(c.textContent || "").trim(); if (t && t.length < 50) return t; c = c.parentElement; } return ""; }
function normRole(s) { return String(s || "").replace(/\s*\(\d+\)\s*$/, "").trim(); }
function getCheckedRoles(doc) { return roleCheckboxes(doc).filter((cb) => cb.checked).map((cb) => normRole(roleLabel(cb))).filter(Boolean); }
function setCheckedRoles(doc, roles) {
  if (!Array.isArray(roles) || !roles.length) return;   // empty/missing => leave selection untouched
  const want = {}; roles.forEach((r) => { want[normRole(r)] = 1; });
  roleCheckboxes(doc).forEach((cb) => {
    const desired = !!want[normRole(roleLabel(cb))];
    if (cb.checked !== desired) { try { cb.click(); } catch (e) {} }
  });
}
function setRolesReliably(doc, roles, onDone, schedule) {
  if (!Array.isArray(roles) || !roles.length) { if (onDone) onDone(); return; }
  schedule = schedule || ((fn) => setTimeout(fn, 180));
  let attempts = 0;
  function target() {
    const present = {};
    roleCheckboxes(doc).forEach((cb) => { const k = normRole(roleLabel(cb)); if (k) present[k] = 1; });
    return roles.map(normRole).filter((r) => present[r]).sort().join("|");
  }
  function satisfied() { return getCheckedRoles(doc).slice().sort().join("|") === target(); }
  function pass() {
    attempts++;
    setCheckedRoles(doc, roles);
    if (satisfied() || attempts >= 8) { if (onDone) onDone(); return; }
    schedule(pass);
  }
  pass();
}

// Models the real factions.php recipient selector: a React multi-select dropdown whose
// option checkboxes only toggle once the opened menu has RENDERED. The first click opens
// the menu (state.opening) but does not toggle in the same synchronous tick; a later tick
// (render()) makes the options live. Reconstructed from the NLG6 firstAncestry capture.
function buildDropdownDoc(opts) {
  opts = opts || {};
  const state = { opening: false, rendered: false };
  function mk(cls, label, checked) {
    return {
      type: "checkbox", className: cls, checked, textContent: "",
      parentElement: { textContent: label, parentElement: null },
      getAttribute() { return null; },
      click() { if (!state.rendered) { state.opening = true; return; } this.checked = !this.checked; },
    };
  }
  const names = opts.names || ["All", "Online", "Reaper (56)", "Banker (3)"];
  const preChecked = opts.preChecked || ["All"];
  const all = names.map((n) => mk("checkbox checkbox-button__input", n, preChecked.indexOf(normName(n)) !== -1));
  return {
    _state: state,
    render() { if (state.opening) state.rendered = true; },
    querySelectorAll(sel) {
      const m = sel.match(/class\*=["']?([^"'\]]+)/);
      if (m) return all.filter((c) => c.className.includes(m[1]));
      return [];
    },
  };
}

test("selects exactly the 10 role checkboxes (not the 4 site-settings ones)", () => {
  const doc = buildDoc();
  assert.equal(roleCheckboxes(doc).length, 10);
});

test("reads the currently-ticked group via native .checked", () => {
  const doc = buildDoc();
  assert.deepEqual(getCheckedRoles(doc), ["Not in an Organized Crime"]);
});

test("labels strip the (N) member count", () => {
  const doc = buildDoc();
  const labels = roleCheckboxes(doc).map((cb) => normRole(roleLabel(cb)));
  assert.deepEqual(labels, ["All", "Online", "Not in an Organized Crime", "Leader/Co-leader", "Dread Reaper", "Banker", "Reaper", "30 Day Trial", "War Leader", "Admin Leader"]);
});

test("setCheckedRoles re-ticks the saved group and clears the rest", () => {
  const doc = buildDoc();
  setCheckedRoles(doc, ["Reaper"]);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);
});

test("setCheckedRoles([]) leaves the current selection untouched (old 1.0.2 templates)", () => {
  const doc = buildDoc();
  const before = getCheckedRoles(doc);
  setCheckedRoles(doc, []);
  assert.deepEqual(getCheckedRoles(doc), before);
});

test("regression: the old exact-token selector matches nothing on today's DOM", () => {
  const doc = buildDoc();
  assert.equal(doc.querySelectorAll("input.checkbox-button__in").length, 0);
});

test("hardened selector excludes lookalike inputs (checkbox-button-group / checkbox-buttoned)", () => {
  const doc = buildDoc({ extra: [
    { cls: "checkbox checkbox-button-group", label: "Bogus Bar", checked: true },
    { cls: "checkbox-buttoned", label: "Bogus Two", checked: true },
  ] });
  // still exactly the 10 real role boxes — the BEM "__" requirement rejects the lookalikes
  assert.equal(roleCheckboxes(doc).length, 10);
  assert.deepEqual(getCheckedRoles(doc), ["Not in an Organized Crime"]);
});

// mirrors the Apply handler's "what actually got applied" computation
function applyRoles(doc, saved) {
  setCheckedRoles(doc, saved);
  const present = {};
  roleCheckboxes(doc).forEach((cb) => { const k = normRole(roleLabel(cb)); if (k) present[k] = 1; });
  const missing = saved.filter((r) => !present[normRole(r)]);
  return { now: getCheckedRoles(doc), missing };
}

test("Apply reports the ACTUAL applied recipients, not the saved list, and flags missing groups", () => {
  // a faction where "Dread Reaper" was deleted; user had "Online" manually ticked
  const doc = buildDoc({ omit: ["Dread Reaper"], preChecked: ["Online"] });
  const res = applyRoles(doc, ["Reaper", "Dread Reaper"]);
  assert.deepEqual(res.now, ["Reaper"]);            // truthful: only Reaper actually applied
  assert.deepEqual(res.missing, ["Dread Reaper"]);  // the vanished group is surfaced, not echoed as applied
});

test("react-dropdown reality: a single reconcile pass only OPENS the menu — group NOT selected (the 1.0.5 bug)", () => {
  const doc = buildDropdownDoc();
  setCheckedRoles(doc, ["Reaper"]);                 // one synchronous pass
  assert.equal(doc._state.opening, true);           // the menu got opened...
  assert.deepEqual(getCheckedRoles(doc), ["All"]);  // ...but Reaper is NOT selected yet (still default "All")
});

test("setRolesReliably converges across the dropdown render boundary (the 1.0.6 fix)", () => {
  const doc = buildDropdownDoc();
  let done = false;
  // synchronous scheduler simulating React rendering the opened menu between passes
  const schedule = (fn) => { doc.render(); fn(); };
  setRolesReliably(doc, ["Reaper"], () => { done = true; }, schedule);
  assert.equal(done, true);
  assert.deepEqual(getCheckedRoles(doc), ["Reaper"]);  // second pass (menu rendered) lands the selection
});

test("setRolesReliably gives up after bounded attempts if the menu never renders (no infinite loop)", () => {
  const doc = buildDropdownDoc();
  let done = false;
  const schedule = (fn) => { fn(); };               // never render -> options never go live
  setRolesReliably(doc, ["Reaper"], () => { done = true; }, schedule);
  assert.equal(done, true);                          // still terminates (attempt cap)
  assert.deepEqual(getCheckedRoles(doc), ["All"]);   // couldn't apply, but bounded & truthful
});
