// ==UserScript==
// @name         RW Pricer — Forum Screenshots
// @namespace    RussianRob
// @author       RussianRob
// @version      1.5.5
// @description  Prices the item screenshots people paste in forum trade threads. Reads the card out of the picture and puts the RW Pricer estimate on it.
// @match        https://www.torn.com/forums.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      tornwar.com
// @run-at       document-idle
// @license      GPL-3.0-or-later
// @updateURL    https://tornwar.com/scripts/torn-rwp-forum.meta.js
// @downloadURL  https://tornwar.com/scripts/torn-rwp-forum.user.js
// ==/UserScript==

/* CHANGELOG
 * 1.5.5  Shows the name the price was built on. A cropped card returns no
 *         name of its own and is identified by its shop price, so the badge
 *         was reading null off the item and printing it.
 * 1.5.4  The cog opens a sign-in box and nothing else. The counters and
 *         request log it grew during debugging are console-only now.
 * 1.5.3  The badge speaks English. "sales by roll (Orange, 6 price points)"
 *         told the reader nothing they could act on.
 * 1.5.2  When a card does not name its weapon, the post's own text is offered
 *         to the reader as a caption and the read is tried once more. The badge
 *         now shows the rarity the price was built on, marked when it was
 *         worked out from the roll rather than read off the card.
 * 1.5.1  A name the catalogue does not have is treated as an unread card. The
 *         reader invented "Big Al's Gun Shop Katana" for a Kodachi whose card
 *         was cropped above the name, and said it was confident.
 * 1.5.0  The panel hangs off a cog beside the Forums heading instead of floating
 *        over the bottom-right corner, where it covered posts and looked like a
 *        notification rather than a control. Anchored to h4#skip-to-content
 *        inside div.content-title -- Torn's own literal ids and classes, not the
 *        hashed kind, so they survive a re-render.
 *
 *        Positioned FIXED and clamped to the viewport on open, because a panel
 *        laid out inside the content column gets clipped by it.
 * 1.4.0  A real session box instead of window.prompt. The prompt fired once per
 *        browser, could not be reopened, and PDA suppresses it outright -- so a
 *        dismissed or blocked prompt left no way back and no way to tell. The
 *        panel now carries sign in / sign out and says which state it is in.
 *
 *        The key is sent once to /api/auth and never stored; only the session
 *        token is kept, and it is shown masked so you can tell one from another
 *        without it being readable over a shoulder. Plain text input, not a
 *        password field: a password field invites the browser's manager to save
 *        a Torn API key as a login.
 * 1.3.0  snipboard.io and friends. The allowlist grows from what people actually
 *        paste, which the panel is now good enough to report: the second thread
 *        tested showed "host not allowed: snipboard.io" as its only real miss.
 * 1.2.1  Size before host, and Torn's own furniture never reported. A forum page
 *        carries ~66 images and nearly all are 48x48 avatars; checking the host
 *        first meant every one produced a "host not allowed" line, the skip list
 *        filled with them, and a real candidate was pushed out of view. The
 *        diagnostic was reporting the wrong thing loudly.
 * 1.2.0  A panel that says what it actually saw. Reported working on nothing and
 *        prompting for nothing -- and with no prompt there was no evidence at
 *        all, because the prompt only fires after a request, and a request only
 *        happens if an image passed the filters. Torn's CSP forbids pasting a
 *        probe into the console, so the script has to carry its own.
 * 1.1.0  A one-time API key, exchanged for a warboard session, so viewing a
 *        screenshot nobody has read yet actually reads it. Without this the
 *        script could only show images somebody else had already paid for --
 *        including, absurdly, for the person whose money it is.
 *
 *        The key is sent once to /api/auth and never stored: what is kept is the
 *        session token, which is revocable and worth far less if the browser is
 *        shared. Same exchange /gym and /xanax use.
 * 1.0.0  Forum posts have no item DOM to read -- people paste a picture of the
 *        tooltip -- so the card is read out of the image server-side and the
 *        price comes back with it. Results are cached on the server by image
 *        URL and by image CONTENT, so a reposted screenshot is read once ever.
 */

