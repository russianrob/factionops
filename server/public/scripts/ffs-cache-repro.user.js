// ==UserScript==
// @name         FFS Cache Bug Repro
// @namespace    RussianRob
// @version      1.0.0
// @description  Standalone, on-demand reproduction of the FFS banner IndexedDB bug: a WebView silently closes the cache connection, the old read pattern hangs forever (estimates blank), the reopen-retry fix recovers. Builds its own throwaway DB — does NOT touch the real FFS banner. Tap the buttons in order.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  "use strict";
  var DB_NAME = "ffs-cache-repro";
  var STORE = "cache";
  var db = null;

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = function () { db = req.result; resolve(db); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function seed() {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ id: "demo", value: "1.39b (cached estimate)" });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }
  function silentClose() { try { db.close(); } catch (e) {} }

  function readOLD() {
    return new Promise(async function (resolve, reject) {
      if (!db) await openDb();
      var tx = db.transaction(STORE, "readonly");
      var r = tx.objectStore(STORE).get("demo");
      r.onsuccess = function () { resolve(r.result && r.result.value); };
      r.onerror = function () { reject(r.error); };
    });
  }

  async function getTx(mode) {
    for (var attempt = 0; attempt < 2; attempt++) {
      if (!db) { try { await openDb(); } catch (e) { db = null; if (attempt) throw e; continue; } }
      try { return db.transaction(STORE, mode); }
      catch (e) { try { if (db) db.close(); } catch (_) {} db = null; if (attempt) throw e; }
    }
    throw new Error("could not open transaction");
  }
  function readFIXED() {
    return new Promise(async function (resolve, reject) {
      var t; try { t = await getTx("readonly"); } catch (e) { reject(e); return; }
      var r = t.objectStore(STORE).get("demo");
      r.onsuccess = function () { resolve(r.result && r.result.value); };
      r.onerror = function () { reject(r.error); };
    });
  }
  function withTimeout(p, ms) {
    return Promise.race([
      p.then(function (v) { return { ok: true, v: v }; }, function (e) { return { err: e }; }),
      new Promise(function (res) { setTimeout(function () { res({ hung: true }); }, ms); })
    ]);
  }

  function build() {
    if (document.getElementById("ffsrepro")) return;
    var css = "#ffsrepro{position:fixed;right:10px;bottom:10px;z-index:2147483647;font:12px/1.4 system-ui,Arial,sans-serif;}" +
      "#ffsrepro .pill{background:#3a2b66;color:#fff;border:0;border-radius:14px;padding:6px 12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5);}" +
      "#ffsrepro .panel{display:none;width:280px;background:#16181d;color:#cfd4dc;border:1px solid #2e333d;border-radius:9px;box-shadow:0 4px 16px rgba(0,0,0,.55);overflow:hidden;}" +
      "#ffsrepro.open .panel{display:block;} #ffsrepro.open .pill{display:none;}" +
      "#ffsrepro .hd{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#1c1f26;font-weight:700;color:#e8c44a;}" +
      "#ffsrepro .hd button{background:transparent;border:0;color:#9aa0aa;cursor:pointer;font-size:15px;}" +
      "#ffsrepro .bd{padding:9px 10px;}" +
      "#ffsrepro .b{display:block;width:100%;text-align:left;margin:5px 0;padding:7px 9px;border-radius:6px;border:1px solid #2e333d;background:#20242c;color:#dde2e8;cursor:pointer;}" +
      "#ffsrepro .b:hover{background:#262b34;}" +
      "#ffsrepro .b.old{border-color:#7a3b3b;} #ffsrepro .b.fix{border-color:#2f6b45;}" +
      "#ffsrepro .log{margin-top:8px;max-height:150px;overflow:auto;background:#0e0f12;border:1px solid #262a33;border-radius:6px;padding:6px 8px;font-size:11px;white-space:pre-wrap;color:#aeb4bd;}";
    var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
    var root = document.createElement("div"); root.id = "ffsrepro";
    root.innerHTML =
      '<button class="pill">🧪 IDB repro</button>' +
      '<div class="panel">' +
      '<div class="hd"><span>FFS cache bug repro</span><button class="x" title="collapse">▾</button></div>' +
      '<div class="bd">' +
      '<button class="b" data-a="setup">① Setup — open DB + cache a value</button>' +
      '<button class="b" data-a="close">② Simulate WebView silent-close</button>' +
      '<button class="b old" data-a="old">③ Read — OLD code (should HANG)</button>' +
      '<button class="b fix" data-a="fix">④ Read — FIXED code (should recover)</button>' +
      '<div class="log"></div>' +
      '</div></div>';
    document.body.appendChild(root);
    var logEl = root.querySelector(".log");
    function log(s) { logEl.textContent += s + "\n"; logEl.scrollTop = logEl.scrollHeight; }
    root.querySelector(".pill").addEventListener("click", function () { root.classList.add("open"); });
    root.querySelector(".x").addEventListener("click", function () { root.classList.remove("open"); });
    root.querySelector(".bd").addEventListener("click", async function (e) {
      var btn = e.target.closest(".b"); if (!btn) return;
      var a = btn.getAttribute("data-a");
      try {
        if (a === "setup") {
          await openDb(); await seed();
          log("① DB open, value cached: \"1.39b (cached estimate)\"");
        } else if (a === "close") {
          if (!db) { log("⚠ run ① first"); return; }
          silentClose();
          log("② connection .close()d — handle still set (the exact bug state)");
        } else if (a === "old") {
          log("③ OLD read… (3s watchdog)");
          var r1 = await withTimeout(readOLD(), 3000);
          if (r1.hung) log("   ❌ HUNG — never resolved. Bug reproduced.");
          else if (r1.err) log("   threw: " + (r1.err && r1.err.name));
          else log("   resolved: " + r1.v + " (connection was alive)");
        } else if (a === "fix") {
          log("④ FIXED read… (3s watchdog)");
          var r2 = await withTimeout(readFIXED(), 3000);
          if (r2.hung) log("   ❌ still hung (unexpected)");
          else if (r2.err) log("   ❌ rejected: " + (r2.err && r2.err.name));
          else log("   ✅ recovered: " + r2.v + " — reopened + read, no reboot");
        }
      } catch (err) { log("error: " + (err && err.message)); }
    });
  }

  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build);
})();
