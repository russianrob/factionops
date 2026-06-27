// ==UserScript==
// @name         Faction Newsletter Templates
// @namespace    RussianRob
// @version      1.0.0
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
  var SCRIPT_VERSION = "1.0.0";
  var STORAGE_KEY = "fnt_templates";

  function getTemplates() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; } }
  function saveTemplates(t) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  function onNewsletterPage() { return /factions\.php/.test(location.pathname) && /option=newsletter/.test(location.hash); }
  function editorEl() { return document.querySelector(".editorContent, .mce-content-body"); }
  function sourceEl() { return document.querySelector("textarea[class*='sourceArea']"); }

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
      + btn("fnt-apply", "Apply", "#3b6dff")
      + btn("fnt-save", "Save current…", "#20242c")
      + btn("fnt-del", "Delete", "#20242c")
      + '<span id="fnt-msg" style="color:#7a818c;"></span>';
    editor.insertAdjacentElement("beforebegin", panel);

    var sel = panel.querySelector("#fnt-select");
    refreshSelect(sel);
    function msg(s) { var m = panel.querySelector("#fnt-msg"); if (m) { m.textContent = s ? " " + s : ""; if (s) setTimeout(function () { m.textContent = ""; }, 2500); } }

    panel.querySelector("#fnt-apply").addEventListener("click", function () {
      var t = getTemplates(), n = sel.value;
      if (!n || !t[n]) { msg("no template selected"); return; }
      setBody(t[n].body || "");
      msg("✓ applied — check it before sending");
    });
    panel.querySelector("#fnt-save").addEventListener("click", function () {
      var name = prompt("Save the current newsletter content as a template — name:");
      if (name == null) return;
      name = name.trim(); if (!name) return;
      var t = getTemplates();
      if (t[name] && !confirm('"' + name + '" already exists. Overwrite it?')) return;
      t[name] = { body: getBody() };
      saveTemplates(t); refreshSelect(sel); sel.value = name; msg("✓ saved");
    });
    panel.querySelector("#fnt-del").addEventListener("click", function () {
      var t = getTemplates(), n = sel.value;
      if (!n || !t[n]) return;
      if (!confirm('Delete template "' + n + '"?')) return;
      delete t[n]; saveTemplates(t); refreshSelect(sel); msg("deleted");
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
