// ==UserScript==
// @name         Faction Newsletter Templates
// @namespace    RussianRob
// @version      1.0.8
// @description  Save and apply reusable templates for your faction newsletter (factions.php → Controls → Newsletter). Inspired by Glasnost's Torn Mail Templates.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/factions.php*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://tornwar.com/scripts/torn-faction-newsletter-templates.user.js
// @updateURL    https://tornwar.com/scripts/torn-faction-newsletter-templates.meta.js
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "1.0.8";
  var STORAGE_KEY = "fnt_templates";

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
  function setCheckedRoles(roles) {
    if (!Array.isArray(roles) || !roles.length) return;
    var want = {}; roles.forEach(function (r) { want[normRole(r)] = 1; });
    roleCheckboxes().forEach(function (cb) {
      var desired = !!want[normRole(roleLabel(cb))];
      if (cb.checked !== desired) { try { cb.click(); } catch (e) {} }
    });
  }
  function setRolesReliably(roles, onDone) {
    if (!Array.isArray(roles) || !roles.length) { if (onDone) onDone(); return; }
    var attempts = 0;
    function target() {
      var present = {}; roleCheckboxes().forEach(function (cb) { var k = normRole(roleLabel(cb)); if (k) present[k] = 1; });
      return roles.map(normRole).filter(function (r) { return present[r]; }).sort().join("|");
    }
    function satisfied() { return getCheckedRoles().slice().sort().join("|") === target(); }
    function pass() {
      attempts++;
      setCheckedRoles(roles);
      if (satisfied() || attempts >= 8) { if (onDone) onDone(); return; }
      setTimeout(pass, 180);
    }
    pass();
  }
  function rolesLabel(roles) { return (Array.isArray(roles) && roles.length) ? roles.join(", ") : "(no group saved)"; }

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

  function btn(id, label, bg) {
    return '<button id="' + id + '" type="button" style="background:' + bg + ';color:#e6e9ee;border:1px solid #2e333d;border-radius:6px;padding:3px 11px;cursor:pointer;font-size:12px;">' + label + "</button>";
  }

  function refreshSelect(sel) {
    var t = getTemplates(), names = Object.keys(t).sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
    sel.innerHTML = names.length
      ? names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + "</option>"; }).join("")
      : '<option value="">(no templates saved)</option>';
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
      + btn("fnt-diag", "🔍", "#3a2b66")
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
      if (!n || !t[n]) { msg("no template selected"); return; }
      setBody(t[n].body || "");
      var saved = Array.isArray(t[n].roles) ? t[n].roles : [];
      if (saved.length) msg("✓ body loaded — set the group manually for now (auto-select being fixed): " + rolesLabel(saved));
      else msg("✓ body loaded — no saved group");
    }
    var DIAG = { active: false, t0: 0, timer: 0, log: [], sig: "" };
    function ddContainer() { var b = roleCheckboxes()[0]; return b ? (b.closest(".react-dropdown-default, .small-select-menu-wrap, .select-wrap, [class*='dropdown']") || b.parentElement) : null; }
    function diagAncestry() { var b = roleCheckboxes()[0], out = [], c = b; for (var h = 0; h < 9 && c; h++) { out.push(String(c.tagName || "") + "." + String(c.className || "").replace(/\s+/g, ".").slice(0, 54)); c = c.parentElement; } return out; }
    function diagSnap() { var c = ddContainer(); return { cls: String((c && c.className) || "").slice(0, 70), checked: getCheckedRoles() }; }
    function diagSig(s) { return s.cls + "|" + s.checked.join(","); }
    function toggleDiag() {
      if (!DIAG.active) {
        DIAG.active = true; DIAG.t0 = Date.now(); DIAG.log = [];
        var base = diagSnap(); base.t = 0; base.kind = "state"; DIAG.log.push(base); DIAG.sig = diagSig(base);
        DIAG.onClick = function (e) {
          var el = e.target; if (!el || !el.closest) return;
          var host = el.closest("label,li,button,[role=button]");
          DIAG.log.push({ t: Date.now() - DIAG.t0, kind: "click", tag: el.tagName, cls: String(el.className || "").slice(0, 50), txt: String(el.textContent || "").trim().slice(0, 28), hostTag: host ? host.tagName : null, hostCls: host ? String(host.className || "").slice(0, 44) : null, hostTxt: host ? String(host.textContent || "").trim().slice(0, 28) : null });
          if (DIAG.log.length > 80) DIAG.log.shift();
        };
        document.addEventListener("click", DIAG.onClick, true);
        DIAG.timer = setInterval(function () {
          var s = diagSnap(), sig = diagSig(s);
          if (sig !== DIAG.sig) { DIAG.sig = sig; s.t = Date.now() - DIAG.t0; s.kind = "state"; DIAG.log.push(s); if (DIAG.log.length > 80) DIAG.log.shift(); }
        }, 150);
        msg("🔍 recording — OPEN the recipients dropdown, click your group, then tap 🔍 again");
      } else {
        DIAG.active = false; if (DIAG.timer) clearInterval(DIAG.timer);
        if (DIAG.onClick) { try { document.removeEventListener("click", DIAG.onClick, true); } catch (e) {} }
        var payload = { v: SCRIPT_VERSION, count: roleCheckboxes().length, ancestry: diagAncestry(), log: DIAG.log };
        var str = "FNT-DIAG " + JSON.stringify(payload);
        try { console.log(str); } catch (e) {}
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(str); } catch (e) {}
        msg("🔍 copied to clipboard (+ console) — paste it to me");
      }
    }
    updateGroupInd();
    sel.addEventListener("change", function () { updateGroupInd(); applySelected(); });
    panel.querySelector("#fnt-apply").addEventListener("click", applySelected);
    panel.querySelector("#fnt-diag").addEventListener("click", toggleDiag);
    panel.querySelector("#fnt-qsend").addEventListener("click", function () {
      var sb = sendButton();
      if (!sb) { msg("⚠ Send button not found"); return; }
      if (!confirm("Send this newsletter to the whole faction now?")) return;
      sb.click();
      msg("sent");
    });
    panel.querySelector("#fnt-save").addEventListener("click", function () {
      var name = prompt("Save the current newsletter content as a template — name:");
      if (name == null) return;
      name = name.trim(); if (!name) return;
      var t = getTemplates();
      if (t[name] && !confirm('"' + name + '" already exists. Overwrite it?')) return;
      var roles = getCheckedRoles();
      t[name] = { body: getBody(), roles: roles };
      saveTemplates(t); refreshSelect(sel); sel.value = name; updateGroupInd(); msg("✓ saved (group: " + rolesLabel(roles) + ")");
    });
    panel.querySelector("#fnt-del").addEventListener("click", function () {
      var t = getTemplates(), n = sel.value;
      if (!n || !t[n]) return;
      if (!confirm('Delete template "' + n + '"?')) return;
      delete t[n]; saveTemplates(t); refreshSelect(sel); updateGroupInd(); msg("deleted");
    });
  }

  function removePanel() { var p = document.getElementById("fnt-panel"); if (p) p.remove(); }

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
