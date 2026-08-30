// ==UserScript==
// @name         Torn Gym Refill Banner
// @namespace    warboard.gym.refill
// @version      1.1.0
// @description  Shows a banner next to the Gym title reminding you to use your daily energy refill if it's still available. Live re-checks and clears itself once used.
// @author       you
// @match        https://www.torn.com/gym.php*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BANNER_ID = 'wb-gym-refill-banner';
  const KEY_STORE = 'wb_gym_refill_apikey';
  const RECHECK_MS = 3 * 60 * 1000; // re-check every 3 minutes

  function getKey() {
    let k = GM_getValue(KEY_STORE, '');
    if (!k) {
      k = (window.prompt(
        'Gym Refill Banner: paste a Torn API key (Limited access is enough — used only to check your daily energy refill).'
      ) || '').trim();
      if (k) GM_setValue(KEY_STORE, k);
    }
    return k;
  }

  function makeBanner(text) {
    const el = document.createElement('a');
    el.id = BANNER_ID;
    el.href = 'https://www.torn.com/points.php';
    el.textContent = text;
    el.title = 'Go to Points page to use your energy refill';
    el.style.cssText = [
      'float:left',
      'margin:2px 0 0 12px',
      'padding:2px 10px',
      'line-height:18px',
      'font-size:12px',
      'font-weight:700',
      'color:#111',
      'text-decoration:none',
      'background:linear-gradient(#ffe259,#ffa751)',
      'border:1px solid #d18b00',
      'border-radius:4px',
      'box-shadow:0 1px 2px rgba(0,0,0,.3)',
      'white-space:nowrap',
      'cursor:pointer'
    ].join(';');
    return el;
  }

  function place(text) {
    const h4 = document.querySelector('h4#skip-to-content');
    if (!h4) return false;
    let el = document.getElementById(BANNER_ID);
    if (!el) {
      el = makeBanner(text);
      h4.insertAdjacentElement('afterend', el);
    } else {
      el.textContent = text;
      el.style.display = '';
    }
    return true;
  }

  function remove() {
    const el = document.getElementById(BANNER_ID);
    if (el) el.remove();
  }

  function checkRefill() {
    const key = getKey();
    if (!key) return;
    GM_xmlhttpRequest({
      method: 'GET',
      url: 'https://api.torn.com/user/?selections=refills&key=' + encodeURIComponent(key),
      onload(res) {
        let data;
        try { data = JSON.parse(res.responseText); } catch (e) { return; }
        if (data.error) {
          // Bad/expired key: clear it so it re-prompts next load, and show nothing.
          if (data.error.code === 2 || data.error.code === 10) GM_setValue(KEY_STORE, '');
          return;
        }
        const used = data.refills && data.refills.energy_refill_used;
        if (used === false) {
          place('⚡ Energy refill available — use it!');
        } else {
          remove(); // already used today (or unknown) → no banner
        }
      }
    });
  }

  // Re-assert placement if React re-renders the title row and drops our node.
  const mo = new MutationObserver(() => {
    const el = document.getElementById(BANNER_ID);
    const h4 = document.querySelector('h4#skip-to-content');
    if (el && h4 && el.parentElement !== h4.parentElement) {
      h4.insertAdjacentElement('afterend', el);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Live re-checks: on interval and when the tab regains focus.
  checkRefill();
  setInterval(checkRefill, RECHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkRefill();
  });
})();