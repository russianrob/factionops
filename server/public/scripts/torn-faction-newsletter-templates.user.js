// ==UserScript==
// @name         Faction Newsletter Templates
// @namespace    RussianRob
// @version      1.0.17
// @description  Save and apply reusable templates for your faction newsletter (factions.php → Controls → Newsletter). Inspired by Glasnost's Torn Mail Templates.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/factions.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "1.0.17";
  var STORAGE_KEY = "fnt_templates";
  var menuHideGen = 0;

  function getTemplates() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; } }
  function saveTemplates(t) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  function onNewsletterPage() { return /factions\.php/.test(location.pathname) && /option=newsletter/.test(location.hash); }
  function editorEl() { return document.querySelector(".editorContent, .mce-content-body"); }
  function sourceEl() { return document.querySelector("textarea[class*='sourceArea']"); }
  function sendButton() {
    var cands = document.querySelectorAll("button, [role='button'], a[class*='torn-btn'], div[class*='btn'], input[type='button']");
    for (var i = 0; i < cands.length; i++) {
      var t = String(cands[i].textContent || cands[i].value || "").trim();
      if (t === "Send") return cands[i];
    }
    return null;
  }

  function roleCheckboxes() { return [].slice.call(document.querySelectorAll('input[class*="checkbox-button__"]')); }
  function roleLabel(cb) { var c = cb; for (var h = 0; h < 6 && c; h++) { var t = String(c.textContent || "").trim(); if (t && t.length < 50) return t; c = c.parentElement; } return ""; }
  function normRole(s) { return String(s || "").replace(/\s*\(\d+\)\s*$/, "").trim(); }
  function getCheckedRoles() {
    return roleCheckboxes().filter(function (cb) { return cb.checked; }).map(function (cb) { return normRole(roleLabel(cb)); }).filter(Boolean);
  }
  function clickOption(cb) {
    var label = (cb.closest && cb.closest("label")) || cb.parentElement;
    var ctrl = (label && label.querySelector && label.querySelector(".checkbox-button__control")) || label || cb;
    try { ctrl.click(); } catch (e) {}
  }
  function recipientToggler() { return document.querySelector("button.toggler.multiselect"); }
  function rolesMenuOpen() { return roleCheckboxes().some(function (cb) { return cb.offsetParent !== null; }); }
  function closeRolesMenu() { if (rolesMenuOpen()) { var tg = recipientToggler(); if (tg) { try { tg.click(); } catch (e) {} } } }
  function rolesRoot() { var b = roleCheckboxes()[0]; return (b && b.closest) ? b.closest(".small-select-menu-wrap, .react-dropdown-default, .select-wrap") : null; }
  function ensureHideStyle() {
    if (document.getElementById("fnt-hide-roles-menu")) return;
    var s = document.createElement("style"); s.id = "fnt-hide-roles-menu";
    s.textContent = "[data-fnt-hide-menu] .dropdownList,[data-fnt-hide-menu] ul[class*='dropdown-content'],[data-fnt-hide-menu] li.item{visibility:hidden !important;}";
    (document.head || document.documentElement).appendChild(s);
  }
  function setMenuHidden(on) {
    if (on) { var root = rolesRoot(); if (root && root.setAttribute) { ensureHideStyle(); root.setAttribute("data-fnt-hide-menu", "1"); } }
    else { var marked = document.querySelectorAll("[data-fnt-hide-menu]"); for (var i = 0; i < marked.length; i++) { if (marked[i].removeAttribute) marked[i].removeAttribute("data-fnt-hide-menu"); } }
  }
  function selectGroupInDropdown(roles, onDone) {
    if (!Array.isArray(roles) || !roles.length) { if (onDone) onDone(); return; }
    var want = {}; roles.forEach(function (r) { want[normRole(r)] = 1; });
    var startedClosed = !rolesMenuOpen();
    var gen = ++menuHideGen;
    function unhide() { if (gen === menuHideGen) setMenuHidden(false); }
    function diffBoxes() { return roleCheckboxes().filter(function (cb) { return cb.checked !== !!want[normRole(roleLabel(cb))]; }); }
    function finish() {
      if (startedClosed) {
        closeRolesMenu();
        var tries = 0;
        (function waitClosed() {
          if (gen !== menuHideGen) return;
          if (!rolesMenuOpen() || ++tries >= 16) { unhide(); return; }
          setTimeout(waitClosed, 100);
        })();
      }
      try { if (onDone) onDone(); } catch (e) {}
    }
    var attempts = 0;
    function settle() {
      attempts++;
      var d;
      try { d = diffBoxes(); } catch (e) { finish(); return; }
      if (d.length === 0 || attempts >= 6) { finish(); return; }
      if (!rolesMenuOpen()) { var tg = recipientToggler(); if (tg) { try { tg.click(); } catch (e) {} } }
      d.forEach(clickOption);
      setTimeout(settle, 320);
    }
    if (startedClosed) { setMenuHidden(true); setTimeout(unhide, 5000); }
    diffBoxes().forEach(clickOption);
    setTimeout(settle, 280);
  }
  function rolesLabel(roles) { return (Array.isArray(roles) && roles.length) ? roles.join(", ") : "(no group saved)"; }
  function sendTargetLabel(recips) {
    var specific = (recips || []).filter(function (r) { return normRole(r).toLowerCase() !== "all"; });
    return specific.length ? specific.join(", ") : "the whole faction";
  }

  function tinyEditor() {
    try {
      if (window.tinymce) {
        var eds = window.tinymce.editors || [];
        var el = editorEl();
        for (var i = 0; i < eds.length; i++) { try { if (eds[i].getBody && eds[i].getBody() === el) return eds[i]; } catch (e) {} }
        return window.tinymce.activeEditor || eds[0] || null;
      }
    } catch (e) {}
    return null;
  }

  function getBody() {
    var ed = tinyEditor();
    if (ed) { try { return ed.getContent(); } catch (e) {} }
    var el = editorEl();
    return el ? el.innerHTML : "";
  }

  function setBody(html) {
    var ed = tinyEditor();
    if (ed) {
      try {
        ed.setContent(html || "");
        ed.fire("change"); ed.fire("input"); ed.fire("keyup");
        if (ed.save) ed.save();
        if (window.tinymce && window.tinymce.triggerSave) window.tinymce.triggerSave();
      } catch (e) {}
    }
    var el = editorEl();
    if (el) {
      if (!ed) el.innerHTML = html || "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    var src = sourceEl();
    if (src) {
      src.value = html || "";
      src.dispatchEvent(new Event("input", { bubbles: true }));
      src.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return !!(ed || el);
  }

  function titleInput() { return document.querySelector('input[class*="titleField"]'); }
  function getTitle() { var el = titleInput(); return el ? String(el.value || "") : ""; }
  function setTitle(v) {
    var el = titleInput(); if (!el) return false;
    var val = v == null ? "" : String(v);
    try {
      var proto = (typeof window !== "undefined" && window.HTMLInputElement) ? window.HTMLInputElement.prototype : null;
      var desc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
      if (desc && desc.set) desc.set.call(el, val); else el.value = val;
    } catch (e) { el.value = val; }
    try { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
    return true;
  }

  function btn(id, label, bg) {
    return '<button id="' + id + '" type="button" style="background:' + bg + ';color:#e6e9ee;border:1px solid #2e333d;border-radius:6px;padding:3px 11px;cursor:pointer;font-size:12px;">' + label + "</button>";
  }

  function refreshSelect(sel) {
    var t = getTemplates(), names = Object.keys(t).sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
    sel.innerHTML = '<option value="__fnt_blank__">— blank —</option>'
      + names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + "</option>"; }).join("");
    sel.value = "__fnt_blank__";
  }

  function buildPanel() {
    if (document.getElementById("fnt-panel")) return;
    var editor = editorEl();
    if (!editor) return;
    var panel = document.createElement("div");
    panel.id = "fnt-panel";
    panel.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 8px;padding:7px 10px;background:#16181d;border:1px solid #2e333d;border-radius:7px;font-size:12px;color:#cfd4dc;box-shadow:0 1px 3px rgba(0,0,0,.35);";
    panel.innerHTML =
      '<span style="font-weight:700;color:#e8c44a;">📰 Newsletter Templates</span>'
      + '<select id="fnt-select" style="background:#0e0f12;color:#dde2e8;border:1px solid #2e333d;border-radius:6px;padding:3px 7px;max-width:220px;"></select>'
      + '<span id="fnt-group" style="color:#9fb6ff;font-size:11px;white-space:nowrap;"></span>'
      + btn("fnt-apply", "Apply", "#3b6dff")
      + btn("fnt-qsend", "⚡ Quick Send", "#2f6b45")
      + btn("fnt-save", "Save current…", "#20242c")
      + btn("fnt-del", "Delete", "#20242c")
      + '<span id="fnt-msg" style="color:#7a818c;"></span>';
    editor.insertAdjacentElement("beforebegin", panel);

    var sel = panel.querySelector("#fnt-select");
    refreshSelect(sel);
    function msg(s) { var m = panel.querySelector("#fnt-msg"); if (m) { m.textContent = s ? " " + s : ""; if (s) setTimeout(function () { m.textContent = ""; }, 3000); } }
    function updateGroupInd() {
      var g = panel.querySelector("#fnt-group"); if (!g) return;
      var t = getTemplates(), n = sel.value;
      g.textContent = (n && t[n]) ? "→ " + rolesLabel(t[n].roles) : "";
    }
    function applySelected() {
      var t = getTemplates(), n = sel.value;
      if (n === "__fnt_blank__") { setBody(""); setTitle(""); msg("✓ blanked (body + title cleared)"); return; }
      if (!n || !t[n]) { msg("no template selected"); return; }
      setBody(t[n].body || "");
      setTitle(t[n].title || "");
      var saved = Array.isArray(t[n].roles) ? t[n].roles : [];
      if (!saved.length) { msg("✓ loaded — no saved group, recipients unchanged"); return; }
      msg("loading group…");
      selectGroupInDropdown(saved, function () {
        var present = {}; roleCheckboxes().forEach(function (cb) { var k = normRole(roleLabel(cb)); if (k) present[k] = 1; });
        var missing = saved.filter(function (r) { return !present[normRole(r)]; });
        var now = getCheckedRoles();
        if (missing.length) msg("⚠ loaded — missing group(s): " + missing.join(", ") + "; recipients: " + (now.join(", ") || "none") + " — verify");
        else msg("✓ loaded (recipients: " + (now.join(", ") || "none") + ") — check before sending");
      });
    }
    updateGroupInd();
    sel.addEventListener("change", function () { updateGroupInd(); applySelected(); });
    panel.querySelector("#fnt-apply").addEventListener("click", applySelected);
    panel.querySelector("#fnt-qsend").addEventListener("click", function () {
      var sb = sendButton();
      if (!sb) { msg("⚠ Send button not found"); return; }
      var who = sendTargetLabel(getCheckedRoles());
      sb.click();
      msg("✓ sent to " + who);
    });
    panel.querySelector("#fnt-save").addEventListener("click", function () {
      var name = prompt("Save the current newsletter content as a template — name:");
      if (name == null) return;
      name = name.trim(); if (!name) return;
      var t = getTemplates();
      if (t[name] && !confirm('"' + name + '" already exists. Overwrite it?')) return;
      var roles = getCheckedRoles();
      t[name] = { body: getBody(), roles: roles, title: getTitle() };
      saveTemplates(t); refreshSelect(sel); sel.value = name; updateGroupInd(); msg("✓ saved (title + body + group: " + rolesLabel(roles) + ")");
    });
    panel.querySelector("#fnt-del").addEventListener("click", function () {
      var t = getTemplates(), n = sel.value;
      if (!n || !t[n]) return;
      if (!confirm('Delete template "' + n + '"?')) return;
      delete t[n]; saveTemplates(t); refreshSelect(sel); updateGroupInd(); msg("deleted");
    });
  }

  function removePanel() { var p = document.getElementById("fnt-panel"); if (p) p.remove(); setMenuHidden(false); }

  var _pending = null;
  function ensure() {
    if (!onNewsletterPage()) { removePanel(); if (_pending) { clearInterval(_pending); _pending = null; } return; }
    if (document.getElementById("fnt-panel")) return;
    if (editorEl()) { buildPanel(); return; }
    if (_pending) return;
    var tries = 0;
    _pending = setInterval(function () {
      tries++;
      if (!onNewsletterPage()) { clearInterval(_pending); _pending = null; removePanel(); return; }
      if (editorEl()) { clearInterval(_pending); _pending = null; buildPanel(); }
      else if (tries > 50) { clearInterval(_pending); _pending = null; }
    }, 300);
  }

  window.addEventListener("hashchange", ensure);
  new MutationObserver(function (muts) {
    if (!onNewsletterPage()) return;
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (t && t.id !== "fnt-panel" && !(t.closest && t.closest("#fnt-panel"))) {
        if (!document.getElementById("fnt-panel") && editorEl()) buildPanel();
        return;
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  ensure();
})();
