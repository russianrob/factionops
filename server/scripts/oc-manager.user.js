// ==UserScript==
// @name         OC Manager
// @namespace    https://torn.com
// @version      2.3.12-pda
// @description  Highlights over-loaned items, helps loan missing OC items (tools, drugs, medical, temporary, clothing, armor), tracks unpaid OC payouts (Modern UI, Dark/Light Mode, PDA compatible)
// @match        https://www.torn.com/factions.php?step=your*
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/oc-manager.user.js
// @updateURL    https://tornwar.com/scripts/oc-manager.meta.js
// ==/UserScript==
// =============================================================================
// CHANGELOG
// =============================================================================
// v2.3.12-pda - Fix: robust armory cache handling for unstacked items (e.g. Construction Helmet) returning "none in stock"
// v2.3.11-pda - Fix: prevent recently loaned items from reappearing when switching tabs due to API lag
// v2.3.10-pda - Fix: fetch both 'armor' and 'armour' categories to bypass Torn API spelling inconsistencies
// v2.3.9-pda - Bump version for PDA cache clearing
// v2.3.8-pda - Fix: deduplicate armory items during pagination to prevent infinite loop of the same page
// v2.3.7-pda - Fix: add armory pagination (support for large inventories) and ensure strict numeric ID matching
// v2.3.6-pda - Bump version for script manager cache clearing
// v2.3.5-pda - Fix: cast armory item IDs to integer to resolve Set lookup failure for Unused tab
// v2.3.4-pda - Fix: Unused tab now excludes combat armoury, only checking known OC armour items
// v2.3.3-pda - Fix: correct armory category spelling from 'armor' to 'armour' so these items show in Unused tab
// v2.3.2-pda - Fix: update Payout link to subTab=completed (Modern OC 2.0 UI compatible)
// v2.3.1-pda - Rename script and files to OC Manager
// v2.3.0-pda - Add Light Mode toggle in settings; implemented CSS variables for theme support
// v2.2.2-pda - Fix: UI lag (removed backdrop-filter), double-click toggle bug, and improved drag performance
// v2.2.2-pda - Fix: robust armory cache handling for unstacked items (e.g. Construction Helmet) returning "none in stock"
// v2.2.1-pda - Fix: corrupted template strings from previous update
// v2.2.0-pda - Modern Dark UI overhaul: Glassmorphism, card-based layouts, and refined animations
// v2.1.0-pda - Fix: robust retrieve button double-click prevention and better feedback
// v2.0.9-pda - Fix: optimize armory cache refresh (no more 7-request hang), restore strict success detection (fixes double-loan)
// v2.0.8-pda - Fix: robust double-loan prevention (disables button immediately, prevents pointer events during loan)
// v2.0.7-pda - Add support for clothing and armor (e.g. Construction Helmet) in armory categories
// v2.0.6-pda - Fix: Payouts now detects item-reward OCs (e.g. Xanax payouts), not just cash
// v2.0.5-pda - Fix: Payouts — add time range + limit to catch recent OCs, log total count for debugging
// v2.0.4-pda - Fix: Payouts detection — accept any success-like status, use cat=successful, add debug logging
// v2.0.3-pda - Fix: prevent double-loan — better success detection, disable button permanently after loan attempt
// v2.0.2-pda - Fix: loan button now always refreshes armory cache (fixes needing to press twice)
// v2.0.1-pda - Unused tab: exclude temporary items (members can freely loan temps)
// v2.0.0-pda - Multi-category armory: loan/retrieve drugs, medical, temporary items (not just tools)
// v1.9.1-pda - Payouts tab: replace broken Pay All with Open Payouts link to Torn's completed crimes page
// v1.9.0-pda - Payouts tab: Pay All button with configurable payout %, pays to faction balance
// v1.8.3-pda - Fix: Unused tab now checks all OC item needs, not just missing ones
// v1.8.2-pda - Fix: resolve item names from Torn API when not in local cache
// v1.8.1-pda - Fix: filter out chain link crimes ($0 reward) from Payouts tab
// v1.8.0-pda - Replace Split tab with Payouts: shows completed OCs awaiting payout
// v1.7.2-pda - Fix: Settings tab now shows PDA key status, allows override/clear
// v1.7.1-pda - Fix: draggable button click detection
// v1.7.0-pda - Draggable OC button with position memory
// v1.6.0-pda - Add API Settings panel, shrink floating button
// v1.5.2-pda - Update URLs to tornwar.com hosting
// v1.5.1-pda - Fix: retrieve role parameter (use "retrieve" not "return")
// v1.5.0-pda - Unused tab card UI with Retrieve Item button
// v1.4.1-pda - Initial PDA-compatible release: highlights over-loaned items,
//              helps loan missing OC tools, split calculator
// =============================================================================
(function () {
  'use strict';

  // ------------------- PDA / API detection -------------------
  let inPDA = false;
  let apiKey = '';
  try {
    const PDAKey = "###PDA-APIKEY###";
    if (PDAKey && PDAKey.charAt(0) !== "#") {
      inPDA = true;
      apiKey = PDAKey;
    }
  } catch (e) {}

  // ------------------- Storage shim (no GM_* APIs) -------------------
  const storage = {
    get(key, def = '') {
      try { const v = localStorage.getItem(key); return v === null ? def : v; }
      catch { return def; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); }
      catch { /* ignore */ }
    }
  };

  const getApiKey = () => {
    const override = storage.get('OCLM_API_KEY', '');
    if (override) return override;
    if (inPDA) return apiKey;
    return '';
  };

  const requireApiKeyOrThrow = () => {
    const key = getApiKey();
    if (!key) {
      const err = new Error('MISSING_API_KEY');
      err.isApiKeyError = true;
      throw err;
    }
    return key;
  };

  const BLACKLISTED_ITEM_IDS = new Set([1012, 226]);

  const overAllocated = new Map();
  const memberNameMap = new Map();
  let membersLoaded = false;

  const armoryCache = new Map();
  let lastRefreshTime = 0;
  const REFRESH_COOLDOWN_MS = 10000; 

  const recentlyLoaned = new Map(); // Map<string (UID), Set<number (IID)>>

  let preparedArmoryID = null;
  let pendingArmoryItemID = null;

  const ITEM_TYPE_TO_ARMORY_TAB = {
    'Tool': 'utilities', 'Drug': 'drugs', 'Medical': 'medical',
    'Booster': 'boosters', 'Temporary': 'temporary', 'Clothing': 'clothing', 'Armor': 'armor'
  };

  const ARMORY_TAB_TO_POST_TYPE = {
    'utilities': 'Tool', 'drugs': 'Drug', 'medical': 'Medical',
    'boosters': 'Booster', 'temporary': 'Temporary', 'clothing': 'Clothing', 'armor': 'Armor'
  };

  const ARMORY_CATEGORIES = ['utilities', 'drugs', 'medical', 'boosters', 'temporary', 'clothing', 'armor', 'armour'];

  // ------------------- Utilities -------------------
  const getRfcvToken = () => {
    const match = document.cookie.match(/rfc_v=([^;]+)/);
    return match ? match[1] : null;
  };

  const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // ------------------- API Helpers -------------------
  const loadMembers = async () => {
    if (membersLoaded) return;
    const key = requireApiKeyOrThrow();
    const res = await fetch(`https://api.torn.com/v2/faction/members?key=${key}`);
    if (!res.ok) throw new Error('Failed to load members');
    const data = await res.json();
    const members = Array.isArray(data?.members) ? data.members : Object.values(data?.members || {});
    members.forEach(m => memberNameMap.set(String(m.id), m.name));
    membersLoaded = true;
  };

  const getMissingOCItems = async () => {
    const key = requireApiKeyOrThrow();
    const res = await fetch(`https://api.torn.com/v2/faction/crimes?cat=available&key=${key}`);
    if (!res.ok) throw new Error('Failed to load OC data');
    const data = await res.json();
    const missing = [];
    const crimes = Array.isArray(data?.crimes) ? data.crimes : Object.values(data?.crimes || {});
    crimes.forEach(crime => {
      crime.slots?.forEach(slot => {
        if (slot.item_requirement && !slot.item_requirement.is_available && slot.user?.id && !BLACKLISTED_ITEM_IDS.has(Number(slot.item_requirement.id))) {
          missing.push({
            crimeName: crime.name,
            position: slot.position,
            itemID: Number(slot.item_requirement.id),
            userID: slot.user.id,
            userName: memberNameMap.get(String(slot.user.id)) || `Unknown [${slot.user.id}]`
          });
        }
      });
    });
    return missing;
  };

  const getAllOCItemRequirements = async () => {
    const key = requireApiKeyOrThrow();
    const res = await fetch(`https://api.torn.com/v2/faction/crimes?cat=available&key=${key}`);
    if (!res.ok) throw new Error('Failed to load OC data');
    const data = await res.json();
    const neededByUser = new Map();
    const crimes = Array.isArray(data?.crimes) ? data.crimes : Object.values(data?.crimes || {});
    crimes.forEach(crime => {
      crime.slots?.forEach(slot => {
        if (slot.item_requirement && slot.user?.id) {
          const uid = String(slot.user.id);
          const iid = Number(slot.item_requirement.id);
          if (!neededByUser.has(uid)) neededByUser.set(uid, new Set());
          neededByUser.get(uid).add(iid);
        }
      });
    });
    return neededByUser;
  };

  const getUnpaidCompletedCrimes = async () => {
    const key = requireApiKeyOrThrow();
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    const res = await fetch(`https://api.torn.com/v2/faction/crimes?cat=successful&filter=executed_at&from=${thirtyDaysAgo}&to=${now}&sort=DESC&limit=100&key=${key}`);
    if (!res.ok) throw new Error('Failed to load completed crimes');
    const data = await res.json();
    if (data?.error) throw new Error(`API error: ${data.error.error || JSON.stringify(data.error)}`);
    const crimes = Array.isArray(data?.crimes) ? data.crimes : (data?.crimes && typeof data.crimes === 'object' ? Object.values(data.crimes) : []);
    const unpaid = [];
    for (const c of crimes) {
      const paidAt = c?.rewards?.payout?.paid_at;
      if (paidAt) continue;
      const money = Number(c?.rewards?.money || 0);
      const respect = Number(c?.rewards?.respect || 0);
      const hasItems = Array.isArray(c?.rewards?.items) ? c.rewards.items.length > 0 : false;
      if (money <= 0 && respect <= 0 && !hasItems) continue;
      unpaid.push({ id: c.id, name: c.name || 'Unknown OC', difficulty: c.difficulty || null, executedAt: c.executed_at, money, respect, hasItems, payoutPct: c?.rewards?.payout?.percentage ?? null });
    }
    return unpaid;
  };

  const ITEM_NAME_CACHE_KEY = 'UTILITY_ITEM_ID_NAME_MAP';
  const getItemNameMap = () => JSON.parse(storage.get(ITEM_NAME_CACHE_KEY, '{}'));
  const setItemName = (itemID, name) => {
    const map = getItemNameMap();
    if (!map[itemID]) { map[itemID] = name; storage.set(ITEM_NAME_CACHE_KEY, JSON.stringify(map)); }
  };
  const getItemName = (itemID) => getItemNameMap()[itemID] || null;

  const resolveItemNames = async (itemIDs) => {
    const unknown = itemIDs.filter(id => !getItemName(id));
    if (unknown.length === 0) return;
    const unique = [...new Set(unknown)];
    try {
      const key = requireApiKeyOrThrow();
      const res = await fetch(`https://api.torn.com/v2/torn/items?ids=${unique.join(',')}&key=${key}`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : Object.values(data?.items || {});
      items.forEach(item => { if (item.id && item.name) setItemName(item.id, item.name); });
    } catch { /* ignore */ }
  };

  // ------------------- Armory Cache -------------------
  const fetchArmoryCategoryJSON = async (category) => {
    const rfcv = getRfcvToken();
    if (!rfcv) throw new Error('Missing RFCV token');
    let allItems = [];
    const seenArmoryIDs = new Set();
    let start = 0;
    while (start < 1000) { // Limit to 20 pages
      const body = new URLSearchParams({ step: 'armouryTabContent', type: category, start: String(start), ajax: 'true' });
      const res = await fetch(`https://www.torn.com/factions.php?rfcv=${rfcv}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
        body, credentials: 'same-origin'
      });
      if (!res.ok) break;
      try {
        const data = await res.json();
        if (!data?.items) break;
        const itemsArr = Array.isArray(data.items) ? data.items : Object.values(data.items);
        if (itemsArr.length === 0) break;
        
        let newItemsAdded = 0;
        for (const entry of itemsArr) {
          if (entry.itemID && entry.name) setItemName(entry.itemID, entry.name);
          if (entry.armoryID && !seenArmoryIDs.has(entry.armoryID)) {
            seenArmoryIDs.add(entry.armoryID);
            allItems.push({ ...entry, itemID: Number(entry.itemID), armoryCategory: category });
            newItemsAdded++;
          }
        }
        
        // If we didn't add any new items from this page, the API is just returning the same first page
        if (newItemsAdded === 0) break;
        
        if (itemsArr.length < 50) break;
        start += 50;
      } catch (e) { console.error('[OCLM] Armory fetch error for', category, e); break; }
    }
    return allItems;
  };

  const fetchAllArmoryItems = async () => {
    const results = await Promise.all(ARMORY_CATEGORIES.map(cat => fetchArmoryCategoryJSON(cat)));
    return results.flat();
  };

  const refreshArmoryCache = async (force = false) => {
    const now = Date.now();
    if (!force && armoryCache.size > 0 && (now - lastRefreshTime < REFRESH_COOLDOWN_MS)) return; 
    armoryCache.clear();
    const items = await fetchAllArmoryItems();
    for (const entry of items) {
      const isUnused = entry.user === false || entry.user === '' || entry.user === 0 || (entry.user && !entry.user.userID);
      if (isUnused) {
        const qty = entry.qty !== undefined ? Number(entry.qty) : (entry.quantity !== undefined ? Number(entry.quantity) : 1);
        if (qty > 0) {
          if (!armoryCache.has(entry.itemID)) {
            armoryCache.set(entry.itemID, { armoryIDs: [entry.armoryID], qty: qty, armoryCategory: entry.armoryCategory });
          } else {
            const cached = armoryCache.get(entry.itemID);
            cached.qty += qty;
            if (!cached.armoryIDs.includes(entry.armoryID)) {
                cached.armoryIDs.push(entry.armoryID);
            }
          }
        }
      }
    }
    lastRefreshTime = Date.now();
  };

  const prepareArmouryForItem = async (itemID) => {
    if (!armoryCache.has(itemID)) await refreshArmoryCache(true);
    else await refreshArmoryCache(false);
    const entry = armoryCache.get(itemID);
    if (!entry || entry.qty <= 0 || !entry.armoryIDs || entry.armoryIDs.length === 0) return null;
    preparedArmoryID = entry.armoryIDs[0];
    pendingArmoryItemID = itemID;
    return preparedArmoryID;
  };

  const getPostTypeForItem = (itemID) => {
    const cached = armoryCache.get(itemID);
    return (cached?.armoryCategory ? ARMORY_TAB_TO_POST_TYPE[cached.armoryCategory] : null) || 'Tool';
  };

  const retrieveItem = async ({ armoryID, itemID, userID, userName, postType }) => {
    const rfcv = getRfcvToken();
    if (!rfcv) throw new Error('Missing RFCV token');
    const itemPostType = postType || getPostTypeForItem(itemID);
    const body = new URLSearchParams({ ajax: 'true', step: 'armouryActionItem', role: 'retrieve', item: armoryID, itemID: itemID, type: itemPostType, user: `${userName} [${userID}]`, quantity: '1' });
    const res = await fetch(`https://www.torn.com/factions.php?rfcv=${rfcv}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body, credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('Retrieve request failed');
    const text = await res.text();
    if (!text.includes('success')) throw new Error('Retrieve failed');
    
    // Remove from local assignment track on successful retrieval
    const uid = String(userID);
    if (recentlyLoaned.has(uid)) { recentlyLoaned.get(uid).delete(itemID); if (recentlyLoaned.get(uid).size === 0) recentlyLoaned.delete(uid); }
  };

  const loanItem = async ({ armoryID, itemID, userID, userName }) => {
    const rfcv = getRfcvToken();
    if (!rfcv) throw new Error('Missing RFCV token');
    const itemPostType = getPostTypeForItem(itemID);
    const body = new URLSearchParams({ ajax: 'true', step: 'armouryActionItem', role: 'loan', item: armoryID, itemID: itemID, type: itemPostType, user: `${userName} [${userID}]`, quantity: '1' });
    const res = await fetch(`https://www.torn.com/factions.php?rfcv=${rfcv}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body, credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('Loan request failed');
    const text = await res.text();
    if (!text.includes('success')) throw new Error('Loan failed');
  };

  const loanPreparedItem = async ({ userID, userName }) => {
    if (!preparedArmoryID || pendingArmoryItemID === null) throw new Error('Armoury not prepared');
    const itemID = pendingArmoryItemID;
    await loanItem({ armoryID: preparedArmoryID, itemID: pendingArmoryItemID, userID, userName });
    const entry = armoryCache.get(pendingArmoryItemID);
    if (entry) { 
      entry.qty -= 1; 
      entry.armoryIDs.shift();
      if (entry.qty <= 0 || entry.armoryIDs.length === 0) {
        armoryCache.delete(pendingArmoryItemID); 
      }
    }
    
    // Add to local assignment track to bypass API cache/lag
    const uid = String(userID);
    if (!recentlyLoaned.has(uid)) recentlyLoaned.set(uid, new Set());
    recentlyLoaned.get(uid).add(itemID);

    preparedArmoryID = null; pendingArmoryItemID = null;
  };

  // ------------------- UI (Modern) -------------------
  const createUI = async () => {
    document.querySelectorAll('#oc-loan-btn, #oc-loan-panel').forEach(el => el.remove());

    const button = document.createElement('div');
    button.id = 'oc-loan-btn';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'OC Loan Manager');
    button.style.cssText = `
      position: fixed; width: 48px; height: 48px; background: linear-gradient(135deg, #2a3cff, #1a27b0);
      color: #fff; display: flex; align-items: center; justify-content: center; border-radius: 50%;
      font-size: 14px; font-weight: 800; cursor: grab; z-index: 99999;
      box-shadow: 0 4px 15px rgba(42, 60, 255, 0.4), inset 0 1px 1px rgba(255,255,255,0.3);
      user-select: none; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease;
      -webkit-tap-highlight-color: transparent; touch-action: none;
    `;
    button.innerHTML = '<span style="letter-spacing:-1px; margin-left:-1px;">OC</span>';

    const savedPos = storage.get('OCLM_BTN_POS', '');
    if (savedPos) {
      try {
        const { x, y } = JSON.parse(savedPos);
        button.style.left = x + 'px'; button.style.top = y + 'px';
      } catch {
        button.style.right = '14px'; button.style.top = '14px';
      }
    } else {
      button.style.right = '14px'; button.style.top = '14px';
    }

    let isDragging = false, wasDragged = false;
    let dragStartX, dragStartY, btnStartX, btnStartY;
    const DRAG_THRESHOLD = 5;

    const getClientPos = (e) => {
      if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    };

    const onDragStart = (e) => {
      const pos = getClientPos(e);
      dragStartX = pos.x; dragStartY = pos.y;
      const rect = button.getBoundingClientRect();
      btnStartX = rect.left; btnStartY = rect.top;
      isDragging = true; wasDragged = false;
      button.style.cursor = 'grabbing';
      button.style.transform = 'scale(0.95)';
      document.addEventListener('mousemove', onDragMove, { passive: false });
      document.addEventListener('mouseup', onDragEnd);
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('touchend', onDragEnd);
    };

    const onDragMove = (e) => {
      if (!isDragging) return;
      const pos = getClientPos(e);
      const dx = pos.x - dragStartX, dy = pos.y - dragStartY;
      if (!wasDragged && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      wasDragged = true;
      e.preventDefault();
      const bw = button.offsetWidth, bh = button.offsetHeight;
      const newX = Math.max(0, Math.min(window.innerWidth - bw, btnStartX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - bh, btnStartY + dy));
      button.style.left = newX + 'px'; button.style.top = newY + 'px'; button.style.right = 'auto';
    };

    const onDragEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      button.style.cursor = 'grab';
      button.style.transform = 'scale(1)';
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('touchend', onDragEnd);
      if (wasDragged) {
        const rect = button.getBoundingClientRect();
        storage.set('OCLM_BTN_POS', JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
      }
    };

    button.addEventListener('mousedown', onDragStart);
    button.addEventListener('touchstart', onDragStart, { passive: false });

    const panel = document.createElement('div');
    panel.id = 'oc-loan-panel';

    const style = document.createElement('style');
    style.id = 'oc-theme-style';
    const updateThemeCSS = () => {
      const isLight = storage.get('OCLM_THEME', 'dark') === 'light';
      style.textContent = `
        :root {
          --oc-bg: ${isLight ? '#f4f4f4' : 'rgba(24, 24, 24, 0.98)'};
          --oc-text: ${isLight ? '#111' : '#efefef'};
          --oc-header-bg: ${isLight ? '#e0e0e0' : 'rgba(0, 0, 0, 0.2)'};
          --oc-border: ${isLight ? '#ccc' : 'rgba(255, 255, 255, 0.1)'};
          --oc-card-bg: ${isLight ? '#fff' : 'rgba(255, 255, 255, 0.03)'};
          --oc-card-border: ${isLight ? '#ddd' : 'rgba(255, 255, 255, 0.06)'};
          --oc-card-text: ${isLight ? '#333' : '#bbb'};
          --oc-card-title: ${isLight ? '#000' : '#fff'};
          --oc-tab-inactive: ${isLight ? '#888' : '#888'};
          --oc-tab-hover: ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'};
          --oc-scrollbar: ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'};
          --oc-status-bar: ${isLight ? '#e8e8e8' : 'rgba(0,0,0,0.2)'};
          --oc-input-bg: ${isLight ? '#fff' : 'rgba(0,0,0,0.3)'};
        }
        #oc-loan-panel {
          position:fixed; width:340px; max-width:92vw; max-height:85vh;
          background: var(--oc-bg); border: 1px solid var(--oc-border);
          border-radius: 16px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
          z-index:99998; opacity:0; visibility:hidden;
          transform:translateY(10px) scale(0.98);
          transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
          display:flex; flex-direction:column; overflow:hidden; color: var(--oc-text);
        }
        #oc-loan-panel * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        #oc-loan-panel .oc-header { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; background: var(--oc-header-bg); border-bottom: 1px solid var(--oc-border); }
        #oc-loan-panel .oc-title { font-size: 16px; font-weight: 700; color: var(--oc-text); }
        #oc-loan-panel .oc-close { cursor: pointer; font-size: 20px; color: #888; transition: color 0.2s; line-height: 1; }
        #oc-loan-panel .oc-close:hover { color: var(--oc-text); }
        #oc-loan-panel .oc-nav { padding: 8px 12px; display: flex; gap: 4px; background: var(--oc-header-bg); border-bottom: 1px solid var(--oc-border); }
        #oc-loan-panel .oc-tab { flex: 1; padding: 8px 4px; background: transparent; border-radius: 8px; border: none; color: var(--oc-tab-inactive); cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s ease; }
        #oc-loan-panel .oc-tab.active { background: rgba(42, 60, 255, 0.15); color: #2a3cff; box-shadow: inset 0 0 0 1px rgba(42, 60, 255, 0.3); }
        #oc-loan-panel .oc-tab:hover:not(.active) { background: var(--oc-tab-hover); color: var(--oc-text); }
        #oc-content { padding: 16px; overflow-y: auto; overflow-x: hidden; flex: 1; scrollbar-width: thin; scrollbar-color: var(--oc-scrollbar) transparent; }
        #oc-content::-webkit-scrollbar { width: 4px; }
        #oc-content::-webkit-scrollbar-thumb { background: var(--oc-scrollbar); border-radius: 2px; }
        .oc-card { background: var(--oc-card-bg); border: 1px solid var(--oc-card-border); border-radius: 12px; padding: 12px; margin-bottom: 12px; transition: transform 0.2s ease, border-color 0.2s ease; }
        .oc-card:hover { border-color: rgba(42, 60, 255, 0.2); transform: translateY(-1px); }
        .oc-card-header { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: flex-start; }
        .oc-crime-name { font-weight: 700; font-size: 13.5px; color: var(--oc-card-title); flex: 1; padding-right: 8px; }
        .oc-pos-tag { font-size: 10px; padding: 2px 6px; background: rgba(0,0,0,0.05); border-radius: 4px; color: #888; text-transform: uppercase; }
        .oc-card-body { font-size: 12.5px; color: var(--oc-card-text); line-height: 1.5; }
        .oc-item-row, .oc-player-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
        .oc-label { color: #888; width: 45px; flex-shrink: 0; }
        .oc-value { color: var(--oc-text); }
        .oc-player-link { color: #2a3cff; text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .oc-action-btn { width: 100%; margin-top: 10px; padding: 10px; border-radius: 10px; border: none; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .btn-loan { background: #2a3cff; color: #fff; }
        .btn-loan:hover:not(:disabled) { background: #1a27b0; }
        .btn-retrieve { background: rgba(200, 60, 60, 0.1); color: #c33; border: 1px solid rgba(200, 60, 60, 0.2); }
        .btn-retrieve:hover:not(:disabled) { background: rgba(200, 60, 60, 0.2); }
        .btn-success { background: #1a7a1a !important; color: #fff !important; }
        .btn-warning { background: #b8860b !important; color: #fff !important; }
        .oc-status-bar { padding: 8px 16px; font-size: 10px; color: #888; background: var(--oc-status-bar); display: flex; justify-content: space-between; border-top: 1px solid var(--oc-border); }
        .settings-input { width:100%; padding:12px; border-radius:10px; background:var(--oc-input-bg); border:1px solid var(--oc-border); color:var(--oc-text); font-family:monospace; margin-bottom:12px; outline:none; }
        .theme-toggle-container { display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--oc-card-bg); border-radius: 12px; border: 1px solid var(--oc-card-border); margin-bottom: 16px; }
      `;
    };
    updateThemeCSS();
    document.head.appendChild(style);

    const apiStatusShort = inPDA ? 'PDA' : (getApiKey() ? 'Local' : 'None');
    panel.innerHTML = `
      <div class="oc-header"><span class="oc-title">OC Manager</span><span class="oc-close">&times;</span></div>
      <div class="oc-nav">
        <button class="oc-tab active" data-tab="missing">Missing</button>
        <button class="oc-tab" data-tab="unused">Unused</button>
        <button class="oc-tab" data-tab="payouts">Payouts</button>
        <button class="oc-tab" style="max-width:36px;" data-tab="settings">⚙</button>
      </div>
      <div id="oc-content"></div>
      <div class="oc-status-bar"><span>v2.3.10-pda</span><span>API: ${apiStatusShort}</span></div>
    `;

    document.body.appendChild(button);
    document.body.appendChild(panel);

    let isOpen = false;
    const positionPanel = () => {
      const btnRect = button.getBoundingClientRect();
      const panelW = 340, panelH = panel.offsetHeight || 400;
      let left = btnRect.right + 12, top = btnRect.top;
      if (left + panelW > window.innerWidth) left = btnRect.left - panelW - 12;
      if (left < 8) left = 8;
      if (top + panelH > window.innerHeight) top = window.innerHeight - panelH - 12;
      if (top < 8) top = 8;
      panel.style.left = left + 'px'; panel.style.top = top + 'px';
    };

    const openPanel = () => { positionPanel(); panel.style.opacity = '1'; panel.style.visibility = 'visible'; panel.style.transform = 'translateY(0) scale(1)'; isOpen = true; loadTab('missing'); };
    const closePanel = () => { panel.style.opacity = '0'; panel.style.transform = 'translateY(10px) scale(0.98)'; setTimeout(() => { if (!isOpen) panel.style.visibility = 'hidden'; }, 200); isOpen = false; };

    button.addEventListener('click', () => { if (!wasDragged) { isOpen ? closePanel() : openPanel(); } });
    panel.querySelector('.oc-close').onclick = closePanel;

    const loadTab = (tab) => {
      panel.querySelectorAll('.oc-tab').forEach(t => { t.classList.toggle('active', t.dataset.tab === tab); });
      if (tab === 'missing') loadMissingTab();
      else if (tab === 'unused') loadUnusedTab();
      else if (tab === 'payouts') loadPayoutsTab();
      else if (tab === 'settings') loadSettingsTab();
    };

    panel.querySelectorAll('.oc-tab').forEach(t => { t.onclick = () => loadTab(t.dataset.tab); });

    const loadMissingTab = async () => {
      const content = document.getElementById('oc-content');
      content.innerHTML = '<div style="text-align:center;color:#666;padding:40px;font-size:13px;">Loading OC data…</div>';
      try {
        await loadMembers();
        const missing = (await getMissingOCItems()).filter(m => !recentlyLoaned.get(String(m.userID))?.has(m.itemID));
        if (!missing.length) { content.innerHTML = '<div style="text-align:center;color:#4a4;padding:40px;font-size:14px;font-weight:600;">All OC items allocated ✓</div>'; return; }
        await resolveItemNames(missing.map(m => m.itemID));
        let html = '';
        for (const m of missing) {
          const itemName = getItemName(m.itemID) || `Item #${m.itemID}`;
          html += `
            <div class="oc-card">
              <div class="oc-card-header"><span class="oc-crime-name">${m.crimeName}</span><span class="oc-pos-tag">${m.position}</span></div>
              <div class="oc-card-body">
                <div class="oc-item-row"><span class="oc-label">Item</span><span class="oc-value" style="font-weight:600;">${itemName}</span></div>
                <div class="oc-player-row"><span class="oc-label">Player</span><a href="/profiles.php?XID=${m.userID}" class="oc-player-link">${m.userName}</a></div>
              </div>
              <button class="oc-action-btn btn-loan loan-btn" data-itemid="${m.itemID}" data-userid="${m.userID}" data-username="${m.userName}">Loan Item</button>
            </div>
          `;
        }
        content.innerHTML = html;
        content.querySelectorAll('.loan-btn').forEach(btn => {
          btn.onclick = async () => {
            if (btn.dataset.loaning === 'true' || btn.disabled) return;
            btn.dataset.loaning = 'true'; btn.disabled = true; btn.textContent = 'Refreshing…';
            const itemID = parseInt(btn.dataset.itemid, 10);
            const userID = parseInt(btn.dataset.userid, 10);
            const userName = btn.dataset.username;
            try {
              const armoryID = await prepareArmouryForItem(itemID);
              if (!armoryID) {
                btn.textContent = 'No stock'; btn.classList.add('btn-warning');
                setTimeout(() => { btn.dataset.loaning = 'false'; btn.disabled = false; btn.textContent = 'Loan Item'; btn.classList.remove('btn-warning'); }, 3000);
                return;
              }
              btn.textContent = 'Loaning…'; await loanPreparedItem({ userID, userName });
              btn.textContent = '✓ Loaned'; btn.classList.add('btn-success');
            } catch (e) { btn.textContent = '? Check'; btn.classList.add('btn-warning'); console.error('[OCLM] Loan error:', e); }
          };
        });
      } catch (e) { content.innerHTML = `<div style="text-align:center;color:#f66;padding:20px;">${e.isApiKeyError ? 'API key required' : 'Error: ' + e.message}</div>`; }
    };

    const loadUnusedTab = async () => {
      const content = document.getElementById('oc-content');
      content.innerHTML = '<div style="text-align:center;color:#666;padding:40px;font-size:13px;">Scanning armory…</div>';
      try {
        await loadMembers();
        const [armoryItems, neededByUser] = await Promise.all([fetchAllArmoryItems(), getAllOCItemRequirements()]);
        
        // Merge recently loaned items to avoid showing them as unused due to API lag
        recentlyLoaned.forEach((items, uid) => {
          if (!neededByUser.has(uid)) neededByUser.set(uid, new Set());
          items.forEach(iid => neededByUser.get(uid).add(iid));
        });

        const unused = [];
        const OC_ARMOUR_ITEM_IDS = new Set([348, 643, 644]); // Hazmat Suit, Construction Helmet, Welding Helmet
        
        for (const entry of armoryItems) {
          if (entry.armoryCategory === 'temporary') continue;
          if ((entry.armoryCategory === 'armor' || entry.armoryCategory === 'armour') && !OC_ARMOUR_ITEM_IDS.has(entry.itemID)) continue;
          
          if (entry.user && entry.user.userID) {
            const uid = String(entry.user.userID), iid = entry.itemID;
            const needed = neededByUser.get(uid);
            if (!needed || !needed.has(iid)) {
              unused.push({
                itemID: iid, itemName: entry.name || getItemName(iid) || `Item #${iid}`,
                armoryID: entry.armoryID, armoryCategory: entry.armoryCategory || 'utilities',
                userID: uid, userName: entry.user.userName || memberNameMap.get(uid) || `Unknown [${uid}]`
              });
            }
          }
        }
        if (!unused.length) { content.innerHTML = '<div style="text-align:center;color:#4a4;padding:40px;font-size:14px;font-weight:600;">No unused loaned items ✓</div>'; return; }
        let html = '<div style="margin-bottom:12px;font-size:12px;color:#888;text-align:center;">Loaned but not needed for any OC:</div>';
        for (const u of unused) {
          html += `
            <div class="oc-card">
              <div class="oc-card-body">
                <div class="oc-item-row"><span class="oc-label">Item</span><span class="oc-value" style="font-weight:600;">${u.itemName}</span></div>
                <div class="oc-player-row"><span class="oc-label">Player</span><a href="/profiles.php?XID=${u.userID}" class="oc-player-link">${u.userName}</a></div>
              </div>
              <button class="oc-action-btn btn-retrieve retrieve-btn" data-armoryid="${u.armoryID}" data-itemid="${u.itemID}" data-userid="${u.userID}" data-username="${u.userName}" data-category="${u.armoryCategory}">Retrieve Item</button>
            </div>
          `;
        }
        content.innerHTML = html;
        content.querySelectorAll('.retrieve-btn').forEach(btn => {
          btn.onclick = async () => {
            if (btn.dataset.retrieving === 'true' || btn.disabled) return;
            btn.dataset.retrieving = 'true'; btn.disabled = true; btn.textContent = 'Retrieving…';
            try {
              const postType = ARMORY_TAB_TO_POST_TYPE[btn.dataset.category] || 'Tool';
              await retrieveItem({ armoryID: parseInt(btn.dataset.armoryid, 10), itemID: parseInt(btn.dataset.itemid, 10), userID: parseInt(btn.dataset.userid, 10), userName: btn.dataset.username, postType });
              btn.textContent = '✓ Retrieved'; btn.classList.add('btn-success');
            } catch (e) { btn.textContent = 'Error'; btn.classList.add('btn-warning'); btn.disabled = false; btn.dataset.retrieving = 'false'; }
          };
        });
      } catch (e) { content.innerHTML = `<div style="text-align:center;color:#f66;padding:20px;">Error: ${e.message}</div>`; }
    };

    const loadPayoutsTab = async () => {
      const content = document.getElementById('oc-content');
      content.innerHTML = '<div style="text-align:center;color:#666;padding:40px;font-size:13px;">Checking completions…</div>';
      try {
        const unpaid = await getUnpaidCompletedCrimes();
        if (!unpaid.length) { content.innerHTML = '<div style="text-align:center;color:#4a4;padding:40px;font-size:14px;font-weight:600;">All OCs paid out ✓</div>'; return; }
        let totalMoney = 0, items = 0;
        unpaid.forEach(c => { totalMoney += c.money; if (c.hasItems) items++; });
        let html = `
          <div style="background:rgba(42,60,255,0.1); border-radius:12px; padding:14px; margin-bottom:16px; border:1px solid rgba(42,60,255,0.2);">
            <div style="font-size:11px; color:#2a3cff; text-transform:uppercase; font-weight:700; margin-bottom:4px; letter-spacing:0.5px;">Summary</div>
            ${totalMoney > 0 ? `<div style="font-size:18px; font-weight:800;">$${formatNumber(totalMoney)}</div>` : ''}
            <div style="font-size:12px; color:#888;">${unpaid.length} Unpaid OCs ${items > 0 ? `• ${items} with Items` : ''}</div>
            <a href="https://www.torn.com/factions.php?step=your#/tab=crimes&subTab=completed" target="_blank" rel="noopener noreferrer" 
               style="display:block; margin-top:12px; padding:10px; background:#2a3cff; color:#fff; text-align:center; border-radius:8px; text-decoration:none; font-weight:700; font-size:13px; box-shadow:0 4px 10px rgba(42,60,255,0.3);">Open Payouts Page</a>
          </div>
        `;
        for (const c of unpaid) {
          const ageSec = Math.floor(Date.now() / 1000) - c.executedAt;
          const ageDays = Math.floor(ageSec / 86400);
          const ageColor = ageDays >= 7 ? '#f66' : (ageDays >= 3 ? '#b8860b' : '#888');
          html += `
            <a href="https://www.torn.com/factions.php?step=your#/tab=crimes&subTab=completed" target="_blank" rel="noopener noreferrer" style="text-decoration:none; color:inherit; display:block;">
              <div class="oc-card" style="padding:10px 12px;">
                <div class="oc-card-header"><span class="oc-crime-name" style="font-size:12.5px;">${c.name}</span><span style="font-size:11px; font-weight:700; color:${ageColor};">${ageDays > 0 ? ageDays+'d' : Math.floor(ageSec/3600)+'h'}</span></div>
                <div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:13px; color:#1a7a1a; font-weight:700;">${c.money > 0 ? '$' + formatNumber(c.money) : ''}</span><span style="font-size:11px; color:#888;">${c.hasItems ? '<span style="color:#2a3cff;">Items</span>' : ''}${c.payoutPct ? ` ${c.payoutPct}%` : ''}</span></div>
              </div>
            </a>
          `;
        }
        content.innerHTML = html;
      } catch (e) { content.innerHTML = `<div style="text-align:center;color:#f66;padding:20px;">Error: ${e.message}</div>`; }
    };

    const loadSettingsTab = () => {
      const content = document.getElementById('oc-content');
      const overrideKey = storage.get('OCLM_API_KEY', '');
      const activeKey = overrideKey || (inPDA ? apiKey : '');
      const masked = activeKey ? activeKey.slice(0, 4) + '…' + activeKey.slice(-4) : 'None';
      const isLight = storage.get('OCLM_THEME', 'dark') === 'light';

      content.innerHTML = `
        <div style="font-weight:700; margin-bottom:12px; font-size:15px;">Appearance</div>
        <div class="theme-toggle-container">
          <span style="font-size:13px; font-weight:600;">Light Mode</span>
          <input type="checkbox" id="theme-toggle" ${isLight ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
        </div>

        <div style="font-weight:700; margin-bottom:12px; font-size:15px; margin-top:20px;">API Settings</div>
        <div class="oc-card">
          <div style="font-size:11px; color:#888; text-transform:uppercase; margin-bottom:6px;">Current Key</div>
          <div style="font-family:monospace; color:#2a3cff; font-size:14px; margin-bottom:4px;">${masked}</div>
          <div style="font-size:10px; color:#888;">Source: ${overrideKey ? 'Override' : (inPDA ? 'PDA' : 'Not set')}</div>
        </div>
        <div style="font-size:12px; color:#888; margin-bottom:6px;">New Override Key</div>
        <input id="settings-key" type="text" placeholder="Paste Torn API Key" class="settings-input">
        <div style="display:flex; gap:10px;"><button id="settings-save" class="oc-action-btn btn-loan" style="margin-top:0;">Save</button><button id="settings-clear" class="oc-action-btn btn-retrieve" style="margin-top:0;">Clear</button></div>
      `;

      document.getElementById('theme-toggle').onchange = (e) => {
        storage.set('OCLM_THEME', e.target.checked ? 'light' : 'dark');
        updateThemeCSS();
        loadSettingsTab();
      };
      document.getElementById('settings-save').onclick = () => { const val = document.getElementById('settings-key').value.trim(); if (val) { storage.set('OCLM_API_KEY', val); alert('Key saved!'); loadSettingsTab(); } };
      document.getElementById('settings-clear').onclick = () => { storage.set('OCLM_API_KEY', ''); alert('Override cleared.'); loadSettingsTab(); };
    };

    document.addEventListener('click', (e) => { if (isOpen && !panel.contains(e.target) && !button.contains(e.target)) closePanel(); });
  };

  createUI();
})();
