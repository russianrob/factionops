// ==UserScript==
// @name         Stakeout
// @namespace    RussianRob
// @version      1.0.1
// @description  Stake out players and factions with status alerts (online, hospital, landing, life, chain, war...) — forked from TornTools
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-stakeout.user.js
// @updateURL    https://tornwar.com/scripts/torn-stakeout.user.js
// ==/UserScript==
(function () {
  'use strict';
  var SCRIPT_VERSION = '1.0.1';

  function hoursSince(tsSec, nowMs) {
    return (nowMs / 1000 - tsSec) / 3600;
  }

  function evaluatePlayer(old, snap, alerts, nowMs) {
    if (!old) return [];
    var fired = [];
    if (alerts.landing && old.state === 'Traveling' && snap.state !== 'Traveling') fired.push('landing');
    if (alerts.okay && snap.state === 'Okay' && old.state !== 'Okay') fired.push('okay');
    if (alerts.hospital && snap.state === 'Hospital' && old.state !== 'Hospital') fired.push('hospital');
    if (alerts.online && snap.lastAction === 'Online' && old.lastAction !== 'Online') fired.push('online');
    if (alerts.life !== false) {
      var thr = snap.lifeMax * (alerts.life / 100);
      var oThr = old.lifeMax * (alerts.life / 100);
      if (snap.lifeCur <= thr && !(old.lifeCur <= oThr)) fired.push('life');
    }
    if (alerts.offline !== false) {
      if (hoursSince(snap.lastActionTs, nowMs) >= alerts.offline && hoursSince(old.lastActionTs, nowMs) < alerts.offline) fired.push('offline');
    }
    if (alerts.revivable && snap.revivable && !old.revivable) fired.push('revivable');
    return fired;
  }

  function evaluateFaction(old, snap, alerts) {
    if (!old) return [];
    var fired = [];
    if (alerts.chainReaches !== false) {
      if (alerts.chainReaches === 0) {
        if (old.chain >= 10 && snap.chain < old.chain) fired.push('chainReaches');
      } else if (snap.chain >= alerts.chainReaches && old.chain < alerts.chainReaches) {
        fired.push('chainReaches');
      }
    }
    if (alerts.memberCountDrops !== false && snap.membersCur < alerts.memberCountDrops && !(old.membersCur < alerts.memberCountDrops)) fired.push('memberCountDrops');
    if (alerts.rankedWarStarts && snap.rankedWar && !old.rankedWar) fired.push('rankedWarStarts');
    if (alerts.inRaid && snap.raid && !old.raid) fired.push('inRaid');
    if (alerts.inTerritoryWar && snap.territoryWar && !old.territoryWar) fired.push('inTerritoryWar');
    return fired;
  }

  function mapPlayerResponse(j) {
    var p = (j && j.profile) ? j.profile : (j || {});
    return {
      name: p.name,
      state: p.status ? p.status.state : '',
      description: p.status ? (p.status.description || '') : '',
      lastAction: p.last_action ? p.last_action.status : '',
      lastActionTs: p.last_action ? p.last_action.timestamp : 0,
      lifeCur: p.life ? p.life.current : 0,
      lifeMax: p.life ? p.life.maximum : 0,
      revivable: !!p.revivable
    };
  }

  function mapFactionResponse(j) {
    var basic = j.basic || {};
    var chain = j.chain || {};
    var wars = j.wars || {};
    return {
      name: basic.name != null ? basic.name : (j.name || ''),
      chain: chain.current != null ? chain.current : 0,
      respect: basic.respect != null ? basic.respect : 0,
      membersCur: basic.members != null ? basic.members : 0,
      membersMax: basic.capacity != null ? basic.capacity : 0,
      rankedWar: !!(wars.ranked),
      raid: Array.isArray(wars.raids) ? wars.raids.length > 0 : false,
      territoryWar: Array.isArray(wars.territory) ? wars.territory.length > 0 : false
    };
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = { hoursSince: hoursSince, evaluatePlayer: evaluatePlayer, evaluateFaction: evaluateFaction, mapPlayerResponse: mapPlayerResponse, mapFactionResponse: mapFactionResponse };
    return;
  }

  var PLAYERS_KEY = 'stakeout_players';
  var FACTIONS_KEY = 'stakeout_factions';
  var SETTINGS_KEY = 'stakeout_settings';
  var DEFAULT_SETTINGS = { apiKey: '', pollSeconds: 30, sound: true, panelOpen: false, panelPos: null };

  function gmGet(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') {
        var v = GM_getValue(key, null);
        if (v == null) return fallback;
        return typeof v === 'string' ? JSON.parse(v) : v;
      }
      var ls = localStorage.getItem(key);
      return ls == null ? fallback : JSON.parse(ls);
    } catch (_) { return fallback; }
  }
  function gmSet(key, val) {
    try {
      var s = JSON.stringify(val);
      if (typeof GM_setValue === 'function') GM_setValue(key, s);
      else localStorage.setItem(key, s);
    } catch (_) {}
  }
  function getPlayers() { var a = gmGet(PLAYERS_KEY, []); return Array.isArray(a) ? a : []; }
  function setPlayers(a) { gmSet(PLAYERS_KEY, a); }
  function getFactions() { var a = gmGet(FACTIONS_KEY, []); return Array.isArray(a) ? a : []; }
  function setFactions(a) { gmSet(FACTIONS_KEY, a); }
  function getSettings() {
    var s = gmGet(SETTINGS_KEY, null);
    if (!s || typeof s !== 'object') return Object.assign({}, DEFAULT_SETTINGS);
    return Object.assign({}, DEFAULT_SETTINGS, s);
  }
  function setSettings(s) { gmSet(SETTINGS_KEY, s); }

  function apiFetch(section, id, selections, cb) {
    var settings = getSettings();
    if (!settings.apiKey) { cb(new Error('no api key')); return; }
    var url = 'https://api.torn.com/v2/' + section + '/' + id + '?selections=' + selections.join(',');
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({
        method: 'GET', url: url,
        headers: { 'Authorization': 'ApiKey ' + settings.apiKey, 'Accept': 'application/json' },
        onload: function (r) {
          try {
            var d = JSON.parse(r.responseText);
            if (d.error) { cb(new Error('api ' + d.error.code + ': ' + d.error.error)); return; }
            cb(null, d);
          } catch (e) { cb(e); }
        },
        onerror: function () { cb(new Error('network error')); }
      });
    } else { cb(new Error('GM_xmlhttpRequest unavailable')); }
  }

  var polling = false;
  function pollOnce() {
    if (polling) return;
    polling = true;
    var nowMs = Date.now();
    var players = getPlayers();
    var factions = getFactions();
    var queue = [];
    players.forEach(function (p, i) { queue.push({ kind: 'player', rec: p, idx: i }); });
    factions.forEach(function (f, i) { queue.push({ kind: 'faction', rec: f, idx: i }); });
    var qi = 0;
    function next() {
      if (qi >= queue.length) { polling = false; return; }
      var job = queue[qi++];
      if (job.kind === 'player') {
        apiFetch('user', job.rec.id, ['profile'], function (err, d) {
          if (!err && d) {
            var snap = mapPlayerResponse(d);
            var fired = evaluatePlayer(job.rec.info, snap, job.rec.alerts, nowMs);
            job.rec.info = snap;
            var arr = getPlayers(); if (arr[job.idx] && arr[job.idx].id === job.rec.id) { arr[job.idx].info = snap; setPlayers(arr); }
            fired.forEach(function (a) { notifyPlayer(job.rec, snap, a); });
            renderPanel();
          }
          next();
        });
      } else {
        apiFetch('faction', job.rec.id, ['basic', 'chain', 'wars'], function (err, d) {
          if (!err && d) {
            var snap = mapFactionResponse(d);
            var fired = evaluateFaction(job.rec.info, snap, job.rec.alerts);
            job.rec.info = snap;
            var arr = getFactions(); if (arr[job.idx] && arr[job.idx].id === job.rec.id) { arr[job.idx].info = snap; setFactions(arr); }
            fired.forEach(function (a) { notifyFaction(job.rec, snap, a); });
            renderPanel();
          }
          next();
        });
      }
    }
    next();
  }

  var pollTimer = null;
  function restartPolling() {
    if (pollTimer) clearInterval(pollTimer);
    var secs = getSettings().pollSeconds || 30;
    pollTimer = setInterval(pollOnce, Math.max(10, secs) * 1000);
  }

  var PLAYER_MSG = {
    okay: 'is now OKAY', hospital: 'is in hospital', landing: 'has landed', online: 'is now online',
    life: 'life dropped below threshold', offline: 'has been offline a while', revivable: 'is now revivable'
  };
  var FACTION_MSG = {
    chainReaches: 'chain alert', memberCountDrops: 'member count dropped',
    rankedWarStarts: 'ranked war started', inRaid: 'is in a raid', inTerritoryWar: 'is in a territory war'
  };

  function playPing() {
    if (!getSettings().sound) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.07;
      o.start(); o.stop(ctx.currentTime + 0.18);
    } catch (_) {}
  }

  function showToast(text, href) {
    var t = document.createElement('div');
    t.className = 'stk-toast';
    t.textContent = '📍 ' + text;
    t.onclick = function () { if (href) window.open(href, '_blank'); t.remove(); };
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('stk-toast-in'); }, 20);
    setTimeout(function () { t.classList.remove('stk-toast-in'); setTimeout(function () { t.remove(); }, 400); }, 8000);
  }

  function notify(text, href) {
    showToast(text, href);
    playPing();
    try {
      if (typeof GM_notification === 'function') {
        GM_notification({ title: 'Stakeout', text: text, onclick: function () { if (href) window.open(href, '_blank'); } });
      }
    } catch (_) {}
  }

  function notifyPlayer(rec, snap, alert) {
    var who = (rec.label || snap.name || ('Player ' + rec.id)) + ' [' + rec.id + ']';
    notify(who + ' ' + (PLAYER_MSG[alert] || alert), 'https://www.torn.com/profiles.php?XID=' + rec.id);
  }
  function notifyFaction(rec, snap, alert) {
    var who = (snap.name || ('Faction ' + rec.id)) + ' [' + rec.id + ']';
    var extra = alert === 'chainReaches' ? (' (chain ' + snap.chain + ')') : '';
    notify(who + ' ' + (FACTION_MSG[alert] || alert) + extra, 'https://www.torn.com/factions.php?step=profile&ID=' + rec.id);
  }

  function injectStyles() {
    if (document.getElementById('stk-styles')) return;
    var s = document.createElement('style');
    s.id = 'stk-styles';
    s.textContent = [
      '.stk-toast{position:fixed;right:16px;bottom:80px;z-index:2147483647;max-width:300px;background:#1b1f2a;color:#e6e8ee;border:1px solid #2a3447;border-left:3px solid #6ee7b7;border-radius:8px;padding:10px 12px;font:600 13px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.5);opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s;cursor:pointer;}',
      '.stk-toast-in{opacity:1;transform:translateY(0);}',
      '#stk-fab{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:44px;height:44px;border-radius:50%;background:#1b1f2a;border:1px solid #2a3447;color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.5);}',
      '#stk-panel{position:fixed;right:16px;bottom:70px;z-index:2147483646;width:320px;max-height:70vh;overflow:auto;background:#10141c;border:1px solid #2a3447;border-radius:10px;color:#e6e8ee;font:13px system-ui,sans-serif;padding:10px;box-shadow:0 8px 24px rgba(0,0,0,.6);display:none;}',
      '#stk-panel.stk-open{display:block;}',
      '.stk-row{border-bottom:1px solid #1c2330;padding:6px 2px;}',
      '.stk-row .stk-name{font-weight:600;}',
      '.stk-status{font-size:11px;color:#9aa3b2;}',
      '.stk-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle;}',
      '.stk-on{background:#6ee7b7;} .stk-off{background:#6b7280;} .stk-hosp{background:#e64d1a;}',
      '.stk-btn{background:#2a3447;color:#e6e8ee;border:0;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:12px;}',
      '.stk-input{background:#0a0d14;border:1px solid #2a3447;color:#e6e8ee;border-radius:5px;padding:4px 6px;width:100%;box-sizing:border-box;}',
      '.stk-alerts label{display:inline-block;margin:2px 6px 2px 0;font-size:11px;color:#cdd3e0;}',
      '.stk-sec{margin:8px 0 4px;font-weight:700;color:#9aa3b2;font-size:11px;text-transform:uppercase;}'
    ].join('');
    document.head.appendChild(s);
  }

  function ensurePanel() {
    injectStyles();
    if (!document.getElementById('stk-fab')) {
      var fab = document.createElement('div');
      fab.id = 'stk-fab'; fab.textContent = '📍';
      fab.onclick = function () {
        var p = document.getElementById('stk-panel');
        p.classList.toggle('stk-open');
        var st = getSettings(); st.panelOpen = p.classList.contains('stk-open'); setSettings(st);
        if (st.panelOpen) renderPanel();
      };
      document.body.appendChild(fab);
    }
    if (!document.getElementById('stk-panel')) {
      var panel = document.createElement('div');
      panel.id = 'stk-panel';
      document.body.appendChild(panel);
      if (getSettings().panelOpen) panel.classList.add('stk-open');
    }
  }

  function defaultPlayerAlerts() { return { okay: false, hospital: true, landing: true, online: true, life: false, offline: false, revivable: false }; }
  function defaultFactionAlerts() { return { chainReaches: false, memberCountDrops: false, rankedWarStarts: true, inRaid: false, inTerritoryWar: false }; }

  function addTarget(rawId, kind) {
    var id = parseInt(String(rawId).replace(/[^0-9]/g, ''), 10);
    if (!id) return;
    if (kind === 'player') {
      var ps = getPlayers();
      if (ps.some(function (p) { return p.id === id; })) return;
      ps.push({ id: id, order: Date.now(), label: '', info: null, alerts: defaultPlayerAlerts() });
      setPlayers(ps);
    } else {
      var fs = getFactions();
      if (fs.some(function (f) { return f.id === id; })) return;
      fs.push({ id: id, order: Date.now(), info: null, alerts: defaultFactionAlerts() });
      setFactions(fs);
    }
    renderPanel();
    pollOnce();
  }

  function removePlayer(id) { setPlayers(getPlayers().filter(function (p) { return p.id !== id; })); renderPanel(); }
  function removeFaction(id) { setFactions(getFactions().filter(function (f) { return f.id !== id; })); renderPanel(); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function dot(snap) {
    if (!snap) return '<span class="stk-dot stk-off"></span>';
    if (snap.state === 'Hospital') return '<span class="stk-dot stk-hosp"></span>';
    if (snap.lastAction === 'Online') return '<span class="stk-dot stk-on"></span>';
    return '<span class="stk-dot stk-off"></span>';
  }

  function cbx(id, key, checked, label) {
    return '<label><input type="checkbox" data-akey="' + key + '" data-id="' + id + '"' + (checked ? ' checked' : '') + '> ' + label + '</label>';
  }
  function numx(id, key, val, label, ph) {
    return '<label>' + label + ' <input class="stk-input" data-anum="' + key + '" data-id="' + id + '" value="' + (val === false ? '' : val) + '" placeholder="' + ph + '" style="width:48px;display:inline;"></label>';
  }
  function playerAlertCheckboxes(p) {
    var a = p.alerts;
    return cbx(p.id, 'okay', a.okay, 'okay') + cbx(p.id, 'hospital', a.hospital, 'hosp') +
      cbx(p.id, 'landing', a.landing, 'land') + cbx(p.id, 'online', a.online, 'online') +
      cbx(p.id, 'revivable', a.revivable, 'reviv') +
      numx(p.id, 'life', a.life, 'life<', '%') + numx(p.id, 'offline', a.offline, 'off≥', 'h');
  }
  function factionAlertCheckboxes(f) {
    var a = f.alerts;
    return cbx(f.id, 'rankedWarStarts', a.rankedWarStarts, 'war') + cbx(f.id, 'inRaid', a.inRaid, 'raid') +
      cbx(f.id, 'inTerritoryWar', a.inTerritoryWar, 'terr') +
      numx(f.id, 'chainReaches', a.chainReaches, 'chain≥', 'N/0') + numx(f.id, 'memberCountDrops', a.memberCountDrops, 'mem<', 'N');
  }

  function updateAlert(kind, id, key, value) {
    if (kind === 'player') {
      var ps = getPlayers(); ps.forEach(function (p) { if (p.id === id) p.alerts[key] = value; }); setPlayers(ps);
    } else {
      var fs = getFactions(); fs.forEach(function (f) { if (f.id === id) f.alerts[key] = value; }); setFactions(fs);
    }
  }

  function renderPanel() {
    var panel = document.getElementById('stk-panel');
    if (!panel || !panel.classList.contains('stk-open')) return;
    if (panel.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    var s = getSettings();
    var players = getPlayers(), factions = getFactions();
    var calls = players.length + factions.length;
    var rate = s.pollSeconds ? Math.round(calls / s.pollSeconds * 60) : 0;
    var html = '';
    html += '<div class="stk-sec">Players</div>';
    players.forEach(function (p) {
      var info = p.info;
      html += '<div class="stk-row" data-pid="' + p.id + '">' +
        dot(info) + '<span class="stk-name">' + esc(p.label || (info && info.name) || p.id) + ' [' + p.id + ']</span> ' +
        '<button class="stk-btn stk-del-p" data-id="' + p.id + '">✕</button>' +
        '<div class="stk-status">' + (info ? (info.state + (info.lifeMax ? ' · life ' + Math.round(info.lifeCur / info.lifeMax * 100) + '%' : '')) : 'pending…') + '</div>' +
        '<div class="stk-alerts" data-pid="' + p.id + '">' + playerAlertCheckboxes(p) + '</div>' +
        '</div>';
    });
    html += '<div style="margin:6px 0;"><input class="stk-input" id="stk-add-p" placeholder="Add player ID"></div>';
    html += '<div class="stk-sec">Factions</div>';
    factions.forEach(function (f) {
      var info = f.info;
      html += '<div class="stk-row" data-fid="' + f.id + '">' +
        '<span class="stk-name">' + esc((info && info.name) || f.id) + ' [' + f.id + ']</span> ' +
        '<button class="stk-btn stk-del-f" data-id="' + f.id + '">✕</button>' +
        '<div class="stk-status">' + (info ? ('chain ' + info.chain + ' · members ' + info.membersCur + '/' + info.membersMax) : 'pending…') + '</div>' +
        '<div class="stk-alerts" data-fid="' + f.id + '">' + factionAlertCheckboxes(f) + '</div>' +
        '</div>';
    });
    html += '<div style="margin:6px 0;"><input class="stk-input" id="stk-add-f" placeholder="Add faction ID"></div>';
    html += '<div class="stk-sec">Settings</div>';
    html += '<div>API key <input class="stk-input" id="stk-key" value="' + (s.apiKey ? '••••••••' : '') + '" placeholder="Torn API key"></div>';
    html += '<div style="margin-top:4px;">Poll secs <input class="stk-input" id="stk-poll" value="' + s.pollSeconds + '" style="width:70px;display:inline;"> ' +
      '<label><input type="checkbox" id="stk-sound"' + (s.sound ? ' checked' : '') + '> sound</label></div>';
    html += '<div class="stk-status" style="margin-top:4px;">~' + rate + ' API calls/min</div>';
    panel.innerHTML = html;
    wirePanel(panel);
  }

  function wirePanel(panel) {
    panel.querySelectorAll('.stk-del-p').forEach(function (b) { b.onclick = function () { removePlayer(parseInt(b.getAttribute('data-id'), 10)); }; });
    panel.querySelectorAll('.stk-del-f').forEach(function (b) { b.onclick = function () { removeFaction(parseInt(b.getAttribute('data-id'), 10)); }; });
    panel.querySelectorAll('input[data-akey]').forEach(function (el) {
      el.onchange = function () {
        var kind = el.closest('[data-pid]') ? 'player' : 'faction';
        updateAlert(kind, parseInt(el.getAttribute('data-id'), 10), el.getAttribute('data-akey'), el.checked);
      };
    });
    panel.querySelectorAll('input[data-anum]').forEach(function (el) {
      el.onchange = function () {
        var kind = el.closest('[data-pid]') ? 'player' : 'faction';
        var v = el.value.trim();
        var parsed = v === '' ? false : parseInt(v.replace(/[^0-9]/g, ''), 10);
        if (parsed !== false && isNaN(parsed)) parsed = false;
        updateAlert(kind, parseInt(el.getAttribute('data-id'), 10), el.getAttribute('data-anum'), parsed);
      };
    });
    var addP = panel.querySelector('#stk-add-p');
    if (addP) addP.onkeydown = function (e) { if (e.key === 'Enter') addTarget(addP.value, 'player'); };
    var addF = panel.querySelector('#stk-add-f');
    if (addF) addF.onkeydown = function (e) { if (e.key === 'Enter') addTarget(addF.value, 'faction'); };
    var keyEl = panel.querySelector('#stk-key');
    if (keyEl) keyEl.onchange = function () { if (keyEl.value && keyEl.value.indexOf('•') === -1) { var s = getSettings(); s.apiKey = keyEl.value.trim(); setSettings(s); pollOnce(); } };
    var pollEl = panel.querySelector('#stk-poll');
    if (pollEl) pollEl.onchange = function () { var s = getSettings(); s.pollSeconds = Math.max(10, parseInt(pollEl.value, 10) || 30); setSettings(s); restartPolling(); };
    var soundEl = panel.querySelector('#stk-sound');
    if (soundEl) soundEl.onchange = function () { var s = getSettings(); s.sound = soundEl.checked; setSettings(s); };
  }

  function currentProfileXid() {
    var m = location.search.match(/[?&]XID=(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }
  function currentFactionId() {
    var m = location.search.match(/[?&]ID=(\d+)/i);
    return (/factions\.php/i.test(location.pathname) && /step=profile/i.test(location.href) && m) ? parseInt(m[1], 10) : null;
  }
  function injectQuickAdd() {
    var xid = currentProfileXid();
    var fid = currentFactionId();
    if (!xid && !fid) return;
    if (document.getElementById('stk-quick')) return;
    var anchor = document.querySelector('.content-title, [class*="titleContainer"], h4');
    if (!anchor) return;
    var btn = document.createElement('button');
    btn.id = 'stk-quick';
    btn.className = 'stk-btn';
    btn.style.cssText = 'margin-left:8px;';
    function refresh() {
      if (xid) {
        var on = getPlayers().some(function (p) { return p.id === xid; });
        btn.textContent = on ? '📍 Staking out' : '📍 Stakeout';
      } else {
        var onf = getFactions().some(function (f) { return f.id === fid; });
        btn.textContent = onf ? '📍 Staking out' : '📍 Stakeout faction';
      }
    }
    btn.onclick = function () {
      if (xid) {
        if (getPlayers().some(function (p) { return p.id === xid; })) removePlayer(xid);
        else addTarget(xid, 'player');
      } else {
        if (getFactions().some(function (f) { return f.id === fid; })) removeFaction(fid);
        else addTarget(fid, 'faction');
      }
      refresh();
    };
    refresh();
    anchor.appendChild(btn);
  }

  function boot() {
    ensurePanel();
    injectQuickAdd();
    if (getSettings().panelOpen) renderPanel();
    restartPolling();
    pollOnce();
    var mo = new MutationObserver(function () { injectQuickAdd(); });
    mo.observe(document.body, { childList: true, subtree: true });
    try { if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Stakeout: open panel', function () { var p = document.getElementById('stk-panel'); if (p) { p.classList.add('stk-open'); renderPanel(); } }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
