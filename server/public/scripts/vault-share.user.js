// ==UserScript==
// @name         Vault Share
// @namespace    RussianRob
// @version      0.1.0
// @description  Shows your share vs your spouse's share of the shared property vault, tracking each person's deposits/withdrawals. Set your share once; it auto-tracks from there.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/properties.php*
// @connect      tornwar.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const SCRIPT_VERSION = "0.1.0";
  const K_SHARE = "vs_myShare";
  const K_LASTTX = "vs_lastTxKey";
  const K_TOTAL = "vs_lastTotal";
  const K_CFG = "vs_configured";

  function gv(k, d) { try { return GM_getValue(k, d); } catch (e) { return d; } }
  function sv(k, v) { try { GM_setValue(k, v); } catch (e) {} }
  function money(n) { return "$" + Math.round(Number(n) || 0).toLocaleString("en-US"); }
  function digits(s) { const m = String(s || "").replace(/[^0-9]/g, ""); return m ? parseInt(m, 10) : NaN; }

  let _diagSent = false;
  function diag(tag, data) {
    if (_diagSent) return; _diagSent = true;
    try {
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://tornwar.com/api/debug/client-log",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "vault-share-diag", data: Object.assign({ event: tag, v: SCRIPT_VERSION }, data) }),
      });
    } catch (e) {}
  }

  // Own player id from the sidebar profile link (settings menu) or any self XID link.
  function ownId() {
    const a =
      document.querySelector('.settings-menu .link a[href*="XID="]') ||
      document.querySelector('a[href*="profiles.php?XID="]');
    const m = a && a.href.match(/XID=(\d+)/);
    return m ? m[1] : null;
  }

  // The vault transaction rows. Torn renders them as list items containing
  // li.amount / li.balance (per the property vault log). Try a few container shapes.
  function findRows() {
    const sels = [
      ".vault-cont .transaction",
      "ul[class*='vault'] > li",
      ".transaction-list > li",
      "li.transaction",
      "ul.transactions > li",
    ];
    for (const s of sels) {
      const found = Array.from(document.querySelectorAll(s)).filter(
        (r) => r.querySelector("li.amount, .amount") && r.querySelector("li.balance, .balance")
      );
      if (found.length) return found;
    }
    // last resort: any element holding both an amount + balance child
    return Array.from(document.querySelectorAll("li, tr, div")).filter(
      (r) => r.querySelector("li.amount, .amount") && r.querySelector("li.balance, .balance") &&
             (r.querySelector(".user .name, .user.name") || r.querySelector(".type"))
    );
  }

  function parseRow(row) {
    const nameEl = row.querySelector(".user .name, .user.name, [class*='user'] .name");
    const title = (nameEl && (nameEl.getAttribute("title") || nameEl.textContent)) || "";
    const idM = title.match(/\[(\d+)\]/);
    const id = idM ? idM[1] : null;
    const typeText = (row.querySelector(".type") || {}).textContent || "";
    const isDeposit = /deposit/i.test(typeText);
    const amount = digits((row.querySelector("li.amount, .amount") || {}).textContent);
    const balance = digits((row.querySelector("li.balance, .balance") || {}).textContent);
    const date = ((row.querySelector(".transaction-date, .date") || {}).textContent || "").trim();
    const time = ((row.querySelector(".transaction-time, .time") || {}).textContent || "").trim();
    const key = (date + " " + time).trim() + "|" + (isNaN(balance) ? amount : balance);
    return { id, isDeposit, amount, balance, key };
  }

  function applyNewTransactions(rows, me) {
    // rows are newest-first. Collect rows newer than the stored anchor, apply oldest-first.
    const lastKey = gv(K_LASTTX, "");
    let myShare = Number(gv(K_SHARE, 0));
    const fresh = [];
    for (const r of rows) {
      if (r.key === lastKey) return { myShare, drift: false, applied: fresh.length, anchorFound: true, fresh };
      fresh.push(r);
    }
    // anchor not in the visible log → can't reconcile precisely
    return { myShare, drift: true, applied: 0, anchorFound: false, fresh: [] };
  }

  function render(rows, me) {
    const total = rows.length ? (isNaN(rows[0].balance) ? Number(gv(K_TOTAL, 0)) : rows[0].balance) : Number(gv(K_TOTAL, 0));
    const configured = gv(K_CFG, false);

    let body, drift = false;
    if (!configured) {
      body = `<div class="vs-row"><span>Set how much of the <b>${money(total)}</b> vault is <b>yours</b>:</span></div>
              <div class="vs-row"><input id="vs-input" type="text" placeholder="e.g. 50000000" />
              <button id="vs-save" class="torn-btn">Save</button></div>`;
    } else {
      const res = applyNewTransactions(rows, me);
      let myShare = res.myShare;
      // apply fresh (mine only), oldest-first
      res.fresh.slice().reverse().forEach((t) => {
        if (t.id && me && t.id === me && !isNaN(t.amount)) {
          myShare += t.isDeposit ? t.amount : -t.amount;
        }
      });
      sv(K_SHARE, myShare);
      sv(K_LASTTX, rows[0].key);
      sv(K_TOTAL, total);
      const spouse = total - myShare;
      drift = res.drift || myShare < -1 || myShare > total + 1;
      body = `<div class="vs-split">
                <div class="vs-cell"><div class="vs-lbl">You</div><div class="vs-amt vs-you">${money(myShare)}</div></div>
                <div class="vs-cell"><div class="vs-lbl">Spouse</div><div class="vs-amt vs-sp">${money(spouse)}</div></div>
                <div class="vs-cell"><div class="vs-lbl">Total</div><div class="vs-amt">${money(total)}</div></div>
              </div>
              ${drift ? `<div class="vs-warn">⚠ Numbers may have drifted — <a href="#" id="vs-reset">re-set your share</a>.</div>`
                      : `<div class="vs-row"><a href="#" id="vs-reset">re-set</a></div>`}`;
    }

    let panel = document.getElementById("vs-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "vs-panel";
      const anchor = document.querySelector(".vault-cont, .content-wrapper, .properties-cont, #properties") || document.body;
      anchor.insertBefore(panel, anchor.firstChild);
    }
    panel.innerHTML = `<div class="vs-title">🔐 Vault Share</div>${body}`;

    const save = document.getElementById("vs-save");
    if (save) save.onclick = () => {
      const v = digits(document.getElementById("vs-input").value);
      if (isNaN(v)) return;
      sv(K_SHARE, v); sv(K_LASTTX, rows[0] ? rows[0].key : ""); sv(K_TOTAL, total); sv(K_CFG, true);
      render(rows, me);
    };
    const reset = document.getElementById("vs-reset");
    if (reset) reset.onclick = (e) => { e.preventDefault(); sv(K_CFG, false); render(rows, me); };
  }

  const CSS = `
    #vs-panel{background:#1c1c1c;border:1px solid #444;border-radius:8px;padding:10px 12px;margin:8px 0;color:#eee;font-size:13px}
    #vs-panel .vs-title{font-weight:700;color:#e0ce00;margin-bottom:6px}
    #vs-panel .vs-split{display:flex;gap:10px;text-align:center}
    #vs-panel .vs-cell{flex:1;background:#262626;border-radius:6px;padding:6px}
    #vs-panel .vs-lbl{font-size:11px;color:#aaa}
    #vs-panel .vs-amt{font-weight:700;font-size:15px}
    #vs-panel .vs-you{color:#7CFC00}#vs-panel .vs-sp{color:#5bc0ff}
    #vs-panel .vs-row{display:flex;align-items:center;gap:8px;margin-top:6px}
    #vs-panel input{flex:1;background:#111;border:1px solid #555;border-radius:4px;color:#fff;padding:4px 6px}
    #vs-panel .vs-warn{margin-top:6px;color:#ffb74d;font-size:12px}
    #vs-panel a{color:#e0ce00}`;
  const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);

  let tries = 0;
  function tick() {
    const rows = findRows();
    if (rows.length) {
      render(rows.map(parseRow), ownId());
      return;
    }
    if (++tries > 40) { // ~20s of polling, then give up + report what's on the page
      const cont = document.querySelector(".vault-cont, [class*='vault']");
      diag("rows-not-found", {
        hasVaultCont: !!cont,
        url: location.href,
        sample: (cont ? cont.outerHTML : document.body.innerHTML).slice(0, 1800),
      });
      return;
    }
    setTimeout(tick, 500);
  }
  tick();
  // Torn is an SPA — re-run when the property view changes.
  new MutationObserver(() => { if (!document.getElementById("vs-panel") && findRows().length) { tries = 0; tick(); } })
    .observe(document.body, { childList: true, subtree: true });
})();