(function () {
  "use strict";

  var SERVER = "https://tornwar.com";
  var TOKEN_KEY = "rwpf_token";
  var NAME_KEY = "rwpf_who";

  function gv(k, d) { try { return GM_getValue(k, d); } catch (e) { return d; } }
  function sv(k, v) { try { GM_setValue(k, v); } catch (e) {} }
  function token() { return gv(TOKEN_KEY, "") || ""; }
  var SEEN = new WeakSet();          // images already handled this page
  var INFLIGHT = 0, MAX_INFLIGHT = 2;
  var QUEUE = [];

  // Only hosts the server will accept anyway — asking about anything else is a
  // round trip that can only be refused.
  var HOSTS = /^editor\.torn\.com$|^(i\.)?snipboard\.io$|^files\.catbox\.moe$|^(i\.)?lensdump\.com$|^i\.imgbb\.com$|^ibb\.co$|^(i\.)?imgur\.com$|^(i\.)?gyazo\.com$|^tornwar\.com$|^(www\.)?torn\.com$|^cdn\.discordapp\.com$|^media\.discordapp\.net$|^i\.ibb\.co$|^i\.postimg\.cc$/i;

  function money(n) {
    if (n == null) return "?";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + Math.round(n / 1e6) + "m";
    return "$" + Math.round(n).toLocaleString();
  }

  // What the script saw, and why it did nothing about it.
  var DIAG = { imgs: 0, furniture: 0, skipped: [], asked: 0, replies: [], wantsSession: false };
  function note(why, src) {
    if (why === "asking") { DIAG.asked++; return; }
    if (DIAG.skipped.length < 12) DIAG.skipped.push(why + "  " + String(src).slice(0, 70));
  }

  /** Put a cog beside the "Forums" heading and hang the panel off it. */
  function ensureCog() {
    if (document.getElementById("rwpf-cog")) return true;
    // Torn's own literal id and classes here, not the hashed ___XXXX kind —
    // these survive a re-render and can be matched exactly.
    var h = document.querySelector("div.content-title h4#skip-to-content")
         || document.querySelector("h4#skip-to-content")
         || document.querySelector("div.content-title h4");
    if (!h) return false;
    var cog = document.createElement("span");
    cog.id = "rwpf-cog";
    cog.textContent = "\u2699\ufe0f";
    cog.title = "RW Pricer — forum screenshots";
    cog.style.cssText = "margin-left:8px;cursor:pointer;font-size:14px;vertical-align:middle;opacity:.85";
    cog.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      var el = document.getElementById("rwpf-diag");
      if (el) { el.remove(); return; }      // second tap closes it
      panel(true);
    });
    h.appendChild(cog);
    return true;
  }

  function placePanel(el) {
    var cog = document.getElementById("rwpf-cog");
    var margin = 8;
    var vw = document.documentElement.clientWidth || 360;
    var vh = document.documentElement.clientHeight || 640;
    var width = Math.min(330, vw - margin * 2);
    el.style.width = width + "px";
    el.style.maxHeight = Math.max(160, vh - margin * 2) + "px";
    el.style.overflowY = "auto";
    if (!cog) { el.style.right = margin + "px"; el.style.bottom = margin + "px"; return; }
    // Measured on open. Fixed, not absolute: laid out inside the content column
    // it would be clipped by it.
    var r = cog.getBoundingClientRect();
    var h = el.offsetHeight || 200;
    var top = r.bottom + 6;
    if (top + h > vh - margin) top = Math.max(margin, r.top - 6 - h);
    if (top < margin) top = margin;
    el.style.top = top + "px";
    el.style.left = Math.max(margin, Math.min(r.left - 10, vw - width - margin)) + "px";
    el.style.right = "auto"; el.style.bottom = "auto";
  }

  function panel(force) {
    var el = document.getElementById("rwpf-diag");
    // Silent unless asked for. It used to appear on every page load and cover
    // the posts it was meant to be pricing.
    if (!el && !force) return;
    if (!el) {
      el = document.createElement("div");
      el.id = "rwpf-diag";
      el.style.cssText = "position:fixed;z-index:2147483647;" +
        "background:rgba(14,17,22,.97);border:1px solid #ff9f2e;border-radius:9px;padding:9px 11px;" +
        "font:11px/1.45 -apple-system,system-ui,sans-serif;color:#e8e6dc;box-shadow:0 8px 26px rgba(0,0,0,.6)";
      document.body.appendChild(el);
    }
    var signedIn = !!token();
    var who = gv(NAME_KEY, "");
    el.innerHTML =
      // A sign-in box, nothing else. It grew image counts, HTTP replies and a
      // list of skipped avatars while the feature was being debugged, none of
      // which means anything to somebody who wants prices on a sale thread.
      // The counters still exist on DIAG for the console; they are not UI.
      "<b style='color:#ff9f2e'>RW Pricer forum</b> " +
      "<span id='rwpf-x' style='opacity:.6;float:right;cursor:pointer'>close</span><br>" +
      "session: <b style='color:" + (signedIn ? "#9fe870" : "#e0b357") + "'>" +
        (signedIn ? ("yes" + (who ? " \u2014 " + String(who).replace(/[<>&]/g, "") : "")) : "no") +
      "</b> " +
      (signedIn
        ? "<span id='rwpf-out' style='cursor:pointer;text-decoration:underline;opacity:.75'>sign out</span>"
        : "<span id='rwpf-in' style='cursor:pointer;color:#7fd4e8;text-decoration:underline'>sign in</span>") +
      (DIAG.wantsSession && !signedIn
        ? "<div style='color:#e0b357;margin-top:4px'>A screenshot here has not been read yet \u2014 sign in to read it.</div>"
        : "") +
      "<div id='rwpf-box' style='display:none;margin-top:7px'>" +
        // Plain text, never a password field: a password field invites the
        // browser's password manager to store a Torn API key as a login.
        "<input id='rwpf-key' type='text' placeholder='Torn API key' autocomplete='off' " +
          "autocorrect='off' autocapitalize='off' spellcheck='false' " +
          "style='width:100%;box-sizing:border-box;background:#0b0d12;border:1px solid #2a2f3a;" +
          "color:#e8e6dc;border-radius:6px;padding:7px 8px;font:12px inherit'>" +
        "<button id='rwpf-go' style='width:100%;margin-top:5px;padding:7px;border:0;border-radius:6px;" +
          "background:#ff9f2e;color:#14170f;font-weight:700;cursor:pointer'>Sign in</button>" +
        "<div id='rwpf-msg' style='margin-top:4px;opacity:.8'>The key is sent once and not stored \u2014 " +
          "only the session token is kept.</div>" +
      "</div>";

    placePanel(el);
    var q = function (id) { return document.getElementById(id); };
    if (q("rwpf-x")) q("rwpf-x").onclick = function () { el.remove(); };
    if (q("rwpf-in")) q("rwpf-in").onclick = function () {
      var box = q("rwpf-box");
      box.style.display = box.style.display === "block" ? "none" : "block";
      if (q("rwpf-key")) q("rwpf-key").focus();
    };
    if (q("rwpf-out")) q("rwpf-out").onclick = function () {
      sv(TOKEN_KEY, ""); sv(NAME_KEY, ""); panel();
    };
    if (q("rwpf-go")) q("rwpf-go").onclick = function () {
      var k = (q("rwpf-key").value || "").trim();
      if (!k) return;
      q("rwpf-msg").textContent = "Checking with Torn\u2026";
      signIn(k, function (err) {
        // The key never lands anywhere but that one request.
        if (q("rwpf-key")) q("rwpf-key").value = "";
        if (err) { if (q("rwpf-msg")) q("rwpf-msg").textContent = err; }
        else panel();
      });
    };
  }

  function style() {
    if (document.getElementById("rwpf-style")) return;
    var s = document.createElement("style");
    s.id = "rwpf-style";
    s.textContent =
      ".rwpf{margin:6px 0 10px;padding:9px 11px;border-radius:9px;font:12.5px/1.5 Verdana,Arial,sans-serif;" +
        "background:rgba(14,17,22,.96);border:1px solid #2a2f3a;color:#e8e6dc;max-width:560px}" +
      ".rwpf .hd{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}" +
      ".rwpf .px{font-size:19px;font-weight:800;color:#9fe870}" +
      ".rwpf .nm{font-weight:700;color:#fff}" +
      ".rwpf .bn{color:#ff9f2e;font-weight:700}" +
      ".rwpf .sub{color:#9aa0ad;font-size:11.5px;margin-top:3px}" +
      ".rwpf .warn{color:#e0b357}" +
      ".rwpf.pending{color:#9aa0ad}";
    document.head.appendChild(s);
  }

  function render(img, data) {
    var box = document.createElement("div");
    box.className = "rwpf";
    var it = data.item, p = data.price;

    // data.unknownItem: the reader returned a name that is not a Torn item.
    // A cropped card names no weapon and the model fills the gap from whatever
    // text sits nearby -- the Kodachi post came back "Big Al's Gun Shop Katana",
    // the sell shop welded to what the picture looked like, and said it was
    // confident. Printing an invented weapon name onto somebody's public sale
    // thread is worse than saying nothing, so nothing is what gets said.
    // The name the PRICE was built on, not the one the card showed. A cropped
    // card honestly returns none, and the shop price on it identifies the
    // weapon server-side — so the item says null while the price says ArmaLite
    // M-15A4. Reading the item put the word "null" on somebody's sale thread.
    var shownName = (p && p.name) || (it && it.name) || null;

    if (!it || data.unknownItem || !shownName) {
      // Say which it is. "No price" and "nobody has paid for a read yet" are
      // different problems and only one of them is yours to fix.
      box.className = "rwpf pending";
      box.textContent = data.needsMember
        ? "RW Pricer: this screenshot has not been read yet."
        : "RW Pricer: could not read an item card in this image.";
      return box;
    }

    var bonuses = (it.bonuses || []).map(function (b) {
      return '<span class="bn">' + b.pct + "% " + b.name + "</span>";
    }).join(" &middot; ");

    box.innerHTML =
      '<div class="hd">' +
        (p ? '<span class="px">' + money(p.estimate) + "</span>" : '<span class="px">no price</span>') +
        '<span class="nm">' + shownName + "</span>" +
        // The rarity the price was actually built on, which is not always the
        // one on the card: a Mag 7 card gave no rarity and the roll said Red.
        // Quality is its own test -- nesting it inside the rarity check meant a
        // card that gave one and not the other lost both.
        (function () {
          var rar = (p && p.rarity) || it.rarity;
          var bits = [];
          if (rar) bits.push(rar + (p && p.inferredRarity ? " (worked out)" : ""));
          if (it.quality) bits.push(it.quality + "%");
          return bits.length ? '<span class="sub">' + bits.join(" &middot; ") + "</span>" : "";
        })() +
      "</div>" +
      (bonuses ? '<div class="sub">' + bonuses + "</div>" : "") +
      // The basis, always. An estimate whose derivation is invisible gets
      // trusted exactly as much as one that measured something.
      // Sentences, not a field list. Somebody reads this mid-trade to decide
      // whether an asking price is fair, and "· 20 sales · range" made them
      // parse a record instead of reading an answer.
      (p ? '<div class="sub">Based on ' + p.basis + "." +
            (p.samples ? " " + p.samples + " sale" + (p.samples === 1 ? "" : "s") : "") +
            (p.low && p.high ? (p.samples ? ", from " : " Sales ran from ") + money(p.low) + " to " + money(p.high) : "") +
            ((p.samples || (p.low && p.high)) ? "." : "") + "</div>" : "") +
      ((p && p.notes || []).map(function (n) {
        return '<div class="sub warn">' + n + "</div>";
      }).join("")) +
      '<div class="sub">These numbers were read out of the picture above, so give them a glance.</div>';
    return box;
  }

  function place(img, node) {
    // After the image, not over it: a forum post is something people read, and
    // covering the picture with the answer hides the evidence for it.
    var anchor = img.closest("a") || img;
    if (anchor.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
  }

  /**
   * The words the picture was posted with, minus anything we put there.
   *
   * A cropped card names no weapon -- the Kodachi post's card starts below the
   * name line -- but the post around it does: "Kodachi - 53% parry". Walk up
   * from the image until a container holds real prose, and stop before the walk
   * reaches the whole page, because a caption is only useful if it is about
   * THIS picture.
   */
  function ownText(node) {
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1) return "";
    // Never feed our own badge back to the reader as evidence.
    if (node.classList && node.classList.contains("rwpf")) return "";
    var out = "";
    for (var i = 0; i < node.childNodes.length; i++) out += ownText(node.childNodes[i]) + " ";
    return out;
  }

  function caption(img) {
    var n = img.parentNode, best = "";
    for (var i = 0; i < 6 && n && n.nodeType === 1; i++, n = n.parentNode) {
      var t = ownText(n).replace(/\s+/g, " ").trim();
      if (t.length > 1200) break;          // too far up: this is the thread, not the post
      if (t.length >= 6) best = t;
      if (best.length >= 40) break;        // enough to name a weapon
    }
    return best.slice(0, 300);
  }

  function ask(img, hint) {
    var url = img.currentSrc || img.src;
    var pending = document.createElement("div");
    pending.className = "rwpf pending";
    pending.textContent = "RW Pricer: reading this screenshot…";
    place(img, pending);

    GM_xmlhttpRequest({
      method: "POST",
      url: SERVER + "/api/rwp/read-image",
      headers: (function () {
        var h = { "Content-Type": "application/json" };
        // Only when we have one. Without it the server still serves cache hits,
        // so an unauthenticated reader is degraded rather than broken.
        var t = token();
        if (t) h.Authorization = "Bearer " + t;
        return h;
      })(),
      data: JSON.stringify(hint ? { url: url, hint: hint } : { url: url }),
      timeout: 45000,
      onload: function (res) {
        INFLIGHT--; pump();
        var data = null;
        try { data = JSON.parse(res.responseText); } catch (e) {}
        DIAG.replies.push("HTTP " + res.status + " " +
          (data ? (data.item ? (data.item.name + (data.price ? " / priced" : " / no price"))
                             : (data.needsMember ? "needs a session" : (data.error || "no item")))
                : String(res.responseText || "").slice(0, 40)));
        panel();
        if (res.status === 401) { sv(TOKEN_KEY, ""); }
        if (!data || data.error) { pending.remove(); return; }
        // No item, or a name the catalogue does not have. The card probably
        // does not show the weapon's name -- but the post it was attached to
        // usually does. Try once more with that, and only once: `hint` being
        // set already is what stops this looping.
        if (!hint && (data.unknownItem || (!data.item && !data.needsMember))) {
          var cap = caption(img);
          if (cap) {
            DIAG.replies.push("retrying with the post's caption");
            pending.remove();
            INFLIGHT++;
            ask(img, cap);
            return;
          }
        }
        // Seen an image nobody has read, and we have no session: offer once.
        if (data.needsMember && !token()) {
          DIAG.wantsSession = true;
          var c = document.getElementById("rwpf-cog");
          // Colour the cog instead of opening anything: something needs you,
          // and you decide when to look.
          if (c) { c.style.opacity = "1"; c.style.filter = "drop-shadow(0 0 4px #e0b357)"; }
        }
        var node = render(img, data);
        pending.parentNode && pending.parentNode.replaceChild(node, pending);
      },
      onerror: function () { INFLIGHT--; pump(); pending.remove(); },
      ontimeout: function () { INFLIGHT--; pump(); pending.remove(); },
    });
  }

  /**
   * Exchange a Torn API key for a warboard session.
   *
   * The key goes to /api/auth and no further; what is kept is the token, which
   * is revocable and useless outside warboard.
   */
  function signIn(key, onDone) {
    GM_xmlhttpRequest({
      method: "POST",
      url: SERVER + "/api/auth",
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ apiKey: key, scriptName: "rwp-forum", scriptVersion: "1.5.5" }),
      timeout: 20000,
      onload: function (res) {
        var d = null;
        try { d = JSON.parse(res.responseText); } catch (e) {}
        if (d && d.token) {
          sv(TOKEN_KEY, d.token);
          sv(NAME_KEY, (d.player && d.player.name) || (d.user && d.user.name) || "");
          // Let every image have another go now that a read can be paid for.
          SEEN = new WeakSet();
          DIAG.skipped = []; DIAG.replies = []; DIAG.asked = 0;
          onDone(null);
          scan();
        } else {
          onDone((d && d.error) || "warboard would not accept that key");
        }
      },
      onerror: function () { onDone("could not reach warboard"); },
      ontimeout: function () { onDone("warboard timed out"); },
    });
  }

  function pump() {
    while (INFLIGHT < MAX_INFLIGHT && QUEUE.length) {
      var img = QUEUE.shift();
      if (!img.isConnected) continue;
      INFLIGHT++;
      ask(img);
    }
  }

  function consider(img) {
    if (SEEN.has(img)) return;
    var src = img.currentSrc || img.src || "";
    if (!/^https:/i.test(src)) return;
    var host;
    try { host = new URL(src).hostname; } catch (e) { return; }

    // Torn's own page furniture: avatars, faction tags, honour bars. Dozens per
    // page, never an item card. Dropped without a word — a diagnostic that
    // reports the obvious loudly hides the thing you needed to see.
    if (/^(avatars|factiontags|awards|icons)\.torn\.com$/i.test(host)) { DIAG.furniture++; return; }

    // Size before host. An item tooltip is a wide screenshot; anything small is
    // furniture whatever it is served from, and saying so about 60 avatars is
    // what buried the useful line last time.
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (w && w < 260) { note("too small (" + w + "x" + h + ")", src); return; }
    if (h && h < 120) { note("too short (" + w + "x" + h + ")", src); return; }

    if (!HOSTS.test(host)) { note("host not allowed: " + host, src); return; }
    // An item tooltip is a wide-ish screenshot. Avatars, emoji and forum
    // furniture are small, and asking about them is noise on every thread.
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (w && w < 260) { note("too narrow (" + w + "x" + h + ")", src); return; }
    if (h && h < 120) { note("too short (" + w + "x" + h + ")", src); return; }
    note("asking", src);
    SEEN.add(img);
    QUEUE.push(img);
    pump();
  }

  function scan() {
    style();
    ensureCog();
    var imgs = document.querySelectorAll("img");
    DIAG.imgs = imgs.length;
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.complete) consider(img);
      else img.addEventListener("load", function () { consider(this); }, { once: true });
    }
  }

  // Torn's forums are a single-page app: posts arrive without a navigation, so
  // a one-shot scan sees only whatever happened to be rendered first.
  var t = null;
  new MutationObserver(function () {
    clearTimeout(t);
    t = setTimeout(scan, 400);
  }).observe(document.body, { childList: true, subtree: true });

  scan();
})();
